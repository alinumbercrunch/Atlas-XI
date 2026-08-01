// Authoritative club -> league mapping from Transfermarkt competition pages.
// Player clubs come from Transfermarkt too, so matching by (normalized) name is
// reliable and lets us label a player by his CURRENT club's league even before he
// has logged any minutes there (e.g. a just-loaned player). Botola is intentionally
// omitted (its clubs are covered by match-derived mapping in the rate step).
const { fetchWithHeaders } = require("../../lib/fetchWithHeaders");
const { parseHtml } = require("../../lib/parseHtml");
const { getDb, initSchema } = require("../../db");

const SEASON = 2025; // 2025/26
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Our league slug -> Transfermarkt competition code.
const COMPETITION_CODES = {
  "eng-1": "GB1",
  "esp-1": "ES1",
  "ger-1": "L1",
  "ita-1": "IT1",
  "fra-1": "FR1",
  "por-1": "PO1",
  "ned-1": "NL1",
  "bel-1": "BE1",
  "eng-2": "GB2",
  "ger-2": "L2",
  "ita-2": "IT2",
  "esp-2": "ES2",
  "fra-2": "FR2",
  "sco-1": "SC1",
  "ned-2": "NL2",
};

function normalizeClub(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Parse the club names from a TM competition "startseite" page (first items table).
function parseLeagueClubs(html) {
  const $ = parseHtml(html);
  return [
    ...new Set(
      $("table.items")
        .first()
        .find('a[href*="/startseite/verein/"]')
        .map((i, el) => $(el).text().trim())
        .get()
        .filter(Boolean),
    ),
  ];
}

async function fetchLeagueClubs(
  code,
  { fetchImpl = fetchWithHeaders, season = SEASON, retries = 3, backoff = 1000 } = {},
) {
  const url = `https://www.transfermarkt.com/x/startseite/wettbewerb/${code}/plus/?saison_id=${season}`;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return parseLeagueClubs(await fetchImpl(url));
    } catch (err) {
      lastErr = err; // TM occasionally 502s; retry with backoff
      if (attempt < retries) await sleep(backoff * attempt);
    }
  }
  throw lastErr;
}

// Build a Map(clubName -> leagueSlug). A league that keeps failing is skipped (its
// clubs fall back to match-derived mapping) rather than aborting the whole run.
async function buildClubLeagueMap({
  fetchImpl = fetchWithHeaders,
  season = SEASON,
  delay = 500,
  onProgress,
} = {}) {
  const map = new Map();
  const failed = [];
  for (const [slug, code] of Object.entries(COMPETITION_CODES)) {
    try {
      const clubs = await fetchLeagueClubs(code, { fetchImpl, season });
      for (const name of clubs) map.set(name, slug);
      if (onProgress) onProgress(slug, clubs.length);
    } catch (err) {
      failed.push(slug);
      console.warn(`[clubs]   ! ${slug} (${code}) failed: ${String(err.message).split("\n")[0]}`);
    }
    if (delay) await sleep(delay);
  }
  if (failed.length) console.warn(`[clubs] skipped leagues: ${failed.join(", ")}`);
  return map;
}

// Set clubs.league_id by matching club names (normalized) to the TM map.
function applyClubLeagues(db, map) {
  const normMap = new Map();
  for (const [name, slug] of map) normMap.set(normalizeClub(name), slug);
  const clubs = db.prepare("SELECT id, name FROM clubs").all();
  const upd = db.prepare("UPDATE clubs SET league_id = ? WHERE id = ?");
  let updated = 0;
  db.transaction(() => {
    for (const c of clubs) {
      const slug = normMap.get(normalizeClub(c.name));
      if (slug) {
        upd.run(slug, c.id);
        updated++;
      }
    }
  })();
  return updated;
}

async function run() {
  const db = initSchema(getDb());
  console.log("[clubs] fetching league club lists from Transfermarkt…");
  const map = await buildClubLeagueMap({
    onProgress: (slug, n) => console.log(`[clubs]   ${slug}: ${n} clubs`),
  });
  const updated = applyClubLeagues(db, map);
  console.log(`[clubs] ${map.size} club names mapped -> ${updated} club rows updated`);
  db.close();
  return { clubs: map.size, updated };
}

module.exports = {
  COMPETITION_CODES,
  parseLeagueClubs,
  fetchLeagueClubs,
  buildClubLeagueMap,
  applyClubLeagues,
  normalizeClub,
};

if (require.main === module) {
  run().catch((e) => {
    console.error("[clubs] fatal:", e);
    process.exit(1);
  });
}

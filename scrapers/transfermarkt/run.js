// Phase 2 orchestrator: discover Moroccan-eligible candidates on Transfermarkt,
// enrich each profile, classify eligibility (honoring overrides), and upsert to SQLite.
//
// Usage:  node scrapers/transfermarkt/run.js
//   env MAXPAGES=N  limit discovery pages (25 players/page; default all ~20)
//   env LIMIT=N     limit how many candidates to enrich (default all)
const { getDb, initSchema } = require("../../db");
const { seed } = require("../../db/seed");
const { TransfermarktClient } = require("./client");
const { discoverByNation, MOROCCO_LAND_ID } = require("./discover");
const { classifyEligibility } = require("./eligibility");
const { ingestPlayer } = require("./ingest");

function loadOverrides(db) {
  const map = new Map();
  const rows = db
    .prepare("SELECT transfermarkt_id, action FROM overrides WHERE transfermarkt_id IS NOT NULL")
    .all();
  for (const r of rows) map.set(String(r.transfermarkt_id), { action: r.action });
  return map;
}

async function run({ maxPages = Infinity, limit = Infinity, db = null } = {}) {
  const ownsDb = !db;
  db = db || initSchema(getDb());
  seed(db); // ensure leagues/season are present
  const client = new TransfermarktClient();
  const overrides = loadOverrides(db);

  console.log("[tm] discovering Moroccan-eligible candidates…");
  let stubs = await discoverByNation(client, {
    landId: MOROCCO_LAND_ID,
    maxPages,
    onProgress: (p, last, n) => console.log(`[tm]   page ${p}/${last} — ${n} candidates`),
  });
  if (stubs.length > limit) stubs = stubs.slice(0, limit);

  console.log(`[tm] enriching ${stubs.length} candidates…`);
  const counts = { eligible: 0, review: 0, excluded: 0, failed: 0 };
  let done = 0;
  for (const stub of stubs) {
    try {
      const profile = await client.fetchProfile(stub.slug, stub.tmId);
      const eligibility = classifyEligibility({ ...profile, override: overrides.get(stub.tmId) });
      ingestPlayer(db, { stub, profile, eligibility });
      counts[eligibility.status] += 1;
    } catch (err) {
      counts.failed += 1;
      console.warn(`[tm]   ! ${stub.name} (${stub.tmId}) failed: ${err.message.split("\n")[0]}`);
    }
    if (++done % 10 === 0) console.log(`[tm]   ${done}/${stubs.length} enriched…`);
  }

  console.log("[tm] done:", JSON.stringify(counts));
  if (ownsDb) db.close();
  return counts;
}

module.exports = { run, loadOverrides };

if (require.main === module) {
  const maxPages = process.env.MAXPAGES ? Number(process.env.MAXPAGES) : Infinity;
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  run({ maxPages, limit }).catch((e) => {
    console.error("[tm] fatal:", e);
    process.exit(1);
  });
}

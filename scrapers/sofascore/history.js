// Pull each player's per-season aggregate stats (average rating + minutes) from
// SofaScore, for the multi-season career trajectory. Only our 16 leagues, and only
// the most recent few seasons. Parsing is separated from the network for testing.
const { SofascoreClient } = require("./client");
const { getDb, initSchema } = require("../../db");
const { seed } = require("../../db/seed");
const { LEAGUES } = require("../../db/leagues");

// utId -> league slug, for filtering SofaScore tournaments to the ones we rank.
const LEAGUE_BY_UT_ID = Object.fromEntries(LEAGUES.map((l) => [l.sofascoreTournamentId, l.id]));

// "24/25" -> 2024, "2025" -> 2025 (sortable start year).
function seasonSortKey(year) {
  const m = String(year || "").match(/^(\d{2,4})/);
  if (!m) return 0;
  const n = Number(m[1]);
  return n < 100 ? n + 2000 : n;
}

// From the seasons list, the (league, tournament, season) rows worth fetching:
// only our leagues, only the most recent `maxBack` distinct season-years.
function parseSeasonsToFetch(seasonsJson, leagueByUtId = LEAGUE_BY_UT_ID, { maxBack = 6 } = {}) {
  const groups = seasonsJson?.uniqueTournamentSeasons || [];
  const rows = [];
  for (const g of groups) {
    const leagueId = leagueByUtId[g.uniqueTournament?.id];
    if (!leagueId) continue;
    for (const s of g.seasons || []) {
      rows.push({ leagueId, utId: g.uniqueTournament.id, seasonId: s.id, year: s.year });
    }
  }
  const years = [...new Set(rows.map((r) => r.year))]
    .sort((a, b) => seasonSortKey(b) - seasonSortKey(a))
    .slice(0, maxBack);
  const keep = new Set(years);
  return rows.filter((r) => keep.has(r.year));
}

function parseOverall(json) {
  const st = json?.statistics;
  if (!st || st.rating == null) return null;
  return {
    rating: Number(st.rating),
    minutes: st.minutesPlayed ?? 0,
    appearances: st.appearances ?? 0,
    goals: st.goals ?? 0,
    assists: st.assists ?? st.goalAssist ?? 0,
  };
}

async function fetchPlayerHistory(
  client,
  sofaId,
  { leagueByUtId = LEAGUE_BY_UT_ID, maxBack = 6 } = {},
) {
  const toFetch = parseSeasonsToFetch(await client.playerSeasons(sofaId), leagueByUtId, {
    maxBack,
  });
  const rows = [];
  for (const f of toFetch) {
    const ov = parseOverall(await client.playerSeasonOverall(sofaId, f.utId, f.seasonId));
    if (ov && ov.minutes > 0)
      rows.push({ seasonYear: f.year, leagueId: f.leagueId, seasonId: f.seasonId, ...ov });
  }
  return rows;
}

function upsertSeasonStats(db, playerId, rows) {
  const upsert = db.prepare(
    `INSERT INTO player_season_stats
       (player_id, season_year, league_id, sofascore_season_id, rating, minutes, appearances, goals, assists)
     VALUES (@player_id, @season_year, @league_id, @sofascore_season_id, @rating, @minutes, @appearances, @goals, @assists)
     ON CONFLICT(player_id, season_year, league_id) DO UPDATE SET
       sofascore_season_id = excluded.sofascore_season_id, rating = excluded.rating,
       minutes = excluded.minutes, appearances = excluded.appearances,
       goals = excluded.goals, assists = excluded.assists`,
  );
  db.transaction(() => {
    for (const r of rows) {
      upsert.run({
        player_id: playerId,
        season_year: r.seasonYear,
        league_id: r.leagueId,
        sofascore_season_id: r.seasonId,
        rating: r.rating,
        minutes: r.minutes,
        appearances: r.appearances,
        goals: r.goals,
        assists: r.assists,
      });
    }
  })();
  return rows.length;
}

function playersNeedingHistory(db, { force = false } = {}) {
  // Incremental by default: skip players already backfilled (past seasons don't
  // change). Pass force to refresh everyone (e.g. to pull the latest season).
  const skipDone = force
    ? ""
    : "AND p.id NOT IN (SELECT DISTINCT player_id FROM player_season_stats)";
  return db
    .prepare(
      `SELECT p.id, p.sofascore_id AS sofaId
       FROM players p JOIN player_scores ps ON ps.player_id = p.id
       WHERE p.sofascore_id IS NOT NULL AND ps.score > 0 ${skipDone}`,
    )
    .all();
}

async function run({ limit = Infinity, force = false, db = null } = {}) {
  const ownsDb = !db;
  db = db || initSchema(getDb());
  seed(db);
  const client = new SofascoreClient();
  let players = playersNeedingHistory(db, { force });
  if (players.length > limit) players = players.slice(0, limit);
  console.log(`[history] fetching season history for ${players.length} players…`);

  const counts = { players: 0, rows: 0, failed: 0 };
  try {
    for (const p of players) {
      try {
        const rows = await fetchPlayerHistory(client, p.sofaId);
        counts.rows += upsertSeasonStats(db, p.id, rows);
        counts.players += 1;
        if (counts.players % 20 === 0)
          console.log(`[history]   ${counts.players}/${players.length}…`);
      } catch (err) {
        counts.failed += 1;
        console.warn(`[history]   ! player ${p.id} failed: ${err.message.split("\n")[0]}`);
      }
    }
  } finally {
    await client.close();
  }
  console.log("[history] done:", JSON.stringify(counts));
  if (ownsDb) db.close();
  return counts;
}

module.exports = {
  parseSeasonsToFetch,
  parseOverall,
  seasonSortKey,
  fetchPlayerHistory,
  upsertSeasonStats,
  playersNeedingHistory,
  LEAGUE_BY_UT_ID,
};

if (require.main === module) {
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const force = process.env.FORCE === "1";
  run({ limit, force }).catch((e) => {
    console.error("[history] fatal:", e);
    process.exit(1);
  });
}

// Phase 3 orchestrator: for each eligible player, resolve a SofaScore id, pull
// current-season per-match rating + minutes, and store them in player_match_stats.
//
// Usage:  node scrapers/sofascore/run.js
//   env LIMIT=N        cap how many players to process
//   env SEASON=25/26   SofaScore season year to keep (default 25/26)
//   env INCLUDE_ALL=1  process all players, not just eligible/review (debug)
const { getDb, initSchema } = require("../../db");
const { seed } = require("../../db/seed");
const { SofascoreClient } = require("./client");
const { parseSearchPlayers, parseEvents, parseMatchStats, filterSeason } = require("./parse");
const { pickBestMatch } = require("./match");
const { upsertMatch, upsertPlayerMatchStat } = require("./ingest");

const SEASON_YEAR = process.env.SEASON || "25/26";
const SEASON_ID = "2025-2026";

function eligiblePlayers(db, { includeAll } = {}) {
  const where = includeAll ? "" : "WHERE p.eligibility_status IN ('eligible', 'review')";
  return db
    .prepare(
      `SELECT p.id, p.name, p.sofascore_id, p.transfermarkt_id, c.name AS club_name
       FROM players p LEFT JOIN clubs c ON c.id = p.club_id
       ${where}
       ORDER BY p.market_value DESC`,
    )
    .all();
}

// Resolve (and cache) a player's SofaScore id from name + club.
async function resolveSofascoreId(db, client, player) {
  if (player.sofascore_id) return player.sofascore_id;
  const results = parseSearchPlayers(await client.searchAll(player.name));
  const match = pickBestMatch(results, { name: player.name, clubName: player.club_name });
  if (!match) return null;
  db.prepare("UPDATE players SET sofascore_id = ? WHERE id = ?").run(match.id, player.id);
  return match.id;
}

async function run({ limit = Infinity, includeAll = false, db = null } = {}) {
  const ownsDb = !db;
  db = db || initSchema(getDb());
  seed(db); // ensure the current season exists (matches reference it)
  const client = new SofascoreClient();

  let players = eligiblePlayers(db, { includeAll });
  if (players.length > limit) players = players.slice(0, limit);
  console.log(`[sofa] processing ${players.length} players (season ${SEASON_YEAR})…`);

  const counts = { matched: 0, unmatched: 0, statRows: 0, failed: 0 };
  try {
    for (const player of players) {
      try {
        const sofaId = await resolveSofascoreId(db, client, player);
        if (!sofaId) {
          counts.unmatched += 1;
          console.warn(`[sofa]   ? no match: ${player.name}`);
          continue;
        }
        counts.matched += 1;

        const events = filterSeason(parseEvents(await client.playerEvents(sofaId, 0)), SEASON_YEAR);
        for (const ev of events) {
          const stats = parseMatchStats(await client.matchStats(ev.id, sofaId));
          if (!stats || stats.minutes == null) continue; // didn't feature
          const matchId = upsertMatch(db, ev, { seasonId: SEASON_ID });
          upsertPlayerMatchStat(db, {
            playerId: player.id,
            matchId,
            rating: stats.rating,
            minutes: stats.minutes,
            goals: stats.goals,
            assists: stats.assists,
          });
          counts.statRows += 1;
        }
        console.log(`[sofa]   ${player.name}: ${events.length} ${SEASON_YEAR} matches`);
      } catch (err) {
        counts.failed += 1;
        console.warn(`[sofa]   ! ${player.name} failed: ${err.message.split("\n")[0]}`);
      }
    }
  } finally {
    await client.close();
  }

  console.log("[sofa] done:", JSON.stringify(counts));
  if (ownsDb) db.close();
  return counts;
}

module.exports = { run, eligiblePlayers, resolveSofascoreId };

if (require.main === module) {
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const includeAll = process.env.INCLUDE_ALL === "1";
  run({ limit, includeAll }).catch((e) => {
    console.error("[sofa] fatal:", e);
    process.exit(1);
  });
}

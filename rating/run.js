// Phase 4 orchestrator: map matches to leagues, compute every player's fair season
// score into player_scores, and build the Best XI.
//
// Usage:  node rating/run.js        (env MIN_MINUTES=N, default 450, for the Best XI)
const { getDb, initSchema } = require("../db");
const { seed } = require("../db/seed");
const { computePlayerScore, selectBestXI } = require("./score");

const SEASON_ID = "2025-2026";
const MIN_MINUTES = process.env.MIN_MINUTES ? Number(process.env.MIN_MINUTES) : 450;

// Fill matches.league_id from the stored SofaScore tournament id. Cups and other
// competitions (no matching league) stay null and are thus excluded from ratings.
function resolveMatchLeagues(db) {
  const info = db
    .prepare(
      `UPDATE matches SET league_id = (
         SELECT l.id FROM leagues l
         WHERE l.sofascore_tournament_id = matches.sofascore_unique_tournament_id
       )`,
    )
    .run();
  return info.changes;
}

// Assign each club its league, inferred from the matches it appears in (a club plays
// in exactly one league, so the most common league among its matches is that league).
// Lets the frontend label a player by his current club's league.
function resolveClubLeagues(db) {
  return db
    .prepare(
      `UPDATE clubs SET league_id = (
         SELECT m.league_id FROM matches m
         WHERE (m.home_club_id = clubs.id OR m.away_club_id = clubs.id) AND m.league_id IS NOT NULL
         GROUP BY m.league_id ORDER BY COUNT(*) DESC LIMIT 1
       )
       WHERE league_id IS NULL`, // only fill gaps; TM competition mapping is authoritative
    )
    .run().changes;
}

// Compute + upsert player_scores for every player that has league match stats.
function computeAllScores(db, seasonId = SEASON_ID) {
  const matchesFor = db.prepare(
    `SELECT s.rating, s.minutes, l.coefficient
     FROM player_match_stats s
     JOIN matches m ON m.id = s.match_id
     JOIN leagues l ON l.id = m.league_id
     WHERE s.player_id = ? AND m.season_id = ?`,
  );
  const upsert = db.prepare(
    `INSERT INTO player_scores
       (player_id, season_id, matches_count, minutes, wavg_rating, shrunk_rating, score, computed_at)
     VALUES (@player_id, @season_id, @matches_count, @minutes, @wavg_rating, @shrunk_rating, @score, @computed_at)
     ON CONFLICT(player_id, season_id) DO UPDATE SET
       matches_count = excluded.matches_count, minutes = excluded.minutes,
       wavg_rating = excluded.wavg_rating, shrunk_rating = excluded.shrunk_rating,
       score = excluded.score, computed_at = excluded.computed_at`,
  );
  const playerIds = db
    .prepare("SELECT DISTINCT player_id FROM player_match_stats")
    .all()
    .map((r) => r.player_id);

  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const player_id of playerIds) {
      const r = computePlayerScore(matchesFor.all(player_id, seasonId));
      upsert.run({
        player_id,
        season_id: seasonId,
        matches_count: r.matchesCount,
        minutes: r.minutes,
        wavg_rating: r.wavg,
        shrunk_rating: r.shrunk,
        score: r.score,
        computed_at: now,
      });
    }
  });
  run();
  return playerIds.length;
}

// Build the Best XI from eligible players who clear the minimum-minutes gate.
function buildBestXI(
  db,
  { seasonId = SEASON_ID, minMinutes = MIN_MINUTES, status = "eligible" } = {},
) {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.primary_position AS position, ps.score, ps.minutes
       FROM players p
       JOIN player_scores ps ON ps.player_id = p.id AND ps.season_id = ?
       WHERE p.eligibility_status = ? AND ps.minutes >= ? AND ps.score > 0`,
    )
    .all(seasonId, status, minMinutes);
  const players = rows.map((r) => ({ ...r, positions: r.position ? [r.position] : [] }));
  return selectBestXI(players);
}

// Compute the Best XI and persist it (one row per slot) so the frontend can read
// it via SQL without importing the selection logic.
function persistBestXI(db, opts = {}) {
  const seasonId = opts.seasonId || SEASON_ID;
  const { xi } = buildBestXI(db, { seasonId, ...opts });
  const del = db.prepare("DELETE FROM best_xi WHERE season_id = ?");
  const ins = db.prepare(
    "INSERT INTO best_xi (season_id, slot_index, slot, player_id) VALUES (?, ?, ?, ?)",
  );
  db.transaction(() => {
    del.run(seasonId);
    xi.forEach((s, i) => ins.run(seasonId, i, s.slot, s.player ? s.player.id : null));
  })();
  return xi.filter((s) => s.player).length;
}

function run() {
  const db = initSchema(getDb());
  seed(db);
  resolveMatchLeagues(db);
  resolveClubLeagues(db);
  const inLeague = db.prepare("SELECT COUNT(*) n FROM matches WHERE league_id IS NOT NULL").get().n;
  const cups = db.prepare("SELECT COUNT(*) n FROM matches WHERE league_id IS NULL").get().n;
  const scored = computeAllScores(db);
  persistBestXI(db);
  console.log(
    `[rate] ${inLeague} in-league matches (+${cups} cups excluded); players scored: ${scored}`,
  );

  const top = db
    .prepare(
      `SELECT p.name, p.primary_position pos, p.eligibility_status st, ps.score, ps.minutes, ps.matches_count mc
       FROM player_scores ps JOIN players p ON p.id = ps.player_id
       WHERE ps.score > 0 ORDER BY ps.score DESC LIMIT 10`,
    )
    .all();
  console.log("\nTop scorers (all statuses):");
  for (const r of top) {
    console.log(
      `  ${r.score.toFixed(3)}  ${r.name.padEnd(22)} ${String(r.pos).padEnd(3)} ` +
        `${r.mc} apps / ${r.minutes} min  [${r.st}]`,
    );
  }

  const { xi, filled } = buildBestXI(db);
  console.log(`\nBest XI (eligible, >= ${MIN_MINUTES} min) — ${filled}/11 filled:`);
  for (const s of xi) {
    console.log(
      `  ${s.slot.padEnd(4)} ${s.player ? `${s.player.name} (${s.player.score.toFixed(3)})` : "—"}`,
    );
  }
  db.close();
}

module.exports = {
  resolveMatchLeagues,
  resolveClubLeagues,
  computeAllScores,
  buildBestXI,
  persistBestXI,
};

if (require.main === module) run();

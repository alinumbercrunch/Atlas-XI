const { findOrCreateClub } = require("../transfermarkt/ingest");

const MATCH_COLUMNS = [
  "sofascore_event_id",
  "season_id",
  "league_id",
  "sofascore_unique_tournament_id",
  "home_club_id",
  "away_club_id",
  "match_date",
  "competition",
];

// Upsert a match (by sofascore_event_id) and return its id. league_id is left null
// here — it is resolved from sofascore_unique_tournament_id in a later mapping step.
function upsertMatch(db, event, { seasonId = null, leagueId = null } = {}) {
  const params = {
    sofascore_event_id: event.id,
    season_id: seasonId,
    league_id: leagueId,
    sofascore_unique_tournament_id: event.uniqueTournamentId ?? null,
    home_club_id: findOrCreateClub(db, event.home),
    away_club_id: findOrCreateClub(db, event.away),
    match_date: event.date ?? null,
    competition: event.tournamentName ?? null,
  };
  db.prepare(
    `INSERT INTO matches (${MATCH_COLUMNS.join(", ")})
     VALUES (${MATCH_COLUMNS.map((c) => "@" + c).join(", ")})
     ON CONFLICT(sofascore_event_id) DO UPDATE SET
       ${MATCH_COLUMNS.filter((c) => c !== "sofascore_event_id")
         .map((c) => `${c} = excluded.${c}`)
         .join(",\n       ")}`,
  ).run(params);
  return db.prepare("SELECT id FROM matches WHERE sofascore_event_id = ?").get(event.id).id;
}

// Upsert one player's stat line for a match (unique on player_id + match_id).
function upsertPlayerMatchStat(db, { playerId, matchId, rating, minutes, goals = 0, assists = 0 }) {
  db.prepare(
    `INSERT INTO player_match_stats (player_id, match_id, rating, minutes, goals, assists)
     VALUES (@playerId, @matchId, @rating, @minutes, @goals, @assists)
     ON CONFLICT(player_id, match_id) DO UPDATE SET
       rating = excluded.rating,
       minutes = excluded.minutes,
       goals = excluded.goals,
       assists = excluded.assists`,
  ).run({ playerId, matchId, rating, minutes, goals, assists });
}

module.exports = { upsertMatch, upsertPlayerMatchStat };

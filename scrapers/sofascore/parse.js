// Pure parsers for SofaScore JSON. No network here — tested against saved fixtures.

function parseSearchPlayers(json) {
  const results = (json && json.results) || [];
  return results
    .filter((r) => r.type === "player" && r.entity)
    .map((r) => ({
      id: r.entity.id,
      name: r.entity.name,
      team: r.entity.team?.name || null,
      teamId: r.entity.team?.id || null,
    }));
}

function parseEvents(json) {
  const events = (json && json.events) || [];
  return events.map((e) => ({
    id: e.id,
    startTimestamp: e.startTimestamp || null,
    date: e.startTimestamp ? new Date(e.startTimestamp * 1000).toISOString().slice(0, 10) : null,
    home: e.homeTeam?.name || null,
    homeId: e.homeTeam?.id || null,
    away: e.awayTeam?.name || null,
    awayId: e.awayTeam?.id || null,
    tournamentName: e.tournament?.name || null,
    uniqueTournamentId: e.tournament?.uniqueTournament?.id || null,
    seasonYear: e.season?.year || null,
  }));
}

// Player's stat line for one match. Returns null if the player didn't feature.
function parseMatchStats(json) {
  const s = json && json.statistics;
  if (!s) return null;
  return {
    rating: s.rating != null ? Number(s.rating) : null,
    minutes: s.minutesPlayed != null ? Number(s.minutesPlayed) : null,
    goals: s.goals || 0,
    assists: s.goalAssist || 0,
  };
}

// Keep only events from a given season (SofaScore's short year form, e.g. "25/26").
function filterSeason(events, seasonYear) {
  return events.filter((e) => e.seasonYear === seasonYear);
}

module.exports = { parseSearchPlayers, parseEvents, parseMatchStats, filterSeason };

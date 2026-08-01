// Match a player (name + club) to the right SofaScore search result.
// Names differ across sources (accents, spellings), so normalize before comparing
// and prefer the candidate whose team matches the player's known club.

function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamMatches(candidateTeam, clubName) {
  if (!candidateTeam || !clubName) return false;
  const a = norm(candidateTeam);
  const b = norm(clubName);
  return a === b || a.includes(b) || b.includes(a);
}

// Pick the best SofaScore player result for { name, clubName }. Returns null if none.
function pickBestMatch(results, { name, clubName } = {}) {
  if (!results || !results.length) return null;
  const target = norm(name);
  const exact = results.filter((r) => norm(r.name) === target);
  const pool = exact.length ? exact : results;

  if (clubName) {
    const byClub = pool.find((r) => teamMatches(r.team, clubName));
    if (byClub) return byClub;
    // If the name wasn't an exact match, don't guess across clubs — no confident pick.
    if (!exact.length) return null;
  }
  return pool[0];
}

module.exports = { pickBestMatch, norm };

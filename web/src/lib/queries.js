// Read-only query layer for the Astro frontend. Functions take an injected `db`
// (better-sqlite3) so they are unit-testable, and guard against a missing DB so
// pages still render before the ETL has been run. Pure SQL — no backend imports,
// so it works identically in Astro's dev server and static build.
const SEASON = "2025-2026";
export const POSITIONS = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"];
// Minimum league minutes to appear in the ranking (keeps tiny cameo samples out).
export const MIN_RANK_MINUTES = 300;

export function getLeagues(db) {
  if (!db) return [];
  return db
    .prepare("SELECT id, name, country, tier, coefficient FROM leagues ORDER BY coefficient DESC")
    .all();
}

export function getSummary(db) {
  if (!db) return { eligible: 0, review: 0, scored: 0, matches: 0 };
  const n = (sql, ...args) => db.prepare(sql).get(...args).n;
  return {
    eligible: n("SELECT COUNT(*) n FROM players WHERE eligibility_status = 'eligible'"),
    review: n("SELECT COUNT(*) n FROM players WHERE eligibility_status = 'review'"),
    scored: n("SELECT COUNT(*) n FROM player_scores WHERE score > 0"),
    matches: n("SELECT COUNT(*) n FROM matches WHERE league_id IS NOT NULL"),
  };
}

// Ranked players for Browse. A player's league is where they logged the most
// minutes this season (club->league is not populated; matches carry the league).
export function getBrowsePlayers(db, { season = SEASON } = {}) {
  if (!db) return [];
  return db
    .prepare(
      `SELECT p.id, p.name, p.primary_position AS position, p.eligibility_status AS status,
              p.market_value AS marketValue, p.citizenships, p.sofascore_id AS sofascoreId,
              ps.score, ps.minutes, ps.matches_count AS matches, ps.wavg_rating AS wavg,
              c.name AS club,
              -- Prefer the current club's league; fall back to where he played most.
              COALESCE(
                c.league_id,
                (SELECT l.id FROM player_match_stats s
                   JOIN matches m ON m.id = s.match_id
                   JOIN leagues l ON l.id = m.league_id
                  WHERE s.player_id = p.id
                  GROUP BY l.id ORDER BY SUM(s.minutes) DESC LIMIT 1)
              ) AS leagueId
       FROM players p
       JOIN player_scores ps ON ps.player_id = p.id AND ps.season_id = ?
       LEFT JOIN clubs c ON c.id = p.club_id
       WHERE p.eligibility_status IN ('eligible', 'review') AND ps.score > 0
         AND ps.minutes >= ?
       ORDER BY ps.score DESC`,
    )
    .all(season, MIN_RANK_MINUTES)
    .map((r) => ({ ...r, citizenships: safeParse(r.citizenships) }));
}

// Read the persisted Best XI (written by the rating step) as slot -> player.
export function getBestXI(db, { season = SEASON } = {}) {
  if (!db) return { xi: [], filled: 0 };
  const rows = db
    .prepare(
      `SELECT b.slot, b.slot_index,
              p.id, p.name, p.primary_position AS position, p.sofascore_id AS sofascoreId,
              ps.score, c.name AS club
       FROM best_xi b
       LEFT JOIN players p ON p.id = b.player_id
       LEFT JOIN player_scores ps ON ps.player_id = b.player_id AND ps.season_id = b.season_id
       LEFT JOIN clubs c ON c.id = p.club_id
       WHERE b.season_id = ?
       ORDER BY b.slot_index`,
    )
    .all(season);
  const xi = rows.map((r) => ({
    slot: r.slot,
    player: r.id
      ? { id: r.id, name: r.name, score: r.score, club: r.club, sofascoreId: r.sofascoreId }
      : null,
  }));
  return { xi, filled: xi.filter((s) => s.player).length };
}

// Ids of every player who has a detail page (rated eligible/review players).
export function getScoredPlayerIds(db, { season = SEASON } = {}) {
  if (!db) return [];
  return db
    .prepare(
      `SELECT p.id FROM players p
       JOIN player_scores ps ON ps.player_id = p.id AND ps.season_id = ?
       WHERE p.eligibility_status IN ('eligible', 'review') AND ps.score > 0`,
    )
    .all(season)
    .map((r) => r.id);
}

// Full detail for one player: bio, score components, and a per-match breakdown
// showing exactly how the fair score was built (league matches counted; cups shown
// but excluded). Returns null if the player has no score.
export function getPlayer(db, id, { season = SEASON } = {}) {
  if (!db) return null;
  const p = db
    .prepare(
      `SELECT p.id, p.name, p.primary_position AS position, p.eligibility_status AS status,
              p.market_value AS marketValue, p.citizenships, p.senior_a_caps AS seniorCaps,
              p.birthplace, p.sofascore_id AS sofascoreId,
              c.name AS club,
              COALESCE(
                c.league_id,
                (SELECT l.id FROM player_match_stats s
                   JOIN matches m ON m.id = s.match_id
                   JOIN leagues l ON l.id = m.league_id
                  WHERE s.player_id = p.id
                  GROUP BY l.id ORDER BY SUM(s.minutes) DESC LIMIT 1)
              ) AS leagueId,
              ps.score, ps.minutes, ps.matches_count AS matches,
              ps.wavg_rating AS wavg, ps.shrunk_rating AS shrunk
       FROM players p
       LEFT JOIN clubs c ON c.id = p.club_id
       JOIN player_scores ps ON ps.player_id = p.id AND ps.season_id = ?
       WHERE p.id = ?`,
    )
    .get(season, id);
  if (!p) return null;

  p.citizenships = safeParse(p.citizenships);
  // Effective (minutes-weighted) league coefficient, recovered from score / shrunk.
  p.coefficient = p.shrunk ? p.score / p.shrunk : null;
  p.matchLog = db
    .prepare(
      `SELECT m.match_date AS date, m.competition, l.name AS league, l.coefficient AS coeff,
              s.rating, s.minutes, s.goals, s.assists
       FROM player_match_stats s
       JOIN matches m ON m.id = s.match_id
       LEFT JOIN leagues l ON l.id = m.league_id
       WHERE s.player_id = ?
       ORDER BY m.match_date DESC`,
    )
    .all(id);
  return p;
}

function seasonKey(year) {
  const m = String(year || "").match(/^(\d{2,4})/);
  if (!m) return 0;
  const n = Number(m[1]);
  return n < 100 ? n + 2000 : n;
}

// A player's per-season career trajectory: one fair score per season (aggregating
// across leagues that season). Same formula as the rating engine (baseline 6.7, K 500).
export function getPlayerSeasons(db, id) {
  if (!db) return [];
  const BASELINE = 6.2; // keep in sync with rating/score.js
  const K = 500;
  return db
    .prepare(
      `SELECT s.season_year AS year,
              SUM(s.minutes) AS minutes, SUM(s.appearances) AS apps,
              SUM(s.goals) AS goals, SUM(s.assists) AS assists,
              SUM(s.rating * s.minutes) / SUM(s.minutes) AS wrating,
              SUM(l.coefficient * s.minutes) / SUM(s.minutes) AS wcoeff,
              GROUP_CONCAT(DISTINCT l.name) AS leagues
       FROM player_season_stats s
       JOIN leagues l ON l.id = s.league_id
       WHERE s.player_id = ? AND s.minutes > 0
       GROUP BY s.season_year`,
    )
    .all(id)
    .map((r) => {
      const shrunk = (r.wrating * r.minutes + BASELINE * K) / (r.minutes + K);
      return {
        year: r.year,
        minutes: r.minutes,
        apps: r.apps,
        goals: r.goals,
        assists: r.assists,
        rating: r.wrating,
        score: shrunk * r.wcoeff,
        leagues: r.leagues,
        sort: seasonKey(r.year),
      };
    })
    .sort((a, b) => a.sort - b.sort);
}

function safeParse(json) {
  try {
    return JSON.parse(json) || [];
  } catch {
    return [];
  }
}

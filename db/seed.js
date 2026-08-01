const { getDb, initSchema } = require("./index");
const { LEAGUES } = require("./leagues");

// The season Atlas XI ranks by default (PLAN.md §3).
const CURRENT_SEASON = { id: "2025-2026", label: "2025/26", startYear: 2025, isCurrent: 1 };

// Idempotent seed: upserts the fixed leagues + current season. Safe to re-run
// (re-running updates coefficients/labels if they changed).
function seed(db) {
  const upsertLeague = db.prepare(`
    INSERT INTO leagues (id, name, country, country_code, tier, coefficient, sofascore_tournament_id)
    VALUES (@id, @name, @country, @countryCode, @tier, @coefficient, @sofascoreTournamentId)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      country = excluded.country,
      country_code = excluded.country_code,
      tier = excluded.tier,
      coefficient = excluded.coefficient,
      sofascore_tournament_id = excluded.sofascore_tournament_id
  `);
  const upsertSeason = db.prepare(`
    INSERT INTO seasons (id, label, start_year, is_current)
    VALUES (@id, @label, @startYear, @isCurrent)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      start_year = excluded.start_year,
      is_current = excluded.is_current
  `);

  const run = db.transaction(() => {
    for (const league of LEAGUES) upsertLeague.run(league);
    upsertSeason.run(CURRENT_SEASON);
  });
  run();

  return { leagues: LEAGUES.length, season: CURRENT_SEASON.label };
}

module.exports = { seed, CURRENT_SEASON };

// CLI: `node db/seed.js` (or `npm run db:seed`) — initializes schema + seeds.
if (require.main === module) {
  const db = getDb();
  initSchema(db);
  const res = seed(db);
  console.log(`[seed] leagues: ${res.leagues}, current season: ${res.season} ✅`);
  db.close();
}

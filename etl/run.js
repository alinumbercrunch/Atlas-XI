// Phase 5 ETL: one re-runnable refresh that chains the pipeline on a single DB
// connection — discover (Transfermarkt) -> stats (SofaScore) -> rate. Every stage
// is idempotent, so re-running updates in place. Stages are injectable for testing.
//
// Usage:  node etl/run.js
//   env STAGES=discover,stats,rate   which stages to run (default all)
//   env MAXPAGES / DISCOVER_LIMIT    bound discovery
//   env STATS_LIMIT                  bound stats enrichment
//   env MIN_MINUTES                  Best XI minutes gate (default 450)
const { getDb, initSchema } = require("../db");
const { seed } = require("../db/seed");

const ALL_STAGES = ["discover", "stats", "history", "clubmap", "rate", "images"];

async function runEtl(opts = {}) {
  const {
    stages = ALL_STAGES,
    maxPages = Infinity,
    discoverLimit = Infinity,
    statsLimit = Infinity,
    minMinutes,
    deps = {},
  } = opts;

  const discover = deps.discover || require("../scrapers/transfermarkt/run").run;
  const fetchStats = deps.fetchStats || require("../scrapers/sofascore/run").run;
  const rating = deps.rating || require("../rating/run");
  const images = deps.images || require("../scrapers/sofascore/images");
  const competitions = deps.competitions || require("../scrapers/transfermarkt/competitions");
  const history = deps.history || require("../scrapers/sofascore/history");

  const ownsDb = !opts.db;
  const db = opts.db || initSchema(getDb());
  seed(db);

  const summary = { stages: {} };
  const time = async (name, fn) => {
    console.log(`[etl] ▶ ${name}…`);
    const t0 = Date.now();
    const result = await fn();
    const seconds = Number(((Date.now() - t0) / 1000).toFixed(1));
    console.log(`[etl] ✓ ${name} (${seconds}s)`, result ? JSON.stringify(result) : "");
    summary.stages[name] = { seconds, result };
    return result;
  };

  if (stages.includes("discover")) {
    await time("discover", () => discover({ maxPages, limit: discoverLimit, db }));
  }
  if (stages.includes("stats")) {
    await time("stats", () => fetchStats({ limit: statsLimit, db }));
  }
  if (stages.includes("history")) {
    await time("history", () => history.run({ db }));
  }
  if (stages.includes("clubmap")) {
    await time("clubmap", async () => {
      const map = await competitions.buildClubLeagueMap({});
      return { updated: competitions.applyClubLeagues(db, map) };
    });
  }
  if (stages.includes("rate")) {
    await time("rate", () => {
      rating.resolveMatchLeagues(db);
      rating.resolveClubLeagues(db);
      const scored = rating.computeAllScores(db);
      const bestXi = rating.persistBestXI(db);
      return { scored, bestXi };
    });
  }
  if (stages.includes("images")) {
    await time("images", () => images.downloadImages(images.playersNeedingImages(db), {}));
  }

  const eligible = db
    .prepare("SELECT COUNT(*) n FROM players WHERE eligibility_status = 'eligible'")
    .get().n;
  const { filled } = rating.buildBestXI(db, minMinutes != null ? { minMinutes } : {});
  console.log(`[etl] done — eligible players: ${eligible}; Best XI: ${filled}/11 filled`);
  summary.eligible = eligible;
  summary.bestXiFilled = filled;

  if (ownsDb) db.close();
  return summary;
}

module.exports = { runEtl, ALL_STAGES };

if (require.main === module) {
  const env = process.env;
  const num = (v) => (v ? Number(v) : undefined);
  runEtl({
    stages: env.STAGES ? env.STAGES.split(",").map((s) => s.trim()) : ALL_STAGES,
    maxPages: num(env.MAXPAGES) ?? Infinity,
    discoverLimit: num(env.DISCOVER_LIMIT) ?? Infinity,
    statsLimit: num(env.STATS_LIMIT) ?? Infinity,
    minMinutes: num(env.MIN_MINUTES),
  }).catch((e) => {
    console.error("[etl] fatal:", e);
    process.exit(1);
  });
}

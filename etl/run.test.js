import { getDb, initSchema } from "../db/index.js";
import { runEtl } from "./run.js";

// Stub stages that just record the order they run in; operate on the shared db.
function makeDeps(calls) {
  return {
    discover: async ({ db }) => {
      calls.push("discover");
      expect(db).toBeTruthy(); // shared db is threaded through
      return { eligible: 0 };
    },
    fetchStats: async ({ db }) => {
      calls.push("stats");
      expect(db).toBeTruthy();
      return { matched: 0 };
    },
    rating: {
      resolveMatchLeagues: () => calls.push("resolve"),
      computeAllScores: () => {
        calls.push("compute");
        return 0;
      },
      buildBestXI: () => ({ filled: 0, xi: [] }),
    },
  };
}

describe("runEtl", () => {
  it("runs all stages in order on one db", async () => {
    const calls = [];
    const db = initSchema(getDb(":memory:"));
    const summary = await runEtl({ db, deps: makeDeps(calls) });
    expect(calls).toEqual(["discover", "stats", "resolve", "compute"]);
    expect(summary.stages.discover).toBeTruthy();
    expect(summary.bestXiFilled).toBe(0);
    db.close();
  });

  it("respects the stages filter (rate only)", async () => {
    const calls = [];
    const db = initSchema(getDb(":memory:"));
    await runEtl({ db, stages: ["rate"], deps: makeDeps(calls) });
    expect(calls).toEqual(["resolve", "compute"]);
    db.close();
  });

  it("can skip the rate stage", async () => {
    const calls = [];
    const db = initSchema(getDb(":memory:"));
    await runEtl({ db, stages: ["discover", "stats"], deps: makeDeps(calls) });
    expect(calls).toEqual(["discover", "stats"]);
    db.close();
  });
});

import { getDb, initSchema } from "./index.js";

function freshDb() {
  return initSchema(getDb(":memory:"));
}

describe("schema", () => {
  it("creates all expected tables", () => {
    const db = freshDb();
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    for (const t of [
      "leagues",
      "clubs",
      "players",
      "overrides",
      "seasons",
      "matches",
      "player_match_stats",
      "player_scores",
    ]) {
      expect(names).toContain(t);
    }
    db.close();
  });

  it("enforces foreign keys (stats need a real player)", () => {
    const db = freshDb();
    db.prepare("INSERT INTO seasons (id, label, start_year) VALUES ('s','s',2025)").run();
    // match with no clubs is fine; player_match_stats referencing a missing player is not.
    db.prepare("INSERT INTO matches (id) VALUES (1)").run();
    expect(() =>
      db.prepare("INSERT INTO player_match_stats (player_id, match_id) VALUES (999, 1)").run(),
    ).toThrow();
    db.close();
  });

  it("rejects an invalid eligibility_status via CHECK", () => {
    const db = freshDb();
    expect(() =>
      db.prepare("INSERT INTO players (name, eligibility_status) VALUES ('X','bogus')").run(),
    ).toThrow();
    // a valid one succeeds
    expect(() =>
      db.prepare("INSERT INTO players (name, eligibility_status) VALUES ('Y','review')").run(),
    ).not.toThrow();
    db.close();
  });

  it("requires an external id on overrides via CHECK", () => {
    const db = freshDb();
    expect(() =>
      db.prepare("INSERT INTO overrides (player_name, action) VALUES ('X','include')").run(),
    ).toThrow();
    expect(() =>
      db
        .prepare(
          "INSERT INTO overrides (player_name, action, transfermarkt_id) VALUES ('X','include','123')",
        )
        .run(),
    ).not.toThrow();
    db.close();
  });

  it("rejects out-of-range ratings via CHECK", () => {
    const db = freshDb();
    db.prepare("INSERT INTO players (id, name) VALUES (1,'P')").run();
    db.prepare("INSERT INTO matches (id) VALUES (1)").run();
    expect(() =>
      db
        .prepare("INSERT INTO player_match_stats (player_id, match_id, rating) VALUES (1,1,11)")
        .run(),
    ).toThrow();
    db.close();
  });
});

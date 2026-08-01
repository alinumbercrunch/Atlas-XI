import { getDb, initSchema } from "./index.js";
import { seed, CURRENT_SEASON } from "./seed.js";
import { LEAGUES } from "./leagues.js";

function freshDb() {
  return initSchema(getDb(":memory:"));
}

describe("seed", () => {
  it("populates all leagues and the current season", () => {
    const db = freshDb();
    seed(db);
    expect(db.prepare("SELECT COUNT(*) n FROM leagues").get().n).toBe(LEAGUES.length);
    const season = db.prepare("SELECT * FROM seasons WHERE is_current = 1").get();
    expect(season.id).toBe(CURRENT_SEASON.id);
    db.close();
  });

  it("is idempotent — re-seeding does not duplicate rows", () => {
    const db = freshDb();
    seed(db);
    seed(db);
    expect(db.prepare("SELECT COUNT(*) n FROM leagues").get().n).toBe(LEAGUES.length);
    expect(db.prepare("SELECT COUNT(*) n FROM seasons").get().n).toBe(1);
    db.close();
  });

  it("updates a changed coefficient on re-seed (upsert)", () => {
    const db = freshDb();
    seed(db);
    db.prepare("UPDATE leagues SET coefficient = 0.01 WHERE id = 'eng-1'").run();
    seed(db); // should reset it back to the source-of-truth value
    expect(db.prepare("SELECT coefficient c FROM leagues WHERE id = 'eng-1'").get().c).toBe(1.0);
    db.close();
  });
});

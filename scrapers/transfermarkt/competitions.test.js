import { readFileSync } from "fs";
import { join } from "path";
import { getDb, initSchema } from "../../db/index.js";
import { seed } from "../../db/seed.js";
import {
  parseLeagueClubs,
  applyClubLeagues,
  buildClubLeagueMap,
  normalizeClub,
} from "./competitions.js";

const fx = (name) =>
  readFileSync(join(process.cwd(), "scrapers", "transfermarkt", "__fixtures__", name), "utf8");

describe("parseLeagueClubs", () => {
  const clubs = parseLeagueClubs(fx("competition-esp2.html"));
  it("extracts the Segunda club list", () => {
    expect(clubs.length).toBeGreaterThan(18);
    expect(clubs).toContain("Racing Santander"); // the case we care about
  });
});

describe("normalizeClub", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeClub("Racing Santander")).toBe("racingsantander");
    expect(normalizeClub("Atlético de Madrid")).toBe("atleticodemadrid");
  });
});

describe("applyClubLeagues", () => {
  it("sets clubs.league_id by (normalized) name match", () => {
    const db = initSchema(getDb(":memory:"));
    seed(db);
    db.prepare("INSERT INTO clubs (id, name) VALUES (1, 'Racing Santander')").run();
    db.prepare("INSERT INTO clubs (id, name) VALUES (2, 'Atletico de Madrid')").run();
    db.prepare("INSERT INTO clubs (id, name) VALUES (3, 'Unknown FC')").run();

    const map = new Map([
      ["Racing Santander", "esp-2"],
      ["Atlético de Madrid", "esp-1"], // accented; should still match club #2
    ]);
    const updated = applyClubLeagues(db, map);

    expect(updated).toBe(2);
    expect(db.prepare("SELECT league_id FROM clubs WHERE id=1").get().league_id).toBe("esp-2");
    expect(db.prepare("SELECT league_id FROM clubs WHERE id=2").get().league_id).toBe("esp-1");
    expect(db.prepare("SELECT league_id FROM clubs WHERE id=3").get().league_id).toBeNull();
    db.close();
  });
});

describe("buildClubLeagueMap", () => {
  it("paginates competitions with an injected fetch", async () => {
    // Serve the Segunda fixture for every code; delay 0 for a fast test.
    const map = await buildClubLeagueMap({
      fetchImpl: async () => fx("competition-esp2.html"),
      delay: 0,
    });
    expect(map.get("Racing Santander")).toBeTruthy();
  });
});

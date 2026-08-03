import { getDb, initSchema } from "../../../db/index.js";
import { seed } from "../../../db/seed.js";
import { upsertMatch, upsertPlayerMatchStat } from "../../../scrapers/sofascore/ingest.js";
import { resolveMatchLeagues, computeAllScores, persistBestXI } from "../../../rating/run.js";
import {
  getLeagues,
  getSummary,
  getBrowsePlayers,
  getBestXI,
  getPlayer,
  getScoredPlayerIds,
  getPlayerSeasons,
} from "./queries.js";

// Build a small realistic DB: two eligible players with Premier League stats.
function seededDb() {
  const db = initSchema(getDb(":memory:"));
  seed(db);
  const add = (id, name, pos) =>
    db
      .prepare(
        "INSERT INTO players (id, name, primary_position, eligibility_status) VALUES (?,?,?, 'eligible')",
      )
      .run(id, name, pos);
  add(1, "Striker One", "ST");
  add(2, "Keeper Two", "GK");
  const m1 = upsertMatch(
    db,
    { id: 1, uniqueTournamentId: 17, home: "A", away: "B" },
    { seasonId: "2025-2026" },
  );
  const m2 = upsertMatch(
    db,
    { id: 2, uniqueTournamentId: 17, home: "A", away: "C" },
    { seasonId: "2025-2026" },
  );
  resolveMatchLeagues(db);
  upsertPlayerMatchStat(db, { playerId: 1, matchId: m1, rating: 8, minutes: 900 });
  upsertPlayerMatchStat(db, { playerId: 2, matchId: m2, rating: 7, minutes: 900 });
  computeAllScores(db);
  persistBestXI(db, { minMinutes: 450 });
  return db;
}

describe("query layer", () => {
  it("getLeagues returns all 16, strongest first", () => {
    const db = seededDb();
    const leagues = getLeagues(db);
    expect(leagues).toHaveLength(16);
    expect(leagues[0].id).toBe("eng-1");
    db.close();
  });

  it("getSummary counts eligible players and scored/league matches", () => {
    const db = seededDb();
    const s = getSummary(db);
    expect(s.eligible).toBe(2);
    expect(s.scored).toBe(2);
    expect(s.matches).toBe(2);
    db.close();
  });

  it("getBrowsePlayers ranks by score and derives the player's league", () => {
    const db = seededDb();
    const players = getBrowsePlayers(db);
    expect(players).toHaveLength(2);
    expect(players[0].name).toBe("Striker One"); // higher rating => higher score
    expect(players[0].leagueId).toBe("eng-1");
    db.close();
  });

  it("getBestXI reads the persisted XI and places players in their slots", () => {
    const db = seededDb();
    const { xi, filled } = getBestXI(db);
    expect(filled).toBe(2);
    expect(xi.find((s) => s.slot === "GK").player.name).toBe("Keeper Two");
    expect(xi.find((s) => s.slot === "ST").player.name).toBe("Striker One");
    db.close();
  });

  it("getScoredPlayerIds lists rated players for static pages", () => {
    const db = seededDb();
    expect(getScoredPlayerIds(db).sort()).toEqual([1, 2]);
    db.close();
  });

  it("getPlayer returns score components + a match log", () => {
    const db = seededDb();
    const p = getPlayer(db, 1);
    expect(p.name).toBe("Striker One");
    expect(p.leagueId).toBe("eng-1");
    expect(p.wavg).toBeCloseTo(8, 5);
    expect(p.coefficient).toBeCloseTo(1, 5); // Premier League
    expect(p.matchLog.length).toBe(1);
    expect(p.matchLog[0].league).toBe("Premier League");
    db.close();
  });

  it("getPlayerSeasons aggregates per season and orders chronologically", () => {
    const db = seededDb();
    const ins = db.prepare(
      "INSERT INTO player_season_stats (player_id, season_year, league_id, rating, minutes, appearances, goals, assists) VALUES (?,?,?,?,?,?,?,?)",
    );
    ins.run(1, "25/26", "eng-1", 7.5, 2000, 25, 10, 5);
    ins.run(1, "24/25", "eng-1", 7.0, 2000, 25, 8, 4);
    const seasons = getPlayerSeasons(db, 1);
    expect(seasons.map((s) => s.year)).toEqual(["24/25", "25/26"]); // chronological
    // improving player: later season scores higher
    expect(seasons[1].score).toBeGreaterThan(seasons[0].score);
    expect(seasons[1].score).toBeCloseTo(((7.5 * 2000 + 6.7 * 500) / 2500) * 1.0, 3);
    db.close();
  });

  it("guards a missing db", () => {
    expect(getLeagues(null)).toEqual([]);
    expect(getBestXI(null).filled).toBe(0);
    expect(getSummary(null).eligible).toBe(0);
    expect(getPlayer(null, 1)).toBeNull();
    expect(getScoredPlayerIds(null)).toEqual([]);
  });
});

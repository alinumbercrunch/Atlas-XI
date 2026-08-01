import { getDb, initSchema } from "../../db/index.js";
import { seed } from "../../db/seed.js";
import { upsertMatch, upsertPlayerMatchStat } from "./ingest.js";

// seed() provides the current season that matches.season_id references.
const freshDb = () => {
  const db = initSchema(getDb(":memory:"));
  seed(db);
  return db;
};

const event = {
  id: 16297542,
  date: "2026-06-14",
  home: "AS FAR Rabat",
  away: "Wydad Casablanca",
  tournamentName: "Botola Pro",
  uniqueTournamentId: 937,
};

describe("upsertMatch", () => {
  it("inserts a match, creates its clubs, and is idempotent", () => {
    const db = freshDb();
    const id1 = upsertMatch(db, event, { seasonId: "2025-2026" });
    const id2 = upsertMatch(db, event, { seasonId: "2025-2026" });
    expect(id1).toBe(id2);
    expect(db.prepare("SELECT COUNT(*) n FROM matches").get().n).toBe(1);
    const row = db.prepare("SELECT * FROM matches WHERE id = ?").get(id1);
    expect(row.competition).toBe("Botola Pro");
    expect(row.sofascore_unique_tournament_id).toBe(937);
    expect(row.home_club_id).toBeTruthy();
    expect(row.away_club_id).toBeTruthy();
    db.close();
  });
});

describe("upsertPlayerMatchStat", () => {
  it("inserts then updates a player's stat line (unique per player+match)", () => {
    const db = freshDb();
    db.prepare("INSERT INTO players (id, name) VALUES (1, 'P')").run();
    const matchId = upsertMatch(db, event, { seasonId: "2025-2026" });

    upsertPlayerMatchStat(db, { playerId: 1, matchId, rating: 8.5, minutes: 90, goals: 1 });
    upsertPlayerMatchStat(db, { playerId: 1, matchId, rating: 7.0, minutes: 90, goals: 0 });

    const rows = db.prepare("SELECT * FROM player_match_stats WHERE player_id = 1").all();
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(7.0);
    expect(rows[0].goals).toBe(0);
    db.close();
  });

  it("rejects an out-of-range rating (schema CHECK)", () => {
    const db = freshDb();
    db.prepare("INSERT INTO players (id, name) VALUES (1, 'P')").run();
    const matchId = upsertMatch(db, event, { seasonId: "2025-2026" });
    expect(() =>
      upsertPlayerMatchStat(db, { playerId: 1, matchId, rating: 99, minutes: 90 }),
    ).toThrow();
    db.close();
  });
});

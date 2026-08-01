import { getDb, initSchema } from "../db/index.js";
import { seed } from "../db/seed.js";
import { upsertMatch, upsertPlayerMatchStat } from "../scrapers/sofascore/ingest.js";
import { resolveMatchLeagues, computeAllScores, buildBestXI } from "./run.js";

function freshDb() {
  const db = initSchema(getDb(":memory:"));
  seed(db); // leagues (with sofascore_tournament_id) + current season
  return db;
}

function addPlayer(db, id, name, position, status = "eligible") {
  db.prepare(
    "INSERT INTO players (id, name, primary_position, eligibility_status) VALUES (?, ?, ?, ?)",
  ).run(id, name, position, status);
}

describe("resolveMatchLeagues", () => {
  it("maps league matches and leaves cups null", () => {
    const db = freshDb();
    upsertMatch(
      db,
      { id: 1, uniqueTournamentId: 17, home: "A", away: "B", tournamentName: "PL" },
      { seasonId: "2025-2026" },
    ); // Premier League
    upsertMatch(
      db,
      { id: 2, uniqueTournamentId: 999999, home: "A", away: "C", tournamentName: "Cup" },
      { seasonId: "2025-2026" },
    ); // unknown => cup
    resolveMatchLeagues(db);
    expect(
      db.prepare("SELECT league_id FROM matches WHERE sofascore_event_id = 1").get().league_id,
    ).toBe("eng-1");
    expect(
      db.prepare("SELECT league_id FROM matches WHERE sofascore_event_id = 2").get().league_id,
    ).toBeNull();
    db.close();
  });
});

describe("computeAllScores", () => {
  it("scores only league matches, applying the league coefficient", () => {
    const db = freshDb();
    addPlayer(db, 1, "PL Player", "ST");
    // one Premier League match (coeff 1.0) and one cup match (excluded)
    const plMatch = upsertMatch(
      db,
      { id: 1, uniqueTournamentId: 17, home: "A", away: "B" },
      { seasonId: "2025-2026" },
    );
    const cupMatch = upsertMatch(
      db,
      { id: 2, uniqueTournamentId: 999999, home: "A", away: "C" },
      { seasonId: "2025-2026" },
    );
    resolveMatchLeagues(db);
    upsertPlayerMatchStat(db, { playerId: 1, matchId: plMatch, rating: 8, minutes: 900 });
    upsertPlayerMatchStat(db, { playerId: 1, matchId: cupMatch, rating: 9.9, minutes: 90 });

    computeAllScores(db);
    const ps = db.prepare("SELECT * FROM player_scores WHERE player_id = 1").get();
    expect(ps.matches_count).toBe(1); // cup excluded
    expect(ps.minutes).toBe(900);
    // shrunk toward 6.7 with 900 min at 8.0: (8*900 + 6.7*500)/1400
    expect(ps.shrunk_rating).toBeCloseTo((8 * 900 + 6.7 * 500) / 1400, 3);
    expect(ps.score).toBeCloseTo(ps.shrunk_rating * 1.0, 5); // PL coeff 1.0
    db.close();
  });
});

describe("buildBestXI", () => {
  it("includes only eligible players past the minutes gate", () => {
    const db = freshDb();
    addPlayer(db, 1, "Eligible ST", "ST", "eligible");
    addPlayer(db, 2, "Low-minutes ST", "ST", "eligible");
    addPlayer(db, 3, "Excluded ST", "ST", "excluded");
    const match = upsertMatch(
      db,
      { id: 1, uniqueTournamentId: 17, home: "A", away: "B" },
      { seasonId: "2025-2026" },
    );
    resolveMatchLeagues(db);
    upsertPlayerMatchStat(db, { playerId: 1, matchId: match, rating: 8, minutes: 900 });
    // player 2 & 3 need their own matches (unique per player+match)
    const match2 = upsertMatch(
      db,
      { id: 2, uniqueTournamentId: 17, home: "A", away: "D" },
      { seasonId: "2025-2026" },
    );
    const match3 = upsertMatch(
      db,
      { id: 3, uniqueTournamentId: 17, home: "A", away: "E" },
      { seasonId: "2025-2026" },
    );
    resolveMatchLeagues(db);
    upsertPlayerMatchStat(db, { playerId: 2, matchId: match2, rating: 9, minutes: 100 }); // below 450
    upsertPlayerMatchStat(db, { playerId: 3, matchId: match3, rating: 9, minutes: 900 }); // excluded status
    computeAllScores(db);

    const { xi } = buildBestXI(db, { minMinutes: 450 });
    const st = xi.find((s) => s.slot === "ST");
    expect(st.player.id).toBe(1); // only eligible + enough minutes
    db.close();
  });
});

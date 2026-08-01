import { getDb, initSchema } from "../../db/index.js";
import { findOrCreateClub, buildPlayerRecord, upsertPlayer, ingestPlayer } from "./ingest.js";

const freshDb = () => initSchema(getDb(":memory:"));

describe("findOrCreateClub", () => {
  it("creates once and reuses the same id; null for empty", () => {
    const db = freshDb();
    const a = findOrCreateClub(db, "Wydad Casablanca");
    const b = findOrCreateClub(db, "Wydad Casablanca");
    expect(a).toBe(b);
    expect(findOrCreateClub(db, null)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) n FROM clubs").get().n).toBe(1);
    db.close();
  });
});

describe("buildPlayerRecord", () => {
  it("merges profile over stub and serializes JSON fields", () => {
    const rec = buildPlayerRecord({
      stub: { tmId: "1", name: "Stub Name", position: "CM", clubName: "AS FAR", marketValue: 1000 },
      profile: {
        name: "Real Name",
        citizenships: ["Morocco", "France"],
        seniorCaps: 0,
        marketValue: 2000,
      },
      eligibility: { status: "eligible", moroccanEligible: true },
    });
    expect(rec.name).toBe("Real Name"); // profile wins
    expect(rec.market_value).toBe(2000);
    expect(JSON.parse(rec.citizenships)).toEqual(["Morocco", "France"]);
    expect(rec.primary_position).toBe("CM");
    expect(rec.moroccan_eligible).toBe(1);
    expect(rec.eligibility_status).toBe("eligible");
  });
});

describe("upsertPlayer", () => {
  const record = {
    transfermarkt_id: "42",
    name: "Test Player",
    citizenships: JSON.stringify(["Morocco"]),
    positions: JSON.stringify(["CM"]),
    primary_position: "CM",
    market_value: 5_000_000,
    senior_a_caps: 0,
    moroccan_eligible: 1,
    eligibility_status: "eligible",
    clubName: "RS Berkane",
  };

  it("inserts then updates the same row (idempotent by tmId)", () => {
    const db = freshDb();
    const first = upsertPlayer(db, record);
    expect(first.action).toBe("insert");

    const second = upsertPlayer(db, { ...record, eligibility_status: "review", senior_a_caps: 3 });
    expect(second.action).toBe("update");
    expect(second.id).toBe(first.id);

    expect(db.prepare("SELECT COUNT(*) n FROM players").get().n).toBe(1);
    const row = db.prepare("SELECT * FROM players WHERE id = ?").get(first.id);
    expect(row.eligibility_status).toBe("review");
    expect(row.senior_a_caps).toBe(3);
    expect(row.club_id).toBeTruthy(); // club linked
    db.close();
  });
});

describe("ingestPlayer", () => {
  it("persists a full stub+profile+eligibility as an eligible player", () => {
    const db = freshDb();
    const { id } = ingestPlayer(db, {
      stub: { tmId: "99", clubName: "Raja CA", marketValue: 3000 },
      profile: {
        name: "Ali Test",
        citizenships: ["Morocco", "Belgium"],
        position: "ST",
        seniorCaps: 0,
      },
      eligibility: { status: "eligible", moroccanEligible: true },
    });
    const row = db.prepare("SELECT * FROM players WHERE id = ?").get(id);
    expect(row.name).toBe("Ali Test");
    expect(row.eligibility_status).toBe("eligible");
    expect(JSON.parse(row.citizenships)).toContain("Belgium");
    db.close();
  });
});

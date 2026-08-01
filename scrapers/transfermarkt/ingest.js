// Persistence for discovered/enriched Transfermarkt players.
// Pure record-building is separated from DB writes so it can be unit-tested.

// Find a club by name or create it (league_id assigned later). Returns id or null.
function findOrCreateClub(db, name) {
  if (!name) return null;
  const found = db.prepare("SELECT id FROM clubs WHERE name = ?").get(name);
  if (found) return found.id;
  return db.prepare("INSERT INTO clubs (name) VALUES (?)").run(name).lastInsertRowid;
}

// Merge a discovery stub + enriched profile + eligibility verdict into a DB record.
// Profile fields win over stub fields (profile is the authoritative enrichment).
function buildPlayerRecord({ stub = {}, profile = {}, eligibility }) {
  const citizenships =
    (profile.citizenships && profile.citizenships.length
      ? profile.citizenships
      : stub.citizenships) || [];
  const position = profile.position || stub.position || null;
  return {
    transfermarkt_id: String(profile.tmId || stub.tmId),
    name: profile.name || stub.name,
    birthplace: profile.birthplace ?? null,
    citizenships: JSON.stringify(citizenships),
    positions: JSON.stringify(position ? [position] : []),
    primary_position: position,
    market_value: profile.marketValue ?? stub.marketValue ?? null,
    senior_a_caps: profile.seniorCaps ?? 0,
    moroccan_eligible: eligibility.moroccanEligible ? 1 : 0,
    eligibility_status: eligibility.status,
    clubName: stub.clubName || null,
  };
}

const COLUMNS = [
  "name",
  "birthplace",
  "citizenships",
  "positions",
  "primary_position",
  "club_id",
  "market_value",
  "senior_a_caps",
  "moroccan_eligible",
  "eligibility_status",
  "transfermarkt_id",
  "updated_at",
];

// Upsert a player by transfermarkt_id. Returns { id, action: "insert"|"update" }.
function upsertPlayer(db, record) {
  const existing = db
    .prepare("SELECT id FROM players WHERE transfermarkt_id = ?")
    .get(record.transfermarkt_id);

  const params = {
    name: record.name,
    birthplace: record.birthplace ?? null,
    citizenships: record.citizenships ?? null,
    positions: record.positions ?? null,
    primary_position: record.primary_position ?? null,
    club_id: findOrCreateClub(db, record.clubName),
    market_value: record.market_value ?? null,
    senior_a_caps: record.senior_a_caps ?? 0,
    moroccan_eligible: record.moroccan_eligible ?? 0,
    eligibility_status: record.eligibility_status,
    transfermarkt_id: record.transfermarkt_id,
    updated_at: record.updated_at || new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO players (${COLUMNS.join(", ")})
     VALUES (${COLUMNS.map((c) => "@" + c).join(", ")})
     ON CONFLICT(transfermarkt_id) DO UPDATE SET
       ${COLUMNS.filter((c) => c !== "transfermarkt_id")
         .map((c) => `${c} = excluded.${c}`)
         .join(",\n       ")}`,
  ).run(params);

  const id =
    existing?.id ??
    db.prepare("SELECT id FROM players WHERE transfermarkt_id = ?").get(record.transfermarkt_id).id;
  return { id, action: existing ? "update" : "insert" };
}

// Convenience: build a record from stub+profile+eligibility and upsert it.
function ingestPlayer(db, { stub, profile, eligibility }) {
  return upsertPlayer(db, buildPlayerRecord({ stub, profile, eligibility }));
}

module.exports = { findOrCreateClub, buildPlayerRecord, upsertPlayer, ingestPlayer };

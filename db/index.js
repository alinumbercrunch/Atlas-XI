const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DEFAULT_DB_PATH = path.join(__dirname, "..", "data", "atlas.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

// Open (creating if needed) a database connection with the right PRAGMAs.
// Pass ":memory:" for tests. Env var ATLAS_DB overrides the default path.
function getDb(dbPath = process.env.ATLAS_DB || DEFAULT_DB_PATH) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// Apply the schema (idempotent). Returns the same db for chaining.
function initSchema(db) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

module.exports = { getDb, initSchema, DEFAULT_DB_PATH, SCHEMA_PATH };

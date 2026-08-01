import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";

// Open the shared SQLite DB read-only for the frontend build. If it doesn't exist
// yet (ETL not run), export null and let the query layer return empty results.
// The build runs from the repo root, so resolve against cwd; ATLAS_DB overrides.
// (import.meta.url is unreliable here — Vite rewrites module paths at build time.)
const candidates = [
  process.env.ATLAS_DB,
  path.join(process.cwd(), "data", "atlas.sqlite"),
  path.join(process.cwd(), "..", "data", "atlas.sqlite"),
].filter(Boolean);

const DB_PATH = candidates.find((p) => existsSync(p)) || candidates[candidates.length - 1];

let db = null;
if (existsSync(DB_PATH)) {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma("foreign_keys = ON");
}

export { db, DB_PATH };

-- Atlas XI — SQLite schema (better-sqlite3).
-- Pure DDL, idempotent (CREATE ... IF NOT EXISTS) so it is safe to re-run.
-- Connection PRAGMAs (foreign_keys, WAL) are set in db/index.js, not here.

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- The fixed set of competitions we track, each with a league-strength coefficient.
CREATE TABLE IF NOT EXISTS leagues (
  id                      TEXT PRIMARY KEY,        -- slug, e.g. 'eng-1'
  name                    TEXT NOT NULL,
  country                 TEXT NOT NULL,
  country_code            TEXT NOT NULL,           -- e.g. 'ENG'
  tier                    INTEGER NOT NULL,        -- 1 = top flight, 2 = second division
  coefficient             REAL NOT NULL,           -- league-strength multiplier (0 < c <= ~1)
  sofascore_tournament_id INTEGER,                 -- resolved in later phases
  transfermarkt_id        TEXT,
  CHECK (tier >= 1),
  CHECK (coefficient > 0)
);

CREATE TABLE IF NOT EXISTS clubs (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  league_id        TEXT REFERENCES leagues(id) ON DELETE SET NULL,
  sofascore_id     INTEGER UNIQUE,
  transfermarkt_id TEXT UNIQUE
);

-- Players discovered via Transfermarkt; enriched with SofaScore ids for stats.
CREATE TABLE IF NOT EXISTS players (
  id                 INTEGER PRIMARY KEY,
  name               TEXT NOT NULL,
  birthplace         TEXT,
  birth_country      TEXT,
  citizenships       TEXT,                         -- JSON array of strings
  positions          TEXT,                         -- JSON array of taxonomy codes
  primary_position   TEXT,                         -- one of GK/CB/FB/DM/CM/AM/W/ST
  club_id            INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  market_value       INTEGER,                      -- EUR
  senior_a_caps      INTEGER NOT NULL DEFAULT 0,   -- senior "A"-team caps for ANY country
  moroccan_eligible  INTEGER NOT NULL DEFAULT 0,   -- 0/1
  eligibility_status TEXT NOT NULL DEFAULT 'excluded',
  sofascore_id       INTEGER UNIQUE,
  transfermarkt_id   TEXT UNIQUE,
  updated_at         TEXT,
  CHECK (eligibility_status IN ('eligible', 'review', 'excluded')),
  CHECK (senior_a_caps >= 0),
  CHECK (moroccan_eligible IN (0, 1))
);

-- Manual curation. Keyed by external id so an override can exist BEFORE a player
-- row is discovered (e.g. descent-only players that auto-detection can't find).
CREATE TABLE IF NOT EXISTS overrides (
  id               INTEGER PRIMARY KEY,
  transfermarkt_id TEXT,
  sofascore_id     INTEGER,
  player_name      TEXT NOT NULL,                  -- for human readability
  action           TEXT NOT NULL,
  reason           TEXT,
  CHECK (action IN ('include', 'exclude')),
  CHECK (transfermarkt_id IS NOT NULL OR sofascore_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS seasons (
  id         TEXT PRIMARY KEY,                     -- e.g. '2025-2026'
  label      TEXT NOT NULL,                        -- e.g. '2025/26'
  start_year INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  CHECK (is_current IN (0, 1))
);

CREATE TABLE IF NOT EXISTS matches (
  id                 INTEGER PRIMARY KEY,
  sofascore_event_id INTEGER UNIQUE,
  season_id          TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  league_id          TEXT REFERENCES leagues(id) ON DELETE SET NULL, -- for per-match coefficient
  home_club_id       INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  away_club_id       INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  match_date         TEXT,                                           -- ISO date
  competition        TEXT
);

CREATE TABLE IF NOT EXISTS player_match_stats (
  id        INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rating    REAL,
  minutes   INTEGER,
  goals     INTEGER DEFAULT 0,
  assists   INTEGER DEFAULT 0,
  UNIQUE (player_id, match_id),
  CHECK (minutes IS NULL OR minutes >= 0),
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10))
);

-- Derived season score per player, written by the rating engine (Phase 4).
CREATE TABLE IF NOT EXISTS player_scores (
  player_id     INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id     TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  matches_count INTEGER NOT NULL DEFAULT 0,
  minutes       INTEGER NOT NULL DEFAULT 0,
  wavg_rating   REAL,                              -- minutes-weighted, league-adjusted mean
  shrunk_rating REAL,                              -- after Bayesian shrinkage
  score         REAL,                              -- final rank value
  computed_at   TEXT,
  PRIMARY KEY (player_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_players_eligibility ON players(eligibility_status);
CREATE INDEX IF NOT EXISTS idx_players_club ON players(club_id);
CREATE INDEX IF NOT EXISTS idx_clubs_league ON clubs(league_id);
CREATE INDEX IF NOT EXISTS idx_pms_player ON player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_pms_match ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);

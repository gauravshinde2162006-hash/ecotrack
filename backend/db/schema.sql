-- EcoTrack Database Schema
-- Compatible with SQLite (default) and PostgreSQL (production)
-- ================================================================

-- Users table (single-user for local dev, multi-user for production)
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL DEFAULT 'EcoUser',
  email       TEXT    UNIQUE,
  daily_goal  REAL    NOT NULL DEFAULT 5.0,  -- target kg CO2e per day
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default user for single-user local dev
INSERT OR IGNORE INTO users (id, name, email, daily_goal)
VALUES (1, 'EcoUser', 'user@ecotrack.local', 5.0);

-- Daily log header (one per user per date)
CREATE TABLE IF NOT EXISTS daily_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL DEFAULT 1,
  date        TEXT    NOT NULL,              -- ISO date: "2025-01-15"
  total_co2e  REAL    NOT NULL DEFAULT 0.0,  -- kg CO2e for the day
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Index for O(log n) date-range queries (used with prefix sum)
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON daily_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_logs_date      ON daily_logs(date);

-- Individual activity entries (many per daily log)
CREATE TABLE IF NOT EXISTS log_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id      INTEGER NOT NULL,
  category    TEXT    NOT NULL,   -- "transport", "diet", "electricity", "lpg", "waste"
  subtype     TEXT    NOT NULL,   -- "car_petrol", "vegan", "india_grid", etc.
  quantity    REAL    NOT NULL,   -- raw value (km, kWh, cylinders, kg)
  co2e        REAL    NOT NULL,   -- computed kg CO2e at time of logging
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
);

-- Index for category-level aggregation (used by MaxHeap builder)
CREATE INDEX IF NOT EXISTS idx_entries_log      ON log_entries(log_id);
CREATE INDEX IF NOT EXISTS idx_entries_category ON log_entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_log_cat  ON log_entries(log_id, category);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL DEFAULT 1,
  daily_target REAL    NOT NULL,  -- kg CO2e per day
  start_date   TEXT    NOT NULL,
  end_date     TEXT,              -- null = open-ended
  is_active    INTEGER DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- AI insight cache (1 per user per day — controls API spend)
CREATE TABLE IF NOT EXISTS ai_cache (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL DEFAULT 1,
  cache_date  TEXT    NOT NULL,   -- date this insight was generated for
  prompt_hash TEXT    NOT NULL,   -- SHA256 of the prompt payload for cache validation
  response    TEXT    NOT NULL,   -- full Claude response JSON
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, cache_date),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Prefix sum snapshot (persisted to avoid full rebuild on restart)
CREATE TABLE IF NOT EXISTS prefix_sum_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL DEFAULT 1,
  snapshot    TEXT    NOT NULL,   -- JSON: [{ date, total, prefix }]
  built_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Transport route cache (backup if Redis is down)
CREATE TABLE IF NOT EXISTS route_cache (
  cache_key    TEXT PRIMARY KEY,  -- "origin|destination|mode"
  distance_km  REAL NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

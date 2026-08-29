CREATE TABLE IF NOT EXISTS curate_journeys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  season TEXT,
  year INTEGER,
  started_at TEXT,
  ended_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_curate_journeys_account ON curate_journeys(account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS curate_visits (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  journey_id TEXT,
  vendor_id TEXT,
  vendor_name TEXT,
  place TEXT,
  visited_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (journey_id) REFERENCES curate_journeys(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_curate_visits_account ON curate_visits(account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_curate_visits_journey ON curate_visits(account_id, journey_id);

ALTER TABLE tea_compass_entries ADD COLUMN journey_id TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN visit_id TEXT;
CREATE INDEX IF NOT EXISTS idx_compass_entries_journey ON tea_compass_entries(account_id, journey_id);
CREATE INDEX IF NOT EXISTS idx_compass_entries_visit ON tea_compass_entries(account_id, visit_id);

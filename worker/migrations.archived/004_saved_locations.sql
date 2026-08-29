-- Saved locations (reusable venues for events)
CREATE TABLE IF NOT EXISTS saved_locations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  map_link TEXT,
  guidelines TEXT,
  venue_guide TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Add location_id FK to events table
ALTER TABLE events ADD COLUMN location_id TEXT REFERENCES saved_locations(id);

CREATE INDEX IF NOT EXISTS idx_saved_locations_name ON saved_locations(name);

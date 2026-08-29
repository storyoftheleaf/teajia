-- Migration 025: Venues and Spaces
-- Replaces the flat saved_locations model with a two-level hierarchy:
--   venue  → the physical address (Adrian's Flat, Art Studio)
--   space  → a room/setup within that venue (Charcoal Table, Social Table)
--
-- Events reference a venue_id (address, arrival info) and store an array of
-- active space IDs as JSON in active_space_ids. Capacity auto-sums from the
-- selected spaces but can be overridden on the event.

CREATE TABLE IF NOT EXISTS venues (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  name        TEXT NOT NULL,                    -- "Adrian's Flat", "Art Studio"
  address     TEXT NOT NULL,
  map_link    TEXT,
  area_hint   TEXT,                             -- shown before approval, e.g. "Da'an District"
  arrival_notes TEXT,
  photos      TEXT,                             -- JSON array of image URLs
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS venue_spaces (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  venue_id    TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                    -- "Charcoal Table", "Social Table"
  capacity    INTEGER NOT NULL DEFAULT 10,
  description TEXT,                             -- vibe note shown to guests
  photos      TEXT,                             -- JSON array of image URLs
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Add venue linkage to events (space-aware)
ALTER TABLE events ADD COLUMN venue_id TEXT REFERENCES venues(id);
ALTER TABLE events ADD COLUMN active_space_ids TEXT; -- JSON array of venue_space ids

CREATE INDEX IF NOT EXISTS idx_venues_account       ON venues(account_id);
CREATE INDEX IF NOT EXISTS idx_venue_spaces_venue   ON venue_spaces(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_spaces_account ON venue_spaces(account_id);
CREATE INDEX IF NOT EXISTS idx_events_venue         ON events(venue_id);

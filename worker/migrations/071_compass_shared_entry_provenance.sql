-- 071: Shared Tea Compass entry provenance.
--
-- Shared or claimed compass cards should point back to the source card so a
-- person cannot accidentally import the same shared card multiple times. The
-- optional session link is reserved for future after-session grouping.

ALTER TABLE tea_compass_entries ADD COLUMN source_entry_id TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_compass_entries_source
  ON tea_compass_entries(source_entry_id);

CREATE INDEX IF NOT EXISTS idx_compass_entries_session
  ON tea_compass_entries(session_id);

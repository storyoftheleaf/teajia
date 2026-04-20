-- 018: has_sample flag on compass_shares + source_entry linkage on compass entries

ALTER TABLE compass_shares ADD COLUMN has_sample INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tea_compass_entries ADD COLUMN source_entry_id TEXT REFERENCES tea_compass_entries(id);
ALTER TABLE tea_compass_entries ADD COLUMN session_id TEXT;

-- available_to_taste is a new status — handled at app layer via status column
-- (status column already exists as TEXT, no constraint to alter)

CREATE INDEX IF NOT EXISTS idx_compass_entries_source ON tea_compass_entries(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_compass_entries_session ON tea_compass_entries(session_id);

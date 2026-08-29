-- Persist the Samples workspace archive state across devices.
ALTER TABLE tea_sample_sets ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

-- Keep the Compass tasting queue linked to its durable operational batch.
ALTER TABLE tea_compass_entries ADD COLUMN sample_set_id TEXT REFERENCES tea_sample_sets(id);

CREATE INDEX IF NOT EXISTS idx_compass_account_sample_set
  ON tea_compass_entries(account_id, sample_set_id);

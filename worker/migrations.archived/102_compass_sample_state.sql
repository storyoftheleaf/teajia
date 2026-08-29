ALTER TABLE tea_compass_entries ADD COLUMN sample_state TEXT
  CHECK (sample_state IS NULL OR sample_state IN ('requested', 'received', 'tasted'));

CREATE INDEX IF NOT EXISTS idx_compass_account_sample_state
  ON tea_compass_entries(account_id, sample_state);

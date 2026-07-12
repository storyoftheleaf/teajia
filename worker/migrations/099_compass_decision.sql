ALTER TABLE tea_compass_entries ADD COLUMN decision TEXT
  CHECK (decision IS NULL OR decision IN ('considering', 'selected', 'passed_on'));

CREATE INDEX IF NOT EXISTS idx_compass_account_decision
  ON tea_compass_entries(account_id, decision);

ALTER TABLE tasting_sessions ADD COLUMN event_id TEXT REFERENCES events(id);
CREATE INDEX IF NOT EXISTS idx_tasting_sessions_event ON tasting_sessions(account_id, event_id);

CREATE TABLE IF NOT EXISTS compass_claim_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  source_entry_id TEXT NOT NULL,
  share_id TEXT NOT NULL REFERENCES compass_shares(id),
  entry_id TEXT NOT NULL UNIQUE REFERENCES tea_compass_entries(id),
  claimed_at TEXT NOT NULL,
  UNIQUE(account_id, user_id, source_entry_id)
);
CREATE INDEX IF NOT EXISTS idx_claim_receipts_owner ON compass_claim_receipts(account_id, user_id, claimed_at);

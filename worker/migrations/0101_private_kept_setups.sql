CREATE TABLE IF NOT EXISTS private_kept_setups (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  teas_json TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (account_id, user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_private_kept_setups_archive
  ON private_kept_setups(account_id, user_id, saved_at DESC);

CREATE TABLE IF NOT EXISTS wisdom_entry_verifications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('cultivar', 'region', 'producer', 'style', 'mark', 'namedTea')),
  entry_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (
    length(content_hash) = 64
    AND content_hash NOT GLOB '*[^0-9a-f]*'
  ),
  verified_by_user_id TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, entry_kind, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_wisdom_verifications_account_entry
  ON wisdom_entry_verifications(account_id, entry_kind, entry_id);

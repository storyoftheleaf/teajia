-- An outbound archive connector, a short-lived request queue, and reviewed
-- references. Schema only: no existing tea, inventory or source row changes.
CREATE TABLE IF NOT EXISTS curate_ar_devices (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  paired_by_user_id TEXT,
  secret_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  pair_expires_at INTEGER NOT NULL,
  paired_at INTEGER,
  last_seen_at INTEGER,
  revoked_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_curate_ar_one_active_device
  ON curate_ar_devices(account_id) WHERE account_id IS NOT NULL AND revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS curate_ar_jobs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('search','read')),
  query TEXT,
  source_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','claimed','completed','failed','expired')),
  claimed_device_id TEXT,
  lease_until INTEGER,
  result_json TEXT,
  result_hash TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_curate_ar_queue ON curate_ar_jobs(account_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_curate_ar_expiry ON curate_ar_jobs(expires_at);
CREATE TABLE IF NOT EXISTS curate_ar_links (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  entry_id TEXT NOT NULL REFERENCES tea_compass_entries(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  excerpt_start INTEGER NOT NULL,
  excerpt_end INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  linked_by_user_id TEXT NOT NULL,
  linked_at INTEGER NOT NULL,
  UNIQUE(account_id,entry_id,source_id)
);
CREATE INDEX IF NOT EXISTS idx_curate_ar_links_entry ON curate_ar_links(account_id,entry_id);

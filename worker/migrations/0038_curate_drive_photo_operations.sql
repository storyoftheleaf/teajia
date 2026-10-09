-- External Drive changes have their own durable audit, never a local Curate undo.
CREATE TABLE IF NOT EXISTS curate_drive_photo_operations (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL, mapping_id TEXT NOT NULL,
 compass_entry_id TEXT NOT NULL, photo_url TEXT NOT NULL, drive_file_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('trash','restore')),
 status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed','unknown')),
 attempt_id TEXT NOT NULL,
 actor_user_id TEXT NOT NULL, actor_token_id TEXT NOT NULL, agent_name TEXT NOT NULL,
 connection_fingerprint TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT,
 attempts_json TEXT NOT NULL DEFAULT '[]',
 error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_curate_drive_photo_inflight ON curate_drive_photo_operations(account_id, drive_file_id) WHERE status IN ('pending','unknown');
CREATE INDEX IF NOT EXISTS idx_curate_drive_photo_history ON curate_drive_photo_operations(account_id, compass_entry_id, created_at DESC);

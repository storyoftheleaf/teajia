-- Curate photos saved to the shop's Google Drive (schema only, no rows move).
--
-- curate_drive_links: one Drive per shop, connected by its owner. The refresh
--   token is sealed with KEY_ENCRYPTION_SECRET; the scope is drive.file, so the
--   shop sees only what it made. last_error 'reconnect' means Google withdrew it.
-- curate_drive_folders: the folders the shop made, by what they are for
--   ('root', 'vendor:<id>', 'tea:<entry id>'), so a rename never makes a second.
-- curate_drive_files: which shop photo became which Drive file, so a photo is
--   copied once however often a tea is saved.

CREATE TABLE IF NOT EXISTS curate_drive_links (
  account_id TEXT PRIMARY KEY,
  connected_by_user_id TEXT NOT NULL,
  google_email TEXT,
  refresh_token_encrypted TEXT NOT NULL,
  root_folder_id TEXT,
  last_error TEXT,
  connected_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS curate_drive_folders (
  account_id TEXT NOT NULL,
  folder_key TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, folder_key)
);

CREATE TABLE IF NOT EXISTS curate_drive_files (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  compass_entry_id TEXT,
  photo_url TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  web_view_link TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, compass_entry_id, photo_url)
);
CREATE INDEX IF NOT EXISTS idx_curate_drive_files_entry ON curate_drive_files(account_id, compass_entry_id);

CREATE TABLE IF NOT EXISTS private_kept_setup_photos (
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  id TEXT NOT NULL,
  tea_id TEXT,
  object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, user_id, event_id, id),
  FOREIGN KEY (account_id, user_id, event_id)
    REFERENCES private_kept_setups(account_id, user_id, event_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS private_kept_photo_cleanup (
  object_key TEXT PRIMARY KEY NOT NULL
);

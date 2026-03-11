CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);

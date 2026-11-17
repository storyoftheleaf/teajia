CREATE TABLE capture_shop_photo_approvals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  product_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  approved_by_user_id TEXT NOT NULL REFERENCES users(id),
  approved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE host_article_offers (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  writer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  submission_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  photo_ids TEXT NOT NULL CHECK (json_valid(photo_ids)),
  credit INTEGER NOT NULL CHECK (credit IN (0, 1)),
  author_name TEXT CHECK (credit = 1 OR author_name IS NULL),
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'published', 'declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, writer_user_id, submission_id)
);

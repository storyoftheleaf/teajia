-- Launch 4, favourites in three kinds (todo/plans/guests-and-tea-masters-launch-4-run.md, slice K-C).
-- Columns and tables only; no existing row is touched.
-- A person's kept articles, private until they choose to show them.
CREATE TABLE IF NOT EXISTS favourite_articles (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  is_public  INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id)
);
-- A Tea Chest tea its owner marked as a favourite.
ALTER TABLE personal_cellar_items ADD COLUMN favourite INTEGER NOT NULL DEFAULT 0 CHECK (favourite IN (0,1));

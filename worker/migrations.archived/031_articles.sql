CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  title TEXT NOT NULL,
  subtitle TEXT,
  author_id TEXT,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  cover_image_url TEXT,
  blocks TEXT NOT NULL DEFAULT '[]',
  layout_template TEXT,
  reading_time_mins INTEGER,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_account_status ON articles(account_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);

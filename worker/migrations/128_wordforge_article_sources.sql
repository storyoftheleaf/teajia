-- WordForge-owned article prose, account-scoped and revisioned.
CREATE TABLE IF NOT EXISTS article_external_sources (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  content_hash TEXT NOT NULL,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_external_sources_source
  ON article_external_sources(account_id, source_system, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_external_sources_article
  ON article_external_sources(account_id, article_id);

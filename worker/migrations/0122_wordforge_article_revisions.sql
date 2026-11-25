-- Private WordForge intake history. The source mapping owns the account and
-- points to the compatibility article row. These payloads are never published
-- by the receiver.
CREATE TABLE wordforge_article_revisions (
  id TEXT PRIMARY KEY,
  external_source_id TEXT NOT NULL REFERENCES article_external_sources(id) ON DELETE CASCADE,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  content_hash TEXT NOT NULL,
  assigned_slug TEXT NOT NULL,
  source_article_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (external_source_id, source_revision)
);

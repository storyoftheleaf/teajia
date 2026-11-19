ALTER TABLE articles ADD COLUMN approved_source_revision_id TEXT REFERENCES wordforge_article_revisions(id);
ALTER TABLE articles ADD COLUMN read_issue_slot TEXT;
ALTER TABLE articles ADD COLUMN editorial_receipt_id TEXT;
CREATE UNIQUE INDEX idx_article_read_issue_slot ON articles(account_id, read_issue_slot) WHERE read_issue_slot IS NOT NULL;

CREATE TABLE article_editorial_receipts (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id),
  actor_id TEXT NOT NULL,
  review_digest TEXT NOT NULL,
  candidate_id TEXT NOT NULL REFERENCES wordforge_article_revisions(id),
  public_generation INTEGER NOT NULL,
  prior_edition_json TEXT,
  approved_edition_json TEXT NOT NULL,
  read_issue_slot TEXT,
  approved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

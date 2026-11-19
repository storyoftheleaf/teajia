-- Private replacement candidates for native articles. No existing rows change.
CREATE TABLE article_native_drafts (
  article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  base_generation INTEGER NOT NULL,
  draft_json TEXT NOT NULL CHECK(json_valid(draft_json))
);

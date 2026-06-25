-- Story content: per-field text + photo overrides for a hand-built Read story,
-- with a draft/published split and a small version history. The bespoke page
-- layout stays in code; this holds what the owner edits inline.
--
-- One row per story (the whole editable surface as JSON), kept in two states:
--   state = 'published'  -> what visitors see
--   state = 'draft'      -> the owner's in-progress edits (preview-only)
-- content JSON shape (all keys optional; page falls back to its coded defaults):
--   { "text": { "<fieldKey>": "<string>" },
--     "photos": { "<slot>": { "url": "...", "crop": {scale,x,y} } },
--     "plates": [ "plate-1", "plate-2", ... ]   -- order + membership of the photo row
--   }
CREATE TABLE IF NOT EXISTS story_content (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'published',   -- 'published' | 'draft'
  content TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_story_content_slug_state
  ON story_content(account_id, story_slug, state);

-- Version history: a snapshot each time the owner publishes, newest first.
-- Used for one-click undo / rollback. Keep a bounded number per story.
CREATE TABLE IF NOT EXISTS story_content_versions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  content TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_story_versions_slug
  ON story_content_versions(account_id, story_slug, created_at DESC);

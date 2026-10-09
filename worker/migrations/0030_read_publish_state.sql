-- A Read story is published, or taken back down, from the story itself.
--
-- Adrian, 2026-10-01: "I would rather not have to do it in manage. I should be
-- right on the page." Until now a piece on /read went live only by editing
-- ARTICLE_LIVE in src/pages/read/articleLive.ts and shipping a build. That map
-- stays, and stays the default: this table holds only the states Adrian has
-- set since, by pressing Publish or Unpublish at the end of a story.
--
-- One row per Read path. A row wins over the map in both directions: 'live'
-- publishes a piece the map calls a draft, 'draft' takes down a piece the map
-- calls live (otherwise Porcelain and Tea, live in the map, could never be
-- unpublished). No row means the map decides, exactly as before.
--
-- Schema only: no row is written here. Nothing that is live today changes
-- until somebody presses a button.
--
-- account_id is the Teajia platform account, the magazine's owner, with no
-- default: a row that does not say whose magazine it belongs to is refused,
-- not guessed. state has no default either, because every write states one.
-- changed_by is the user who pressed the button; changed_at is when.

CREATE TABLE IF NOT EXISTS read_publish_state (
  path TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('live', 'draft')),
  changed_by TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_read_publish_state_account
  ON read_publish_state(account_id);

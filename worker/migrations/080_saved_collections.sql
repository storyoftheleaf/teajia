-- 080_saved_collections — a logged-in user's personal shelf of collections they
-- have opened or saved from a shared link.
--
-- Collections are the shareable unit: a curator publishes one and sends a link
-- (/c/:slug). Until now a recipient had no home for the collections sent to
-- them — only the one-off link. This table is that home, keyed on the GLOBAL
-- user id (users.id), NOT scoped by account_id: the whole point is that a
-- customer of Store A may have no account of their own, or belong elsewhere,
-- and still keep a shelf of collections various curators sent them.
--
-- source distinguishes how it landed on the shelf:
--   'received' — auto-recorded when the logged-in user opened a shared link
--                addressed to them (the honest "shared with you" signal — the
--                visit itself is the identity link, no fragile email matching).
--   'saved'    — the user explicitly tapped Save on an open link.
-- A row can start 'received' and a later explicit save is a no-op (kept as
-- received); an explicit save with no prior row is 'saved'. Either way it shows
-- on the same shelf; the badge just reads differently.
--
-- via_slug records which publication link they came through, so the shelf can
-- deep-link back to the exact /c/:slug they were sent (a collection can have
-- several publications).

CREATE TABLE IF NOT EXISTS saved_collections (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  via_slug      TEXT,                       -- publication slug they arrived through
  source        TEXT NOT NULL DEFAULT 'saved', -- 'received' | 'saved'
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_collections_user ON saved_collections(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_collections_collection ON saved_collections(collection_id);

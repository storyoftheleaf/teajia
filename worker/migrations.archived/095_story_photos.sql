-- Story photos: a real image + crop position for each named photo frame in a
-- hand-built Read story page. Keeps the bespoke page layout while letting the
-- owner drag a photo into each frame and pan/zoom it to fit, from admin.
--
-- One row per (story_slug, frame_slot). crop holds the pan/zoom as JSON:
--   { "scale": 1.0, "x": 0.5, "y": 0.5 }  -- x/y are object-position fractions.
CREATE TABLE IF NOT EXISTS story_photos (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali',
  story_slug TEXT NOT NULL,
  frame_slot TEXT NOT NULL,
  image_url TEXT NOT NULL,
  crop TEXT NOT NULL DEFAULT '{"scale":1,"x":0.5,"y":0.5}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_photos_slug_slot
  ON story_photos(account_id, story_slug, frame_slot);

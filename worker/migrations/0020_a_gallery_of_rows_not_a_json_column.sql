-- Photos of a tea master at work, not a headshot: the profile spec wants
-- "people in action," and it wants them orderable and removable one at a
-- time. profile_favorites and payment_methods already answered this same
-- shape question for a person's teas and payment options: one row per item,
-- ordered by `position`, rather than a JSON blob that a single UPDATE has to
-- rewrite whole just to drop one picture. This table follows the same
-- pattern for a person's gallery.
--
-- 3 to 5 images is the editorial ceiling Adrian set for a profile. The admin
-- editor enforces that, not this table, the same way payment_methods lets
-- the editor decide how many payment options are reasonable rather than a
-- CHECK constraint counting rows.
--
-- caption is optional: a photo can stand on its own. image_url is not,
-- because a gallery row with no image is not a gallery row.

CREATE TABLE IF NOT EXISTS contributor_gallery_images (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT CHECK (caption IS NULL OR length(caption) <= 280),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contributor_gallery_images_contributor
  ON contributor_gallery_images(contributor_id, position);

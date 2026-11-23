CREATE TABLE IF NOT EXISTS casual_sit_publications (
  sit_id TEXT PRIMARY KEY NOT NULL REFERENCES member_private_sits(id) ON DELETE CASCADE,
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  writing TEXT NOT NULL,
  tea_name TEXT NOT NULL,
  link_shop_tea INTEGER NOT NULL CHECK (link_shop_tea IN (0, 1)),
  photo_object_key TEXT REFERENCES private_member_sit_photos(object_key) ON DELETE SET NULL,
  photo_public_id TEXT UNIQUE,
  photo_alt TEXT,
  published_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_casual_sit_publications_profile
  ON casual_sit_publications(contributor_id);
CREATE INDEX IF NOT EXISTS idx_casual_sit_publications_photo
  ON casual_sit_publications(photo_object_key);

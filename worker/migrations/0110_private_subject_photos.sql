CREATE TABLE IF NOT EXISTS private_member_sit_photos (
  sit_id TEXT NOT NULL REFERENCES member_private_sits(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (sit_id, user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_private_member_sit_photo_user ON private_member_sit_photos(user_id);

CREATE TRIGGER IF NOT EXISTS queue_deleted_private_member_sit_photo
AFTER DELETE ON private_member_sit_photos
BEGIN
  INSERT OR IGNORE INTO private_kept_photo_cleanup (object_key) VALUES (OLD.object_key);
END;

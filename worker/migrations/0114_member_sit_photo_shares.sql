-- A private original has no share ID until its owner offers it to this sit.
ALTER TABLE private_member_sit_photos ADD COLUMN share_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_private_member_sit_photo_shares
  ON private_member_sit_photos(sit_id, share_id) WHERE share_id IS NOT NULL;

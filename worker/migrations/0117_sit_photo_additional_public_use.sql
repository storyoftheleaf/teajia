-- Existing permissions cover the public recap. The guest must opt in to
-- any additional Teajia appearance when offering the photo.
ALTER TABLE sit_photo_public_permissions
  ADD COLUMN can_show_in_brewing INTEGER NOT NULL DEFAULT 0
  CHECK (can_show_in_brewing IN (0, 1));

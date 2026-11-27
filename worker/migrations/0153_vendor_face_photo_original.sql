-- The whole photo a vendor's face was cut from, so the face can always be
-- reframed in and out again (Adrian, 2026-11-27: "keep the original photo so
-- I can always adjust in and out").
--
-- face_photo stays what every list shows: the framed square. This column holds
-- the uploaded original beside it (the URL /api/upload-image returned), and the
-- photo editor opens on it when the face is reframed.
--
-- Schema only: no row is written. NULL means no original was kept (faces saved
-- before this), and the editor opens on face_photo as before.

ALTER TABLE customers ADD COLUMN face_photo_original TEXT;

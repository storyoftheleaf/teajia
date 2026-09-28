-- A photo placed on a creator's page is cropped by the page, not by the
-- person who placed it: the cover is 420px tall at every width, so the same
-- portrait is a tall frame on a phone and a wide one on a desktop, and the
-- gallery tiles are tall, square and wide in turn. Cropped from the centre,
-- a portrait taken at a workbench loses the face to the bench.
--
-- Each column holds the point that must stay in frame, written the way the
-- page uses it: a CSS object-position of two percentages, "50% 30%". NULL is
-- the honest answer when nobody chose one, and the page reads it as the
-- centre, which is exactly what it did before this column existed.
--
-- Schema only. No row changes.

ALTER TABLE contributors ADD COLUMN portrait_focus TEXT;
ALTER TABLE contributors ADD COLUMN avatar_focus TEXT;
ALTER TABLE contributor_gallery_images ADD COLUMN focus TEXT;

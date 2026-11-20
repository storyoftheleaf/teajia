-- Teajia family: the part of a photograph its author chose to show.
-- One new column, empty for every existing row, which means "the middle of
-- the picture", exactly what is shown today. No row is read or changed.
-- It holds a few numbers (position, zoom, the part shown in percent); the
-- stored picture is never altered, so a crop can always be undone.
ALTER TABLE member_photographs ADD COLUMN frame TEXT;

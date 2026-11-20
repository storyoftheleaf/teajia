-- Teajia family: the shape a photograph is shown in.
-- Plan: todo/plans/teajia-family.md (changes of 2026-11-20).
--
-- Every photograph is shown square unless its author picks upright (2:3) or
-- across (3:2) from the zoom. The stored file is never changed; this is only
-- how it is cropped when shown.
-- One new column with a default. No existing row is read or rewritten.
ALTER TABLE member_photographs ADD COLUMN shape TEXT NOT NULL DEFAULT 'square' CHECK (shape IN ('square', 'upright', 'across'));

-- The five columns the tea-review routes have always written and read.
--
-- Creating a review names voice_notes, source_sample_id, verdict, would_buy and
-- status in its INSERT, and listing reviews filters and orders by status. None
-- of them exist on the live table, so as of 2026-08-31 every attempt to write a
-- review failed and every attempt to list them failed with it. The feature has
-- never worked in production; its migration was never written.
--
-- Types follow what the routes bind: JSON text for voice clips, a text id for
-- the sample a review came from, a text verdict, an integer flag, and a status
-- defaulting to submitted, which is the value the create path already sends and
-- the value the anonymous list path already expects to see.
ALTER TABLE tea_reviews ADD COLUMN voice_notes TEXT;
ALTER TABLE tea_reviews ADD COLUMN source_sample_id TEXT;
ALTER TABLE tea_reviews ADD COLUMN verdict TEXT;
ALTER TABLE tea_reviews ADD COLUMN would_buy INTEGER DEFAULT 0;
ALTER TABLE tea_reviews ADD COLUMN status TEXT DEFAULT 'submitted';

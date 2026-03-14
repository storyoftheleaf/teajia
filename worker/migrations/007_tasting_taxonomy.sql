-- Add structured tasting taxonomy column
-- Stores JSON object: {"flavor":["charcoal"],"body":["full","oily"],...}
-- Legacy columns (tasting_notes, mood) remain in place for backward compatibility
ALTER TABLE products ADD COLUMN tasting TEXT DEFAULT '{}';

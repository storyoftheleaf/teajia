-- Migration 034: Venue profile fields + space tea styles
ALTER TABLE venues ADD COLUMN website TEXT;
ALTER TABLE venues ADD COLUMN instagram TEXT;
ALTER TABLE venue_spaces ADD COLUMN tea_styles TEXT; -- JSON array of style tags

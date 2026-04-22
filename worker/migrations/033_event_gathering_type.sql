-- Add gathering_type column to events table
-- This column was referenced in worker queries but never migrated
ALTER TABLE events ADD COLUMN gathering_type TEXT DEFAULT 'private';

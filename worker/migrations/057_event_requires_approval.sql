-- Add requires_approval flag to events table.
-- Default true preserves existing behaviour (approval-based RSVP) for all
-- pre-existing events. Hosts can flip to false on a per-event basis for
-- casual events where instant confirmation is appropriate.

ALTER TABLE events ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 1;

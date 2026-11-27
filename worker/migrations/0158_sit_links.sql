-- A sit sent by one link, and what was poured at it (Adrian, 2026-11-27).
-- Schema only: no existing row changes.
--
-- events.sit_link_code  the code in /sit/<code>, the one link a host sends
--                       everyone who came. Anyone holding it may open the sit.
-- events.casual_sit     1 for a sit made on the pour page, which may be made
--                       on the day or afterwards and needs no invitation.
-- event_tea_menu.poured_grams       what the host weighed, when they did.
-- event_tea_menu.stock_taken_grams  what that pour took out of stock, so
--                                   taking the pour back returns exactly it.
ALTER TABLE events ADD COLUMN sit_link_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_sit_link_code ON events(sit_link_code) WHERE sit_link_code IS NOT NULL;
ALTER TABLE events ADD COLUMN casual_sit INTEGER NOT NULL DEFAULT 0 CHECK (casual_sit IN (0, 1));
ALTER TABLE event_tea_menu ADD COLUMN poured_grams REAL;
ALTER TABLE event_tea_menu ADD COLUMN stock_taken_grams REAL;

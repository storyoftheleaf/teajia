-- Whether an RSVP wants their first name shown on the public guest list.
--
-- The column was never added to production, but the code both writes it (the
-- public RSVP insert, and the admin attendee update) and reads it (the public
-- event page's guest list). SQLite rejects the whole statement when a column
-- is missing, so as of 2026-08-31 every public event page answered 500 and
-- every RSVP submission failed with it.
--
-- Default 0: nobody appears on a public list until they ask to.
ALTER TABLE event_attendees ADD COLUMN show_in_guest_list INTEGER DEFAULT 0;

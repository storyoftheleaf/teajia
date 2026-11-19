CREATE TABLE IF NOT EXISTS event_attendee_recaps (
  event_id TEXT PRIMARY KEY NOT NULL REFERENCES events(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  session_notes TEXT NOT NULL
);

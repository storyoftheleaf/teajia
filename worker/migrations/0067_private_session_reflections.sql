CREATE TABLE IF NOT EXISTS private_session_reflections (
  attendee_id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  reflection TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(attendee_id, event_id, account_id) REFERENCES event_attendees(id, event_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_session_reflections_owner ON private_session_reflections(account_id, user_id, updated_at);

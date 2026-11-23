CREATE TABLE IF NOT EXISTS session_guest_book (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'included', 'passed')),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, event_id, user_id),
  FOREIGN KEY(attendee_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_guest_book_event ON session_guest_book(account_id, event_id, status);

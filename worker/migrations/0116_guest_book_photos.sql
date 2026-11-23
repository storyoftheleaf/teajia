CREATE TABLE IF NOT EXISTS session_guest_book_photos (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'included', 'passed')),
  offered_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (account_id, user_id, event_id, photo_id)
    REFERENCES private_kept_setup_photos(account_id, user_id, event_id, id) ON DELETE CASCADE,
  FOREIGN KEY (attendee_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_book_photo_active_source
  ON session_guest_book_photos(account_id, event_id, user_id, photo_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guest_book_photo_event_status
  ON session_guest_book_photos(account_id, event_id, status) WHERE revoked_at IS NULL;

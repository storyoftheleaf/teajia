-- A host can give each person in a booking their own after-sit link. The link
-- opens the same after-sit page as the booking's link, but a guest book note
-- written through it is signed with the first name the host gave here.
CREATE TABLE IF NOT EXISTS after_sit_party_links (
  id TEXT PRIMARY KEY NOT NULL,
  credential_hash TEXT NOT NULL UNIQUE,
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  first_name TEXT NOT NULL CHECK (length(first_name) BETWEEN 1 AND 40),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (attendee_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_after_sit_party_links_seat
  ON after_sit_party_links(attendee_id, event_id, account_id);

-- NULL means the note is signed with the booking's own name, as before.
ALTER TABLE session_guest_book ADD COLUMN signed_name TEXT;

-- A later correction back to present must not reactivate any issued link.
CREATE TRIGGER IF NOT EXISTS after_sit_party_revoke_on_attendance_correction
AFTER UPDATE OF attended, status ON event_attendees
WHEN NEW.attended IS NOT 1 OR NEW.status IS NOT 'confirmed'
BEGIN
  DELETE FROM after_sit_party_links
    WHERE attendee_id = OLD.id AND event_id = OLD.event_id AND account_id = OLD.account_id;
END;

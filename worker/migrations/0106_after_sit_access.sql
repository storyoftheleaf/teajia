CREATE TABLE IF NOT EXISTS after_sit_access (
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  credential_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (attendee_id, event_id, account_id),
  FOREIGN KEY (attendee_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id) ON DELETE CASCADE
);

-- A later correction back to present must not reactivate a previously issued link.
CREATE TRIGGER IF NOT EXISTS after_sit_revoke_on_attendance_correction
AFTER UPDATE OF attended, status ON event_attendees
WHEN NEW.attended IS NOT 1 OR NEW.status IS NOT 'confirmed'
BEGIN
  DELETE FROM after_sit_access
    WHERE attendee_id = OLD.id AND event_id = OLD.event_id AND account_id = OLD.account_id;
END;

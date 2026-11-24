-- Copying a guest's after-sit link again adds a link; it never replaces the
-- one already sent. The first link stays in after_sit_access, every later copy
-- lands here, and every check reads both through after_sit_live_access.
-- Withdrawing removes all of a guest's links; each still expires on its own.
CREATE TABLE IF NOT EXISTS after_sit_extra_access (
  credential_hash TEXT PRIMARY KEY NOT NULL,
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (attendee_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_after_sit_extra_access_seat
  ON after_sit_extra_access(attendee_id, event_id, account_id);

CREATE VIEW IF NOT EXISTS after_sit_live_access AS
  SELECT attendee_id, event_id, account_id, credential_hash, expires_at FROM after_sit_access
  UNION ALL
  SELECT attendee_id, event_id, account_id, credential_hash, expires_at FROM after_sit_extra_access;

-- A later correction back to present must not reactivate any issued link.
CREATE TRIGGER IF NOT EXISTS after_sit_extra_revoke_on_attendance_correction
AFTER UPDATE OF attended, status ON event_attendees
WHEN NEW.attended IS NOT 1 OR NEW.status IS NOT 'confirmed'
BEGIN
  DELETE FROM after_sit_extra_access
    WHERE attendee_id = OLD.id AND event_id = OLD.event_id AND account_id = OLD.account_id;
END;

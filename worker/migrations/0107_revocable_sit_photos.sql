CREATE TABLE IF NOT EXISTS sit_photo_public_permissions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience = 'public_recap'),
  credit TEXT NOT NULL CHECK (length(trim(credit)) BETWEEN 1 AND 120),
  offered_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE (account_id, event_id, id),
  FOREIGN KEY (account_id, user_id, event_id, photo_id)
    REFERENCES private_kept_setup_photos(account_id, user_id, event_id, id) ON DELETE CASCADE,
  FOREIGN KEY (attendee_id, event_id, account_id)
    REFERENCES event_attendees(id, event_id, account_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sit_photo_one_active_permission
  ON sit_photo_public_permissions(account_id, user_id, event_id, photo_id, audience)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sit_photo_permission_source
  ON sit_photo_public_permissions(account_id, user_id, event_id, photo_id);

CREATE TABLE IF NOT EXISTS sit_photo_recap_placements (
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  alt_text TEXT NOT NULL CHECK (length(trim(alt_text)) BETWEEN 1 AND 250),
  observation TEXT CHECK (length(observation) <= 280),
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT NOT NULL,
  PRIMARY KEY (account_id, event_id),
  FOREIGN KEY (account_id, event_id, permission_id)
    REFERENCES sit_photo_public_permissions(account_id, event_id, id) ON DELETE CASCADE
);

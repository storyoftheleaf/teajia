CREATE TABLE IF NOT EXISTS member_private_sits (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  sit_date TEXT NOT NULL,
  title TEXT,
  description TEXT,
  tea_id TEXT,
  tea_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (owner_user_id, request_id)
);

CREATE TABLE IF NOT EXISTS member_private_sit_invites (
  token_hash TEXT PRIMARY KEY NOT NULL,
  sit_id TEXT NOT NULL REFERENCES member_private_sits(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  accepted_by_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (sit_id, accepted_by_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS member_private_sit_one_pending_invite
  ON member_private_sit_invites(sit_id)
  WHERE accepted_by_user_id IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS member_private_sit_guest_history
  ON member_private_sit_invites(accepted_by_user_id, sit_id);

CREATE TABLE IF NOT EXISTS member_private_sit_notes (
  sit_id TEXT NOT NULL REFERENCES member_private_sits(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  PRIMARY KEY (sit_id, user_id)
);

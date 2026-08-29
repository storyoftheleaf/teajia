-- Preserve established identities (Google, platform tier, or an already-active
-- membership). Standalone legacy password registrations must prove email
-- ownership before they can inherit a future privileged invitation.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at, datetime('now'))
WHERE google_id IS NOT NULL
   OR platform_role IS NOT NULL
   OR EXISTS (
     SELECT 1 FROM account_members am
     WHERE am.user_id = users.id AND am.status = 'active'
   );

CREATE TABLE IF NOT EXISTS identity_email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose = 'signup-email'),
  code_hash TEXT NOT NULL,
  client_nonce_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_identity_email_verifications_user
  ON identity_email_verifications(user_id, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_jobs (
  account_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  lock_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, operation)
);

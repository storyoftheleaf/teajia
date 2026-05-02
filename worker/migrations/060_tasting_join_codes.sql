-- 060: Tasting Event join codes.
--
-- The host issues a 6-digit code for an in-person tasting session. Guests redeem
-- the code together with their first name + email; the redeem endpoint creates a
-- passwordless account (or logs them into an existing one by email match) and
-- adds them to tasting_session_members.
--
-- Codes expire 24h after creation, are bound to a single session, can be revoked
-- by the host, and increment a redemption_count for telemetry.

CREATE TABLE IF NOT EXISTS tasting_join_codes (
  code TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  redemption_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_join_codes_session ON tasting_join_codes(session_id);
CREATE INDEX IF NOT EXISTS idx_join_codes_active ON tasting_join_codes(session_id, expires_at, revoked_at);

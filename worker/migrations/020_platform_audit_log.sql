-- Migration 020: Platform audit log
-- Records all platform-level administrative actions for accountability.
-- Account-scoped activity is already tracked in activity_logs.
-- This table captures cross-account and platform-level actions only.

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  action      TEXT NOT NULL,       -- e.g. 'account.created', 'feature.toggled', 'platform_role.changed', 'account.suspended'
  actor_id    TEXT,                -- user_id of who did it
  actor_email TEXT,                -- denormalised for readability after user deletion
  target_type TEXT,                -- 'account' | 'user' | 'feature' | 'member'
  target_id   TEXT,                -- id of the affected entity
  details     TEXT DEFAULT '{}',   -- JSON: extra context (old value, new value, etc.)
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_actor   ON platform_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_target  ON platform_audit_log(target_id);

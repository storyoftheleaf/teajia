-- Migration 019: Platform roles, simplified account roles, account features
-- Adds:
--   users.platform_role       — NULL | 'platform_admin' | 'platform_owner' (one person max)
--   account_features          — platform-owner-controlled feature flags per account
--   account_members.permissions — account-owner-controlled per-member feature permissions
-- Changes:
--   account_members.role: drops 'manager' tier — existing manager rows → 'staff'

-- ── 1. Platform role on users ─────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN platform_role TEXT DEFAULT NULL;
-- Values: NULL (normal), 'platform_admin', 'platform_owner'

-- Seed Adrian as platform_owner via his user row.
-- Update the WHERE clause to match Adrian's actual email if different.
UPDATE users SET platform_role = 'platform_owner' WHERE email = 'adrianrasmussen@gmail.com';

-- ── 2. Migrate manager → staff in account_members ────────────────────────────
UPDATE account_members SET role = 'staff' WHERE role = 'manager';

-- ── 3. Per-member feature permissions ────────────────────────────────────────
ALTER TABLE account_members ADD COLUMN permissions TEXT NOT NULL DEFAULT '{}';
-- JSON object e.g. '{"ai_wisdom": true}'
-- account owner controls this per member; only relevant if account has the feature enabled

-- ── 4. Account-level feature flags ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_features (
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 0,
  enabled_by  TEXT REFERENCES users(id),
  enabled_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, feature)
);

-- Seed ai_wisdom_generation for Adrian's account (platform owner always has access,
-- but this makes it explicit and allows granting to other members later)
INSERT OR IGNORE INTO account_features (account_id, feature, enabled, enabled_by)
SELECT a.id, 'ai_wisdom_generation', 1, u.id
FROM accounts a, users u
WHERE a.is_platform_owner = 1 AND u.platform_role = 'platform_owner'
LIMIT 1;

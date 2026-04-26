-- 047_members_access.sql
-- Step 0 (Members & Access) schema additions for the Network Rollout.
-- Adds:
--   accounts.kind                — 'platform' | 'location' | 'master'
--   account_applications         — pending requests to join the network
--   account_members.permissions  — backfilled with bundles array
-- Drops (logically; columns remain for one release as deprecated):
--   users.can_create_collections — superseded by Tea Master tier
--
-- Bundle resolution at runtime (handled in worker, not in SQL):
--   Platform Owner / Admin       → all six bundles on every account
--   Location Owner / Tea Master  → all six bundles on own account (Members locked-on)
--   Member                       → bundles array from account_members.permissions.bundles
--   Guest                        → none
--
-- Six bundles: catalog, stock, publish, gather, sell, members

-- ── 1. accounts.kind ─────────────────────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'location';
-- Values: 'platform' (Adrian's hub), 'location' (tea house), 'master' (Tea Master)

-- Backfill: the platform-owner account becomes 'platform'; everyone else stays 'location'.
-- Tea Master conversion is a manual step Adrian runs later per-account; this migration
-- intentionally does not auto-promote anyone.
UPDATE accounts SET kind = 'platform' WHERE is_platform_owner = 1;

CREATE INDEX IF NOT EXISTS idx_accounts_kind ON accounts(kind);

-- ── 2. account_applications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_applications (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  applicant_email       TEXT NOT NULL,
  applicant_name        TEXT,
  proposed_account_kind TEXT NOT NULL,        -- 'location' | 'master'
  note                  TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
                                              -- 'pending' | 'approved' | 'declined' | 'withdrawn'
  decided_by_user_id    TEXT REFERENCES users(id),
  decided_at            TEXT,
  decision_note         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_account_applications_status ON account_applications(status);
CREATE INDEX IF NOT EXISTS idx_account_applications_email  ON account_applications(applicant_email);

-- ── 3. Backfill account_members.permissions with bundle arrays ──────────────
-- The permissions column already exists (added in 019). It currently stores
-- shapes like '{"ai_wisdom_generation": true}'. We backfill a `bundles` array
-- derived from each member's current role.
--
-- Bundle defaults by role (these mirror NETWORK_ROLLOUT_PLAN.md decision §0):
--   owner   → all six bundles (Members locked-on)
--   staff   → catalog, stock, sell
--   viewer  → empty
--
-- We use json_patch to merge `bundles` into whatever is currently there, so
-- any existing feature flags (like ai_wisdom_generation) are preserved during
-- the transition. The worker drops ai_wisdom_generation in code in sub-step 0.3.

UPDATE account_members
SET permissions = json_patch(
  COALESCE(NULLIF(permissions, ''), '{}'),
  '{"bundles":["catalog","stock","publish","gather","sell","members"]}'
)
WHERE role = 'owner';

UPDATE account_members
SET permissions = json_patch(
  COALESCE(NULLIF(permissions, ''), '{}'),
  '{"bundles":["catalog","stock","sell"]}'
)
WHERE role = 'staff';

UPDATE account_members
SET permissions = json_patch(
  COALESCE(NULLIF(permissions, ''), '{}'),
  '{"bundles":[]}'
)
WHERE role = 'viewer';

-- ── 4. Curator flag deprecation (Option A — drop fully) ─────────────────────
-- The `users.can_create_collections` flag from migration 040 is superseded by
-- the Tea Master tier (accounts.kind = 'master'). We do NOT auto-promote any
-- current curator to Tea Master — Adrian decides per-person. Once decided, he
-- runs:
--
--   UPDATE accounts SET kind = 'master' WHERE id = 'acc_<their_id>';
--
-- After all current curators are reviewed and their accounts (re)kinded, the
-- can_create_collections column becomes pure dead weight and a follow-up
-- migration drops it.
--
-- For now: leave the column in place (don't break collection-create flow that
-- still reads it), but the worker's authorization no longer consults it. The
-- worker will check `accounts.kind = 'master'` OR `account_members has
-- 'publish' bundle` instead.

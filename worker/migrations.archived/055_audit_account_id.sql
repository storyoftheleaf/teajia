-- Migration 055: Add account_id to platform_audit_log so per-account audit
-- views can filter cleanly without inferring from target_type/target_id.
-- Backfills existing rows where target_type = 'account'.

ALTER TABLE platform_audit_log ADD COLUMN account_id TEXT;

UPDATE platform_audit_log
SET account_id = target_id
WHERE target_type = 'account' AND account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_audit_account ON platform_audit_log(account_id, created_at DESC);

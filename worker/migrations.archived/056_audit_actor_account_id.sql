-- Migration 056: Add actor_account_id to platform_audit_log so we can distinguish
-- "the account this action targeted" (account_id) from "the account context the
-- actor was operating in when the action fired" (actor_account_id).
--
-- Closes audit Finding #31. account_id alone collapsed two meanings:
--   1. Adrian acting in account X (target=X, actor was in X)
--   2. Platform-wide action affecting account X (target=X, actor was platform)
-- After this migration:
--   account_id        = the account the action targets (or NULL platform-wide)
--   actor_account_id  = the account context the actor was operating in (always set
--                       when known; equals the active acting-as account or the
--                       platform/owner's home account)

ALTER TABLE platform_audit_log ADD COLUMN actor_account_id TEXT;

-- Backfill: existing rows wrote account_id from the actor's active context, so
-- copy it across. Rows where account_id is NULL stay NULL (best we can do for
-- legacy data — going forward the helper sets actor_account_id explicitly).
UPDATE platform_audit_log
   SET actor_account_id = account_id
 WHERE actor_account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_audit_actor_account
  ON platform_audit_log(actor_account_id, created_at DESC);

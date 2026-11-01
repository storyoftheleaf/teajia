-- Polling must not revisit retained tombstones or completed, unexpired jobs.
-- The partial queue index matches the claim query's explicit status IN clause.
CREATE INDEX IF NOT EXISTS idx_curate_ar_unexpired_cleanup
  ON curate_ar_jobs(expires_at) WHERE status!='expired';
CREATE INDEX IF NOT EXISTS idx_curate_ar_claim_active
  ON curate_ar_jobs(account_id,created_by_user_id,created_at,id)
  WHERE status IN ('pending','claimed');
-- Temporary incident mitigation indexed all recent jobs, including completed.
DROP INDEX IF EXISTS idx_curate_ar_claim_recent;

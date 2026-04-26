-- 051_network_adoption.sql
-- Step 6 of the Network Rollout — cross-pollination adoption queue.
-- Per docs/NETWORK_ROLLOUT_PLAN.md Step 6.
--
-- A partner who originates a tea profile (one Adrian doesn't yet curate)
-- can flag it as a candidate for network-wide adoption. Adrian sees these
-- in his /admin/network adoption queue and either adopts (transferring
-- curated_by_account_id to his account, making the profile network-visible
-- to all partners' catalog browse) or declines.
--
-- Schema additions to tea_profiles:
--   suggested_for_network_at — non-null when the originator has flagged it
--   suggested_for_network_by_user_id — who flagged it (audit trail)
--   suggested_for_network_note — optional rationale from the partner
--   adoption_decision — 'pending' | 'adopted' | 'declined' | NULL (never flagged)
--   adoption_decided_at — when Adrian decided
--   adoption_decided_by_user_id — which platform-tier user decided
--   adoption_decline_note — optional reason returned to the partner
--
-- All ADDITIVE. No changes to existing rows or columns.

ALTER TABLE tea_profiles ADD COLUMN suggested_for_network_at TEXT;
ALTER TABLE tea_profiles ADD COLUMN suggested_for_network_by_user_id TEXT REFERENCES users(id);
ALTER TABLE tea_profiles ADD COLUMN suggested_for_network_note TEXT;
ALTER TABLE tea_profiles ADD COLUMN adoption_decision TEXT;
ALTER TABLE tea_profiles ADD COLUMN adoption_decided_at TEXT;
ALTER TABLE tea_profiles ADD COLUMN adoption_decided_by_user_id TEXT REFERENCES users(id);
ALTER TABLE tea_profiles ADD COLUMN adoption_decline_note TEXT;

-- Index for the adoption queue: pending suggestions ordered by submission time.
CREATE INDEX IF NOT EXISTS idx_profiles_adoption_pending
  ON tea_profiles(adoption_decision, suggested_for_network_at)
  WHERE adoption_decision = 'pending';

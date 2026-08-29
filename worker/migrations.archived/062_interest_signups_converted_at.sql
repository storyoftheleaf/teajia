-- Add converted_at + customer_id to interest_signups.
-- Worker has been writing UPDATE ... SET converted_at = datetime('now') and
-- SELECTing si.converted_at since the interest-signups admin tab shipped,
-- but no migration ever added the column. Without it, /api/admin/events 500s
-- (the COUNT(*) WHERE converted_at IS NULL subquery fails) and the convert
-- flow silently swallows the UPDATE error.
--
-- customer_id was in the original 004_events_v2 / 018 table definition but
-- the remote DB row from migration 018 didn't include it for some accounts;
-- adding IF NOT EXISTS-style guard via separate ALTER (D1 has no IF NOT
-- EXISTS for ADD COLUMN, so this migration only adds converted_at — the
-- customer_id case is handled by 018 already where it applied).

ALTER TABLE interest_signups ADD COLUMN converted_at TEXT;

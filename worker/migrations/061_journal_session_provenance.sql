-- 061: Track which tasting session produced each customer_tasting_journal row.
--
-- When a verdict is submitted from a Tasting Event, the worker dual-writes:
-- (a) tasting_session_verdicts (host live view), and
-- (b) customer_tasting_journal (the guest's permanent personal record).
--
-- These columns let us trace bridged journal rows back to the originating
-- session for filtering ("show me everything from Adrian's Saturday tasting"),
-- and survive even if the session is deleted (we keep session_title denormalized).
--
-- Both columns nullable: rows from direct-on-product-page tastings have neither.
-- source_type was added by migration 041; bridged rows write 'session' there.

ALTER TABLE customer_tasting_journal ADD COLUMN session_id TEXT;
ALTER TABLE customer_tasting_journal ADD COLUMN session_title TEXT;
CREATE INDEX IF NOT EXISTS idx_ctj_session ON customer_tasting_journal(session_id);

-- Launch 1, the first table (todo/plans/guests-and-tea-masters-launch-1-run.md).
-- Columns and one new table only. No existing row is changed: older Tea Chest
-- teas keep source_kind NULL, which the screens show as nothing at all.

-- A session may carry one published article for its guests to read.
ALTER TABLE events ADD COLUMN reading_article_id TEXT;
-- A short random reference a thank-you's tea links carry, so an order request
-- can say which session it began from without any guest secret in an address.
ALTER TABLE events ADD COLUMN thanks_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_thanks_ref ON events(thanks_ref) WHERE thanks_ref IS NOT NULL;

-- Where a Tea Chest tea came from. 'bought' and 'session' are set by the site;
-- 'gift' and 'own' are chosen by hand.
ALTER TABLE personal_cellar_items ADD COLUMN source_kind TEXT CHECK (source_kind IN ('bought','gift','session','own'));
ALTER TABLE personal_cellar_items ADD COLUMN source_from_name TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN source_event_id TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN source_tea_ref TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN source_invoice_id TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN source_invoice_line_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cellar_bought_once
  ON personal_cellar_items(owner_user_id, source_invoice_line_id) WHERE source_invoice_line_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cellar_session_once
  ON personal_cellar_items(owner_user_id, source_event_id, source_tea_ref) WHERE source_kind = 'session';

-- One row per order request that began from a session's thank-you. Written by
-- recordOrderSessionSource only. Nothing reads it to show, pay or rank yet.
CREATE TABLE IF NOT EXISTS order_session_sources (
  inquiry_id   TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  host_user_id TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

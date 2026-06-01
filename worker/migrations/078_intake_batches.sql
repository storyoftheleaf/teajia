-- 078_intake_batches.sql
-- Intake batches: group stock arrivals into named shipments / intake sessions.
--
-- Two layers:
--   1. batches            — the shipment/session itself (label + the date Adrian asserts).
--   2. stock_ledger.batch_id — stamps each PURCHASE_RECEIPT (intake) row with its shipment.
--
-- A tea's *origin* is NOT stored here — it's derived from its earliest PURCHASE_RECEIPT,
-- so it can never drift. The same tea legitimately appears in many batches (first
-- acquisition + each restock). intake_date is nullable so undated old stock is allowed.

CREATE TABLE IF NOT EXISTS batches (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    account_id  TEXT NOT NULL,
    label       TEXT NOT NULL,            -- e.g. "June 2026 order", "Personal aged stock"
    intake_date TEXT,                     -- the real-world acquisition date Adrian asserts (nullable)
    vendor      TEXT,                     -- optional sourcing label
    note        TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_batches_account ON batches(account_id);

-- Label intake-event ledger rows with their shipment. Nullable: all existing
-- history stays valid and simply reads as "no batch".
ALTER TABLE stock_ledger ADD COLUMN batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch ON stock_ledger(batch_id);

-- Seed one "Unsorted" catch-all batch per existing account, so there is always a
-- default to fall into when stock is added without choosing a batch.
INSERT INTO batches (id, account_id, label, intake_date)
SELECT 'unsorted_' || a.id, a.id, 'Unsorted', NULL
FROM accounts a
WHERE NOT EXISTS (
    SELECT 1 FROM batches b WHERE b.account_id = a.id AND b.label = 'Unsorted'
);

-- Tea credit review fixes (todo/review/findings/A8.md, A10.md A10-1).
-- Creates and alters only. No existing row is changed, added or removed.

-- When each order was first Filled, and whether tea credit was open then.
-- The row is written by the triggers below on the first move to Filled, from
-- any path, so it exists for every Fill made after this migration. Its
-- credit_open is set once by the worker's settle that follows that write:
-- 1 when HOST_CREDIT was open, 0 when it was closed. An order Filled while
-- closed never earns later (A8-5); the rule lives in worker/src/hostCreditLedger.ts
-- (CLOSED_FILL_EARNS_LATER). An order Filled before this migration has no row,
-- and the ledger reads that as "Filled before the record began".
CREATE TABLE IF NOT EXISTS host_credit_fills (
  invoice_id  TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  filled_at   TEXT NOT NULL DEFAULT (datetime('now')),
  credit_open INTEGER CHECK (credit_open IS NULL OR credit_open IN (0, 1))
);

CREATE TRIGGER IF NOT EXISTS host_credit_first_fill_insert
AFTER INSERT ON invoices WHEN NEW.status = 'Filled'
BEGIN
  INSERT OR IGNORE INTO host_credit_fills (invoice_id, account_id) VALUES (NEW.id, NEW.account_id);
END;

CREATE TRIGGER IF NOT EXISTS host_credit_first_fill_update
AFTER UPDATE OF status ON invoices WHEN NEW.status = 'Filled' AND OLD.status IS NOT 'Filled'
BEGIN
  INSERT OR IGNORE INTO host_credit_fills (invoice_id, account_id) VALUES (NEW.id, NEW.account_id);
END;

-- A host's Idempotency-Key for one use of credit on one order (A8-8): a replay
-- with the same key returns the request it first made, whatever became of it.
ALTER TABLE host_credit_spend_requests ADD COLUMN request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_host_credit_requests_key
  ON host_credit_spend_requests(account_id, host_user_id, invoice_id, request_key)
  WHERE request_key IS NOT NULL;

-- Why the worker, not the owner, ended a hold (A8-3, A8-9). The request keeps
-- status 'declined' with decided_by_user_id 'system', so its history stays:
-- 'order_void' (the order was made Void or removed) or 'order_changed' (the
-- tea or the amount owed no longer covers it when the owner approves).
ALTER TABLE host_credit_spend_requests ADD COLUMN release_reason TEXT;

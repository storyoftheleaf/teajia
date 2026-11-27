-- Tea credit review fixes A8-6 and A8-7 (todo/review/findings/A8.md,
-- todo/review/fixes/last.md). Creates and alters only. No existing row is
-- changed, added or removed.

-- A8-6: a staff seller cannot award credit on their own. filled_by_staff is
-- the person, not the shop's owner, whose Fill made the order Filled; the
-- worker stamps it (worker/src/hostCreditLedger.ts). While it is set the
-- order earns nothing until the owner approves it in Manage's second look.
ALTER TABLE host_credit_fills ADD COLUMN filled_by_staff TEXT;

-- Taken out of Filled, that Fill no longer stands: the next Fill decides again.
CREATE TRIGGER IF NOT EXISTS host_credit_fill_staff_cleared_on_reopen
AFTER UPDATE OF status ON invoices WHEN OLD.status = 'Filled' AND NEW.status IS NOT 'Filled'
BEGIN
  UPDATE host_credit_fills SET filled_by_staff = NULL WHERE invoice_id = NEW.id;
END;

-- A8-7: a Void that would reverse credit the host has already spent reverses
-- only what is unspent, so the signed ledger never goes below zero. The rest is
-- absorbed by the shop and kept here, one row per award, for the owner to see
-- in Manage. Nobody is told.
CREATE TABLE IF NOT EXISTS host_credit_shortfalls (
  award_entry_id TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL,
  host_user_id   TEXT NOT NULL,
  invoice_id     TEXT NOT NULL,
  amount         REAL NOT NULL CHECK (amount > 0),
  currency       TEXT NOT NULL CHECK (length(currency) = 3 AND currency != 'UNK'),
  reason         TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_host_credit_shortfalls_account ON host_credit_shortfalls (account_id, created_at);

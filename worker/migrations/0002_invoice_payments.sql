-- Money gets its own records.
--
-- Before this table the system knew only a status word on the invoice, which
-- could say "partial" without storing how much, and could never hold a
-- customer's report of a transfer separately from money actually seen. One row
-- per payment fixes both and gives a payment history for free.
--
-- The whole boundary of the feature lives in two columns. `claimed_by` says who
-- put the row there, `status` says whether it is money. A customer writes
-- ('customer','claimed') and that changes nothing about what the order is owed.
-- Only a ('*','confirmed') row counts toward paid, and only an operator can
-- move a row into that state.
CREATE TABLE IF NOT EXISTS invoice_payments (
  id                  TEXT PRIMARY KEY,
  invoice_id          TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  account_id          TEXT NOT NULL REFERENCES accounts(id),
  amount_usd          REAL NOT NULL CHECK (amount_usd > 0),
  amount_original     REAL,
  currency            TEXT,
  payment_method_id   TEXT REFERENCES payment_methods(id),
  method_label        TEXT,
  reference           TEXT,
  note                TEXT,
  status              TEXT NOT NULL DEFAULT 'claimed'
                        CHECK (status IN ('claimed','confirmed','rejected')),
  claimed_by          TEXT NOT NULL CHECK (claimed_by IN ('customer','operator')),
  claimed_at          TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_by_user_id TEXT REFERENCES users(id),
  confirmed_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Two reads exist and these are them.
--
-- 1. "What has been paid on these invoices" — the aggregate every invoice-shaped
--    response now runs once per page, keyed by invoice with the status in the
--    index so the conditional sums never touch the table.
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice
  ON invoice_payments(invoice_id, status);

-- 2. "Which reports are still waiting on me" — the admin lists pending claims
--    across every order in the account, so account plus status leads.
CREATE INDEX IF NOT EXISTS idx_invoice_payments_account_status
  ON invoice_payments(account_id, status, claimed_at DESC);

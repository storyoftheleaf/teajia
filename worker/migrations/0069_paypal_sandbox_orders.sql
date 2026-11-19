-- Local PayPal sandbox attempts only. No live payment configuration or backfill.
CREATE TABLE IF NOT EXISTS paypal_sandbox_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  quote_key TEXT NOT NULL,
  amount_usd REAL NOT NULL CHECK(amount_usd > 0),
  paypal_order_id TEXT UNIQUE,
  approval_url TEXT,
  capture_id TEXT UNIQUE,
  state TEXT NOT NULL DEFAULT 'created' CHECK(state IN ('created','pending','completed','failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_paypal_sandbox_active_quote
  ON paypal_sandbox_orders(account_id, invoice_id, quote_key) WHERE state != 'failed';

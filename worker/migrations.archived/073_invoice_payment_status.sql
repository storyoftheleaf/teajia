-- Migration 073 - invoice payment tracking columns for MCP commerce.
--
-- The historical root-level migrations/013_invoice_payment_status.sql was not
-- present in worker/migrations, so remote D1 instances managed by Wrangler can
-- lack these columns. MCP record_sale writes payment_status='unpaid' and
-- mark_invoice_paid updates payment_status/payment_date/payment_method.

ALTER TABLE invoices ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE invoices ADD COLUMN payment_date TEXT;
ALTER TABLE invoices ADD COLUMN payment_method TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices (account_id, payment_status);

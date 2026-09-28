-- A request retains its approximate destination; shipping is a later operator step.
ALTER TABLE invoices ADD COLUMN shipping_destination TEXT;
ALTER TABLE invoices ADD COLUMN tracking_number TEXT;
ALTER TABLE invoices ADD COLUMN stock_exception TEXT;
ALTER TABLE invoices ADD COLUMN source_inquiry_id TEXT;
ALTER TABLE accounts ADD COLUMN order_whatsapp_notifications_enabled INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_whatsapp_outbox (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  order_ref TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_contact TEXT,
  delivery_location TEXT,
  order_summary TEXT,
  invoice_url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  lease_token TEXT,
  lease_expires_at TEXT,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_order_whatsapp_outbox_due
  ON order_whatsapp_outbox(state, next_attempt_at);

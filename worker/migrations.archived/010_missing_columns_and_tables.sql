-- Fix missing columns and tables that the worker code depends on
-- Verified against live D1 schema on 2026-03-22

-- 1. Stock Ledger table (required for all stock change tracking)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    product_id TEXT NOT NULL REFERENCES products(id),
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    source_invoice_id TEXT,
    source_invoice_number TEXT,
    user_email TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Activity Logs: add entity_type and entity_id columns
ALTER TABLE activity_logs ADD COLUMN entity_type TEXT;
ALTER TABLE activity_logs ADD COLUMN entity_id TEXT;

-- 3. Invoices: add customer_id, deleted_at, and notes columns
ALTER TABLE invoices ADD COLUMN customer_id TEXT;
ALTER TABLE invoices ADD COLUMN deleted_at TEXT;
ALTER TABLE invoices ADD COLUMN notes TEXT;

-- 4. Products: add sold_out_at column (used by fulfill/void invoice)
ALTER TABLE products ADD COLUMN sold_out_at TEXT;

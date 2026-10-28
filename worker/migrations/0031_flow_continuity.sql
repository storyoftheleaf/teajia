-- Additive repair only: existing financial/capture facts are not rewritten.
ALTER TABLE tea_compass_entries ADD COLUMN clay_type TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN material_note TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN sell_price REAL;
ALTER TABLE tea_compass_entries ADD COLUMN tasting_history TEXT;
ALTER TABLE curate_import_batches ADD COLUMN intake_state TEXT;
ALTER TABLE curate_import_batches ADD COLUMN intake_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN idempotency_key TEXT;
ALTER TABLE purchase_orders ADD COLUMN request_fingerprint TEXT;
ALTER TABLE purchase_orders ADD COLUMN receipt_id TEXT REFERENCES inventory_receipts(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_request ON purchase_orders(account_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS invoice_refunds (
 id TEXT PRIMARY KEY,account_id TEXT NOT NULL,invoice_id TEXT NOT NULL REFERENCES invoices(id),
 amount_usd REAL NOT NULL CHECK(amount_usd>0),request_id TEXT NOT NULL,reference TEXT,note TEXT,
 recorded_by_user_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(account_id,invoice_id,request_id)
);
CREATE TRIGGER IF NOT EXISTS trg_products_nonnegative_units BEFORE UPDATE OF quantity_units ON products WHEN NEW.quantity_units<0 BEGIN SELECT RAISE(ABORT,'quantity_units cannot be negative'); END;

ALTER TABLE inventory_receipt_lines ADD COLUMN source_movement_id TEXT REFERENCES stock_ledger(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_source_movement_once ON inventory_receipt_lines(account_id,source_movement_id) WHERE source_movement_id IS NOT NULL;

ALTER TABLE invoice_line_items ADD COLUMN quantity_unit TEXT CHECK(quantity_unit IN ('g','unit'));

ALTER TABLE products ADD COLUMN clay_type TEXT;
ALTER TABLE products ADD COLUMN material_note TEXT;

ALTER TABLE tea_compass_entries ADD COLUMN producer TEXT;
ALTER TABLE products ADD COLUMN producer TEXT;
ALTER TABLE products ADD COLUMN season TEXT;
ALTER TABLE products ADD COLUMN storage TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN source_invoice_id TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN source_invoice_line_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_compass_customer_purchase ON tea_compass_entries(user_id,account_id,source_invoice_line_id) WHERE source_invoice_line_id IS NOT NULL;

ALTER TABLE wholesale_orders ADD COLUMN receive_claim_token TEXT;
ALTER TABLE wholesale_orders ADD COLUMN receive_claimed_at TEXT;
CREATE TRIGGER IF NOT EXISTS trg_listings_nonnegative_stock BEFORE UPDATE OF stock_grams ON product_listings WHEN NEW.stock_grams<0 BEGIN SELECT RAISE(ABORT,'stock_grams cannot be negative'); END;

ALTER TABLE invoices ADD COLUMN customer_library_account_id TEXT;

CREATE TABLE inventory_receipts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'planned' CHECK (state IN ('planned','ordered','in_transit','partially_received','received','cancelled')),
  vendor_name TEXT,
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  eta TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, idempotency_key)
);
CREATE INDEX idx_inventory_receipts_account_state ON inventory_receipts(account_id, state, created_at);

CREATE TABLE inventory_receipt_lines (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  expected_quantity REAL NOT NULL CHECK (expected_quantity > 0),
  received_quantity REAL NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  cancelled_quantity REAL NOT NULL DEFAULT 0 CHECK (cancelled_quantity >= 0),
  unit TEXT NOT NULL CHECK (unit IN ('g','unit')),
  intended_purpose TEXT NOT NULL CHECK (intended_purpose IN ('working','sample','personal')),
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  intake_batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (received_quantity + cancelled_quantity <= expected_quantity)
);
CREATE INDEX idx_inventory_receipt_lines_receipt ON inventory_receipt_lines(account_id, receipt_id);
ALTER TABLE stock_ledger ADD COLUMN inventory_receipt_line_id TEXT REFERENCES inventory_receipt_lines(id) ON DELETE SET NULL;
CREATE INDEX idx_stock_ledger_receipt_line ON stock_ledger(inventory_receipt_line_id);

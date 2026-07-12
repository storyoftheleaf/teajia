ALTER TABLE products ADD COLUMN inventory_purpose TEXT CHECK (inventory_purpose IN ('working', 'sample', 'personal'));
ALTER TABLE products ADD COLUMN stock_known_at TEXT;
ALTER TABLE product_listings ADD COLUMN inventory_purpose TEXT CHECK (inventory_purpose IN ('working', 'sample', 'personal'));
ALTER TABLE product_listings ADD COLUMN stock_known_at TEXT;
ALTER TABLE stock_ledger ADD COLUMN movement_unit TEXT CHECK (movement_unit IS NULL OR movement_unit IN ('gram', 'unit'));

UPDATE products SET inventory_purpose = CASE WHEN is_sample = 1 THEN 'sample' WHEN is_personal = 1 THEN 'personal' ELSE 'working' END;
UPDATE product_listings SET inventory_purpose = CASE WHEN is_sample = 1 THEN 'sample' WHEN is_personal = 1 THEN 'personal' ELSE 'working' END;

CREATE TABLE curate_receipt_proposals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  compass_entry_id TEXT REFERENCES tea_compass_entries(id) ON DELETE SET NULL,
  import_id TEXT REFERENCES curate_import_batches(id) ON DELETE SET NULL,
  import_item_id TEXT REFERENCES curate_import_items(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  product_name TEXT,
  product_type TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('working', 'sample', 'personal')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'unit')),
  acquisition_kind TEXT NOT NULL CHECK (acquisition_kind IN ('purchase', 'free_sample', 'gift', 'transfer', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  idempotency_key TEXT NOT NULL,
  ledger_id TEXT REFERENCES stock_ledger(id) ON DELETE SET NULL,
  proposed_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, idempotency_key),
  UNIQUE(ledger_id)
);
CREATE INDEX idx_receipt_proposals_account_status ON curate_receipt_proposals(account_id, status, created_at);
ALTER TABLE stock_ledger ADD COLUMN receipt_proposal_id TEXT REFERENCES curate_receipt_proposals(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_stock_ledger_receipt_proposal ON stock_ledger(receipt_proposal_id) WHERE receipt_proposal_id IS NOT NULL;

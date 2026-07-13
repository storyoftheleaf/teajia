ALTER TABLE curate_import_batches ADD COLUMN analysis_state TEXT NOT NULL DEFAULT 'not_started'
  CHECK (analysis_state IN ('not_started','analyzing','complete','failed'));
ALTER TABLE curate_import_batches ADD COLUMN analysis_overview TEXT;
ALTER TABLE curate_import_batches ADD COLUMN analysis_language TEXT;
ALTER TABLE curate_import_batches ADD COLUMN analysis_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE curate_import_batches ADD COLUMN analysis_model TEXT;
ALTER TABLE curate_import_batches ADD COLUMN analysis_error TEXT;
ALTER TABLE curate_import_batches ADD COLUMN finalize_idempotency_key TEXT;
ALTER TABLE curate_import_batches ADD COLUMN completed_at TEXT;

CREATE TABLE curate_import_vendor_groups (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  group_key TEXT NOT NULL,
  proposed_vendor_name TEXT,
  resolved_vendor_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  vendor_confidence REAL CHECK (vendor_confidence IS NULL OR (vendor_confidence >= 0 AND vendor_confidence <= 1)),
  uncertainty_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, batch_id, group_key)
);
CREATE INDEX idx_curate_import_vendor_groups_batch
  ON curate_import_vendor_groups(account_id, batch_id, position);

ALTER TABLE curate_import_items ADD COLUMN vendor_group_id TEXT REFERENCES curate_import_vendor_groups(id) ON DELETE SET NULL;
ALTER TABLE curate_import_items ADD COLUMN manually_corrected_fields_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE curate_import_receipts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  vendor_group_id TEXT NOT NULL REFERENCES curate_import_vendor_groups(id) ON DELETE RESTRICT,
  inventory_receipt_id TEXT NOT NULL REFERENCES inventory_receipts(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, vendor_group_id),
  UNIQUE (account_id, inventory_receipt_id)
);
CREATE INDEX idx_curate_import_receipts_batch ON curate_import_receipts(account_id, batch_id);

ALTER TABLE inventory_receipt_lines ADD COLUMN original_cost_amount REAL;
ALTER TABLE inventory_receipt_lines ADD COLUMN original_cost_currency TEXT;
ALTER TABLE inventory_receipt_lines ADD COLUMN original_unit_cost REAL;
ALTER TABLE inventory_receipt_lines ADD COLUMN pack_count REAL;

-- Canonical, idempotent inventory movement metadata.
ALTER TABLE products ADD COLUMN stock_movement_guard TEXT;
ALTER TABLE stock_ledger ADD COLUMN movement_type TEXT CHECK (movement_type IS NULL OR movement_type IN ('receipt','sale','sample_use','gift','waste','return','recount','transfer'));
ALTER TABLE stock_ledger ADD COLUMN idempotency_key TEXT;
ALTER TABLE stock_ledger ADD COLUMN source_compass_entry_id TEXT REFERENCES tea_compass_entries(id) ON DELETE SET NULL;
ALTER TABLE stock_ledger ADD COLUMN movement_fingerprint TEXT;

CREATE UNIQUE INDEX idx_stock_ledger_account_idempotency
  ON stock_ledger(account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_stock_ledger_compass_entry ON stock_ledger(account_id, source_compass_entry_id);

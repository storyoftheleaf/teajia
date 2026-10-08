-- A retried invoice create returns its first committed invoice, even after the
-- browser lost the response. Keep the key across soft deletion for recovery.
ALTER TABLE invoices ADD COLUMN create_idempotency_key TEXT;
ALTER TABLE invoices ADD COLUMN create_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_account_create_key
  ON invoices(account_id, create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;

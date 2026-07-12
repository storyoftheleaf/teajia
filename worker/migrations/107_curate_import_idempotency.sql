ALTER TABLE curate_import_batches ADD COLUMN client_idempotency_key TEXT;
ALTER TABLE curate_import_batches ADD COLUMN request_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_curate_import_batch_idempotency
  ON curate_import_batches(account_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

ALTER TABLE curate_import_sources ADD COLUMN client_idempotency_key TEXT;
ALTER TABLE curate_import_sources ADD COLUMN request_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_curate_import_source_idempotency
  ON curate_import_sources(account_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

-- Migration 086: Inventory & lookup indexes (audit H7, M8)
--
-- Additive only — safe to apply to a live DB, no table rebuild, no data change.
-- Addresses missing indexes on high-cardinality lookup/join columns that were
-- causing full-table scans as the ledger and invoice tables grow.
--
-- NOTE: this repo applies migrations ad-hoc via `wrangler d1 execute --file`,
-- there is no tracked migration runner (see worker/MIGRATIONS.md). These use
-- IF NOT EXISTS so they are safe to re-run.

-- H7: per-product ledger history / current-balance lookups were unindexed
-- (only account_id and batch_id were indexed). The seed NOT EXISTS check and
-- every "ledger for this product" query full-scanned.
CREATE INDEX IF NOT EXISTS idx_stock_ledger_product
  ON stock_ledger(product_id);

-- Ledger rows are frequently filtered by their source invoice when voiding /
-- reconciling a sale.
CREATE INDEX IF NOT EXISTS idx_stock_ledger_source_invoice
  ON stock_ledger(source_invoice_id);

-- M8: customer order-history (get_customer / list_invoices) filtered
-- WHERE account_id = ? AND customer_id = ? with no covering index.
CREATE INDEX IF NOT EXISTS idx_invoices_account_customer
  ON invoices(account_id, customer_id);

-- M8: sales-attribution / provenance lookups by source.
CREATE INDEX IF NOT EXISTS idx_invoices_source_event
  ON invoices(source_event_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_collection
  ON invoices(source_collection_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_publication
  ON invoices(source_publication_id);

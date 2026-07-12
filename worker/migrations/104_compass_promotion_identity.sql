-- One physical Inventory identity per account-scoped Curate encounter.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_account_compass_identity
  ON products(account_id, source_compass_entry_id)
  WHERE source_compass_entry_id IS NOT NULL;

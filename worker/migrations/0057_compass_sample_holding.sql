-- A Library tea can have one sample holding and one ordinary holding.
-- Legacy sample flags still identify rows without a canonical purpose.
DROP INDEX idx_products_account_compass_identity;
CREATE UNIQUE INDEX idx_products_account_compass_identity
  ON products(account_id, source_compass_entry_id,
    (CASE WHEN inventory_purpose IS NOT NULL THEN inventory_purpose = 'sample' ELSE COALESCE(is_sample, 0) = 1 END))
  WHERE source_compass_entry_id IS NOT NULL;

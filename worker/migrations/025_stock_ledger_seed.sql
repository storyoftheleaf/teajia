-- Seed INITIAL_BALANCE stock_ledger entries for products that have stock_grams > 0
-- but no existing stock_ledger history. This ensures all stock is traceable.
INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, note, account_id, created_at)
SELECT
  lower(hex(randomblob(16))),
  p.id,
  p.stock_grams,
  p.stock_grams,
  'INITIAL_BALANCE',
  'Seeded from existing stock_grams value',
  p.account_id,
  datetime('now')
FROM products p
WHERE p.stock_grams > 0
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl WHERE sl.product_id = p.id
  );

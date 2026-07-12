ALTER TABLE invoices ADD COLUMN fulfillment_claimed_at TEXT;

-- Migration 111 could leave a token without a lease timestamp. Such a token
-- has no safe owner and must not block fulfillment forever.
UPDATE invoices
SET fulfillment_claim_token = NULL
WHERE fulfillment_claim_token IS NOT NULL AND fulfillment_claimed_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_products_nonnegative_stock
BEFORE UPDATE OF stock_grams ON products
FOR EACH ROW WHEN NEW.stock_grams < 0
BEGIN
  SELECT RAISE(ABORT, 'stock_grams cannot be negative');
END;

-- A buyer-facing SKU holds only the grams transferred from one private holding.
-- Keeping the link on the SKU preserves that source for a later cancellation.
ALTER TABLE products ADD COLUMN personal_offer_source_id TEXT REFERENCES products(id);
ALTER TABLE products ADD COLUMN personal_offer_pack_price_usd REAL;
ALTER TABLE products ADD COLUMN personal_offer_price_amount REAL;
ALTER TABLE products ADD COLUMN personal_offer_price_currency TEXT;
ALTER TABLE products ADD COLUMN personal_offer_withdrawn_at TEXT;

CREATE UNIQUE INDEX idx_products_open_personal_offer
  ON products(account_id, personal_offer_source_id)
  WHERE personal_offer_source_id IS NOT NULL AND personal_offer_withdrawn_at IS NULL;

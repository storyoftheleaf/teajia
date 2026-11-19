-- Existing rows retain their current delivery behavior.
ALTER TABLE invoices ADD COLUMN fulfillment_method TEXT
  CHECK (fulfillment_method IS NULL OR fulfillment_method IN ('bali_pickup', 'us_shipping'));
ALTER TABLE invoices ADD COLUMN shipping_quote_status TEXT
  CHECK (shipping_quote_status IS NULL OR shipping_quote_status IN ('requested', 'confirmed'));
ALTER TABLE invoices ADD COLUMN order_payment_deadline TEXT;

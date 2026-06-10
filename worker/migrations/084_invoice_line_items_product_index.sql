-- Migration 084: Index invoice_line_items by product_id
-- Product-side joins (e.g. the collection product-stats query does
-- LEFT JOIN invoice_line_items ili ON ili.product_id = p.id) full-scan the
-- table per product without this. invoice_id already has an index (023);
-- this covers the reverse direction.

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_product
  ON invoice_line_items(product_id);

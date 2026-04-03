-- Add persistent cross-link from products back to the Tea Compass entry that sourced them
ALTER TABLE products ADD COLUMN source_compass_entry_id TEXT;

-- Index for reverse lookups (find product by compass entry)
CREATE INDEX IF NOT EXISTS idx_products_source_compass ON products(source_compass_entry_id);

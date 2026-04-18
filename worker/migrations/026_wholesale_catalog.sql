-- Add wholesale catalog fields to products
ALTER TABLE products ADD COLUMN wholesale_price REAL DEFAULT NULL;
ALTER TABLE products ADD COLUMN catalog_visible INTEGER NOT NULL DEFAULT 0;

-- Add format field to events
ALTER TABLE events ADD COLUMN event_format TEXT NOT NULL DEFAULT 'private_tasting';

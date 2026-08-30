-- N3: transport mode per item + shipping rate per batch
ALTER TABLE curate_import_items ADD COLUMN transport_mode TEXT
  CHECK (transport_mode IN ('air','sea','land','courier','unknown'));
ALTER TABLE curate_import_batches ADD COLUMN shipping_rate_per_kg REAL NOT NULL DEFAULT 10.0;

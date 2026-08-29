-- Records the plant a tea is made from, so a tea can point at the shared
-- wisdom base instead of repeating its lineage in prose. Free text holding the
-- cultivar's canonical name; the wisdom base resolves it to a full entry.
ALTER TABLE tea_compass_entries ADD COLUMN cultivar TEXT;
ALTER TABLE products ADD COLUMN cultivar TEXT;

CREATE INDEX IF NOT EXISTS idx_products_cultivar ON products(cultivar);
CREATE INDEX IF NOT EXISTS idx_compass_cultivar ON tea_compass_entries(cultivar);

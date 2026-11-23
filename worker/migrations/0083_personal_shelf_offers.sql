-- A legacy shelf flag records seller intent. Only an explicitly reviewed
-- listing has an approved public name and quantity. Leave all existing rows
-- and seller addresses intact for private review.
ALTER TABLE personal_cellar_items ADD COLUMN shelf_offer_name TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN shelf_offer_grams REAL;
ALTER TABLE personal_cellar_items ADD COLUMN shelf_offer_type TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN shelf_offer_year INTEGER;
ALTER TABLE personal_cellar_items ADD COLUMN shelf_offer_origin TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN chest_label TEXT;

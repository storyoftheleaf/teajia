-- Keep what the owner paid private. Older holdings and offers have no
-- recorded price until the owner enters it and approves the offer.
ALTER TABLE personal_cellar_items ADD COLUMN chest_cost_amount REAL;
ALTER TABLE personal_cellar_items ADD COLUMN chest_cost_currency TEXT;
ALTER TABLE personal_cellar_items ADD COLUMN shelf_offer_price_amount REAL;
ALTER TABLE personal_cellar_items ADD COLUMN shelf_offer_price_currency TEXT;

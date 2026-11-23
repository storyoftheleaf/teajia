-- Legacy stars and promotions have no recorded offer. Keep the records and
-- require an explicit offer and a placement before serving any excerpt.
ALTER TABLE tasting_note_candidates ADD COLUMN offered_at TEXT;
ALTER TABLE product_impressions ADD COLUMN show_on_listing INTEGER NOT NULL DEFAULT 0 CHECK (show_on_listing IN (0, 1));
ALTER TABLE product_impressions ADD COLUMN show_on_main_page INTEGER NOT NULL DEFAULT 0 CHECK (show_on_main_page IN (0, 1));

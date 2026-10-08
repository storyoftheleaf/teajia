-- Private supplier discount evidence only; no invented thresholds or pricing changes.
ALTER TABLE curate_quotes ADD COLUMN discount_percent REAL CHECK (discount_percent IS NULL OR discount_percent BETWEEN 0 AND 100);
ALTER TABLE curate_quotes ADD COLUMN discount_condition_type TEXT CHECK (discount_condition_type IS NULL OR discount_condition_type IN ('none','min_order_amount','min_order_weight','min_quantity','unknown'));
ALTER TABLE curate_quotes ADD COLUMN discount_min_amount REAL CHECK (discount_min_amount IS NULL OR discount_min_amount > 0);
ALTER TABLE curate_quotes ADD COLUMN discount_min_currency TEXT CHECK ((discount_min_amount IS NULL) = (discount_min_currency IS NULL));
ALTER TABLE curate_quotes ADD COLUMN discount_min_weight_grams REAL CHECK (discount_min_weight_grams IS NULL OR discount_min_weight_grams > 0);
ALTER TABLE curate_quotes ADD COLUMN discount_min_quantity INTEGER CHECK (discount_min_quantity IS NULL OR (discount_min_quantity > 0 AND discount_min_quantity = CAST(discount_min_quantity AS INTEGER)));

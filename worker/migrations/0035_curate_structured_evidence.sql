-- Private sourcing facts and quoted documents, no product costs or stock changed.
ALTER TABLE tea_compass_entries ADD COLUMN age_quoted TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN grade TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN pack_size_grams REAL CHECK (pack_size_grams IS NULL OR pack_size_grams > 0);
ALTER TABLE tea_compass_entries ADD COLUMN pack_size_label TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN vendor_item_number TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN discount_percent REAL CHECK (discount_percent IS NULL OR discount_percent BETWEEN 0 AND 100);
ALTER TABLE tea_compass_entries ADD COLUMN quote_id TEXT REFERENCES curate_quotes(id);
ALTER TABLE tea_compass_entries ADD COLUMN route_quotes TEXT;
ALTER TABLE curate_vendor_profiles ADD COLUMN vendor_code TEXT;
ALTER TABLE curate_vendor_profiles ADD COLUMN contact_people TEXT;
ALTER TABLE curate_vendor_profiles ADD COLUMN addresses TEXT;
CREATE TABLE curate_quotes (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL REFERENCES customers(id),
  reference TEXT,
  issued_to TEXT,
  quote_date TEXT,
  validity_days INTEGER CHECK (validity_days IS NULL OR validity_days >= 0),
  valid_until TEXT,
  minimum_order_amount REAL CHECK (minimum_order_amount IS NULL OR minimum_order_amount >= 0),
  currency TEXT,
  payment_terms TEXT,
  created_by_user_id TEXT NOT NULL,
  created_by_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  CHECK ((minimum_order_amount IS NULL) = (currency IS NULL))
);
CREATE INDEX idx_curate_quotes_vendor ON curate_quotes(account_id, vendor_id, archived_at);
CREATE TABLE curate_quote_lines (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  quote_id TEXT NOT NULL REFERENCES curate_quotes(id),
  compass_entry_id TEXT NOT NULL REFERENCES tea_compass_entries(id),
  vendor_item_number TEXT,
  price_amount REAL CHECK (price_amount IS NULL OR price_amount >= 0),
  price_currency TEXT,
  price_per_unit_grams REAL CHECK (price_per_unit_grams IS NULL OR price_per_unit_grams > 0),
  discount_percent REAL CHECK (discount_percent IS NULL OR discount_percent BETWEEN 0 AND 100),
  route_quotes TEXT,
  archived_at TEXT,
  CHECK ((price_amount IS NULL) = (price_currency IS NULL))
);
CREATE INDEX idx_curate_quote_lines_quote ON curate_quote_lines(account_id, quote_id);

ALTER TABLE purchase_orders ADD COLUMN freight_estimate_json TEXT;

-- How a tea travels home: Suitcase, Airmail or Boat (Adrian, 2026-11-26).
--
-- products.freight_method  'suitcase', 'air' or 'sea', or NULL. NULL is
--   nobody chose, and the tea keeps the shop freight rate exactly as before,
--   so no price moves until a method is picked. A chosen method prices the
--   tea's freight at that method's shipping route, read at use time, never
--   copied into the row (worker/src/shippingRate.ts). A rate typed on the tea
--   itself (shipping_rate_per_kg) still wins over both.
--
-- shipping_routes gains a third mode, 'suitcase', so the suitcase rate lives
-- in Settings beside Air and Boat. SQLite cannot change a CHECK in place, so
-- the table is rebuilt: every row is copied across unchanged, column for
-- column, and nothing else is written.

ALTER TABLE products ADD COLUMN freight_method TEXT
  CHECK (freight_method IS NULL OR freight_method IN ('suitcase', 'air', 'sea'));

CREATE TABLE shipping_routes_next (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('air', 'sea', 'suitcase')),
  carrier TEXT,
  destination TEXT,
  rate_per_kg REAL CHECK (rate_per_kg IS NULL OR rate_per_kg >= 0),
  rate_currency TEXT CHECK ((rate_per_kg IS NULL) = (rate_currency IS NULL)),
  packing_percent REAL CHECK (packing_percent IS NULL OR packing_percent >= 0),
  billing_step_kg REAL CHECK (billing_step_kg IS NULL OR billing_step_kg > 0),
  minimum_kg REAL CHECK (minimum_kg IS NULL OR minimum_kg >= 0),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO shipping_routes_next
  (id, account_id, mode, carrier, destination, rate_per_kg, rate_currency,
   packing_percent, billing_step_kg, minimum_kg, archived_at, created_at, updated_at)
SELECT id, account_id, mode, carrier, destination, rate_per_kg, rate_currency,
       packing_percent, billing_step_kg, minimum_kg, archived_at, created_at, updated_at
  FROM shipping_routes;

DROP TABLE shipping_routes;
ALTER TABLE shipping_routes_next RENAME TO shipping_routes;

CREATE INDEX IF NOT EXISTS idx_shipping_routes_account
  ON shipping_routes(account_id, archived_at);

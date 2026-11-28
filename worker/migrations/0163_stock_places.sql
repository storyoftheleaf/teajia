-- Where a tea's stock is kept (Adrian, 2026-11-28: "Split stock based on
-- where it is stored, but just have one number").
-- Schema only: no existing row changes.
--
-- The shop keeps one number per tea: products.stock_grams (quantity_units for
-- teaware), moved only through the stock ledger as before. This adds the
-- private split of that number between the shop's own named places, such as
-- a studio and a house. Customers never see it.
--
-- stock_places          the account's places, in the order the shop lists
--                       them. Sales that do not name a place come out of the
--                       first place first.
-- product_stock_places  how much of one tea sits at one place. Only what has
--                       been placed is stored: whatever of the total is not
--                       in a row is "not placed yet". The split is always
--                       read through worker/src/stockPlaces.ts, which fits it
--                       to the current total, so it always adds up.
-- stock_place_moves     the history of the split: every change to how much is
--                       where, with the stock ledger line when the total
--                       moved too (from/to NULL means "not placed yet").
CREATE TABLE IF NOT EXISTS stock_places (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_places_account ON stock_places(account_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_places_account_name
  ON stock_places(account_id, lower(name)) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS product_stock_places (
  account_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  place_id   TEXT NOT NULL REFERENCES stock_places(id) ON DELETE CASCADE,
  amount     REAL NOT NULL CHECK (amount >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, place_id)
);
CREATE INDEX IF NOT EXISTS idx_product_stock_places_account ON product_stock_places(account_id, product_id);

CREATE TABLE IF NOT EXISTS stock_place_moves (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  from_place_id TEXT,
  to_place_id   TEXT,
  amount        REAL NOT NULL,
  ledger_id     TEXT,
  note          TEXT,
  user_email    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_place_moves_product ON stock_place_moves(account_id, product_id, created_at);

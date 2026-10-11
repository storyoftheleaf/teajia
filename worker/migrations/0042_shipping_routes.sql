-- shipping_routes: how bought tea travels home, set once in Settings and read by
--   the buying basket to estimate freight without asking (plan
--   todo/plans/samples-to-orders.md, build 3).
--
--   mode            'air' or 'sea' (shown as Boat), the words curate_freight_costs uses.
--   carrier         who carries it, as Adrian names them.
--   destination     where it is received: the shop, or a forwarder the boat leaves from.
--   rate_per_kg     what the carrier charges, in rate_currency. NULL means nobody
--                   entered one: an air route then follows the shop freight rate,
--                   a sea route is not estimated. Never read as zero.
--   packing_percent how much packing adds to the tea's weight. NULL is none stated.
--   billing_step_kg the carrier bills in steps of this many kilos, rounded up.
--   minimum_kg      the least it bills, whatever the parcel weighs.
--
-- The shelf price is untouched: it still prices freight at the shop rate. These
-- figures estimate what an order will cost to bring home, nothing else.
--
-- Schema only: no row is written. No numeric or currency defaults: a rate states
-- its currency or is refused (the CHECK below, and worker/src/shippingRoutes.ts).

CREATE TABLE IF NOT EXISTS shipping_routes (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('air', 'sea')),
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

CREATE INDEX IF NOT EXISTS idx_shipping_routes_account
  ON shipping_routes(account_id, archived_at);

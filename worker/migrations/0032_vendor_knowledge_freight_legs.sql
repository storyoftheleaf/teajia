-- What the shop knows about a vendor, what it costs to bring their tea home,
-- and two facts about a Curate tea that had nowhere to live.
--
-- Adrian, 2026-10-07: "If I mentioned the price being in Hong Kong dollars,
-- then it's obviously in Hong Kong ... it will know when I ship from Hong Kong
-- there's a cost to go from Hong Kong to China and then from China by boat to
-- Bali. These prices might be different for different vendors ... anytime I do
-- buy something, I will give you the price that it costs for how many kilos of
-- tea and then you will calculate." So an agent needs somewhere to keep that,
-- and somewhere to read it back from next time. All of it is back office:
-- owner-tier, never on the storefront.
--
-- curate_vendor_profiles: one row per vendor (a customers row tagged vendor).
--   The currency they quote in, how they store tea, their story, where their tea
--   ships from and the route home. `customers.preferred_currency` was not used
--   for the currency because it carries DEFAULT 'USD', which cannot tell "this
--   vendor quotes in dollars" from "nobody said".
--
-- curate_freight_costs: every shipping cost Adrian reports, kept as he said it
--   (a total, its currency, the weight it moved), never as a typed per-kg rate.
--   The per-kg figure is worked out when it is read, so it cannot drift from the
--   evidence. The latest row for a vendor and leg is that leg's current cost; the
--   older rows stay as history. vendor_id NULL is a leg every vendor shares
--   (the boat from China to Bali).
--
-- tea_compass_entries.shop_name: what customers will see ("Deep Forest"),
--   beside `name`, which stays what the vendor calls it.
-- tea_compass_entries.transport_mode: how it travels home (air, sea, land,
--   courier). The shelf price still uses the shop freight rate; this records
--   the fact so an order can estimate the landed cost from the real legs.
--
-- Schema only: no row is written. No numeric or currency defaults: every write
-- states its currency and weight, and an amount with no currency is refused in
-- worker/src/mcpTools/curateSupply.ts before it reaches here.

ALTER TABLE tea_compass_entries ADD COLUMN shop_name TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN transport_mode TEXT;

CREATE TABLE IF NOT EXISTS curate_vendor_profiles (
  vendor_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  price_currency TEXT,
  storage TEXT,
  story TEXT,
  ships_from TEXT,
  route TEXT,
  lead_time_days INTEGER,
  updated_by_agent TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_curate_vendor_profiles_account
  ON curate_vendor_profiles(account_id);

CREATE TABLE IF NOT EXISTS curate_freight_costs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  vendor_id TEXT,
  leg TEXT NOT NULL,
  mode TEXT CHECK (mode IS NULL OR mode IN ('air', 'sea', 'land', 'courier')),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL,
  weight_kg REAL NOT NULL CHECK (weight_kg > 0),
  transit_days INTEGER,
  observed_on TEXT NOT NULL,
  note TEXT,
  from_agent TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_curate_freight_costs_leg
  ON curate_freight_costs(account_id, vendor_id, leg, observed_on);

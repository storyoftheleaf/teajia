-- 077_collection_item_recommendations.sql
-- Per-item curator recommendations for personal collections: how much of each
-- tea the curator suggests, and the price they are quoting for that amount.
-- Both nullable; an item with neither behaves exactly as before (recipient picks
-- their own quantity, sees the live catalog price).
--
-- recommended_quantity is TEXT to mirror the public picker's mixed model:
--   loose-leaf  -> grams as a number-string, e.g. "100"
--   cake/teaware -> unit count, e.g. "2"
-- recommended_price_usd is the TOTAL price for the recommended quantity of this
-- one tea (a per-collection override, e.g. a friend/bundle rate), in USD. It maps
-- directly to invoice_line_items.price_at_sale (which is also a line total in USD,
-- stored as REAL). Null = no override; fall back to the catalog price.

ALTER TABLE collection_items ADD COLUMN recommended_quantity TEXT;
ALTER TABLE collection_items ADD COLUMN recommended_price_usd REAL;

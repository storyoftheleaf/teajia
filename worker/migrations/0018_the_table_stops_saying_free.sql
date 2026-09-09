-- The table stops answering for Adrian on freight, markup and cost.
--
-- `worker/schema.sql` says `products.shipping_rate_per_kg REAL DEFAULT NULL`.
-- The live column says `DEFAULT 0`. Migration `0000` created it that way, and
-- 0007, 0010, 0013 and 0016 each wrote over existing ROWS without being able to
-- touch it, because SQLite cannot alter a column default in place. So the file
-- that describes this database has been wrong for months, and wrong in the
-- direction that costs money.
--
-- What the three defaults say to an INSERT that does not mention them:
--
--   shipping_rate_per_kg  0     this tea ships free. Freight never enters the
--                               cost basis and the x3 never multiplies it.
--   markup_multiplier     2.5   the multiplier `0013` cleared off the shelf.
--                               The curator listing path reads this column, so
--                               a row carrying it prices differently from the
--                               shop's own page.
--   cost_amount           0     a free tea, not an unrecorded one. Zero times
--                               three is a price of zero.
--
-- Each is absence answered with a number, and once it is in the row nobody can
-- tell it from a decision. NULL is how a row says nobody entered anything:
-- `shippingRate.ts` then charges the shop rate, `markup.ts` reads
-- SHOP_MARKUP_MULTIPLIER, and a cost nobody recorded stays findable.
--
-- THIS MIGRATION CHANGES NO EXISTING ROW'S VALUE. Every UPDATE below copies a
-- column onto its own replacement, byte for byte, including the zeros. A tea
-- pinned at 85 keeps 85; a tea deliberately shipping free keeps its 0; teaware
-- keeps the 0 that is its true rate. What changes is what the NEXT tea gets,
-- and the rehearsal test asserts row-for-row equality on both tables to prove
-- exactly that.
--
-- WHY IT IS NOT THE USUAL TABLE REBUILD, which is worth writing down because
-- the obvious version of this migration is destructive and looks fine.
--
-- The SQLite manual's procedure is: create the new table, copy, DROP the old,
-- rename, replay the indexes. Its first step is `PRAGMA foreign_keys = OFF`,
-- and D1 does not allow that: it accepts the statement, ignores it, and
-- `PRAGMA foreign_keys` still reports 1. Only `defer_foreign_keys` is honoured,
-- and deferring a CONSTRAINT CHECK does not stop a foreign key ACTION.
--
-- Measured against the local D1 runtime, not reasoned about. `DROP TABLE
-- products` performs an implicit DELETE of every row, which:
--   * cascade-deletes every row of `article_products` and `sales_grants`
--     (ON DELETE CASCADE), silently, with the migration reporting success;
--   * aborts on `inventory_receipt_lines` (ON DELETE RESTRICT), which holds the
--     shop's only trustworthy record of what was actually paid;
--   * blanks `curate_receipt_proposals.product_id` and both product links on
--     `profile_favorites` (ON DELETE SET NULL).
-- Working around that would mean deleting and re-inserting the receipt lines
-- inside a migration. That is a worse trade than the default it removes.
--
-- ADD, COPY, DROP, RENAME does the same job without dropping either table, so
-- no foreign key is ever involved, no index or trigger is dropped, and nothing
-- has to be replayed. The three columns move to the end of the column order,
-- which nothing in this codebase depends on: every INSERT names its columns.

-- products

ALTER TABLE products ADD COLUMN shipping_rate_per_kg_0018 REAL;
UPDATE products SET shipping_rate_per_kg_0018 = shipping_rate_per_kg;
ALTER TABLE products DROP COLUMN shipping_rate_per_kg;
ALTER TABLE products RENAME COLUMN shipping_rate_per_kg_0018 TO shipping_rate_per_kg;

ALTER TABLE products ADD COLUMN markup_multiplier_0018 REAL;
UPDATE products SET markup_multiplier_0018 = markup_multiplier;
ALTER TABLE products DROP COLUMN markup_multiplier;
ALTER TABLE products RENAME COLUMN markup_multiplier_0018 TO markup_multiplier;

ALTER TABLE products ADD COLUMN cost_amount_0018 REAL;
UPDATE products SET cost_amount_0018 = cost_amount;
ALTER TABLE products DROP COLUMN cost_amount;
ALTER TABLE products RENAME COLUMN cost_amount_0018 TO cost_amount;

-- product_listings, which is the row a partner shop actually prices from.

ALTER TABLE product_listings ADD COLUMN shipping_rate_per_kg_0018 REAL;
UPDATE product_listings SET shipping_rate_per_kg_0018 = shipping_rate_per_kg;
ALTER TABLE product_listings DROP COLUMN shipping_rate_per_kg;
ALTER TABLE product_listings RENAME COLUMN shipping_rate_per_kg_0018 TO shipping_rate_per_kg;

ALTER TABLE product_listings ADD COLUMN markup_multiplier_0018 REAL;
UPDATE product_listings SET markup_multiplier_0018 = markup_multiplier;
ALTER TABLE product_listings DROP COLUMN markup_multiplier;
ALTER TABLE product_listings RENAME COLUMN markup_multiplier_0018 TO markup_multiplier;

ALTER TABLE product_listings ADD COLUMN cost_amount_0018 REAL;
UPDATE product_listings SET cost_amount_0018 = cost_amount;
ALTER TABLE product_listings DROP COLUMN cost_amount;
ALTER TABLE product_listings RENAME COLUMN cost_amount_0018 TO cost_amount;

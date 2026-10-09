-- A purchase order's dollar total may be unknown.
--
-- `purchase_orders.total_usd` was created by `0000` as `REAL NOT NULL DEFAULT
-- 0`. Curate leaves the total out when it has no honest dollar figure: a
-- currency the shop has no rate for (never read at 1, which stored ¥450 as
-- $450), or a tea on the order with no price yet (a total that counts the blank
-- as zero records the order as cheaper than it was). With the column refusing
-- NULL, the worker had to store those orders as 0, and 0 reads as an order that
-- cost nothing. NULL is how a row says nobody could work it out.
--
-- THIS MIGRATION CHANGES NO EXISTING ROW'S VALUE. The UPDATE copies the column
-- onto its replacement byte for byte, zeros included; only what the column
-- accepts from now on changes. The live table held no purchase orders when this
-- was written (read 2026-10-09), and the rehearsal test asserts row-for-row
-- equality on seeded shapes anyway.
--
-- Same shape as 0018 (ADD, COPY, DROP, RENAME) rather than a table rebuild: D1
-- ignores `PRAGMA foreign_keys = OFF`, so a rebuild's DROP TABLE is the
-- dangerous version. No index, trigger, view or foreign key names
-- `purchase_orders.total_usd`, so DROP COLUMN is allowed. The column moves to
-- the end of the column order, which nothing depends on: every INSERT into this
-- table names its columns.

ALTER TABLE purchase_orders ADD COLUMN total_usd_0040 REAL;
UPDATE purchase_orders SET total_usd_0040 = total_usd;
ALTER TABLE purchase_orders DROP COLUMN total_usd;
ALTER TABLE purchase_orders RENAME COLUMN total_usd_0040 TO total_usd;

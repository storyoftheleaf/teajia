-- The 1993 Y562 stops shipping free.
--
-- Migration 0011 already set this tea's freight rate to NULL, on 2026-09-06 at
-- 13:12. Thirteen minutes later, 4de316b fixed the bug where CLEARING the
-- Ship $/kg field ran `Number(val) || 0` and saved a rate of ZERO. So there is
-- a thirteen-minute window in which any save touching this tea wrote 0 back
-- over what 0011 had just cleared, and a 0 is not "unentered", it is Adrian
-- saying this tea ships free. He has now said plainly that it should not.
--
-- Two ways this tea can be carrying a zero, and this migration covers both,
-- because from here there is no way to read the live row and find out which:
--
--   1. 0011 matched it and something wrote 0 back afterwards. Then clause A
--      below matches again and clears it, and this is simply 0011 re-run.
--   2. 0011 never matched it, because the tea is recorded under a name holding
--      neither 'Y562' nor '吉幸'. Then clause A does nothing a second time, and
--      clause B is what catches it.
--
-- CLAUSE B is deliberately narrow. It is not "clear every zero": the shop's own
-- rule is that a typed 0 is a decision and teaware is the one true zero, so a
-- blanket sweep would silently un-set a tea somebody meant to ship free. It is
-- a 1993 non-teaware tea currently shipping free, which is this tea's own
-- fingerprint. The known facts about it: 中茶吉幸 Y562, Zhongcha Jixing, China
-- National Yunnan Tea I/E Corp, roughly 1993 ripe, 100 g boxes, 60 CNY a box
-- from Boyuan Tea Shop in Guangzhou.
--
-- If clause B does catch a second 1993 tea, what happens to it is that it stops
-- shipping free and follows the shop rate like everything else on the shelf,
-- which is the correct state for any tea that is not teaware. That is the
-- bounded direction: it can only move a price toward covering its own postage,
-- never away.
--
-- The check remains the gold dot in the inventory's Ship $/kg column. If it is
-- still on this tea after this deploys, neither clause reached it and the row
-- needs its id read off the live database.

-- Clause A: the tea by name. Same identification 0011 used and Adrian
-- confirmed, minus 0011's `IS NOT NULL` guard, which was pointless there and
-- would be pointless here: setting NULL to NULL costs nothing.
UPDATE products
   SET shipping_rate_per_kg = NULL
 WHERE (type IS NULL OR type <> 'Teaware')
   AND (
        (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) LIKE '%Y562%'
     OR (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) LIKE '%吉幸%'
   )
   -- 'Y562' as a substring also matches 'Y5620'. No such tea exists here, but a
   -- migration that edits money should not rely on that.
   AND NOT (
        (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) GLOB '*[Yy]562[0-9]*'
   );

-- Clause B: a 1993 tea that is currently shipping free.
--
-- Compared as a NUMBER, not as text, and that is not a style preference. The
-- `year` column is TEXT but has been written through several doors over the
-- years: the MCP writes `String(year).trim()`, the admin form writes a parsed
-- integer, and a driver binding a JS number can land it as '1993.0'. A text
-- comparison against '1993' silently misses two of those three, and it misses
-- them by doing nothing, which is the failure that looks like success. Testing
-- this migration against a seeded database is what surfaced it.
--
-- CAST folds all of them to 1993, and a NULL year casts to NULL and matches
-- nothing.
UPDATE products
   SET shipping_rate_per_kg = NULL
 WHERE (type IS NULL OR type <> 'Teaware')
   AND shipping_rate_per_kg = 0
   AND CAST(year AS INTEGER) = 1993;

-- The listing mirror carries the same column and no name of its own, so it is
-- reached through the product it belongs to. A product following the shop rate
-- whose listing still holds its own is a tea that ships free on partner catalog
-- browse and not in the shop, which is the drift the mirror exists to prevent.
--
-- Scoped back to this migration's own subject rather than to every product that
-- happens to have a NULL rate. Written as the identity of the tea (the name, or
-- the year) instead of as the condition the clauses matched on, because after
-- those two UPDATEs the condition is no longer true of the rows they changed.
UPDATE product_listings
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg IS NOT NULL
   AND legacy_product_id IN (
     SELECT id FROM products
      WHERE shipping_rate_per_kg IS NULL
        AND (type IS NULL OR type <> 'Teaware')
        AND (
             (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) LIKE '%Y562%'
          OR (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) LIKE '%吉幸%'
          OR CAST(year AS INTEGER) = 1993
        )
   );

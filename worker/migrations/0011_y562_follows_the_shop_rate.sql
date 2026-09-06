-- The 1993 Y562 joins the rest of the catalogue on the shop freight rate.
--
-- Migration 0010 cleared everything 0008 had written plus the three Huang Wei
-- teas, and deliberately left this one alone: its stored rate is roughly 5 to 8
-- USD/kg, which is not the old default, and a figure nobody recognises might be
-- one Adrian set on purpose. Clearing it on a guess would have moved a real
-- price on a tea he sells. He confirmed on 2026-09-06 that it should follow the
-- shop rate like everything else, so here it is, as its own migration with its
-- own reason rather than folded into the last one.
--
-- Matched by name because this session has no live database access and so no
-- product id for it. 'Y562' is the export mark on the box (中茶吉幸 Y562,
-- Zhongcha Jixing, China National Yunnan Tea I/E Corp, ~1993 ripe, 100 g boxes,
-- 60 CNY a box from Boyuan Tea Shop in Guangzhou). Both the mark and 吉幸 are
-- distinctive enough that nothing else in the shop can collide with them, and
-- matching on either covers the tea being recorded under its Latin mark, its
-- Chinese name, or both.
--
-- If this matches nothing the migration succeeds silently, which is the one
-- failure worth naming out loud: the tea would keep its pinned rate and keep
-- its dot in the inventory's Ship $/kg column. That dot is the check. If it is
-- still there after this deploys, the tea is recorded under a name neither
-- clause catches, and it needs its id read off the live database.
--
-- The three name columns are joined into one string and matched once, rather
-- than six LIKE clauses repeated twice. Shorter, and it makes room for the one
-- guard worth having: 'Y562' as a substring also matches 'Y5620', so a mark
-- followed by another digit is excluded. No such tea exists here, but a
-- migration that edits money should not rely on that.
--
-- Only a rate that is actually set is touched, and teaware is excluded on the
-- same grounds as every other migration in this sequence: it prices per piece
-- with freight already inside that price.

UPDATE products
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg IS NOT NULL
   AND (type IS NULL OR type <> 'Teaware')
   AND (
        (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) LIKE '%Y562%'
     OR (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) LIKE '%吉幸%'
   )
   AND NOT (
        (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) GLOB '*[Yy]562[0-9]*'
   );

-- The listing mirror carries the same column but no name of its own, so it is
-- reached through the product it belongs to rather than matched again.
UPDATE product_listings
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg IS NOT NULL
   AND legacy_product_id IN (
     SELECT id FROM products
      WHERE (type IS NULL OR type <> 'Teaware')
        AND (
             (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) LIKE '%Y562%'
          OR (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) LIKE '%吉幸%'
        )
        AND NOT (
             (COALESCE(product_name, '') || ' ' || COALESCE(given_name, '') || ' ' || COALESCE(chinese_name, '')) GLOB '*[Yy]562[0-9]*'
        )
   );

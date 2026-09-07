-- Every tea follows the shop's freight rate, which is 85 Yuan/kg.
--
-- Adrian's rule, stated plainly on 2026-09-07: everything ships from China by
-- air at 85 yuan a kilo, that is the default, and he will adjust the ones that
-- differ himself as he adds them. So no tea should be carrying a rate of its
-- own unless he put it there deliberately, and after a week in which several
-- doors wrote rates nobody chose, none of them can be assumed deliberate.
--
-- What was writing them, all now fixed but all having already written rows:
--
--   * the Add Product form PRE-FILLED the shop rate as a value, so every tea
--     added by hand was stamped with whatever the rate was that day and stopped
--     following it (fixed 2026-09-06),
--   * clearing that field saved a ZERO, meaning "ships free", which is how the
--     only way to unpin a tea became the way to make it free (fixed the same
--     day),
--   * migration 0008 wrote a figure onto every tea that had none; 0010 undid
--     that, but only for the rows it could still recognise.
--
-- The result Adrian is looking at is a column reading 0.00 down the page, which
-- is not "free" being displayed honestly: the stored column is in each tea's
-- OWN buying currency, so a small number on a tea bought in rupiah is a
-- fraction of a cent and prints as a rounding artefact.
--
-- Clearing the column is the whole fix. NULL is not "no freight", it is "follow
-- the shop", and the shop charges 85 Yuan/kg converted live, so every tea below
-- ends up charged correctly and STAYS correct when that rate is renegotiated.
-- Nothing here can lower a price: a tea that was shipping free starts carrying
-- freight, and freight sits inside the cost basis the markup multiplies.
--
-- TEAWARE IS UNTOUCHED. It prices per piece with freight already inside that
-- price, which is the one true zero in this shop.
--
-- A deliberately pinned rate is cleared too, and that is the deliberate part of
-- this migration rather than an oversight. Adrian has said the default applies
-- to everything and that he will re-pin what differs; a week of doors writing
-- rates nobody chose means "deliberate" cannot be read off the row. Re-pinning
-- one tea is now a sentence to the shop through `update_tea_pricing`, or a
-- number typed into `create_tea` as it is added.

UPDATE products
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg IS NOT NULL
   AND (type IS NULL OR type <> 'Teaware');

-- The listing mirror carries the same column and no name of its own, so it is
-- reached through the product it belongs to. A product following the shop rate
-- whose listing still holds one would ship free on partner catalog browse and
-- not in the shop.
UPDATE product_listings
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg IS NOT NULL
   AND legacy_product_id IN (
     SELECT id FROM products WHERE type IS NULL OR type <> 'Teaware'
   );

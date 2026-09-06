-- Hand the catalogue back to the shop's freight rate.
--
-- Migration 0008 wrote 12 USD/kg, converted into each tea's own cost currency,
-- onto every tea that had no rate of its own. That was right at the time and is
-- wrong now, for a reason that did not exist then: migration 0009 moved the
-- shop rate onto the account, where Adrian can change it when he renegotiates
-- freight. A tea carrying its own copy of the old number does not follow him.
-- It is pinned, and it goes stale the moment the shop rate moves.
--
-- Worse, the copy was already drifting. 0008 multiplied 12 USD by the exchange
-- rate on the day it ran, so a yuan tea holds a figure frozen at that day's
-- dollar while the shop now quotes 85 Yuan and converts live.
--
-- This does not undo what Adrian asked for. His rule was that the rate be
-- entered and shown rather than applied invisibly, and it still is: a tea with
-- no rate of its own displays the shop rate in the inventory column and in the
-- edit panel, because that is what it is actually being charged. What changes
-- is that the number shown is now read from the shop each time instead of
-- copied once. The inventory marks a tea that owns its rate with a dot, so the
-- two states are told apart on the screen rather than only in the schema.
--
-- Nothing here changes a price today. 85 Yuan is 12 USD at roughly 7.1, which
-- is what every one of these rows already carries.

-- 1. The rows 0008 wrote.
--
-- Matched by dividing back out rather than by equality: 0008 multiplied by the
-- rate of the day, the rate has moved since, and float equality on money that
-- has been through two conversions finds nothing. A tolerance of half a dollar
-- per kilo is far wider than two days of currency drift and far narrower than
-- the gap to any other rate in the shop -- the intake default was 10, the old
-- Add Product form 13.
--
-- A deliberate 12 USD/kg, if one exists, is cleared too, and that is correct:
-- it is indistinguishable from an inherited 12 by construction, and clearing it
-- moves the tea onto a shop rate that is currently the same number.
UPDATE products
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg IS NOT NULL
   AND (type IS NULL OR type <> 'Teaware')
   AND ABS(
         shipping_rate_per_kg / COALESCE(
           (SELECT er.rate_to_usd
              FROM exchange_rates er
             WHERE er.currency = CASE LOWER(COALESCE(products.cost_currency, 'USD'))
                                   WHEN 'cny' THEN 'Yuan'
                                   WHEN 'rmb' THEN 'Yuan'
                                   WHEN 'renminbi' THEN 'Yuan'
                                   WHEN 'yuan' THEN 'Yuan'
                                   WHEN 'cnh' THEN 'Yuan'
                                   WHEN 'mop' THEN 'HKD'
                                   ELSE COALESCE(products.cost_currency, 'USD')
                                 END),
           1)
         - 12
       ) < 0.5;

-- 2. The three Huang Wei teas, finalized 2026-08-31 through the curate intake
--    path when its default was still 10 USD/kg. Adrian authorised clearing
--    these on 2026-09-05. Named by id rather than matched on 10, because a
--    rate of 10 somewhere else in the shop might be one he meant.
UPDATE products
   SET shipping_rate_per_kg = NULL
 WHERE id IN (
   '2ec4bcf5-1773-453c-b710-5b859203cb4e',  -- 陈年六堡茶 Aged Liu Bao
   'd8b6bcc0-e5d1-4ed1-8cab-67b3bd62d0dc',  -- 陈年旧熟普 Aged Ripe Pu-erh
   'bb692acb-b4a0-4114-afa8-c9644140eb5f'   -- 北越旧熟普 N. Vietnam Ripe
 );

-- 3. The listing mirror carries the same column and its own cost_currency, so
--    it is cleared on the same terms rather than joined: its id is only
--    conventionally tied to the product, and a convention is a poor thing to
--    price money on. Same reasoning as 0008, which filled it the same way.
UPDATE product_listings
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg IS NOT NULL
   AND ABS(
         shipping_rate_per_kg / COALESCE(
           (SELECT er.rate_to_usd
              FROM exchange_rates er
             WHERE er.currency = CASE LOWER(COALESCE(product_listings.cost_currency, 'USD'))
                                   WHEN 'cny' THEN 'Yuan'
                                   WHEN 'rmb' THEN 'Yuan'
                                   WHEN 'renminbi' THEN 'Yuan'
                                   WHEN 'yuan' THEN 'Yuan'
                                   WHEN 'cnh' THEN 'Yuan'
                                   WHEN 'mop' THEN 'HKD'
                                   ELSE COALESCE(product_listings.cost_currency, 'USD')
                                 END),
           1)
         - 12
       ) < 0.5;

UPDATE product_listings
   SET shipping_rate_per_kg = NULL
 WHERE legacy_product_id IN (
   '2ec4bcf5-1773-453c-b710-5b859203cb4e',
   'd8b6bcc0-e5d1-4ed1-8cab-67b3bd62d0dc',
   'bb692acb-b4a0-4114-afa8-c9644140eb5f'
 );

-- Write the shop's freight rate onto every tea that has none, so it is a value
-- an operator can see and change rather than a default applied invisibly at
-- read time.
--
-- This changes no price. Migration 0007 made an unentered rate NULL, and the
-- pricing function already charges the shop default on a NULL. What this does
-- is make that charge visible in the inventory: the number in the row and in
-- the edit panel is now the number being used, not a placeholder the code
-- happens to agree with.
--
-- The column is written in the tea's OWN cost currency, so 12 USD/kg becomes
-- 86.4 on a yuan-priced tea and 12 on a dollar-priced one. The exchange table
-- keys CNY as 'Yuan' and the products carry every alias operators have typed
-- over the years, so the aliases are spelled out here exactly as
-- CURRENCY_ALIASES in worker/src/teaMasterSales.ts spells them. A currency the
-- table has no rate for keeps the USD figure rather than being multiplied by
-- nothing, which is the same choice formatCurrency makes.
--
-- Teaware is skipped: it prices per piece with freight already inside that
-- price, and the pricing function never adds a per-gram rate to it.
UPDATE products
   SET shipping_rate_per_kg = 12 * COALESCE(
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
 WHERE shipping_rate_per_kg IS NULL
   AND (type IS NULL OR type <> 'Teaware');

-- The listing mirror carries the same column and its own cost_currency, so it
-- is filled the same way rather than joined: its id is only conventionally
-- tied to the product ('list_' || products.id), and a convention is a poor
-- thing to price money on.
UPDATE product_listings
   SET shipping_rate_per_kg = 12 * COALESCE(
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
 WHERE shipping_rate_per_kg IS NULL;

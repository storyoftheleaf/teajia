-- A shipping rate of zero used to mean two different things.
--
-- The column was born `REAL DEFAULT 0`, so every product created outside the
-- intake path stored 0 and the pricing function read it as free freight. Not
-- one of those zeros was Adrian saying a tea ships for nothing; they were all
-- nobody having entered a rate. Meanwhile the shop's markup multiplied a cost
-- basis with no freight in it at all.
--
-- The rule is now: NULL means nobody has said, and the shop default applies;
-- a number means Adrian said, and it is obeyed, zero included. That needs the
-- two states to be distinguishable, so the legacy zeros become NULL here.
--
-- Teaware is left alone on purpose. Its freight is already inside a per-piece
-- price and the pricing function never adds a per-gram rate to it, so the
-- value is inert either way; rewriting it would only invite the question of
-- why later.
UPDATE products
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg = 0
   AND (type IS NULL OR type <> 'Teaware');

-- The listing mirror carries the same column with the same history.
UPDATE product_listings
   SET shipping_rate_per_kg = NULL
 WHERE shipping_rate_per_kg = 0;

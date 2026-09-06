-- The markup is three, and a row that never said otherwise stops carrying a copy.
--
-- `markup_multiplier` was created with DEFAULT 2.5 while the shop's own pricing
-- multiplied by three. So every product carried a number the shelf ignored, and
-- the curator listing path — which does read the column — priced the same tea at
-- a different multiple depending on which surface asked. Adrian settled it on
-- 2026-09-06: three, everywhere.
--
-- Cleared rather than set to 3, for the reason migration 0010 exists. Writing
-- three into every row would recreate exactly the fault being removed: one
-- policy number copied into hundreds of independent facts, free to drift the
-- next time the number changes. NULL means the row follows the shop, and the
-- shop's number lives in worker/src/markup.ts where changing it changes
-- everything at once.
--
-- Only rows still carrying the old default are touched. A multiplier somebody
-- deliberately set to something else is theirs, the same rule freight follows.
--
-- The effect on price: a curator listing that was multiplying by 2.5 now
-- multiplies by 3. Nothing on the shop shelf moves, because shop pricing never
-- read this column.

UPDATE products
   SET markup_multiplier = NULL
 WHERE markup_multiplier IS NOT NULL
   AND ABS(markup_multiplier - 2.5) < 0.001;

UPDATE product_listings
   SET markup_multiplier = NULL
 WHERE markup_multiplier IS NOT NULL
   AND ABS(markup_multiplier - 2.5) < 0.001;

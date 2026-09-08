-- The teas recorded as 'CNY' and 'YUAN' are recorded as 'Yuan', like the rest.
--
-- The exchange table keys yuan as 'Yuan'. It does not carry a 'CNY' row and it
-- does not carry a 'YUAN' row. So a tea whose cost_currency says either of
-- those names a rate that does not exist, and every reader has to decide what
-- to do about that. The worker canonicalises, which is why the shelf price on
-- these teas has been right all along. The admin did not, which is why every
-- number Adrian reads about them has been wrong.
--
-- What was writing them: `update_tea_pricing` uppercased the currency it was
-- given instead of canonicalising it, so 'cny' became 'CNY' and, worse, the
-- correct answer 'Yuan' became 'YUAN'. One call at a time, through the door
-- with no form and nobody watching. That is fixed in the same branch as this
-- migration; this file is for the rows it already made.
--
-- THIS DOES NOT CHANGE WHAT ANY TEA COSTS OR WHAT THE SHOP CHARGES. It changes
-- a label from one spelling of yuan to another spelling of the same yuan. The
-- amount is untouched, the rate it converts at is the same 6.73 the worker was
-- already using, and the shelf price does not move by a cent. What changes is
-- that the admin can now find the rate: the dashboard stops counting these
-- costs as dollars, the inventory preview stops pricing them at nothing, and a
-- freight rate pinned to one of them can be read in dollars instead of a dash.
--
-- Bounded on purpose. It touches rows whose cost_currency is exactly 'CNY' or
-- 'YUAN', case-insensitively, and nothing else. A tea recorded as 'Yuan',
-- 'NT', 'HKD', 'USD', 'IDR', 'JPY', 'MYR' or 'AUD' is already a name the table
-- carries and is left exactly as it is. A tea with no currency recorded at all
-- stays NULL, because "nobody said" is a different fact from "somebody said
-- yuan" and migration 0014 exists to keep them apart. Teaware is included on
-- the same terms as any other row: this is about the spelling of a currency,
-- not about freight, so there is nothing special about it here.
--
-- cost_currency_source is deliberately NOT touched. A row that said 'CNY' said
-- what its money was in; spelling it the way the table does is a correction of
-- our record, not a new statement by Adrian, and stamping it 'stated' would
-- claim he answered a question nobody put to him.

UPDATE products
   SET cost_currency = 'Yuan'
 WHERE cost_currency IS NOT NULL
   AND lower(cost_currency) IN ('cny', 'yuan')
   AND cost_currency <> 'Yuan';

-- The listing mirror carries the same column, written by the same doors, and a
-- listing whose currency the partner catalogue cannot resolve prices off a rate
-- of one exactly as the admin did.
UPDATE product_listings
   SET cost_currency = 'Yuan'
 WHERE cost_currency IS NOT NULL
   AND lower(cost_currency) IN ('cny', 'yuan')
   AND cost_currency <> 'Yuan';

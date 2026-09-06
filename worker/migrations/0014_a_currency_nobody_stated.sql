-- A currency nobody stated is not a currency, and right now it looks like one.
--
-- `cost_currency` carries DEFAULT 'USD' on both `products` and
-- `product_listings`. So a row where somebody chose dollars and a row where
-- nobody was ever asked are the same row, and the guess is worth roughly seven
-- times the money: a 1200 CNY invoice stored as 1200 USD prices the tea
-- sevenfold, the x3 triples the error, and the schema has no objection because
-- 1200 is a perfectly good number. That is how the 1993 Y562 came to show a
-- cost of $1,200 against notes saying 60 CNY x 20 boxes. Adrian's own reading
-- of the shelf is that MOST of these teas were not paid for in dollars.
--
-- Every door that writes an amount now has to say what the amount is in
-- (`costCurrency.ts`), so rows written from here forward are answers. This
-- migration is about the rows already on the shelf, and it does exactly one
-- thing: it makes "somebody said" distinguishable from "nobody said".
--
--   NULL       nobody ever stated it. The stored currency may be right and may
--              be the default; there is no way to tell from the row.
--   'stated'   a human or a door that had to answer said so.
--   'recovered' it was reconciled against a record of what was actually paid.
--
-- What this migration deliberately does NOT do is change a single currency.
--
-- The temptation is to join `inventory_receipt_lines.original_cost_currency`
-- (which, unlike the product column, has no default and so is honest) and
-- rewrite the rows it covers. Two reasons not to, and the second is the one
-- that matters:
--
--   1. `tea_compass_entries.price_currency` DEFAULTS to 'NT'. It is the same
--      disease in a second table, so it is not evidence, and a migration that
--      treats it as evidence would silently retag Taiwanese every tea that ever
--      passed through the compass without a currency.
--   2. Evidence belongs READ AT USE TIME, NOT COPIED INTO ROWS. That is the
--      rule migration 0010 exists to restore and 0013 exists to finish. A
--      backfill that resolves the receipt join once freezes an answer that the
--      receipts can later contradict, and produces exactly the copied-default
--      shape being removed everywhere else in this schema. The audit surface
--      does the join live, every time it is asked.
--
-- So: the column, and nothing else. Correcting the shelf is an action Adrian
-- takes against evidence he can see, in bulk, one answer per vendor rather than
-- one per tea, through `/admin/cost-currency` or the `set_cost_currency` MCP
-- tool. A migration that moved hundreds of prices on a join nobody had looked
-- at would be the same fault wearing a fix's clothes.

ALTER TABLE products ADD COLUMN cost_currency_source TEXT;
ALTER TABLE product_listings ADD COLUMN cost_currency_source TEXT;

-- Read by the audit surface's "unverified" filter and by nothing on the hot
-- pricing path, so it is a partial index on the rows that are actually looked
-- for rather than an index over the whole shelf.
CREATE INDEX IF NOT EXISTS idx_products_cost_currency_unverified
  ON products(account_id) WHERE cost_currency_source IS NULL;
CREATE INDEX IF NOT EXISTS idx_listings_cost_currency_unverified
  ON product_listings(account_id) WHERE cost_currency_source IS NULL;

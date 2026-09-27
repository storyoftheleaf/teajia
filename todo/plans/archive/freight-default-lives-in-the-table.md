# Every new tea follows the shop rate, from the table up

**Finding:** audit items JOBO-1, MONEY-1, FEEL-1, MONEY-7 in [docs/AUDIT-2026-09.md](../../docs/AUDIT-2026-09.md).

**What is wrong.** `worker/schema.sql` says `products.shipping_rate_per_kg REAL DEFAULT NULL` and `product_listings` the same; the live table was created by migration `0000` with `DEFAULT 0`, and `markup_multiplier` with `DEFAULT 2.5`. Migrations 0007, 0010, 0013 and 0016 all ran UPDATEs over existing rows; none rebuilt the table, and SQLite cannot change a column default any other way. So the default that CLAUDE.md says was removed is still there for every future INSERT, and five of the six INSERT sites omit the column: `worker/src/index.ts` at 2818 (bulk create), 2981, 13732 (receipt proposal), 14727 (cellar placement), 23736 (inbound import) and `worker/src/mcp.ts` 876 (`create_tea`). The bulk door strips null keys before inserting, so it cannot even send NULL on purpose.

**What done looks like.** `PRAGMA table_info(products)` and `(product_listings)` on the sandbox copy of live report `dflt_value` NULL for `shipping_rate_per_kg` and `markup_multiplier`. A tea created through every door with the field omitted shows the shop rate in the Ship $/kg column with no gold dot, and prices at (cost + freight) x 3.

## Steps

1. Write migration `0017` that rebuilds both tables with the corrected defaults: create the new table from the intended DDL, copy every row, drop the old, rename, then replay the indexes and triggers that name those tables (read them back from `sqlite_master` first; the sandbox refresh script shows how). Wrap in a transaction. Rehearse it twice against a scratch database seeded from `worker/schema.sql` in `node:sqlite`, and once against the sandbox copy of live.
2. This migration moves rows, so publish the walkthrough page first and hand Adrian the link, per the CLAUDE.md rule. Before/after row shapes: a tea with an omitted rate, a tea pinned at 0, a tea pinned at 85, teaware.
3. Make every INSERT into `products` and `product_listings` name `shipping_rate_per_kg` and `markup_multiplier` explicitly (NULL unless the caller set one), so the code no longer relies on the default at all. Six sites in the worker.
4. Fix the guard. `schema-defaults-are-decisions.test.ts` must read the real default from migration `0000` plus every later migration (or from the sandbox database when present) and compare it with the registry's claimed value, so a default that disagrees with its written reason fails the suite. Add a test that runs each INSERT door with the field omitted against `node:sqlite` seeded from the migrations, not from `schema.sql`, and asserts NULL landed.
5. Correct `worker/schema.sql` only after the migration lands, so the file and the database agree again.
6. Afterwards: the FEEL lane's inventory screenshot showed `$0.00 (pinned to this tea)` on every fresh row. Adrian's check is that column: a newly added tea shows the shop rate with no dot.

## Watch for

- The refresh script copies live structure; after the migration deploys, run `npm run sandbox:refresh` so the sandbox matches.
- `product_listings` has more than one unique index used by upserts. Missing one on the rebuild makes an `ON CONFLICT` upsert fail outright.
- `cost_amount REAL DEFAULT 0` has the same shape and is registered DEBT; rebuilding the table is the one moment it can be fixed for free. Decide whether to take it in the same migration (recommended) or leave it registered.

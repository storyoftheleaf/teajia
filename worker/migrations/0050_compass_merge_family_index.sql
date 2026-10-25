-- The merge-family walk and the shelf page get an index, because every search
-- pays for both.
--
-- worker/src/curateHoldings.ts answers which teas have been merged into which
-- by recursing on `merged_into_id` inside one account, and that reading sits
-- behind `search_tea`, `curate_stock` and GET /api/curate/holdings. On D1 its
-- scans are billed as rows read, which is what exhausted the free-tier daily
-- allowance on 2026-10-24 and took the whole API down with it.
--
-- `merged_into_id` LEADS, which is the opposite of the obvious order, and the
-- order is the whole point. The recursive step looks a tea up BY its parent
-- (`e.merged_into_id = f.id`) inside one account, so `merged_into_id` is the
-- lookup key and `account_id` is the extra column that keeps it a covering
-- read. An index on `(account_id, merged_into_id)` cannot serve that lookup at
-- all: `account_id` leads, `merged_into_id` is unreachable without it, and
-- SQLite falls back to building a throwaway index per step. Measured against
-- Miniflare's D1 on a seeded 300-tea shelf, `(account_id, merged_into_id)`
-- saved 30 rows read of 142,009. This one, with the query's join order pinned,
-- takes the same page to 5,525.
--
-- The second index is the shelf page itself. The page is ordered by
-- `COALESCE(vendor_name,''), COALESCE(name,''), id` — coalesced because a NULL
-- in the keyset's row-value comparison would answer NULL and silently drop
-- every tea with no vendor recorded — and an index on the raw columns cannot
-- serve a sort over an expression, so this one indexes the expressions. It
-- took the same 300-tea page from 5,525 rows to 4,755, and more as the shelf
-- grows: at 3,000 teas, 31,453 to 20,003.
--
-- Neither is partial. The recursion compares `merged_into_id` to a non-NULL
-- id, but SQLite cannot prove that statically and would decline a partial
-- index; the full one also serves the `merged_into_id IS NULL` filter that
-- picks out the canonical teas.
--
-- Nothing in the code requires either of them. They are a perf aid: the
-- reading is correct and bounded without them, and reads about 40% more rows.
--
-- Schema only: no row is read, written or moved.
CREATE INDEX IF NOT EXISTS idx_compass_merged_into
  ON tea_compass_entries(merged_into_id, account_id);

CREATE INDEX IF NOT EXISTS idx_compass_account_shelf_order
  ON tea_compass_entries(account_id, COALESCE(vendor_name,''), COALESCE(name,''), id);

-- The merge-family walk gets an index, because every search pays for it.
--
-- worker/src/curateHoldings.ts answers which teas have been merged into which by
-- recursing on `merged_into_id` inside one account, and that reading sits behind
-- `search_tea`, `curate_stock` and GET /api/curate/holdings. With no index on
-- that pair SQLite builds a throwaway one at runtime for each recursive step,
-- and building it is itself a full scan of tea_compass_entries: EXPLAIN QUERY
-- PLAN reports "SEARCH e USING AUTOMATIC PARTIAL COVERING INDEX" in three
-- places, and with this index all three become real index searches. On D1 that
-- scan is billed as rows read, which is what exhausted the free-tier daily
-- allowance and took the whole API down with it.
--
-- Not partial. The recursion compares `merged_into_id` to a non-NULL id, but
-- SQLite cannot prove that statically, so it would decline a partial index; the
-- full one also serves the `merged_into_id IS NULL` filter that picks out the
-- canonical teas.
--
-- Schema only: no row is read, written or moved.
CREATE INDEX IF NOT EXISTS idx_compass_account_merged_into
  ON tea_compass_entries(account_id, merged_into_id);

-- 054_featured_collection_flag.sql
-- Adds is_featured_collection flag to collections so the system-managed
-- "Featured" collection (used by POST /api/products/:id/featured) is
-- distinguishable from any user collection that happens to be titled "Featured".
-- The flag is set automatically by the endpoint; users never set it manually.

ALTER TABLE collections ADD COLUMN is_featured_collection INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_collections_featured
  ON collections(account_id, is_featured_collection)
  WHERE is_featured_collection = 1;

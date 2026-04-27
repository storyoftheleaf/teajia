-- 053_collection_shop_index.sql
-- Partial index for fast active-shop-publication lookups.
-- The collection_publications table already supports target_type='shop' via
-- its CHECK constraint (added in 039_collections.sql). No schema change needed,
-- only the index that makes GET /api/collections/shop and the idempotency
-- check in publish-shop efficient at scale.

CREATE INDEX IF NOT EXISTS idx_publications_shop_active
  ON collection_publications(target_type, unpublished_at)
  WHERE target_type = 'shop' AND unpublished_at IS NULL;

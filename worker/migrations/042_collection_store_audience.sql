-- 042_collection_store_audience.sql
-- Phase 2 Collections: store audience.
-- Replaces the legacy Catalog Seed flow with reference-on-publish + opt-in
-- import. The recipient sees an inbound Collection-shaped object and chooses
-- which products to materialize into their own inventory.

-- Provenance on imported products — lets the inbound view show "Imported"
-- per row and prevents accidental re-imports.
ALTER TABLE products ADD COLUMN imported_from_product_id TEXT;
ALTER TABLE products ADD COLUMN imported_via_publication_id TEXT;
CREATE INDEX IF NOT EXISTS idx_products_imported_from
    ON products(account_id, imported_from_product_id);

-- Unread state for inbound publications — drives the badge in /admin/collections
-- and the AccountPanel Operator card.
ALTER TABLE collection_publications ADD COLUMN recipient_seen_at TEXT;

-- Lookup index for "publications targeting this account."
CREATE INDEX IF NOT EXISTS idx_collection_publications_target
    ON collection_publications(target_type, target_id, unpublished_at);

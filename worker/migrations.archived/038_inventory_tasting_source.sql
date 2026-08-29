-- Track the provenance of a product's structured tasting profile.
--   'owner'     — saved by the shop owner (authoritative for this product).
--   'community' — aggregated from public reviews.
--   NULL        — no saved tasting (fall back to style-level common profile on the frontend).
--
-- Only 'owner' and 'community' are treated as claims about the specific product
-- on the public product page; anything else shows under a "Common to this style"
-- label or is hidden entirely when no style baseline exists.
ALTER TABLE products ADD COLUMN tasting_source TEXT;

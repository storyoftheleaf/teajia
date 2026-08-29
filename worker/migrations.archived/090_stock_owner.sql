-- Migration 090: Stock ownership — give every stock row an owner (stock spine step 1)
--
-- The stock-spine plan (docs/MULTI_STORE_PLAN.md § "Movement / Locations /
-- Sellers / Personal Collections") rests on one rule: every piece of stock is
-- owned by a person. This migration adds that owner column to both the legacy
-- `products` table and its per-account `product_listings` mirror.
--
-- owner_user_id is NULLABLE on purpose. NULL means "owned by the location
-- itself" — the default, pre-spine state. Existing rows stay NULL, so nothing
-- changes visibly: no read query, storefront filter, or UI reads this column
-- yet. It is the dormant foundation the later steps (seller curation, the
-- master view, personal collections, the standalone seller) build on.
--
-- We deliberately do NOT backfill to any specific user. Location-owned (NULL)
-- is the correct existing-behavior default; a forced backfill would silently
-- re-attribute every historical row to one person.
--
-- The index on (account_id, owner_user_id) is added now so later per-owner
-- filtering and rollups (which always scope by account first) are cheap.
--
-- WARNING: SQLite ADD COLUMN has no IF NOT EXISTS — apply exactly once.

ALTER TABLE products ADD COLUMN owner_user_id TEXT;
ALTER TABLE product_listings ADD COLUMN owner_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_products_account_owner  ON products(account_id, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_listings_account_owner  ON product_listings(account_id, owner_user_id);

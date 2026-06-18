-- Migration 091: Stock shown-in-shop switch (stock spine step 2)
--
-- Step 1 (migration 090) recorded WHOSE tea each row is (owner_user_id).
-- Step 2 splits "stock exists" from "stock is shown": the location owner — not
-- the seller — decides which of a seller's tea actually appears in the shop.
--
-- This is a SEPARATE switch from is_public. is_public is the seller/operator's
-- "list this at all" flag; shown_in_shop is the LOCATION OWNER's curation gate.
-- The public storefront now requires BOTH (is_public = 1 AND shown_in_shop = 1).
--
-- LOCKED default behaviour (docs/MULTI_STORE_PLAN.md, todo/plans/stock-spine.md):
--   * Existing rows default to 1 (shown) — nothing changes in any shop today.
--   * A row added by a NON-owner seller (staff) defaults to 0 (held) — set in
--     the create handler from the creating user's role, not by this schema.
-- The DEFAULT 1 here only governs the backfill of existing rows and any row
-- whose creator is an owner; staff-created rows are explicitly inserted as 0.
--
-- Mirrored onto product_listings too (it is the per-account inventory mirror),
-- via LISTING_MIRROR_COLUMNS in worker/src/index.ts.
--
-- WARNING: SQLite ADD COLUMN has no IF NOT EXISTS — apply exactly once.
-- 091 is the single source of truth for shown_in_shop; do NOT add it to any
-- old CREATE TABLE (a fresh-DB create + this ALTER would collide).

ALTER TABLE products         ADD COLUMN shown_in_shop INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_listings ADD COLUMN shown_in_shop INTEGER NOT NULL DEFAULT 1;

-- Public storefront filters on (account_id, shown_in_shop, is_public, status);
-- a partial index on the curation gate keeps that read cheap.
CREATE INDEX IF NOT EXISTS idx_products_account_shown ON products(account_id, shown_in_shop);

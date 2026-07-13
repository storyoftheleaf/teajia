-- 048_tea_profiles.sql
-- Step 1 (Profiles migration) of the Network Rollout.
-- Introduces canonical tea profiles + per-account product listings.
-- Per docs/NETWORK_UI_BRIEF.md.
--
-- Mental model:
--   tea_profiles    = canonical content for a tea (name, origin, description, lore, photos)
--   product_listings = per-account references to a profile (stock, price, vendor, store note)
--
-- Migration is ADDITIVE ONLY. The existing `products` table stays in place,
-- read-only as a fallback, until a future cleanup migration removes it.
-- All worker handlers that read from products keep working unchanged.
--
-- Scope: Only TEA rows are migrated. Teaware (products.type = 'Teaware')
-- stays in products as-is, per Decision 5 in the rollout plan
-- ("profiles are tea-only").

-- ── 1. tea_profiles — canonical tea content ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tea_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT UNIQUE NOT NULL,
  -- Lineage (immutable) vs stewardship (transferable). Per Decision 10.
  originated_by_account_id TEXT NOT NULL REFERENCES accounts(id),
  curated_by_account_id    TEXT NOT NULL REFERENCES accounts(id),
  -- Identity
  name TEXT NOT NULL,
  chinese_name TEXT,
  type TEXT,                          -- 'White' | 'Green' | 'Oolong' | 'Red' | 'Aged' | 'Pu-erh' | 'Hei' | 'Yancha' | etc.
  form TEXT,                          -- 'Loose' | 'Cake' | 'Brick' | etc.
  -- Provenance
  origin_country TEXT,
  origin_region TEXT,
  varietal TEXT,                      -- not in legacy products; stays NULL until edited
  harvest_year TEXT,                  -- mirrors products.year (kept as TEXT for "2024 spring" etc.)
  -- Editorial content
  description TEXT,
  lore TEXT,
  processing_notes TEXT,
  terroir TEXT,
  mood TEXT,                          -- short mood phrase (e.g. "Grounding & Meditative")
  experience TEXT,                    -- 1-2 sentences on the feeling of drinking
  tasting_notes TEXT DEFAULT '[]',    -- JSON array, denormalized for quick display
  -- Photos
  image_url TEXT,                     -- primary canonical photo
  canonical_photos TEXT DEFAULT '[]', -- JSON array of additional R2 URLs (mirrors additional_images)
  -- Tags (live in tasting per Decision 23; columns exist for the
  -- tasting-to-canonical promotion flow that lands in Step 3)
  flavor_tags TEXT DEFAULT '[]',
  mood_tags TEXT DEFAULT '[]',
  -- Network economics
  wholesale_margin_pct INTEGER,       -- profile-level override; NULL falls back to trust-tier default
  network_visible INTEGER NOT NULL DEFAULT 1,
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'published', -- 'draft' | 'published' | 'archived'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_originated ON tea_profiles(originated_by_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_curated    ON tea_profiles(curated_by_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_network    ON tea_profiles(network_visible, status);
CREATE INDEX IF NOT EXISTS idx_profiles_type       ON tea_profiles(type);

-- ── 2. product_listings — per-account references to a profile ───────────────
CREATE TABLE IF NOT EXISTS product_listings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  profile_id TEXT NOT NULL REFERENCES tea_profiles(id),
  -- Inventory
  stock_grams INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 100,
  recheck_stock INTEGER DEFAULT 0,
  -- Pricing
  fixed_retail_price_usd REAL,        -- if set, overrides markup_multiplier-derived price
  markup_multiplier REAL DEFAULT 2.5,
  -- Cost / sourcing (PROTECTED from cross-account reads, per Phase 1A protections)
  vendor TEXT,
  vendor_id TEXT,
  cost_amount REAL DEFAULT 0,
  cost_currency TEXT DEFAULT 'USD',
  shipping_rate_per_kg REAL DEFAULT 0,
  quantity_purchased INTEGER,
  source_compass_entry_id TEXT,
  stock_verified_at TEXT,
  -- Per-listing override of canonical content
  store_note TEXT,
  listing_photos TEXT DEFAULT '[]',           -- JSON, shown FIRST on storefront if present
  hide_canonical_photos INTEGER NOT NULL DEFAULT 0,
  -- Visibility flags (each carries distinct intent, per memory_visibility_flag_semantics)
  is_personal INTEGER DEFAULT 0,
  can_reorder INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  is_curated INTEGER DEFAULT 0,
  is_sample INTEGER DEFAULT 0,
  in_transit INTEGER DEFAULT 0,
  show_wisdom INTEGER DEFAULT 1,
  is_custom_wisdom INTEGER DEFAULT 0,
  -- Lifecycle (soft-delete: partner stops carrying — per Decision 13)
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
  archived_at TEXT,
  archived_reason TEXT,
  sold_out_at TEXT,
  -- Tasting (per-listing because tasting is per-account-per-tea)
  tasting TEXT DEFAULT '{}',
  tasting_source TEXT,
  -- Migration anchor — the legacy product row this listing was created from.
  -- Populated by backfill below; NULL for listings created post-migration.
  legacy_product_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_listings_account        ON product_listings(account_id);
CREATE INDEX IF NOT EXISTS idx_listings_profile        ON product_listings(profile_id);
CREATE INDEX IF NOT EXISTS idx_listings_account_status ON product_listings(account_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_legacy         ON product_listings(legacy_product_id);

-- ── 3. wholesale_margin_defaults — tier → percentage table ──────────────────
-- Adrian tunes these in Platform settings. Resolution chain (handled in worker):
--   per-partner override  →  per-profile margin  →  trust-tier default  →  global fallback (50%)
CREATE TABLE IF NOT EXISTS wholesale_margin_defaults (
  trust_tier TEXT PRIMARY KEY,        -- 'basic' | 'verified' | 'partner' | 'tea_master'
  default_margin_pct INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO wholesale_margin_defaults (trust_tier, default_margin_pct) VALUES
  ('basic',      50),
  ('verified',   45),
  ('partner',    40),
  ('tea_master', 48);

-- ── 4. account_wholesale_overrides — per-partner per-profile override ───────
CREATE TABLE IF NOT EXISTS account_wholesale_overrides (
  profile_id          TEXT NOT NULL REFERENCES tea_profiles(id),
  buyer_account_id    TEXT NOT NULL REFERENCES accounts(id),
  margin_pct_override INTEGER NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, buyer_account_id)
);

-- ── 5. Backfill — products → tea_profiles + product_listings ────────────────
-- For every TEA product (type IS NULL OR type != 'Teaware'):
--   1. Create a tea_profile with the canonical content
--   2. Create a product_listing in the same account pointing at the new profile
--
-- Lineage: originated_by = curated_by = the product's current account_id.
-- Tea Master adoption / cross-account curation transfers happen later via
-- the network/adopt endpoint (Step 6).
--
-- Profile id is deterministic ('prof_' || product.id) so the listing JOIN
-- below doesn't have to re-compute the slug — it just references the profile
-- by the same product id prefix. This avoids slug-string-matching brittleness.
--
-- Slug derivation: use tea_key when present (lowercased, hyphenated).
-- Append the 6-char product id suffix unconditionally to guarantee uniqueness
-- across accounts (two accounts with the same tea_key get distinct slugs;
-- the cross-account "this is the same tea" link comes via tea_key, not slug).
INSERT INTO tea_profiles (
  id, slug,
  originated_by_account_id, curated_by_account_id,
  name, chinese_name, type, form,
  origin_country, origin_region, harvest_year,
  description, lore, processing_notes, terroir, mood, experience,
  tasting_notes,
  image_url, canonical_photos,
  network_visible, status,
  created_at, updated_at
)
SELECT
  'prof_' || p.id AS id,
  -- Slug always ends with the 6-char product id suffix to guarantee
  -- per-account uniqueness even when tea_key is shared across accounts.
  LOWER(REPLACE(REPLACE(REPLACE(
    COALESCE(NULLIF(p.tea_key, ''), p.product_name || COALESCE('-' || p.year, ''))
      || '-' || SUBSTR(p.id, 1, 6),
    ' ', '-'),
    '/', '-'),
    '''', '')) AS slug,
  p.account_id,
  p.account_id,
  p.product_name,
  p.chinese_name,
  p.type,
  p.form,
  p.origin_country,
  p.origin_region,
  p.year,
  p.description,
  p.lore,
  p.processing_notes,
  p.terroir,
  p.mood,
  p.experience,
  COALESCE(p.tasting_notes, '[]'),
  p.image_url,
  COALESCE(p.additional_images, '[]'),
  -- network_visible: only public, non-personal, non-sample teas show up in
  -- partner catalog browse by default. Adrian can flip individual profiles
  -- later via the network admin views (Step 2+).
  CASE WHEN COALESCE(p.is_public, 1) = 1
            AND COALESCE(p.is_personal, 0) = 0
            AND COALESCE(p.is_sample, 0) = 0
       THEN 1 ELSE 0 END,
  CASE COALESCE(p.status, 'Active')
    WHEN 'Archived' THEN 'archived'
    WHEN 'Draft'    THEN 'draft'
    ELSE 'published'
  END,
  COALESCE(p.created_at, datetime('now')),
  COALESCE(p.updated_at, datetime('now'))
FROM products p
WHERE p.type IS NULL OR p.type != 'Teaware';

-- Now create one product_listing per migrated tea, pointing at the profile
-- we just inserted. Profile id is deterministically 'prof_' || product.id,
-- so no slug-matching is required.
INSERT INTO product_listings (
  id, account_id, profile_id,
  stock_grams, low_stock_threshold, recheck_stock,
  fixed_retail_price_usd, markup_multiplier,
  vendor, vendor_id, cost_amount, cost_currency,
  shipping_rate_per_kg, quantity_purchased, source_compass_entry_id,
  stock_verified_at,
  is_personal, can_reorder, is_public, is_featured, is_curated, is_sample, in_transit,
  show_wisdom, is_custom_wisdom,
  status, sold_out_at,
  tasting, tasting_source,
  legacy_product_id,
  created_at, updated_at
)
SELECT
  'list_' || p.id,
  p.account_id,
  'prof_' || p.id,
  COALESCE(p.stock_grams, 0),
  COALESCE(p.low_stock_threshold, 100),
  COALESCE(p.recheck_stock, 0),
  p.fixed_retail_price_usd,
  COALESCE(p.markup_multiplier, 2.5),
  p.vendor, p.vendor_id, COALESCE(p.cost_amount, 0), COALESCE(p.cost_currency, 'USD'),
  COALESCE(p.shipping_rate_per_kg, 0), p.quantity_purchased, p.source_compass_entry_id,
  p.stock_verified_at,
  COALESCE(p.is_personal, 0), COALESCE(p.can_reorder, 0), COALESCE(p.is_public, 1),
  COALESCE(p.is_featured, 0), COALESCE(p.is_curated, 0), COALESCE(p.is_sample, 0),
  COALESCE(p.in_transit, 0),
  COALESCE(p.show_wisdom, 1), COALESCE(p.is_custom_wisdom, 0),
  -- Listing status: 'archived' if the legacy product was archived. Otherwise 'active'.
  -- Sold-out doesn't archive the listing (per Decision 13: stock zero ≠ stopped carrying).
  CASE WHEN COALESCE(p.status, 'Active') = 'Archived' THEN 'archived' ELSE 'active' END,
  p.sold_out_at,
  COALESCE(p.tasting, '{}'),
  p.tasting_source,
  p.id,
  COALESCE(p.created_at, datetime('now')),
  COALESCE(p.updated_at, datetime('now'))
FROM products p
WHERE p.type IS NULL OR p.type != 'Teaware';

-- ── 6. tea_reviews.profile_id — Sub-step 1b ─────────────────────────────────
-- Promote tea_reviews from tea_key string to profile_id FK. Each review carries
-- a product_id pointing at the legacy products row; we use that to look up the
-- deterministic 'prof_' || product_id profile we just inserted.
-- Old tea_key column stays for one release as a fallback for any cross-account
-- review whose product_id is on another account.
ALTER TABLE tea_reviews ADD COLUMN profile_id TEXT REFERENCES tea_profiles(id);

UPDATE tea_reviews
SET profile_id = 'prof_' || product_id
WHERE product_id IS NOT NULL
  AND product_id != ''
  AND EXISTS (SELECT 1 FROM tea_profiles WHERE id = 'prof_' || tea_reviews.product_id);

CREATE INDEX IF NOT EXISTS idx_reviews_profile ON tea_reviews(profile_id);

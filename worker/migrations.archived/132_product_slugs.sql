-- 132_product_slugs.sql
-- Readable public web addresses for products.
--
-- Before this migration /shop/product/:id took a raw UUID, so every shared
-- link and every search result read as machine noise. This adds products.slug
-- and backfills it from the name the product page actually displays.
--
-- NOT the same thing as tea_profiles.slug, and the two must not be merged:
--   tea_profiles.slug  = network-wide canonical identifier. Carries a 6-char
--                        id suffix on purpose so two accounts holding the same
--                        tea still get distinct rows (see 048_tea_profiles.sql).
--   products.slug      = the public web address for ONE shop's listing. Reads
--                        as a name, no suffix unless a name genuinely repeats.
-- Teaware has no tea_profile at all, so only products.slug can cover the whole
-- catalogue. Two columns, two jobs.
--
-- Addresses are minted once and never move on their own: renaming a product
-- does not rewrite a live URL, so existing links and search results survive.
-- Resolution accepts BOTH the slug and the legacy id, so nothing ever 404s.

-- ── 1. The column ───────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN slug TEXT;

-- ── 2. Backfill ─────────────────────────────────────────────────────────────
-- Base name mirrors the page heading rule in AlcoveIdentityHeader: the given
-- name when it is real and different, otherwise the product name.
--
-- SQLite has no regex, so punctuation is stripped with nested REPLACE, the same
-- approach used by the 048 backfill. Apostrophes vanish; every other separator
-- becomes a hyphen; runs of hyphens collapse; ends are trimmed.
--
-- Collision ladder, in order:
--   1. bare name                       (~295 of 316 rows)
--   2. name + year, when a year exists (~19 rows)
--   3. name + counter                  (2 rows: Liao Fu, Oriental Beauty)
UPDATE products SET slug = (
  SELECT CASE WHEN l.rn = 1 THEN l.cand ELSE l.cand || '-' || l.rn END
  FROM (
    SELECT
      c.id,
      c.cand,
      ROW_NUMBER() OVER (PARTITION BY c.cand ORDER BY c.created_at, c.id) AS rn
    FROM (
      SELECT
        b.id,
        b.created_at,
        CASE
          WHEN b.base_n = 1              THEN b.base
          WHEN b.year IS NOT NULL        THEN b.base || '-' || b.year
          ELSE b.base
        END AS cand
      FROM (
        SELECT
          s.id,
          s.created_at,
          s.year,
          s.base,
          COUNT(*) OVER (PARTITION BY s.base) AS base_n
        FROM (
          SELECT
            p.id,
            p.created_at,
            p.year,
            COALESCE(
              NULLIF(
                TRIM(
                  -- collapse runs of hyphens (four passes covers the worst name)
                  REPLACE(REPLACE(REPLACE(REPLACE(
                  -- separators to hyphen
                  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                  -- characters that simply disappear
                  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    LOWER(TRIM(
                      CASE
                        WHEN p.given_name IS NOT NULL
                         AND TRIM(p.given_name) <> ''
                         AND LOWER(TRIM(p.given_name)) <> 'unknown'
                         AND TRIM(p.given_name) <> TRIM(p.product_name)
                        THEN p.given_name
                        ELSE p.product_name
                      END
                    )),
                    '''', ''), '’', ''), '"', ''), '`', ''), '.', ''),
                    ' ', '-'), '/', '-'), '\', '-'), ',', '-'), '(', '-'),
                    ')', '-'), '&', '-'), '+', '-'), '_', '-'), ':', '-'),
                    ';', '-'), '!', '-'), '?', '-'), '%', '-'),
                    '----', '-'), '---', '-'), '--', '-'), '--', '-'),
                  '-'
                ),
                ''
              ),
              SUBSTR(p.id, 1, 8)
            ) AS base
          FROM products p
        ) s
      ) b
    ) c
  ) l
  WHERE l.id = products.id
);

-- ── 3. Uniqueness ───────────────────────────────────────────────────────────
-- NULLs do not collide in SQLite, so a row that somehow escapes the backfill
-- stays addressable by its id rather than blocking the index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

-- ── 4. Repair the mirror gap ────────────────────────────────────────────────
-- Teas created after 048 by a path that skipped buildProductMirrorInserts have
-- no tea_profiles row, so edits to them have no canonical record to write into.
-- Same SELECT shape as the 048 backfill, restricted to the missing rows.
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
  'prof_' || p.id,
  LOWER(REPLACE(REPLACE(REPLACE(
    COALESCE(NULLIF(p.tea_key, ''), p.product_name || COALESCE('-' || p.year, ''))
      || '-' || SUBSTR(p.id, 1, 6),
    ' ', '-'),
    '/', '-'),
    '''', '')),
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
WHERE (p.type IS NULL OR p.type != 'Teaware')
  AND p.account_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tea_profiles tp WHERE tp.id = 'prof_' || p.id);

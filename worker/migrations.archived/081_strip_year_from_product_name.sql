-- 081_strip_year_from_product_name — one-time cleanup of redundant vintages
-- baked into product names.
--
-- The inventory table renders a dedicated Year column, so a name like
-- "Aged Liu Bao 1960" repeats the vintage that already sits one column over.
-- This migration strips a trailing year from product_name ONLY when it exactly
-- matches the row's own `year` value, so a trailing number that is NOT the
-- recorded vintage is never touched.
--
-- Matching is conservative: the year must appear at the very end of the name,
-- preceded by a single separator (space, comma+space, or " - "/" – "). We run
-- one UPDATE per separator shape. year is stored as INTEGER (see migration 018)
-- but some rows carry it as TEXT, so we compare against CAST(year AS TEXT).
--
-- Idempotent: re-running is a no-op because the matched suffix is already gone.

-- " 1960"  →  trailing space + year
UPDATE products
SET product_name = TRIM(SUBSTR(product_name, 1, LENGTH(product_name) - LENGTH(CAST(year AS TEXT)) - 1))
WHERE year IS NOT NULL
  AND CAST(year AS TEXT) GLOB '[0-9][0-9][0-9][0-9]'
  AND product_name LIKE '% ' || CAST(year AS TEXT)
  AND LENGTH(TRIM(SUBSTR(product_name, 1, LENGTH(product_name) - LENGTH(CAST(year AS TEXT)) - 1))) > 0;

-- ", 1960"  →  comma + space + year
UPDATE products
SET product_name = TRIM(SUBSTR(product_name, 1, LENGTH(product_name) - LENGTH(CAST(year AS TEXT)) - 2))
WHERE year IS NOT NULL
  AND CAST(year AS TEXT) GLOB '[0-9][0-9][0-9][0-9]'
  AND product_name LIKE '%, ' || CAST(year AS TEXT)
  AND LENGTH(TRIM(SUBSTR(product_name, 1, LENGTH(product_name) - LENGTH(CAST(year AS TEXT)) - 2))) > 0;

-- " - 1960"  →  space-dash-space + year
UPDATE products
SET product_name = TRIM(SUBSTR(product_name, 1, LENGTH(product_name) - LENGTH(CAST(year AS TEXT)) - 3))
WHERE year IS NOT NULL
  AND CAST(year AS TEXT) GLOB '[0-9][0-9][0-9][0-9]'
  AND product_name LIKE '% - ' || CAST(year AS TEXT)
  AND LENGTH(TRIM(SUBSTR(product_name, 1, LENGTH(product_name) - LENGTH(CAST(year AS TEXT)) - 3))) > 0;

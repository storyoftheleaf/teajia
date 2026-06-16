-- ============================================================================
-- Teajia inventory — READ-ONLY reconciliation / pre-backfill diagnostics
-- ============================================================================
-- Every statement here is a SELECT. Nothing is written, updated, or deleted.
-- Run BEFORE applying migration 089's NOT NULL/CHECK section, and any time you
-- want a health snapshot. The new code (PR #234) PREVENTS these conditions
-- going forward but does not retroactively fix rows that already drifted.
--
-- Run it (output is per-statement, each row carries a `check_name` label):
--   cd worker
--   wrangler d1 execute teajia-db --remote --file=./diagnostics/reconciliation_readonly.sql
-- For machine-readable output add --json and pipe to a file.
--
-- Notes:
--   * The listing mirror row id convention is 'list_' || products.id.
--   * Invoice numbers are formatted PREFIX-00005 (zero-padded); the drift
--     check normalizes the numeric tail so '5' and '00005' collide.
--   * Row-returning checks are LIMITed to 200 so output stays bounded — a
--     non-empty result means "investigate"; counts give the true magnitude.
-- ============================================================================


-- ── 1. NEGATIVE STOCK (products) — the headline C2 symptom ──────────────────
SELECT 'negative_stock_products' AS check_name, account_id, id AS product_id,
       given_name, product_name, stock_grams, status
FROM products
WHERE stock_grams < 0
ORDER BY stock_grams ASC
LIMIT 200;

-- magnitude
SELECT 'negative_stock_products_COUNT' AS check_name, COUNT(*) AS n,
       MIN(stock_grams) AS worst
FROM products WHERE stock_grams < 0;


-- ── 2. NEGATIVE STOCK (product_listings mirror) ─────────────────────────────
SELECT 'negative_stock_listings' AS check_name, account_id, id AS listing_id,
       stock_grams, status
FROM product_listings
WHERE stock_grams < 0
ORDER BY stock_grams ASC
LIMIT 200;


-- ── 3. LISTING MIRROR DRIFT (products.stock_grams vs product_listings) ──────
-- The two are double-written; under the old race they could diverge.
SELECT 'listing_mirror_drift' AS check_name, p.account_id, p.id AS product_id,
       p.stock_grams AS product_stock, pl.stock_grams AS listing_stock,
       (COALESCE(p.stock_grams,0) - COALESCE(pl.stock_grams,0)) AS diff
FROM products p
JOIN product_listings pl ON pl.id = 'list_' || p.id
WHERE COALESCE(p.stock_grams,0) <> COALESCE(pl.stock_grams,0)
ORDER BY ABS(COALESCE(p.stock_grams,0) - COALESCE(pl.stock_grams,0)) DESC
LIMIT 200;

SELECT 'listing_mirror_drift_COUNT' AS check_name, COUNT(*) AS n
FROM products p
JOIN product_listings pl ON pl.id = 'list_' || p.id
WHERE COALESCE(p.stock_grams,0) <> COALESCE(pl.stock_grams,0);


-- ── 4. LEDGER DRIFT (products.stock_grams vs latest stock_ledger balance) ───
-- balance_after was previously computed from a stale read; a mismatch means
-- the audit trail and the live stock disagree.
WITH latest AS (
  SELECT product_id, balance_after,
         ROW_NUMBER() OVER (PARTITION BY product_id
                            ORDER BY created_at DESC, rowid DESC) AS rn
  FROM stock_ledger
)
SELECT 'ledger_balance_drift' AS check_name, p.account_id, p.id AS product_id,
       p.stock_grams AS live_stock, l.balance_after AS ledger_balance,
       (COALESCE(p.stock_grams,0) - COALESCE(l.balance_after,0)) AS diff
FROM products p
JOIN latest l ON l.product_id = p.id AND l.rn = 1
WHERE COALESCE(p.stock_grams,0) <> COALESCE(l.balance_after,0)
ORDER BY ABS(COALESCE(p.stock_grams,0) - COALESCE(l.balance_after,0)) DESC
LIMIT 200;


-- ── 5. DUPLICATE INVOICE NUMBERS (incl. format drift '5' vs '00005') ────────
-- Active (non-deleted) invoices only. The new UNIQUE index blocks future
-- string-identical dups; this also catches numerically-equal differently-
-- formatted dups the index would NOT catch.
WITH norm AS (
  SELECT account_id, invoice_number,
         CASE WHEN instr(invoice_number, '-') > 0
              THEN substr(invoice_number, instr(invoice_number, '-') + 1)
              ELSE invoice_number END AS tail
  FROM invoices
  WHERE deleted_at IS NULL
),
num AS (
  SELECT account_id, invoice_number,
         CAST(CASE WHEN ltrim(tail, '0') = '' THEN '0'
                   ELSE ltrim(tail, '0') END AS INTEGER) AS seqnum
  FROM norm
)
SELECT 'duplicate_invoice_numbers' AS check_name, account_id, seqnum,
       COUNT(*) AS variants_count, GROUP_CONCAT(invoice_number) AS variants
FROM num
GROUP BY account_id, seqnum
HAVING COUNT(*) > 1
ORDER BY variants_count DESC
LIMIT 200;


-- ── 6. INVOICE_SEQ counter behind reality (would cause future collisions) ───
WITH norm AS (
  SELECT account_id, invoice_number,
         CASE WHEN instr(invoice_number, '-') > 0
              THEN substr(invoice_number, instr(invoice_number, '-') + 1)
              ELSE invoice_number END AS tail
  FROM invoices
),
num AS (
  SELECT account_id,
         CAST(CASE WHEN ltrim(tail, '0') = '' THEN '0'
                   ELSE ltrim(tail, '0') END AS INTEGER) AS seqnum
  FROM norm
)
SELECT 'invoice_seq_behind_max' AS check_name, a.id AS account_id, a.slug,
       a.invoice_seq, MAX(n.seqnum) AS max_used
FROM accounts a
JOIN num n ON n.account_id = a.id
GROUP BY a.id
HAVING a.invoice_seq < MAX(n.seqnum)
LIMIT 200;


-- ── 7. NULL-account line items (invisible to scoped reads; block 089 NOT NULL)
SELECT 'line_items_null_account' AS check_name, li.id, li.invoice_id,
       li.product_id, li.quantity,
       (SELECT i.account_id FROM invoices i WHERE i.id = li.invoice_id) AS parent_invoice_account
FROM invoice_line_items li
WHERE li.account_id IS NULL
LIMIT 200;

SELECT 'line_items_null_account_COUNT' AS check_name, COUNT(*) AS n
FROM invoice_line_items WHERE account_id IS NULL;


-- ── 8. ORPHANED CHILDREN (FKs are inert in D1 — these can exist) ────────────
SELECT 'orphan_lineitem_missing_product' AS check_name, li.id, li.invoice_id, li.product_id
FROM invoice_line_items li
WHERE li.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = li.product_id)
LIMIT 200;

SELECT 'orphan_lineitem_missing_invoice' AS check_name, li.id, li.invoice_id
FROM invoice_line_items li
WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = li.invoice_id)
LIMIT 200;

SELECT 'orphan_ledger_missing_product' AS check_name, sl.id, sl.product_id, sl.delta, sl.reason
FROM stock_ledger sl
WHERE sl.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = sl.product_id)
LIMIT 200;

SELECT 'orphan_ledger_missing_source_invoice' AS check_name, sl.id, sl.source_invoice_id
FROM stock_ledger sl
WHERE sl.source_invoice_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = sl.source_invoice_id)
LIMIT 200;

SELECT 'orphan_collection_item_missing_product' AS check_name, ci.collection_id, ci.product_id
FROM collection_items ci
WHERE ci.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = ci.product_id)
LIMIT 200;

SELECT 'orphan_sample_missing_product' AS check_name, ts.id, ts.product_id
FROM tea_samples ts
WHERE ts.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = ts.product_id)
LIMIT 200;


-- ── 9. INVALID ENUM/STATUS values (no CHECK constraint exists today) ────────
SELECT 'invalid_product_status' AS check_name, account_id, id AS product_id, status
FROM products
WHERE status NOT IN ('Active', 'Sold Out', 'Archived', 'Draft')
LIMIT 200;

SELECT 'invalid_invoice_status' AS check_name, account_id, id AS invoice_id, status
FROM invoices
WHERE status NOT IN ('Draft', 'Filled', 'Void')
LIMIT 200;

SELECT 'invalid_payment_status' AS check_name, account_id, id AS invoice_id, payment_status
FROM invoices
WHERE payment_status NOT IN ('unpaid', 'partial', 'paid')
LIMIT 200;

-- product_listings.status vocabulary is unverified — list what's actually there
SELECT 'distinct_listing_status' AS check_name, status, COUNT(*) AS n
FROM product_listings
GROUP BY status
ORDER BY n DESC;


-- ── 10. SUSPECT QUANTITIES / PRICES on line items ───────────────────────────
SELECT 'lineitem_nonpositive_qty' AS check_name, id, invoice_id, product_id, quantity
FROM invoice_line_items
WHERE quantity IS NULL OR quantity <= 0
LIMIT 200;

SELECT 'lineitem_negative_price' AS check_name, id, invoice_id, product_id, price_at_sale
FROM invoice_line_items
WHERE price_at_sale IS NULL OR price_at_sale < 0
LIMIT 200;


-- ── 11. YEAR TYPE DRIFT (declared TEXT, treated as INTEGER; mixed rows) ──────
SELECT 'product_year_nonnumeric' AS check_name, account_id, id AS product_id, year
FROM products
WHERE year IS NOT NULL AND year <> '' AND CAST(year AS INTEGER) = 0
LIMIT 200;


-- ── 12. COST CURRENCY without an exchange rate (breaks margin math) ──────────
SELECT 'cost_currency_no_rate' AS check_name, p.account_id, p.id AS product_id,
       p.cost_currency, p.cost_amount
FROM products p
WHERE p.cost_currency IS NOT NULL
  AND p.cost_currency <> 'USD'
  AND p.cost_amount IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM exchange_rates er WHERE er.currency = p.cost_currency)
LIMIT 200;


-- ── 13. MCP token hygiene (informational; H4 only sets expiry on new tokens) ─
SELECT 'mcp_tokens_no_expiry' AS check_name,
       SUM(CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END) AS legacy_non_expiring,
       SUM(CASE WHEN expires_at IS NOT NULL THEN 1 ELSE 0 END) AS expiring,
       SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END) AS active_total
FROM mcp_tokens;

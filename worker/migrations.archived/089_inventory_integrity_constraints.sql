-- Migration 089: Inventory integrity — backfill + constraint hardening
-- (audit C2 follow-up, H6, M5, M7)
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ REVIEW BEFORE APPLYING. The backfill UPDATE at the bottom is safe and      │
-- │ idempotent. The CHECK / NOT NULL constraints below require a full SQLite   │
-- │ table rebuild (create-new → copy → drop → rename) which MUST be hand-      │
-- │ checked against the LIVE products/invoices column set first — they are     │
-- │ left as a commented template precisely so nobody runs a rebuild that       │
-- │ silently drops a column added after this file was written. Do NOT auto-    │
-- │ apply. The application-layer guards (conditional stock UPDATE with         │
-- │ `stock_grams >= ?`, enum validation in worker/src/mcp.ts & index.ts)       │
-- │ already enforce these invariants for all write paths; the DB constraints   │
-- │ below are defense-in-depth.                                                │
-- └──────────────────────────────────────────────────────────────────────────┘

-- ── SAFE: backfill orphaned line-item account_id (H6) ───────────────────────
-- invoice_line_items.account_id is nullable; NULL rows are invisible to every
-- account-scoped read. Backfill from the parent invoice. Idempotent.
UPDATE invoice_line_items
   SET account_id = (
       SELECT i.account_id FROM invoices i WHERE i.id = invoice_line_items.invoice_id
   )
 WHERE account_id IS NULL
   AND invoice_id IS NOT NULL;

-- ── REVIEW-REQUIRED template (do NOT run unverified) ────────────────────────
-- After the backfill above leaves zero NULL account_id rows, and after copying
-- the CURRENT products/invoices column lists verbatim, a rebuild can add:
--   products.stock_grams         CHECK (stock_grams >= 0)
--   products.status              CHECK (status IN ('Active','Sold Out','Archived','Draft'))
--   invoices.status              CHECK (status IN ('Draft','Filled','Void'))
--   invoices.payment_status      CHECK (payment_status IN ('unpaid','partial','paid'))
--   invoice_line_items.account_id  NOT NULL
--
-- Canonical SQLite rebuild shape (per table):
--   PRAGMA foreign_keys=OFF;
--   BEGIN;
--   CREATE TABLE products_new ( ...EXACT current columns... , CHECK (stock_grams >= 0) );
--   INSERT INTO products_new SELECT ...EXACT current columns... FROM products;
--   DROP TABLE products;
--   ALTER TABLE products_new RENAME TO products;
--   -- recreate every products index here
--   COMMIT;
--   PRAGMA foreign_keys=ON;
--
-- Generate the EXACT column list with:
--   wrangler d1 execute teajia-db --remote --command \
--     "SELECT sql FROM sqlite_master WHERE name='products';"
-- and reproduce it verbatim. Then enable per table, one at a time, with a
-- backup taken first.

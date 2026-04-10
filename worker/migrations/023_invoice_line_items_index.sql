-- Migration 023: Index invoice_line_items by invoice_id
-- The GET /api/invoices query does a GROUP BY on invoice_line_items to compute
-- per-invoice totals. Without this index it's a full table scan on every page load.

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice
  ON invoice_line_items(invoice_id);

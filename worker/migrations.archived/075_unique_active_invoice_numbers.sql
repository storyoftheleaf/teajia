-- Prevent ambiguous invoice-number follow-ups inside one account.
-- Soft-deleted invoices may keep their historical number; active invoices may
-- not share the same visible invoice number.

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_account_invoice_number_active
  ON invoices(account_id, invoice_number)
  WHERE deleted_at IS NULL;

-- Order process: an inquiry that has been priced into a Draft invoice carries
-- the invoice it became, so the admin can see it is already converted and the
-- customer's order page can find the pay link that hangs off that invoice.
ALTER TABLE inquiries ADD COLUMN converted_invoice_id TEXT;

-- Partial index: the only read is "which invoice did this inquiry become", and
-- the reverse lookup from an invoice back to its inquiry (fulfilment email).
CREATE INDEX IF NOT EXISTS idx_inquiries_converted_invoice
  ON inquiries(converted_invoice_id)
  WHERE converted_invoice_id IS NOT NULL;

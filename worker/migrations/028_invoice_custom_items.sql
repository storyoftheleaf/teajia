-- Allow custom (non-inventory) line items on invoices
ALTER TABLE invoice_line_items ADD COLUMN custom_name TEXT;

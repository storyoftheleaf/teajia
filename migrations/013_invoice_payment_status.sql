-- Add payment tracking to invoices
ALTER TABLE invoices ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
-- payment_status values: unpaid | partial | paid
ALTER TABLE invoices ADD COLUMN payment_date TEXT;
ALTER TABLE invoices ADD COLUMN payment_method TEXT;
-- payment_method values: cash | transfer | whatsapp_pay | other

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices (payment_status);

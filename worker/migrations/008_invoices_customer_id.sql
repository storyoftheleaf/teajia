-- Add customer_id column to invoices table (was in schema but never migrated)
ALTER TABLE invoices ADD COLUMN customer_id TEXT;

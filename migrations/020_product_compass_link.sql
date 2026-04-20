-- 020: Product ↔ compass entry link for sample pack queue population

-- products table already has source_compass_entry_id from earlier migration
-- Add compass_source_entry_id as an alias / confirm it exists
-- If it already exists this is a no-op at the app level — we just ensure the index

CREATE INDEX IF NOT EXISTS idx_products_compass_entry ON products(source_compass_entry_id) WHERE source_compass_entry_id IS NOT NULL;

-- invoices: track customer user_id for queue population on fulfillment
ALTER TABLE invoices ADD COLUMN customer_user_id TEXT REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN order_type TEXT NOT NULL DEFAULT 'sale'; -- sale | gift

CREATE INDEX IF NOT EXISTS idx_invoices_customer_user ON invoices(customer_user_id) WHERE customer_user_id IS NOT NULL;

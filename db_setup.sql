-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type TEXT NOT NULL,
    given_name TEXT,
    chinese_name TEXT, 
    product_name TEXT NOT NULL,
    year INT,
    origin_country TEXT,
    origin_region TEXT,
    description TEXT,
    tasting_notes TEXT[],
    image_url TEXT,
    status TEXT DEFAULT 'Active',
    vendor TEXT,
    stock_grams INT DEFAULT 0,
    -- Cost tracking
    cost_amount NUMERIC DEFAULT 0, -- Base cost of the batch (excluding shipping)
    cost_currency TEXT DEFAULT 'USD',
    shipping_rate_per_kg NUMERIC DEFAULT 0, -- Shipping cost per KG in source currency
    quantity_purchased INT, -- Original quantity to calculate cost per gram
    low_stock_threshold INT DEFAULT 100,
    markup_multiplier NUMERIC DEFAULT 2.5, -- Standard retail markup
    fixed_retail_price_usd NUMERIC, -- Override calculated price
    -- New Flags
    is_personal BOOLEAN DEFAULT FALSE,
    can_reorder BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    lore TEXT,
    is_custom_wisdom BOOLEAN DEFAULT FALSE,
    show_wisdom BOOLEAN DEFAULT TRUE,
    processing_notes TEXT,
    mood TEXT,
    experience TEXT,
    liquor_color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to set quantity_purchased on insert if missing (for cost calc)
CREATE OR REPLACE FUNCTION set_initial_quantity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity_purchased IS NULL THEN
        NEW.quantity_purchased := NEW.stock_grams;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_initial_qty ON products;
CREATE TRIGGER trigger_set_initial_qty
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION set_initial_quantity();

-- 3. Create Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency TEXT PRIMARY KEY,
    rate_to_usd NUMERIC NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Rates
INSERT INTO exchange_rates (currency, rate_to_usd) VALUES
('USD', 1.0),
('NT', 32.3),
('Yuan', 7.2),
('IDR', 16210),
('JPY', 150.0),
('MYR', 4.7)
ON CONFLICT (currency) DO NOTHING;

-- 4. Create Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    customer_name TEXT,
    customer_whatsapp TEXT,
    display_currency TEXT,
    shipping_cost_usd NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Draft',
    inventory_deducted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Invoice Line Items Table
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id UUID REFERENCES invoices(id),
    product_id UUID REFERENCES products(id),
    quantity INT NOT NULL,
    price_at_sale NUMERIC NOT NULL
);

-- 6. Create Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_email TEXT,
    action TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Product Pricing View
DROP VIEW IF EXISTS product_pricing_view;
CREATE OR REPLACE VIEW product_pricing_view WITH (security_invoker = true) AS
SELECT 
    p.*,
    CASE 
        WHEN p.quantity_purchased > 0 THEN 
            (
                (p.cost_amount / p.quantity_purchased) + 
                (COALESCE(p.shipping_rate_per_kg, 0) / 1000.0)
            ) / NULLIF(COALESCE(er.rate_to_usd, 1), 0) -- FIXED: Division instead of Multiplication
        ELSE 0 
    END AS cost_per_gram_usd,
    CASE 
        WHEN p.fixed_retail_price_usd IS NOT NULL THEN p.fixed_retail_price_usd
        WHEN p.quantity_purchased > 0 THEN 
            (
                (
                    (p.cost_amount / p.quantity_purchased) + 
                    (COALESCE(p.shipping_rate_per_kg, 0) / 1000.0)
                ) / NULLIF(COALESCE(er.rate_to_usd, 1), 0) -- FIXED: Division instead of Multiplication
            ) * 3.0 -- Fixed 3x Markup logic from requirements
        ELSE 0 
    END AS retail_price_per_gram_usd
FROM products p
LEFT JOIN exchange_rates er ON p.cost_currency = er.currency;

-- 8. Create Sales Processing Function
CREATE OR REPLACE FUNCTION process_sale(items JSONB)
RETURNS VOID AS $$
DECLARE
    item JSONB;
    p_id UUID;
    qty INT;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        p_id := (item->>'product_id')::UUID;
        qty := (item->>'quantity')::INT;
        UPDATE products 
        SET stock_grams = stock_grams - qty
        WHERE id = p_id;
    END LOOP;
    INSERT INTO activity_logs (action, details)
    VALUES ('SALE', 'Processed invoice with ' || jsonb_array_length(items) || ' items');
END;
$$ LANGUAGE plpgsql;

-- 8b. Fulfill Invoice Function
CREATE OR REPLACE FUNCTION fulfill_invoice(invoice_id_input UUID)
RETURNS VOID AS $$
DECLARE
    inv_record RECORD;
    item RECORD;
BEGIN
    SELECT * INTO inv_record FROM invoices WHERE id = invoice_id_input;
    IF inv_record IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
    IF inv_record.inventory_deducted THEN RAISE EXCEPTION 'Inventory already deducted for this invoice'; END IF;
    FOR item IN SELECT * FROM invoice_line_items WHERE invoice_id = invoice_id_input
    LOOP
        UPDATE products 
        SET stock_grams = stock_grams - item.quantity
        WHERE id = item.product_id;
    END LOOP;
    UPDATE invoices 
    SET status = 'Filled', 
        inventory_deducted = TRUE 
    WHERE id = invoice_id_input;
    INSERT INTO activity_logs (action, details)
    VALUES ('FULFILLMENT', 'Order ' || inv_record.invoice_number || ' marked as filled. Inventory deducted.');
END;
$$ LANGUAGE plpgsql;

-- 9. DANGER ZONE: Truncate All Data
CREATE OR REPLACE FUNCTION truncate_all_data()
RETURNS VOID AS $$
BEGIN
    TRUNCATE TABLE invoice_line_items, invoices, products, activity_logs CASCADE;
END;
$$ LANGUAGE plpgsql;

-- 10. MIGRATIONS & POLICIES
DO $$ 
BEGIN
    -- COLUMNS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'shipping_rate_per_kg') THEN
        ALTER TABLE products ADD COLUMN shipping_rate_per_kg NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'chinese_name') THEN
        ALTER TABLE products ADD COLUMN chinese_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_personal') THEN
        ALTER TABLE products ADD COLUMN is_personal BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'can_reorder') THEN
        ALTER TABLE products ADD COLUMN can_reorder BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_public') THEN
        ALTER TABLE products ADD COLUMN is_public BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_featured') THEN
        ALTER TABLE products ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'lore') THEN
        ALTER TABLE products ADD COLUMN lore TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_custom_wisdom') THEN
        ALTER TABLE products ADD COLUMN is_custom_wisdom BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'show_wisdom') THEN
        ALTER TABLE products ADD COLUMN show_wisdom BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'processing_notes') THEN
        ALTER TABLE products ADD COLUMN processing_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'mood') THEN
        ALTER TABLE products ADD COLUMN mood TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'experience') THEN
        ALTER TABLE products ADD COLUMN experience TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'liquor_color') THEN
        ALTER TABLE products ADD COLUMN liquor_color TEXT;
    END IF;

    -- ENABLE RLS
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

    -- PRODUCTS POLICIES
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow public read products') THEN
        CREATE POLICY "Allow public read products" ON products FOR SELECT TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow public insert products') THEN
        CREATE POLICY "Allow public insert products" ON products FOR INSERT TO public WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow public update products') THEN
        CREATE POLICY "Allow public update products" ON products FOR UPDATE TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow public delete products') THEN
        CREATE POLICY "Allow public delete products" ON products FOR DELETE TO public USING (true);
    END IF;

    -- INVOICES POLICIES (NEW)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Allow public all invoices') THEN
        CREATE POLICY "Allow public all invoices" ON invoices FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    -- INVOICE LINE ITEMS POLICIES (NEW)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_line_items' AND policyname = 'Allow public all lines') THEN
        CREATE POLICY "Allow public all lines" ON invoice_line_items FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    -- ACTIVITY LOGS POLICIES (NEW)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Allow public all logs') THEN
        CREATE POLICY "Allow public all logs" ON activity_logs FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    -- EXCHANGE RATES POLICIES (NEW)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_rates' AND policyname = 'Allow public all rates') THEN
        CREATE POLICY "Allow public all rates" ON exchange_rates FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;

    GRANT ALL ON TABLE products TO anon, authenticated, service_role;
    GRANT ALL ON TABLE exchange_rates TO anon, authenticated, service_role;
    GRANT ALL ON TABLE invoices TO anon, authenticated, service_role;
    GRANT ALL ON TABLE invoice_line_items TO anon, authenticated, service_role;
    GRANT ALL ON TABLE activity_logs TO anon, authenticated, service_role;
END $$;

-- Recreate view to ensure new columns are picked up by p.*
DROP VIEW IF EXISTS product_pricing_view;
CREATE OR REPLACE VIEW product_pricing_view WITH (security_invoker = true) AS
SELECT 
    p.*,
    CASE 
        WHEN p.quantity_purchased > 0 THEN 
            (
                (p.cost_amount / p.quantity_purchased) + 
                (COALESCE(p.shipping_rate_per_kg, 0) / 1000.0)
            ) / NULLIF(COALESCE(er.rate_to_usd, 1), 0)
        ELSE 0 
    END AS cost_per_gram_usd,
    CASE 
        WHEN p.fixed_retail_price_usd IS NOT NULL THEN p.fixed_retail_price_usd
        WHEN p.quantity_purchased > 0 THEN 
            (
                (
                    (p.cost_amount / p.quantity_purchased) + 
                    (COALESCE(p.shipping_rate_per_kg, 0) / 1000.0)
                ) / NULLIF(COALESCE(er.rate_to_usd, 1), 0)
            ) * 3.0
        ELSE 0 
    END AS retail_price_per_gram_usd
FROM products p
LEFT JOIN exchange_rates er ON p.cost_currency = er.currency;

NOTIFY pgrst, 'reload config';
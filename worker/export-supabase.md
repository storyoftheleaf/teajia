# Migrating Data from Supabase to D1

## Step 1: Export from Supabase

Go to your Supabase dashboard > SQL Editor and run:

```sql
-- Export products as INSERT statements
SELECT 'INSERT INTO products (id, type, given_name, chinese_name, product_name, year, origin_country, origin_region, description, tasting_notes, image_url, status, vendor, stock_grams, cost_amount, cost_currency, shipping_rate_per_kg, quantity_purchased, low_stock_threshold, markup_multiplier, fixed_retail_price_usd, is_personal, can_reorder, is_public, is_featured, lore, is_custom_wisdom, show_wisdom, processing_notes, mood, experience, liquor_color, created_at) VALUES ('
  || quote(id) || ', '
  || quote(type) || ', '
  || quote(given_name) || ', '
  || quote(chinese_name) || ', '
  || quote(product_name) || ', '
  || COALESCE(year::text, 'NULL') || ', '
  || quote(origin_country) || ', '
  || quote(origin_region) || ', '
  || quote(description) || ', '
  || quote(COALESCE(array_to_json(tasting_notes)::text, '[]')) || ', '
  || quote(image_url) || ', '
  || quote(status) || ', '
  || quote(vendor) || ', '
  || COALESCE(stock_grams::text, '0') || ', '
  || COALESCE(cost_amount::text, '0') || ', '
  || quote(COALESCE(cost_currency, 'USD')) || ', '
  || COALESCE(shipping_rate_per_kg::text, '0') || ', '
  || COALESCE(quantity_purchased::text, '0') || ', '
  || COALESCE(low_stock_threshold::text, '100') || ', '
  || COALESCE(markup_multiplier::text, '2.5') || ', '
  || COALESCE(fixed_retail_price_usd::text, 'NULL') || ', '
  || CASE WHEN is_personal THEN '1' ELSE '0' END || ', '
  || CASE WHEN can_reorder THEN '1' ELSE '0' END || ', '
  || CASE WHEN COALESCE(is_public, true) THEN '1' ELSE '0' END || ', '
  || CASE WHEN is_featured THEN '1' ELSE '0' END || ', '
  || quote(lore) || ', '
  || CASE WHEN is_custom_wisdom THEN '1' ELSE '0' END || ', '
  || CASE WHEN COALESCE(show_wisdom, true) THEN '1' ELSE '0' END || ', '
  || quote(processing_notes) || ', '
  || quote(mood) || ', '
  || quote(experience) || ', '
  || quote(liquor_color) || ', '
  || quote(created_at::text)
  || ');'
FROM products;
```

Copy the output and save it to `worker/seed.sql`.

## Step 2: Apply to D1

```bash
cd worker

# Initialize schema
npm run db:init

# Seed data
npm run db:seed
```

## Step 3: Set Worker Secrets

Use the SHA-256 hash (NOT bcrypt) for the password:

```bash
# Set the password hash (SHA-256 of your password)
wrangler secret put ADMIN_PASSWORD_HASH
# Paste: 3c2480a673afd5453dd1e06c06119f422ff4307b25a41030fe4ca4bff018bd45

wrangler secret put JWT_SECRET
# Paste: tJ9#xK2mPqL8vRw4nYeB6dZsAhCu1Fgj
```

## Step 4: Deploy Worker

```bash
npm run deploy
```

Your API is now live at: https://teajia-api.lightcodes.workers.dev

## Step 5: Update Frontend

Create `.env.local` in the project root:

```
VITE_API_URL=https://teajia-api.lightcodes.workers.dev
```

## Important

- The ADMIN_PASSWORD_HASH must be a **SHA-256 hex** of your password (not bcrypt).
  Workers don't support bcrypt natively. The bcrypt hash you generated earlier
  should NOT be used -- use the SHA-256 one above instead.
- After migration, you can remove the `@supabase/supabase-js` package from package.json.

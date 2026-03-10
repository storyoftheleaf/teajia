# TODO 44: Replace `SELECT *` with Column-Specific Queries

**Priority:** P1 — HIGH
**Impact:** Reduced payload size (30-50% smaller responses), faster D1 reads, less JSON serialization
**Effort:** Medium (half-day)

## Problem

Nearly every query in the worker uses `SELECT *`, fetching all 30+ columns from the products table even when only a subset is needed. This wastes:

1. **D1 read time** — more data transferred from SQLite
2. **Worker CPU** — larger objects to serialize as JSON
3. **Network bandwidth** — larger response payloads to the client
4. **Client memory** — React Query caches the entire bloated object

### Worst offender: `handleGetPublicProducts`

```typescript
// worker/src/index.ts:277-279
const result = await env.DB.prepare(
  "SELECT * FROM products WHERE is_public = 1 AND status = 'Active' ORDER BY created_at DESC"
).all();
```

This fetches **all 30+ columns** including admin-only fields (`cost_amount`, `vendor`, `cost_currency`, `shipping_rate_per_kg`, `quantity_purchased`, etc.) — then strips them in JavaScript:

```typescript
const safe: Record<string, unknown> = {};
for (const key of PUBLIC_FIELDS) {
  if (key in withPricing) safe[key] = withPricing[key];
}
```

The admin fields are fetched, held in memory, processed, and then thrown away. The SQL should only fetch what's needed.

## Solution

### 1. Public products — select only public columns in SQL

```sql
SELECT
  id, type, given_name, chinese_name, product_name, year,
  origin_country, origin_region, stock_grams, description,
  tasting_notes, image_url, additional_images, status,
  is_personal, can_reorder, is_featured, lore, show_wisdom,
  processing_notes, terroir, mood, experience,
  cost_amount, cost_currency, quantity_purchased,
  shipping_rate_per_kg, fixed_retail_price_usd
FROM products
WHERE is_public = 1 AND status = 'Active'
ORDER BY created_at DESC
```

Note: `cost_amount`, `cost_currency`, `quantity_purchased`, and `shipping_rate_per_kg` are still needed for the `addPricingFields()` calculation — but they get stripped from the response by the `PUBLIC_FIELDS` whitelist afterward. Ideally, move the pricing calculation into SQL (a computed column or a subquery) so even these aren't fetched.

### 2. Admin products — keep `SELECT *` (admins need everything)

No change needed here. Admin users see all fields.

### 3. Customer list aggregation

The `handleGetCustomers` query already selects `c.*` but could be tightened:

```sql
SELECT c.id, c.name, c.company, c.email, c.phone, c.whatsapp,
       c.city, c.country, c.preferred_currency, c.tags, c.source, c.created_at,
       COUNT(i.id) as order_count,
       ...
```

### 4. Event attendee lists

`handleGetAttendees` joins with customers but only needs a few customer fields:

```sql
SELECT ea.id, ea.full_name, ea.phone_number, ea.email, ea.plus_one, ea.plus_one_name,
       ea.access_tier, ea.status, ea.magic_token, ea.photo_consent, ea.notes,
       ea.tea_preference, ea.bringing_tea, ea.waitlist_position, ea.attended, ea.created_at,
       c.name as customer_name_linked, c.tags as customer_tags
FROM event_attendees ea
LEFT JOIN customers c ON c.id = ea.customer_id
WHERE ea.event_id = ?
```

### 5. Pricing calculation in SQL (stretch goal)

Move `addPricingFields()` logic into the SQL query itself to avoid fetching cost columns for public products entirely:

```sql
SELECT ...,
  CASE
    WHEN quantity_purchased > 0 THEN
      ((cost_amount / quantity_purchased) + COALESCE(shipping_rate_per_kg, 0) / 1000.0)
      / COALESCE((SELECT rate_to_usd FROM exchange_rates WHERE currency = p.cost_currency), 1)
    ELSE 0
  END * 3.0 AS retail_price_per_gram_usd
FROM products p
WHERE is_public = 1 AND status = 'Active'
```

This eliminates the need to fetch exchange rates as a separate query AND removes the JS-side pricing calculation. Two birds, one stone.

## Notes

- Coordinate with TODO 43 (batch queries) — if pricing moves into SQL, the rates query is no longer needed for public products
- The `addPricingFields()` function should still exist for admin endpoints where the full calculation is displayed
- Test that all fields the frontend expects are still present after the change
- The `PUBLIC_FIELDS` whitelist in the worker acts as a safety net, but defense-in-depth means not fetching sensitive data in the first place

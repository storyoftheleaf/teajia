# TODO 43: Batch Sequential D1 Queries into Parallel Operations

**Priority:** P1 — HIGH
**Impact:** 30-50% latency reduction on multi-query endpoints (saves one D1 round-trip per batch)
**Effort:** Low (2-3 hours)

## Problem

Several handlers make 2+ sequential `await env.DB.prepare(...).all()` calls where the queries are **independent** — the second doesn't depend on the first's result. Each D1 query is a network round-trip. Sequential calls add up.

D1 provides `env.DB.batch()` which sends multiple queries in a **single round-trip**. This is free performance.

## Affected Handlers

### 1. `handleGetProducts` (admin product list) — 2 sequential queries

```typescript
// Current: two round-trips
const ratesResult = await env.DB.prepare('SELECT ...').all();   // ← round-trip 1
const result = await env.DB.prepare('SELECT * FROM products...').all();  // ← round-trip 2
```

**Fix:** Batch both queries:
```typescript
const [ratesResult, productsResult] = await env.DB.batch([
  env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates'),
  env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC"),
]);
```

### 2. `handleGetPublicProducts` (public product list) — 2 sequential queries

Same pattern as above. This is the **most-hit endpoint** — every visitor triggers it.

```typescript
const [ratesResult, productsResult] = await env.DB.batch([
  env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates'),
  env.DB.prepare("SELECT * FROM products WHERE is_public = 1 AND status = 'Active' ORDER BY created_at DESC"),
]);
```

### 3. `handleGetEventBySlug` (public event page) — 2 sequential queries

```typescript
// Current: event fetch, then count fetch
const event = await env.DB.prepare('SELECT ... WHERE slug = ?').bind(slug).first();
// Can't fully batch because count query needs event.id
// But we CAN restructure with a JOIN or subquery (see below)
```

**Fix:** Use a single query with a subquery:
```sql
SELECT e.*,
  COALESCE((SELECT SUM(1 + plus_one) FROM event_attendees
            WHERE event_id = e.id AND status = 'confirmed'), 0) as confirmed_count
FROM events e
WHERE e.slug = ? AND e.status = 'active'
```

### 4. `handleGetRSVP` (RSVP page) — 2 sequential queries

```typescript
// Current:
const attendee = await env.DB.prepare('SELECT ... WHERE magic_token = ?').first();  // round-trip 1
const menu = await env.DB.prepare('SELECT ... WHERE event_id = ?').all();           // round-trip 2
```

**Fix:** After the first query returns `event_id`, batch isn't possible (dependency). But we can use a single JOIN query or restructure to eliminate the second call by embedding menu in the first.

### 5. `handleDeleteInvoice` — 2 sequential deletes

```typescript
await env.DB.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').bind(id).run();
await env.DB.prepare('DELETE FROM invoices WHERE id = ?').bind(id).run();
```

**Fix:**
```typescript
await env.DB.batch([
  env.DB.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').bind(id),
  env.DB.prepare('DELETE FROM invoices WHERE id = ?').bind(id),
]);
```

### 6. `handleDeleteCustomer` — 2 sequential operations

```typescript
await env.DB.prepare('UPDATE invoices SET customer_id = NULL WHERE customer_id = ?').bind(id).run();
await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
```

**Fix:**
```typescript
await env.DB.batch([
  env.DB.prepare('UPDATE invoices SET customer_id = NULL WHERE customer_id = ?').bind(id),
  env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id),
]);
```

### 7. `handleTruncateAll` — 4 sequential deletes

```typescript
await env.DB.prepare('DELETE FROM invoice_line_items').run();
await env.DB.prepare('DELETE FROM invoices').run();
await env.DB.prepare('DELETE FROM products').run();
await env.DB.prepare('DELETE FROM activity_logs').run();
```

**Fix:**
```typescript
await env.DB.batch([
  env.DB.prepare('DELETE FROM invoice_line_items'),
  env.DB.prepare('DELETE FROM invoices'),
  env.DB.prepare('DELETE FROM products'),
  env.DB.prepare('DELETE FROM activity_logs'),
]);
```

## Priority Order

1. `handleGetPublicProducts` — highest traffic, easiest win
2. `handleGetProducts` — admin workhorse
3. `handleGetEventBySlug` — public-facing, latency-sensitive
4. `handleDeleteInvoice` / `handleDeleteCustomer` / `handleTruncateAll` — lower traffic but easy

## Notes

- `env.DB.batch()` executes all statements in a **single round-trip** and wraps them in an implicit transaction
- The return value is an array of results in the same order as the input statements
- For dependent queries (where query B needs query A's result), batching isn't possible — those stay sequential
- This change is purely a performance optimization; no functional behavior changes

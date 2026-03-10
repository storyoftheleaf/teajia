# TODO 45: Convert Loop-Based DB Operations to `env.DB.batch()`

**Priority:** P1 — HIGH
**Impact:** N round-trips → 1 round-trip for bulk operations (invoice creation, fulfillment, bulk import)
**Effort:** Low (1-2 hours)

## Problem

Several handlers execute database queries **inside a `for` loop**, creating N sequential round-trips to D1. Each round-trip has ~5-20ms of latency overhead. For an invoice with 5 line items, that's 5 unnecessary sequential round-trips that could be 1.

D1's `env.DB.batch()` sends all statements in a **single round-trip** and executes them in an implicit transaction.

## Affected Handlers

### 1. `handleCreateInvoice` — N+1 round-trips for N line items

```typescript
// worker/src/index.ts:419-424
for (const item of body.lineItems) {
  const itemId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO invoice_line_items (id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?)'
  ).bind(itemId, id, item.product_id, item.quantity, item.price_at_sale).run();
}
```

**Fix:**
```typescript
const invoiceStmt = env.DB.prepare(
  `INSERT INTO invoices (id, invoice_number, ...) VALUES (?, ?, ...)`
).bind(id, ...);

const lineItemStmts = body.lineItems.map(item =>
  env.DB.prepare(
    'INSERT INTO invoice_line_items (id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), id, item.product_id, item.quantity, item.price_at_sale)
);

await env.DB.batch([invoiceStmt, ...lineItemStmts]);
```

### 2. `handleFulfillInvoice` — N+2 round-trips for N line items

```typescript
// worker/src/index.ts:476-478
for (const item of items.results) {
  await env.DB.prepare('UPDATE products SET stock_grams = stock_grams - ? WHERE id = ?')
    .bind(item.quantity, item.product_id).run();
}
```

**Fix:**
```typescript
const stockUpdates = items.results.map(item =>
  env.DB.prepare('UPDATE products SET stock_grams = stock_grams - ? WHERE id = ?')
    .bind(item.quantity, item.product_id)
);

await env.DB.batch([
  ...stockUpdates,
  env.DB.prepare("UPDATE invoices SET status = 'Filled', inventory_deducted = 1 WHERE id = ?").bind(invoice_id),
  env.DB.prepare("INSERT INTO activity_logs (id, action, details) VALUES (?, 'FULFILLMENT', ?)").bind(crypto.randomUUID(), `Order ${invoice.invoice_number} marked as filled. Inventory deducted.`),
]);
```

### 3. `handleBulkCreateProducts` — N round-trips for N products

```typescript
// worker/src/index.ts:346-348
for (const raw of products) {
  // ... prepare body ...
  await env.DB.prepare(`INSERT INTO products (id, ${cols.join(', ')}) VALUES (?, ${placeholders})`)
    .bind(id, ...cols.map(c => body[c] ?? null)).run();
  inserted++;
}
```

**Fix:**
```typescript
const stmts = products.map(raw => {
  // ... prepare body ...
  const id = crypto.randomUUID();
  const cols = Object.keys(body);
  const placeholders = cols.map(() => '?').join(', ');
  return env.DB.prepare(`INSERT INTO products (id, ${cols.join(', ')}) VALUES (?, ${placeholders})`)
    .bind(id, ...cols.map(c => body[c] ?? null));
});

await env.DB.batch(stmts);
```

### 4. `handleBackfillCustomerLinks` — N round-trips for N matches

```typescript
// worker/src/index.ts:708-709
if (match) {
  await env.DB.prepare('UPDATE invoices SET customer_id = ? WHERE id = ?')
    .bind(match.id, inv.id).run();
  linked++;
}
```

**Fix:** Collect all updates, then batch:
```typescript
const updates = [];
for (const inv of unlinked.results) {
  // ... find match ...
  if (match) {
    updates.push(
      env.DB.prepare('UPDATE invoices SET customer_id = ? WHERE id = ?')
        .bind(match.id, inv.id)
    );
  }
}
if (updates.length > 0) await env.DB.batch(updates);
```

## Impact Estimate

| Handler | Current Round-Trips | After Batch | Savings |
|---|---|---|---|
| Create invoice (5 items) | 6 | 1 | ~50-100ms |
| Fulfill invoice (5 items) | 8 | 2 | ~60-120ms |
| Bulk create (20 products) | 20 | 1 | ~200-400ms |
| Backfill (50 invoices) | up to 50 | 1 | ~500ms+ |

## Notes

- `env.DB.batch()` has a limit of 100 statements per call. For bulk imports > 100 products, chunk into batches of 100.
- Batch operations are atomic (implicit transaction) — if one fails, all roll back. This is actually **better** than the current loop behavior where a failure leaves partial data.
- The `handleSubmitTastingNotes` and `handleBatchAttendance` handlers already correctly use `env.DB.batch()` — follow their pattern.

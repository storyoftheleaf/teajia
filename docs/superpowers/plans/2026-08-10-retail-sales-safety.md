# Retail Sales Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public retail inquiries store-bound, private, reliably visible to operators, currency-correct, and unable to create corrupt invoice or inventory data.

**Architecture:** Add small pure domain modules for cart/store invariants, tracking-token hashing, order-money presentation, and invoice input validation. Keep the existing inquiry-led WhatsApp flow, but persist an idempotent inquiry before opening an external channel and use a private capability token for public status. Route all protected inquiry requests through the authenticated API client and call invoice validation before constructing any D1 write statements.

**Tech Stack:** React 19, TypeScript, Zustand, React Query, Vite 6, Cloudflare Workers, D1/SQLite, Vitest, Playwright.

---

## File map

### New files

- `src/lib/publicCartDomain.ts` — store resolution, single-store cart checks, reference and tracking-token generation.
- `src/lib/publicCartDomain.test.ts` — pure cart/store and token tests.
- `src/lib/orderMoney.ts` — convert USD base values into a labeled display currency using the current validated rate table.
- `src/lib/orderMoney.test.ts` — conversion, fallback, and formatting tests.
- `src/lib/api.inquiries.test.ts` — public and authenticated inquiry client contracts.
- `worker/migrations/127_secure_inquiry_tracking.sql` — hashed private tracking tokens and supporting indexes.
- `worker/src/inquiryDomain.ts` — token hashing, inquiry input normalization, public redaction, and idempotency helpers.
- `worker/tests/inquiry-security.test.ts` — store binding, token privacy, idempotency, and account isolation.
- `worker/tests/invoice-write-validation.test.ts` — invalid quantity, price, product, customer, status, and currency cases.
- `tests/public-cart-store-safety.spec.ts` — selected-store routing, mixed-store prevention, persistence failure, and tracking-link behavior.

### Modified files

- `src/types.ts` — require `storeSlug` and `storeName` on public cart items; extend customer-order response money fields.
- `src/lib/store.ts` — enforce one store per public cart and discard unscoped legacy persisted cart rows during v3 migration.
- `src/App.tsx` — resolve the checkout store from hosted route, `/store/:slug`, or `/shop` selection; fetch its contact details and attach it to cart lines.
- `src/components/shared/PublicCart.tsx` — send store/currency/token, persist before channel handoff, surface failures, and show the private tracking link.
- `src/lib/api.ts` — typed inquiry contracts, private-token lookup, authenticated list/update, and explicit errors.
- `src/pages/OrderStatusPage.tsx` — private tracking-code behavior and redacted customer presentation.
- `src/admin/components/ActivityView.tsx` — authenticated query error and retry states; mutation error feedback.
- `src/pages/OrderHistoryPage.tsx` — format the server-provided display amount.
- `src/pages/OrderDetailPage.tsx` — format display-currency line and total values.
- `worker/src/invoiceDomain.ts` — pure retail invoice-create and line-item validation.
- `worker/src/index.ts` — secure inquiry routes, sell-scoped status mutation, display-money response fields, and invoice validation calls.
- `worker/schema.sql` — mirror the tracking-token additions when the concurrent migration 126 work has been integrated.
- `worker/tests/customer-order-detail.test.ts` — assert display-currency amounts and rate metadata.
- `docs/STATE_OF_THE_SITE.md` and `docs/CHANGELOG.md` — record only the behavior proven by the completed release.

The concurrent Tea Master sales-spine branch owns migration 126, `teaMasterSales.ts`, grants, settlements, and Quick Invoice/Orders attribution. This plan does not modify those new files or duplicate their domain.

---

### Task 1: Store-bound public cart domain

**Files:**
- Create: `src/lib/publicCartDomain.ts`
- Create: `src/lib/publicCartDomain.test.ts`
- Modify: `src/types.ts`
- Modify: `src/lib/store.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing store-resolution and cart-invariant tests**

Create `src/lib/publicCartDomain.test.ts` with these behaviors:

```ts
import { describe, expect, it } from 'vitest';
import {
  canAddToStoreCart,
  resolveCheckoutStoreSlug,
  validateStoreCart,
} from './publicCartDomain';

const bali = { id: 'tea-1', name: 'Tea', variant: '', category: 'tea' as const, quantityGrams: 25, pricePerGram: 1, totalPrice: 25, storeSlug: 'teajia-bali', storeName: 'Teajia Bali' };
const australia = { ...bali, id: 'tea-2', storeSlug: 'teajia-australia', storeName: 'Teajia Australia' };

describe('public cart store boundary', () => {
  it('resolves hosted, path, selected, and default stores in priority order', () => {
    expect(resolveCheckoutStoreSlug({ hostedSlug: 'host', storefrontSlug: 'path', selectedSlug: 'selected' })).toBe('host');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: 'path', selectedSlug: 'selected' })).toBe('path');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: null, selectedSlug: 'selected' })).toBe('selected');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: null, selectedSlug: null })).toBe('teajia-bali');
  });

  it('allows an empty or same-store cart and rejects a different store', () => {
    expect(canAddToStoreCart([], bali)).toEqual({ allowed: true });
    expect(canAddToStoreCart([bali], { ...bali, id: 'tea-3' })).toEqual({ allowed: true });
    expect(canAddToStoreCart([bali], australia)).toMatchObject({ allowed: false, existingStoreSlug: 'teajia-bali', incomingStoreSlug: 'teajia-australia' });
  });

  it('rejects mixed or unscoped carts before checkout', () => {
    expect(validateStoreCart([bali])).toEqual({ ok: true, storeSlug: 'teajia-bali' });
    expect(validateStoreCart([bali, australia])).toMatchObject({ ok: false, reason: 'mixed_store' });
    expect(validateStoreCart([{ ...bali, storeSlug: '' }])).toMatchObject({ ok: false, reason: 'missing_store' });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/lib/publicCartDomain.test.ts`

Expected: FAIL because `publicCartDomain.ts` and the store fields do not exist.

- [ ] **Step 3: Implement the pure cart domain**

Create typed functions with no React or Zustand dependency:

```ts
import type { CartItem } from '../types';

export const DEFAULT_STORE_SLUG = 'teajia-bali';

export function resolveCheckoutStoreSlug(input: { hostedSlug: string | null; storefrontSlug: string | null; selectedSlug: string | null }): string {
  return input.hostedSlug || input.storefrontSlug || input.selectedSlug || DEFAULT_STORE_SLUG;
}

export function canAddToStoreCart(cart: CartItem[], item: CartItem) {
  const existing = cart[0];
  if (!existing || existing.storeSlug === item.storeSlug) return { allowed: true as const };
  return { allowed: false as const, existingStoreSlug: existing.storeSlug, incomingStoreSlug: item.storeSlug };
}

export function validateStoreCart(cart: CartItem[]) {
  if (cart.length === 0) return { ok: false as const, reason: 'empty' as const };
  if (cart.some(item => !item.storeSlug)) return { ok: false as const, reason: 'missing_store' as const };
  const stores = new Set(cart.map(item => item.storeSlug));
  if (stores.size !== 1) return { ok: false as const, reason: 'mixed_store' as const };
  return { ok: true as const, storeSlug: cart[0].storeSlug };
}
```

Add required `storeSlug` and `storeName` fields to `CartItem`.

- [ ] **Step 4: Enforce the invariant in Zustand and migrate persisted data**

In `addToPublicCart`, call `canAddToStoreCart`. A conflict returns the unchanged state. Increment the persisted store version to 3. For `version < 3`, retain only cart items with a nonempty string `storeSlug`; this intentionally clears ambiguous legacy items rather than silently assigning them to Bali.

```ts
if (version < 3) {
  const prev = persistedState as { publicCart?: Array<Partial<PublicCartItem>> };
  prev.publicCart = Array.isArray(prev.publicCart)
    ? prev.publicCart.filter((item): item is PublicCartItem => typeof item.storeSlug === 'string' && item.storeSlug.length > 0)
    : [];
}
```

- [ ] **Step 5: Bind App cart additions and contacts to the resolved store**

Read `shopStoreSlug` from Zustand and calculate:

```ts
const checkoutStoreSlug = resolveCheckoutStoreSlug({
  hostedSlug: hostStoreSlug,
  storefrontSlug,
  selectedSlug: shopStoreSlug,
});
```

Fetch the public store for `checkoutStoreSlug`, including `/shop`, and attach `storeSlug`/`storeName` in `handleAddToCart`. Before adding, call `canAddToStoreCart`; on conflict, leave the existing cart untouched, open it, and show a message explaining that one order can contain one store only.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
npx vitest run src/lib/publicCartDomain.test.ts src/lib/storefrontApi.test.ts
npm run lint
```

Expected: cart tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the store-bound cart**

```bash
git add src/lib/publicCartDomain.ts src/lib/publicCartDomain.test.ts src/types.ts src/lib/store.ts src/App.tsx
git commit -m "fix: bind public carts to one store"
```

---

### Task 2: Private, idempotent inquiry tracking

**Files:**
- Create: `worker/migrations/127_secure_inquiry_tracking.sql`
- Create: `worker/src/inquiryDomain.ts`
- Create: `worker/tests/inquiry-security.test.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/publicCartDomain.ts`
- Modify: `src/lib/publicCartDomain.test.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/components/shared/PublicCart.tsx`
- Modify: `src/pages/OrderStatusPage.tsx`

- [ ] **Step 1: Write failing token and inquiry route tests**

Add pure tests proving generated tracking tokens contain at least 192 bits of randomness, human references rotate per checkout, and mixed/missing store payloads fail.

Create `worker/tests/inquiry-security.test.ts` using the existing Worker fake-D1 pattern. Cover:

```ts
expect((await createInquiry({ store_slug: undefined })).status).toBe(400);
expect((await createInquiry({ store_slug: 'missing-store' })).status).toBe(404);

const first = await createInquiry(validPayload);
expect(first.status).toBe(201);
const created = await first.json();
expect(created).toMatchObject({ ref_number: validPayload.ref_number, success: true });
expect(created.tracking_token).toBe(validPayload.tracking_token);

const repeat = await createInquiry(validPayload);
expect(repeat.status).toBe(200);
expect(await repeat.json()).toMatchObject({ id: created.id, tracking_token: validPayload.tracking_token, idempotent: true });

expect(db.inquiries).toHaveLength(1);
expect(db.inquiries[0].tracking_token_hash).not.toContain(validPayload.tracking_token);

const publicLookup = await lookup(created.tracking_token);
expect(await publicLookup.json()).toEqual(expect.objectContaining({
  ref_number: validPayload.ref_number,
  items_json: validPayload.items_json,
  currency: 'AUD',
}));
expect(await lookup(validPayload.ref_number)).toHaveProperty('status', 404);
expect(JSON.stringify(await publicLookup.clone().json())).not.toContain('customer@example.com');
```

Also prove two accounts may have the same human reference but only the token selects the row.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npx vitest run src/lib/publicCartDomain.test.ts worker/tests/inquiry-security.test.ts
```

Expected: FAIL because tracking-token helpers, schema columns, and secure lookup do not exist.

- [ ] **Step 3: Add the additive inquiry migration**

Create `worker/migrations/127_secure_inquiry_tracking.sql`:

```sql
ALTER TABLE inquiries ADD COLUMN tracking_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiries_tracking_token_hash
  ON inquiries(tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_account_ref
  ON inquiries(account_id, ref_number, created_at DESC);
```

Mirror `tracking_token_hash` and indexes in `worker/schema.sql` after incorporating the concurrent migration-126 schema changes. Do not add plaintext tracking tokens.

- [ ] **Step 4: Implement the inquiry domain**

Create `worker/src/inquiryDomain.ts` with:

```ts
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateTrackingToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export function redactPublicInquiry(row: Record<string, unknown>) {
  return {
    ref_number: row.ref_number,
    items_json: row.items,
    status: row.status,
    total_estimate_usd: row.total_usd,
    currency: row.currency,
    created_at: row.created_at,
  };
}
```

The module must also normalize cart inquiry inputs and reject missing `store_slug`, invalid totals, malformed items JSON, empty item arrays, and items whose `storeSlug` differs from the request store.

- [ ] **Step 5: Replace public inquiry creation and lookup semantics**

For non-consult inquiries:

1. Require a valid store slug and resolve its account.
2. Require a valid tracking token and hash it.
3. Validate every item belongs to that store slug.
4. Check for an existing row by token hash. If found in the same account, return it with HTTP 200 and `idempotent: true`.
5. Insert the hash, store currency explicitly, and return the plaintext token only because the caller supplied it.
6. On a unique-token race, reload by hash and return the existing row.

Change the public GET handler to hash `params.token`, select by `tracking_token_hash`, and return only `redactPublicInquiry(row)`. A human `ref_number` must no longer resolve publicly.

- [ ] **Step 6: Generate private client tracking identity**

Extend `publicCartDomain.ts`:

```ts
function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createTrackingToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function createHumanOrderRef(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `TJ-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
```

Do not store a reusable order reference in local storage.

- [ ] **Step 7: Persist before opening the contact channel**

Update `PublicCart` to accept `storeSlug` and `storeName`. Generate one reference/token pair per mounted checkout and reuse it for retries, making repeated channel clicks idempotent.

The channel handler must:

1. Validate the cart store.
2. Set a saving state.
3. Call `api.inquiries.create` with `store_slug`, `currency`, `tracking_token`, and the existing fields.
4. If persistence fails, display a retryable error and do not open WhatsApp/email or claim success.
5. If persistence succeeds, build/open the selected channel and show `/order/:trackingToken` as the private tracking link.

Copying text follows the same persistence-first rule. The message contains the human `ref_number`, never the private token.

- [ ] **Step 8: Make the tracking page private and redacted**

Rename the API client method to `getByTrackingToken`. Update `OrderStatusPage` to treat the URL segment as a private tracking code, display the returned human reference, remove name/contact/location fields, and label the manual form “Private tracking code.”

- [ ] **Step 9: Run focused tests and commit**

Run:

```bash
npx vitest run src/lib/publicCartDomain.test.ts worker/tests/inquiry-security.test.ts
npm run lint
npm run lint:colors
```

Expected: all focused tests, typecheck, and color rules pass.

Commit:

```bash
git add worker/migrations/127_secure_inquiry_tracking.sql worker/schema.sql worker/src/inquiryDomain.ts worker/src/index.ts worker/tests/inquiry-security.test.ts src/lib/publicCartDomain.ts src/lib/publicCartDomain.test.ts src/lib/api.ts src/components/shared/PublicCart.tsx src/pages/OrderStatusPage.tsx
git commit -m "fix: secure public inquiry tracking"
```

---

### Task 3: Authenticated operator inquiry inbox

**Files:**
- Create: `src/lib/api.inquiries.test.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/admin/components/ActivityView.tsx`
- Modify: `worker/src/index.ts`
- Modify: `worker/tests/inquiry-security.test.ts`

- [ ] **Step 1: Write failing API-client tests**

Create `src/lib/api.inquiries.test.ts`. Stub a valid JWT in storage and prove list/update requests contain `Authorization` and `X-Teajia-Account`. Prove HTTP failures reject with `ApiError` instead of resolving to an empty list or null.

```ts
await expect(api.inquiries.list()).rejects.toMatchObject({ status: 403 });
await expect(api.inquiries.updateStatus('inq-1', 'seen')).rejects.toMatchObject({ status: 500 });
expect(fetch).toHaveBeenCalledWith(
  expect.stringContaining('/api/admin/inquiries'),
  expect.objectContaining({ headers: expect.objectContaining({ authorization: expect.stringMatching(/^Bearer /) }) }),
);
```

Extend Worker tests to prove a Sell-capable account member can list/update only their account's inquiry, another account returns 403/404, and an unauthenticated request returns 401.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npx vitest run src/lib/api.inquiries.test.ts worker/tests/inquiry-security.test.ts
```

Expected: FAIL because inquiry list/update use unauthenticated `fetchWithTimeout`, swallow errors, and status mutation requires Gather.

- [ ] **Step 3: Move protected clients to `authedFetch`**

Implement:

```ts
list: async (status?: string): Promise<{ inquiries: InquiryRecord[] }> => {
  const url = new URL(`${API_URL}/api/admin/inquiries`);
  if (status) url.searchParams.set('status', status);
  return authedFetch(url.toString());
},

updateStatus: async (id: string, status: InquiryStatus) =>
  authedFetch(`${API_URL}/api/admin/inquiries/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
```

Define explicit `InquiryRecord` and `InquiryStatus` types. Do not convert an error response to an empty success state.

- [ ] **Step 4: Align Worker authorization with sales work**

Require the `sell` bundle for both inquiry list and status mutation. Account members without Sell receive 403, including viewers and staff whose other bundles do not include Sell.

- [ ] **Step 5: Add visible query and mutation errors**

In `InquiriesView`, use `isError`, `error`, and `refetch`. Render a quiet alert with “Could not load inquiries” and a “Try again” button. Do not render “No inquiries” while the query is errored. Disable the status selector during mutation and show a mutation alert if saving fails.

The new-count query may omit the badge on error, but it must not poison the inbox query cache.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
npx vitest run src/lib/api.inquiries.test.ts worker/tests/inquiry-security.test.ts
npm run lint
npm run lint:colors
```

Commit:

```bash
git add src/lib/api.inquiries.test.ts src/lib/api.ts src/admin/components/ActivityView.tsx worker/src/index.ts worker/tests/inquiry-security.test.ts
git commit -m "fix: authenticate the sales inquiry inbox"
```

---

### Task 4: Currency-correct customer orders and validated invoice writes

**Files:**
- Create: `src/lib/orderMoney.ts`
- Create: `src/lib/orderMoney.test.ts`
- Create: `worker/tests/invoice-write-validation.test.ts`
- Modify: `src/types.ts`
- Modify: `src/pages/OrderHistoryPage.tsx`
- Modify: `src/pages/OrderDetailPage.tsx`
- Modify: `worker/src/invoiceDomain.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/tests/invoice-domain.test.ts`
- Modify: `worker/tests/customer-order-detail.test.ts`

- [ ] **Step 1: Write failing money-domain tests**

Create `src/lib/orderMoney.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { convertOrderAmount, formatOrderAmount } from './orderMoney';

const rates = [{ currency: 'USD', rateToUSD: 1 }, { currency: 'AUD', rateToUSD: 1.52 }, { currency: 'IDR', rateToUSD: 16210 }];

describe('order money presentation', () => {
  it('converts USD base amounts before applying a currency label', () => {
    expect(convertOrderAmount(16, 'AUD', rates)).toEqual({ amount: 24.32, currency: 'AUD', rate: 1.52, converted: true });
    expect(convertOrderAmount(16, 'IDR', rates)).toEqual({ amount: 259360, currency: 'IDR', rate: 16210, converted: true });
  });

  it('keeps USD unchanged and fails closed to an explicit USD label when a rate is missing', () => {
    expect(convertOrderAmount(16, 'USD', rates)).toMatchObject({ amount: 16, currency: 'USD' });
    expect(convertOrderAmount(16, 'JPY', rates)).toEqual({ amount: 16, currency: 'USD', rate: 1, converted: false });
  });

  it('formats the converted amount, not the raw USD number', () => {
    expect(formatOrderAmount(16, 'AUD', rates)).toContain('24.32');
  });
});
```

- [ ] **Step 2: Write failing invoice validation tests**

Extend `worker/tests/invoice-domain.test.ts` for a pure `validateRetailInvoiceInput` function. Create route tests proving invoice creation and pending-item editing reject:

- quantity `-1`, `0`, `NaN`, or `Infinity`;
- price `-1`, `NaN`, or `Infinity`;
- negative/non-finite shipping;
- missing line items;
- a line with neither an account-owned product nor a nonempty custom name;
- a product belonging to another account;
- a customer belonging to another account;
- unsupported create status or payment status;
- malformed display currency.

Prove rejected requests write no invoice, line, sequence, activity, reservation, or stock data.

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npx vitest run src/lib/orderMoney.test.ts worker/tests/invoice-domain.test.ts worker/tests/invoice-write-validation.test.ts worker/tests/customer-order-detail.test.ts
```

Expected: FAIL because money conversion and retail invoice validation are absent.

- [ ] **Step 4: Implement order-money presentation**

Create `orderMoney.ts` around the existing `ExchangeRate` contract. Accept only finite nonnegative USD values and finite positive rates. Missing/invalid non-USD rates must return a USD-labeled amount rather than applying the requested currency symbol to an unconverted number.

Use `useRates()` in order history/detail. Replace the local formatters with `formatOrderAmount`. Detail line amounts, subtotal, shipping, total, and accessible labels all use the same helper.

This is a correctness bridge using the current rate table. The later payment-ledger phase snapshots the sale-time FX rate and replaces the current-rate projection for newly issued invoices.

- [ ] **Step 5: Implement the invoice validation domain**

Add these exports to `invoiceDomain.ts`:

```ts
export interface RetailInvoiceLineInput {
  product_id?: string | null;
  custom_name?: string | null;
  quantity: number;
  price_at_sale: number;
}

export interface RetailInvoiceInput {
  customer_name: string;
  customer_id?: string | null;
  customer_whatsapp?: string | null;
  display_currency?: string | null;
  shipping_cost_usd?: number | null;
  status?: string | null;
  payment_status?: string | null;
}

export function validateRetailInvoiceInput(invoice: RetailInvoiceInput, lines: RetailInvoiceLineInput[]) {
  if (!invoice || typeof invoice.customer_name !== 'string' || !invoice.customer_name.trim()) throw new RangeError('customer_name is required');
  if (!Array.isArray(lines) || lines.length === 0) throw new RangeError('At least one line item is required');
  requireNonNegative('shipping_cost_usd', Number(invoice.shipping_cost_usd ?? 0));
  if (!/^[A-Z]{3}$/.test(invoice.display_currency || 'USD')) throw new RangeError('display_currency must be a 3-letter currency code');
  if (!['Draft', 'Pending'].includes(invoice.status || 'Pending')) throw new RangeError('status must be Draft or Pending');
  if ((invoice.payment_status || 'unpaid') !== 'unpaid') throw new RangeError('New invoices must start unpaid');
  for (const line of lines) {
    requireFinite('quantity', line.quantity);
    if (line.quantity <= 0) throw new RangeError('quantity must be greater than 0');
    requireNonNegative('price_at_sale', line.price_at_sale);
    if (!line.product_id && !line.custom_name?.trim()) throw new RangeError('Each line requires a product or custom name');
  }
  return {
    ...invoice,
    customer_name: invoice.customer_name.trim(),
    display_currency: invoice.display_currency || 'USD',
    shipping_cost_usd: Number(invoice.shipping_cost_usd ?? 0),
    status: invoice.status || 'Pending',
    payment_status: 'unpaid' as const,
    lineItems: lines.map(line => ({ ...line, custom_name: line.custom_name?.trim() || null })),
  };
}
```

- [ ] **Step 6: Validate ownership before building writes**

In create and pending-item replacement:

1. Parse and validate the entire request before incrementing invoice sequence or building statements.
2. Fetch all distinct non-null product IDs with `account_id = ?`; reject if any are missing.
3. If `customer_id` exists, fetch it with the same account and reject if missing.
4. Use only the normalized result to bind D1 statements.
5. Return a structured 400 error for invalid input and 404 for cross-account/missing product or customer.

Remove nonexistent columns from generic invoice update allowlists. Validate allowed lifecycle/payment values until the later explicit-command phase replaces generic PATCH completely. A direct patch cannot set `Filled`, `Void`, `paid`, or `partial`; those require their dedicated operations.

- [ ] **Step 7: Return and render converted customer amounts**

Keep the Worker response's `_usd` fields explicit. The UI converts them with the public rate table. Do not add a `display_currency_rate` field in this phase because the current database does not contain a sale-time rate snapshot.

- [ ] **Step 8: Run focused tests and commit**

Run:

```bash
npx vitest run src/lib/orderMoney.test.ts worker/tests/invoice-domain.test.ts worker/tests/invoice-write-validation.test.ts worker/tests/customer-order-detail.test.ts
npm run lint
npm run lint:colors
```

Commit:

```bash
git add src/lib/orderMoney.ts src/lib/orderMoney.test.ts src/types.ts src/pages/OrderHistoryPage.tsx src/pages/OrderDetailPage.tsx worker/src/invoiceDomain.ts worker/src/index.ts worker/tests/invoice-domain.test.ts worker/tests/invoice-write-validation.test.ts worker/tests/customer-order-detail.test.ts
git commit -m "fix: validate retail invoices and order money"
```

---

### Task 5: Browser coverage, integration review, and product truth

**Files:**
- Create: `tests/public-cart-store-safety.spec.ts`
- Modify: `tests/order-detail.spec.ts`
- Modify: `docs/STATE_OF_THE_SITE.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Write failing browser tests**

Use Playwright route interception to prove:

1. Selecting Australia under `/shop` sends `store_slug: teajia-australia`, `currency`, and Australia-only cart lines.
2. Adding a Bali item and then attempting an Australia item leaves the Bali cart unchanged and explains the one-store rule.
3. A failed inquiry POST does not open WhatsApp/email and presents retry.
4. Retrying the same checkout sends the same tracking token and does not create a second inquiry.
5. Success opens the selected channel and shows a private `/order/:token` link.
6. A tracking page response never renders customer email, phone, or location.
7. An AUD order with USD total 16 and rate 1.52 displays AUD 24.32 in history and detail.

- [ ] **Step 2: Run browser tests and verify RED**

Start the test server in the isolated worktree with `npm run dev:test`, then run:

```bash
npx playwright test tests/public-cart-store-safety.spec.ts tests/order-detail.spec.ts --project='Mobile Chrome' --reporter=list
```

Expected: new tests fail on the pre-fix checkout and currency behavior.

- [ ] **Step 3: Make only integration-level fixes required by the tests**

Fix wiring, labels, accessible error states, and mobile clearance exposed by the browser tests. Do not add inquiry conversion, payment ledger, Tea Master settlement, dashboard redesign, or wholesale work in this phase.

- [ ] **Step 4: Review concurrent-work compatibility**

Fetch the latest state of the active Tea Master sales-spine branch. Rebase or merge only committed work. Resolve migration/schema and `worker/src/index.ts` conflicts by preserving both domain calls. Confirm this branch still does not define sales grants or settlements.

- [ ] **Step 5: Update product truth**

Update the state and changelog with only verified statements:

- public carts and inquiries are store-bound;
- public tracking uses a private token and redacted response;
- operator inquiries authenticate and surface failures;
- customer non-USD totals convert before labeling;
- retail invoice writes reject invalid/cross-account data.

Keep payment ledger, inquiry conversion, network reporting, Tea Master integration, and wholesale rebuild listed as subsequent phases.

- [ ] **Step 6: Run complete verification**

Run fresh commands and read their full output:

```bash
git diff --check
npx vitest run src/lib/publicCartDomain.test.ts src/lib/api.inquiries.test.ts src/lib/orderMoney.test.ts worker/tests/inquiry-security.test.ts worker/tests/invoice-domain.test.ts worker/tests/invoice-write-validation.test.ts worker/tests/customer-order-detail.test.ts
npm run test:worker
npm run lint
npm run lint:colors
npm run build
npx playwright test tests/public-cart-store-safety.spec.ts tests/order-detail.spec.ts --project='Mobile Chrome' --reporter=list
```

Expected: zero relevant failures. If the existing verification-code expiry timing test fails at its known timing boundary, rerun that test in isolation and report both results rather than hiding it.

- [ ] **Step 7: Request final review**

Review the branch against the approved design and this plan. Confirm no mixed-store path, public PII lookup, unvalidated invoice write, or mislabeled money path remains in the phase-one surfaces.

- [ ] **Step 8: Commit integration and documentation**

```bash
git add tests/public-cart-store-safety.spec.ts tests/order-detail.spec.ts docs/STATE_OF_THE_SITE.md docs/CHANGELOG.md
git commit -m "test: verify retail sales safety"
```

Do not push or merge until explicitly asked to ship.

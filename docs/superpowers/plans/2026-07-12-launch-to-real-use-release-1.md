# Launch-to-Real-Use Release 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Teajia's trust floor: correct and repair collection invoices, restore every public Read entry path, deliver email verification codes for sign-in and guest/event verification, prove tenant isolation, and add customer order details.

**Architecture:** Keep the existing Worker, D1 models, React Router, React Query, and verification lifecycle. Extract small pure Worker modules for invoice arithmetic and email delivery, add only additive migrations, and keep route wiring in the existing Worker router and `App.tsx`; one integration owner must serialize edits to those two shared files. Preserve the already-correct per-unit `price_at_sale` implementation in `handleConfirmCollectionPicks`, the published-only article API, and the already-removed saved/history panel links, then add regression coverage around them instead of rebuilding them.

**Tech Stack:** React 19, TypeScript 5.8, React Router 7, React Query, Vite 6, Cloudflare Workers, D1/SQLite, Resend HTTP API, Vitest 4, Playwright.

---

## File structure and execution boundaries

- Create `worker/src/invoiceDomain.ts`: pure invoice quantity, unit-price, line-total, and repair-candidate calculations.
- Create `worker/tests/invoice-domain.test.ts`: unit tests for tea grams, teaware units, rounding, and historical inflated-line detection.
- Create `worker/migrations/108_invoice_line_repair_audit.sql`: durable idempotency and audit records for invoice-line repairs.
- Modify `worker/schema.sql` and create `worker/tests/fixtures/schema-through-108.sql`: keep clean-schema and legacy migration rehearsal aligned.
- Create `worker/tests/invoice-repair.test.ts`: route-level preview/apply/idempotency tests.
- Create `worker/src/verificationDelivery.ts`: the single email delivery boundary; it never logs a code.
- Create `worker/tests/verification-delivery.test.ts`: provider success, failure, and redacted-log tests.
- Create `worker/migrations/109_verification_challenges.sql`: shared purpose-aware challenge lifecycle for sign-in and guest/event verification.
- Modify `worker/src/index.ts`: wire invoice repair, verification, order detail, and existing public article behavior. Because four tasks touch this file, apply them sequentially in task order.
- Modify `src/App.tsx`: route article entry events and add order detail. Apply Read changes before order-detail changes.
- Modify `src/types.ts`: remove the dead `PAGE_READER` state after all uses are removed and define customer order-detail types.
- Modify `src/lib/api.ts`: verification and order-detail clients.
- Modify `src/pages/SignInPage.tsx`: make email-code sign-in the primary non-Google path while retaining password compatibility and Google OAuth.
- Modify `src/components/events/VerifySheet.tsx`: default to email and display retryable delivery failures.
- Modify `src/pages/OrderHistoryPage.tsx` and create `src/pages/OrderDetailPage.tsx`: list-to-detail journey.
- Create `worker/tests/tenancy-isolation.test.ts`: cross-account matrix for customers, events, invoices, inventory, and Curate.
- Create `tests/read-entry-paths.spec.ts`, `tests/signin-email-code.spec.ts`, and `tests/order-detail.spec.ts`: browser journeys.

Do not run invoice, verification, tenancy, and order-detail Worker integrations concurrently: all modify `worker/src/index.ts`. Do not run Read and order-detail route integrations concurrently: both modify `src/App.tsx`. Migration numbers 108 and 109 are reserved by this plan and must be applied in that order.

### Task 1: Lock the invoice invariant in a pure domain module

**Files:**
- Create: `worker/src/invoiceDomain.ts`
- Create: `worker/tests/invoice-domain.test.ts`

- [ ] **Step 1: Write the failing invariant tests**

```ts
import { describe, expect, it } from 'vitest';
import { deriveConfirmedInvoiceLine, invoiceLineTotal, repairCandidate } from '../src/invoiceDomain';

describe('invoice line invariant', () => {
  it('stores a per-gram rate for a scaled tea pick', () => {
    expect(deriveConfirmedInvoiceLine({ quantity: 100, recommendedQuantity: 50, recommendedPriceUsd: 12, catalogUnitPriceUsd: 0.3 }))
      .toEqual({ quantity: 100, unitPriceUsd: 0.24, lineTotalUsd: 24 });
  });

  it('stores a per-unit rate for teaware', () => {
    expect(deriveConfirmedInvoiceLine({ quantity: 2, recommendedQuantity: 1, recommendedPriceUsd: 18, catalogUnitPriceUsd: 20 }))
      .toEqual({ quantity: 2, unitPriceUsd: 18, lineTotalUsd: 36 });
  });

  it('treats a recommendation without a quantity as a flat line quote', () => {
    expect(deriveConfirmedInvoiceLine({ quantity: 50, recommendedQuantity: null, recommendedPriceUsd: 15, catalogUnitPriceUsd: 0.4 }))
      .toEqual({ quantity: 50, unitPriceUsd: 0.3, lineTotalUsd: 15 });
  });

  it('computes persisted totals from quantity times unit price', () => {
    expect(invoiceLineTotal(75, 0.32)).toBe(24);
  });

  it('recognizes only collection lines with reproducible historical inflation', () => {
    expect(repairCandidate({ sourceCollectionId: 'c1', quantity: 50, storedPriceAtSale: 600, recommendedQuantity: 50, recommendedPriceUsd: 12, catalogUnitPriceUsd: 0.3 }))
      .toEqual({ correctedUnitPriceUsd: 0.24, currentLineTotalUsd: 30000, correctedLineTotalUsd: 12 });
    expect(repairCandidate({ sourceCollectionId: null, quantity: 50, storedPriceAtSale: 600, recommendedQuantity: 50, recommendedPriceUsd: 12, catalogUnitPriceUsd: 0.3 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `npx vitest run worker/tests/invoice-domain.test.ts`

Expected: FAIL with `Cannot find module '../src/invoiceDomain'`.

- [ ] **Step 3: Implement the pure invariant**

```ts
export interface ConfirmedInvoiceLineInput {
  quantity: number;
  recommendedQuantity: number | null;
  recommendedPriceUsd: number | null;
  catalogUnitPriceUsd: number | null;
}

export interface RepairCandidateInput extends ConfirmedInvoiceLineInput {
  sourceCollectionId: string | null;
  storedPriceAtSale: number;
}

const money = (value: number) => Math.round(value * 100) / 100;

export function deriveConfirmedInvoiceLine(input: ConfirmedInvoiceLineInput) {
  const quantity = Math.max(1, Math.round(Number(input.quantity) || 1));
  const recommendedQuantity = Number(input.recommendedQuantity);
  let lineTotalUsd = 0;
  if (input.recommendedPriceUsd !== null && Number.isFinite(recommendedQuantity) && recommendedQuantity > 0) {
    lineTotalUsd = money((input.recommendedPriceUsd / recommendedQuantity) * quantity);
  } else if (input.recommendedPriceUsd !== null) {
    lineTotalUsd = money(input.recommendedPriceUsd);
  } else if (input.catalogUnitPriceUsd !== null) {
    lineTotalUsd = money(input.catalogUnitPriceUsd * quantity);
  }
  return { quantity, unitPriceUsd: lineTotalUsd / quantity, lineTotalUsd };
}

export function invoiceLineTotal(quantity: number, unitPriceUsd: number): number {
  return money(quantity * unitPriceUsd);
}

export function repairCandidate(input: RepairCandidateInput) {
  if (!input.sourceCollectionId || input.quantity <= 1) return null;
  const corrected = deriveConfirmedInvoiceLine(input);
  const historicalLineTotal = corrected.lineTotalUsd;
  if (money(input.storedPriceAtSale) !== historicalLineTotal) return null;
  const currentLineTotalUsd = invoiceLineTotal(input.quantity, input.storedPriceAtSale);
  if (currentLineTotalUsd === historicalLineTotal) return null;
  return {
    correctedUnitPriceUsd: corrected.unitPriceUsd,
    currentLineTotalUsd,
    correctedLineTotalUsd: historicalLineTotal,
  };
}
```

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run worker/tests/invoice-domain.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit the invariant**

```bash
git add worker/src/invoiceDomain.ts worker/tests/invoice-domain.test.ts
git commit -m "test: lock invoice line pricing invariant"
```

### Task 2: Reuse the invariant in collection confirmation

**Files:**
- Modify: `worker/src/index.ts:16870-16975`
- Create: `worker/tests/collection-confirm-invoice.test.ts`

- [ ] **Step 1: Add a route regression test around the existing partial fix**

Create a Worker DB harness that returns one active collection tea with `recommended_quantity = 50` and `recommended_price_usd = 12`, posts a pick quantity of `100`, captures the `invoice_line_items` insert bindings, and asserts:

```ts
expect(response.status).toBe(201);
expect(insertedLine).toMatchObject({ quantity: 100, price_at_sale: 0.24 });
expect(insertedLine.quantity * insertedLine.price_at_sale).toBe(24);
```

Add a second fixture for teaware with recommendation `1 @ 18`, pick quantity `2`, and assert `quantity: 2`, `price_at_sale: 18`, and total `36`.

- [ ] **Step 2: Run the regression test**

Run: `npx vitest run worker/tests/collection-confirm-invoice.test.ts`

Expected: PASS against the current partial implementation. If it fails, the expected failure must show a stored line total rather than a unit price; do not change the expected values.

- [ ] **Step 3: Replace duplicated arithmetic with the domain function**

Add:

```ts
import { deriveConfirmedInvoiceLine } from './invoiceDomain';
```

Replace the local `lineTotal` and `unitPrice` calculation in `handleConfirmCollectionPicks` with:

```ts
const derived = deriveConfirmedInvoiceLine({
  quantity,
  recommendedQuantity: row.recommended_quantity == null ? null : Number(row.recommended_quantity),
  recommendedPriceUsd: row.recommended_price_usd == null ? null : Number(row.recommended_price_usd),
  catalogUnitPriceUsd: row.fixed_retail_price_usd == null ? null : Number(row.fixed_retail_price_usd),
});

lineItems.push({
  product_id: row.product_id,
  custom_name: null,
  quantity: derived.quantity,
  price_at_sale: derived.unitPriceUsd,
  label: `${row.product_name} × ${derived.quantity}${isTeaware ? '' : 'g'}`,
});
```

- [ ] **Step 4: Run invoice tests and type-check**

Run: `npx vitest run worker/tests/invoice-domain.test.ts worker/tests/collection-confirm-invoice.test.ts && npm run lint`

Expected: both test files PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the integration**

```bash
git add worker/src/index.ts worker/tests/collection-confirm-invoice.test.ts
git commit -m "refactor: centralize confirmed invoice pricing"
```

### Task 3: Add previewable, idempotent invoice repair

**Files:**
- Create: `worker/migrations/108_invoice_line_repair_audit.sql`
- Modify: `worker/schema.sql`
- Create: `worker/tests/fixtures/schema-through-108.sql`
- Create: `worker/tests/invoice-repair.test.ts`
- Modify: `worker/src/index.ts:19080-19170`

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE IF NOT EXISTS invoice_line_repairs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  line_item_id TEXT NOT NULL REFERENCES invoice_line_items(id),
  repair_key TEXT NOT NULL UNIQUE,
  old_price_at_sale REAL NOT NULL,
  new_price_at_sale REAL NOT NULL,
  old_line_total REAL NOT NULL,
  new_line_total REAL NOT NULL,
  repaired_by TEXT NOT NULL REFERENCES users(id),
  repaired_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_repairs_account_invoice
  ON invoice_line_repairs(account_id, invoice_id);
```

Append the identical table and index definitions to `worker/schema.sql`, then generate `worker/tests/fixtures/schema-through-108.sql` by applying migrations 099 through 108 to the existing `schema-through-098.sql` fixture using local D1.

- [ ] **Step 2: Rehearse the migration twice**

Run:

```bash
rm -rf /tmp/teajia-r1-migrations
npx wrangler d1 execute teajia-r1 --local --persist-to /tmp/teajia-r1-migrations --file worker/tests/fixtures/schema-through-098.sql
for f in worker/migrations/{099_compass_decision,100_curate_context,101_curate_imports,102_compass_sample_state,103_inventory_purpose_receipts,104_inventory_receipts,105_stock_movements,106_compass_promotion_identity,107_curate_import_idempotency,108_invoice_line_repair_audit}.sql; do npx wrangler d1 execute teajia-r1 --local --persist-to /tmp/teajia-r1-migrations --file "$f"; done
npx wrangler d1 execute teajia-r1 --local --persist-to /tmp/teajia-r1-migrations --file worker/migrations/108_invoice_line_repair_audit.sql
```

Expected: every command exits 0; the second 108 run reports success because every DDL statement is idempotent.

- [ ] **Step 3: Write failing preview/apply tests**

In `worker/tests/invoice-repair.test.ts`, seed two accounts and these lines:

```ts
const affected = { invoice_id: 'inv-a', line_item_id: 'line-a', quantity: 50, price_at_sale: 12, recommended_quantity: 50, recommended_price_usd: 12 };
const correct = { invoice_id: 'inv-b', line_item_id: 'line-b', quantity: 50, price_at_sale: 0.24, recommended_quantity: 50, recommended_price_usd: 12 };
```

Assert `GET /api/admin/repairs/invoice-lines` returns only `inv-a`, with `current_total_usd: 600`, `corrected_total_usd: 12`, and makes no update. Assert `POST` without `{ confirm: true, preview_key }` is 400. Assert POST with the preview key changes only `line-a`, inserts an audit row, and a repeated POST returns `changed_lines: 0`. Assert an ordinary owner from account B cannot preview or mutate account A.

- [ ] **Step 4: Run the repair test and confirm the route is absent**

Run: `npx vitest run worker/tests/invoice-repair.test.ts`

Expected: FAIL with status 404 for `/api/admin/repairs/invoice-lines`.

- [ ] **Step 5: Implement the scoped preview and apply handlers**

Use `requireOwnerTier`, query only rows where `i.account_id = ?`, `i.source_collection_id IS NOT NULL`, and no matching audit record exists. Join `collection_items` on collection and product to recover recommendation data. Pass every row through `repairCandidate`; construct `preview_key` as a SHA-256 digest of sorted `line_item_id:old:new` tuples. The POST recomputes preview, rejects a stale digest with 409, then batches for each candidate:

```sql
UPDATE invoice_line_items
SET price_at_sale = ?
WHERE id = ? AND invoice_id = ? AND account_id = ? AND price_at_sale = ?;
```

and:

```sql
INSERT OR IGNORE INTO invoice_line_repairs
(id, account_id, invoice_id, line_item_id, repair_key, old_price_at_sale,
 new_price_at_sale, old_line_total, new_line_total, repaired_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
```

Register:

```ts
['GET', '/api/admin/repairs/invoice-lines', handlePreviewInvoiceLineRepair],
['POST', '/api/admin/repairs/invoice-lines', handleApplyInvoiceLineRepair],
```

- [ ] **Step 6: Run repair and invariant tests**

Run: `npx vitest run worker/tests/invoice-domain.test.ts worker/tests/collection-confirm-invoice.test.ts worker/tests/invoice-repair.test.ts`

Expected: PASS; repeated repair reports zero changes and unchanged totals.

- [ ] **Step 7: Commit the repair path**

```bash
git add worker/migrations/108_invoice_line_repair_audit.sql worker/schema.sql worker/tests/fixtures/schema-through-108.sql worker/tests/invoice-repair.test.ts worker/src/index.ts
git commit -m "feat: add previewable invoice line repair"
```

### Task 4: Repair legacy article entry paths without reopening retired destinations

**Files:**
- Create: `tests/read-entry-paths.spec.ts`
- Modify: `src/App.tsx:410-435,535-565,1090-1110`
- Modify: `src/types.ts:431`

- [ ] **Step 1: Write failing browser tests**

Mock `GET **/api/articles/live-story` with a published article. From the archived magazine fixture click an Article card and assert URL `/article/live-story` and visible title. Dispatch:

```ts
await page.evaluate(() => window.dispatchEvent(new CustomEvent('openArticle', {
  detail: { story: { id: 'live-story', slug: 'live-story', title: 'Live Story', type: 'Article' } },
})));
```

Assert the same URL. Mock draft and missing slugs with 404 and assert no public index/card anchor points to them. Open AccountPanel and assert links named `Saved stories` and `Reading history` have count zero.

- [ ] **Step 2: Run the test and verify the dead overlay failure**

Run: `npx playwright test tests/read-entry-paths.spec.ts --project='Desktop Chrome'`

Expected: FAIL because Article taps leave the URL unchanged while setting `PAGE_READER`.

- [ ] **Step 3: Route Article entries by slug**

In both the `openArticle` listener and `handleCardClick`, replace the Article branch with:

```ts
const slug = story.slug || story.id;
navigate(`/article/${encodeURIComponent(slug)}`);
return;
```

Keep `PHOTO_ESSAY` and `STORY_VIEW` unchanged. Add `navigate` to the effect dependency list. After `rg -n "PAGE_READER" src` returns only the type declaration, remove `PAGE_READER` from `ViewState`.

- [ ] **Step 4: Run Read coverage and type-check**

Run:

```bash
npx playwright test tests/read-entry-paths.spec.ts tests/read-index-articles.spec.ts tests/read-bottom-bar.spec.ts --project='Desktop Chrome'
npm run lint
```

Expected: all Read tests PASS; `rg -n "PAGE_READER" src` prints no matches; TypeScript exits 0.

- [ ] **Step 5: Commit Read integrity**

```bash
git add tests/read-entry-paths.spec.ts src/App.tsx src/types.ts
git commit -m "fix: route article entries to the live reader"
```

### Task 5: Create the safe email delivery boundary

**Files:**
- Create: `worker/src/verificationDelivery.ts`
- Create: `worker/tests/verification-delivery.test.ts`

- [ ] **Step 1: Write provider-boundary tests**

Test `deliverVerificationCode` with a mocked fetch. Assert the request goes to `https://api.resend.com/emails`, uses the configured sender, includes the six-digit code in the provider payload, and returns `{ delivered: true, providerMessageId: 'email-1' }`. Test HTTP 503 returns `{ delivered: false, retryable: true, reason: 'provider_unavailable' }`. Spy on `console.error` and assert no log call contains `123456` or the full email address.

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `npx vitest run worker/tests/verification-delivery.test.ts`

Expected: FAIL with missing `verificationDelivery` module.

- [ ] **Step 3: Implement delivery**

```ts
export interface VerificationEmailEnv {
  RESEND_API_KEY?: string;
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
}

export async function deliverVerificationCode(
  env: VerificationEmailEnv,
  input: { email: string; code: string; purpose: 'signin' | 'event' },
  fetcher: typeof fetch = fetch,
) {
  if (!env.RESEND_API_KEY || !env.SENDER_EMAIL) {
    console.error('[verification] email provider is not configured');
    return { delivered: false as const, retryable: false, reason: 'provider_not_configured' };
  }
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${env.SENDER_NAME || 'Teajia'} <${env.SENDER_EMAIL}>`,
      to: [input.email],
      subject: input.purpose === 'signin' ? 'Your Teajia sign-in code' : 'Your Teajia verification code',
      html: `<p>Your Teajia code is <strong>${input.code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    }),
  });
  if (!response.ok) {
    console.error(`[verification] email delivery failed status=${response.status}`);
    return { delivered: false as const, retryable: response.status >= 500, reason: response.status >= 500 ? 'provider_unavailable' : 'provider_rejected' };
  }
  const body = await response.json() as { id: string };
  return { delivered: true as const, providerMessageId: body.id };
}
```

- [ ] **Step 4: Run delivery tests**

Run: `npx vitest run worker/tests/verification-delivery.test.ts`

Expected: PASS for success, retryability, missing configuration, and log redaction.

- [ ] **Step 5: Commit delivery boundary**

```bash
git add worker/src/verificationDelivery.ts worker/tests/verification-delivery.test.ts
git commit -m "feat: add verification email delivery boundary"
```

### Task 6: Generalize the existing verification lifecycle for sign-in and events

**Files:**
- Create: `worker/migrations/109_verification_challenges.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/tests/fixtures/schema-through-108.sql`
- Create: `worker/tests/verification-routes.test.ts`
- Modify: `worker/src/index.ts:10490-10670,19440-19470`

- [ ] **Step 1: Add the purpose-aware challenge table**

```sql
CREATE TABLE IF NOT EXISTS verification_challenges (
  id TEXT PRIMARY KEY,
  contact_normalized TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signin', 'event')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at TEXT,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_verification_challenges_contact_purpose
  ON verification_challenges(contact_normalized, purpose, created_at DESC);
```

Append the same definitions to `worker/schema.sql`.

- [ ] **Step 2: Write failing route tests**

Cover:

```ts
expect(await requestCode({ contact: 'Member@Example.com', purpose: 'signin' })).toMatchObject({ status: 202 });
expect(deliveryCalls[0]).toMatchObject({ email: 'member@example.com', purpose: 'signin' });
expect(await requestCode({ contact: 'guest@example.com', purpose: 'event' })).toMatchObject({ status: 202 });
expect(await requestCodeWithProviderFailure()).toMatchObject({ status: 503, body: { error: 'We could not send the code.', retryable: true } });
expect(await confirmSignin('member@example.com', issuedCode)).toMatchObject({ status: 200, body: { token: expect.any(String) } });
expect(await confirmEvent('guest@example.com', issuedCode)).toMatchObject({ status: 200, body: { customer: expect.any(Object), attendances: expect.any(Array) } });
```

Also assert a code is single-use, expires at ten minutes, locks after three failures, a resend inside sixty seconds returns 429, and responses never contain `code` unless `DEV_RETURN_VERIFY_CODES === 'true'`.

- [ ] **Step 3: Run tests and confirm missing purpose behavior**

Run: `npx vitest run worker/tests/verification-routes.test.ts`

Expected: FAIL because `/api/verify/request` accepts `method`, does not deliver, and `/confirm` cannot issue a sign-in JWT.

- [ ] **Step 4: Implement request delivery using the existing endpoints**

Accept:

```ts
type VerificationRequestBody = {
  contact: string;
  purpose?: 'signin' | 'event';
  method?: 'email';
};
```

Normalize email with `trim().toLowerCase()`, default `purpose` to `event` for backward compatibility, hash the code with the existing SHA-256 helper, insert a challenge only after `deliverVerificationCode` succeeds, and return HTTP 202 `{ success: true, expires, retryable: true }`. On delivery failure return 503 with `{ error: 'We could not send the code.', retryable: delivery.retryable }` and persist no active challenge. Keep the dev echo behind the existing explicit flag.

- [ ] **Step 5: Implement purpose-aware confirmation**

Accept `{ contact, code, purpose?: 'signin' | 'event' }`. Atomically mark the newest matching unconsumed challenge consumed only after hash and expiry validation. For `signin`, find the `users.email`, load memberships exactly as password login does, and sign the same JWT claims; always return the same 401 message for an unknown email or bad code. For `event`, reuse the current customer and attendance response construction. Do not log contact, code, code hash, or JWT.

- [ ] **Step 6: Run verification and authorization tests**

Run: `npx vitest run worker/tests/verification-delivery.test.ts worker/tests/verification-routes.test.ts worker/tests/auth-boundaries.test.ts`

Expected: all tests PASS; password login and Google OAuth tests remain unchanged.

- [ ] **Step 7: Rehearse migration 109 on clean and legacy schemas**

Run:

```bash
npx wrangler d1 execute teajia-r1-clean --local --file worker/schema.sql
npx wrangler d1 execute teajia-r1 --local --persist-to /tmp/teajia-r1-migrations --file worker/migrations/109_verification_challenges.sql
npx wrangler d1 execute teajia-r1 --local --persist-to /tmp/teajia-r1-migrations --file worker/migrations/109_verification_challenges.sql
```

Expected: all commands exit 0, including the repeated migration.

- [ ] **Step 8: Commit shared verification lifecycle**

```bash
git add worker/migrations/109_verification_challenges.sql worker/schema.sql worker/tests/fixtures/schema-through-108.sql worker/tests/verification-routes.test.ts worker/src/index.ts
git commit -m "feat: deliver reusable email verification codes"
```

### Task 7: Make email code the default non-Google sign-in path

**Files:**
- Create: `tests/signin-email-code.spec.ts`
- Modify: `src/lib/api.ts:830-910,1810-1850`
- Modify: `src/pages/SignInPage.tsx`
- Modify: `src/components/events/VerifySheet.tsx:130-220`

- [ ] **Step 1: Write failing browser journeys**

For `/signin`, mock request as 202, enter `member@example.com`, click `Email me a code`, assert the six-digit input appears, submit `123456`, mock a JWT response, and assert return navigation occurs. Mock request 503 `{ error: 'We could not send the code.', retryable: true }`, assert the message and `Try again` button. For the event sheet, assert email is initially selected and the same request endpoint receives `{ purpose: 'event' }`. Assert the Google link remains visible.

- [ ] **Step 2: Run the browser test**

Run: `npx playwright test tests/signin-email-code.spec.ts --project='Desktop Chrome'`

Expected: FAIL because SignIn exposes password login rather than email-code controls.

- [ ] **Step 3: Add typed API methods**

```ts
verification: {
  requestCode: async (contact: string, purpose: 'signin' | 'event' = 'event') => {
    const res = await fetchWithTimeout(`${API_URL}/api/verify/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, method: 'email', purpose }),
    });
    return handleResponse(res);
  },
  confirmCode: async (contact: string, code: string, purpose: 'signin' | 'event' = 'event') => {
    const res = await fetchWithTimeout(`${API_URL}/api/verify/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, code, purpose }),
    });
    return handleResponse(res);
  },
}
```

When the sign-in confirmation returns a token, store it through the same token/session path used by `auth.login` and invalidate the decoded-claims cache.

- [ ] **Step 4: Implement the two-step sign-in form**

Render email entry first, then code entry after a 202 response. Preserve the Google OAuth button. Place password login behind a text button labeled `Use password instead` so existing operators are not locked out. Delivery failure text must use the API message and expose a retry button; confirmation failure must keep the code input editable.

- [ ] **Step 5: Default the event sheet to email**

Initialize the method to `email`, call `requestCode(contact, 'event')` and `confirmCode(contact, code, 'event')`, and keep the existing loading, retry, and attempt-error states. Remove any copy promising WhatsApp delivery.

- [ ] **Step 6: Run UI verification**

Run:

```bash
npx playwright test tests/signin-email-code.spec.ts --project='Desktop Chrome'
npm run lint
npm run lint:colors
```

Expected: browser tests PASS; TypeScript and color rules exit 0.

- [ ] **Step 7: Commit the email-code UI**

```bash
git add tests/signin-email-code.spec.ts src/lib/api.ts src/pages/SignInPage.tsx src/components/events/VerifySheet.tsx
git commit -m "feat: make email code the default sign-in path"
```

### Task 8: Establish the cross-account denial harness

**Files:**
- Create: `worker/tests/tenancy-isolation.test.ts`

- [ ] **Step 1: Build two-account fixtures and identity helpers**

Use a stateful fake D1 harness with accounts `acct-a` and `acct-b`, a member who belongs only to A, a member who belongs only to B, and a platform owner. Seed one customer, event, invoice with line, product, stock row, Curate journey, visit, and Compass entry in each account. Sign real test JWTs and always send `X-Teajia-Account`.

- [ ] **Step 2: Assert account selection fails closed**

```ts
it('denies selecting an account without membership', async () => {
  const response = await callAs(memberA, 'acct-b', '/api/customers');
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: 'Account access denied' });
});
```

- [ ] **Step 3: Assert direct IDs and lists are scoped**

Create a table-driven suite with these cases:

```ts
[
  ['customers', '/api/customers', '/api/customers/customer-b', 'PUT'],
  ['events', '/api/admin/events', '/api/admin/events/event-b', 'PUT'],
  ['invoices', '/api/invoices', '/api/invoices/invoice-b/items', 'GET'],
  ['inventory', '/api/products', '/api/products/product-b/stock', 'PUT'],
  ['curate journeys', '/api/curate/journeys', '/api/curate/journeys/journey-b', 'PUT'],
  ['curate visits', '/api/curate/visits', '/api/curate/visits/visit-b', 'PUT'],
  ['curate records', '/api/tea-compass', '/api/tea-compass/entry-b', 'PUT'],
]
```

For every list, assert no B ID appears while acting in A. For every direct read/write, assert 404 or 403 and confirm B's stored row is byte-for-byte unchanged. Add invoice fulfillment and stock mutation cases because writes with side effects are release-blocking.

- [ ] **Step 4: Assert platform exceptions separately**

Act as the platform owner with `X-Teajia-Account: acct-b`; assert the B list and direct resource are accessible. Act as an ordinary owner from A and repeat; assert denial. This test must exercise the database-read `platform_role`, not merely a JWT claim.

- [ ] **Step 5: Run the suite and record any handler leaks as failures**

Run: `npx vitest run worker/tests/tenancy-isolation.test.ts`

Expected: PASS if every existing handler scopes IDs and lists. Any failing case must remain red until its query includes `account_id = ctx.accountId` and its mutation verifies affected-row count before returning success.

- [ ] **Step 6: Apply minimal scoping fixes if the suite exposes a leak**

For a leaking direct mutation, use this exact pattern:

```ts
const result = await env.DB.prepare(
  'UPDATE resource SET field = ? WHERE id = ? AND account_id = ?'
).bind(value, params.id, ctx.accountId).run();
if (Number(result.meta?.changes || 0) === 0) return json({ error: 'Resource not found' }, 404);
```

For lists, add `WHERE account_id = ?` and bind `ctx.accountId`. Do not add platform-specific query bypasses; platform users select the target account through the established active-account resolver.

- [ ] **Step 7: Run all Worker authorization tests**

Run: `npm run test:worker`

Expected: the complete Worker suite PASS with no cross-account read or write.

- [ ] **Step 8: Commit tenancy coverage and any minimal fixes**

```bash
git add worker/tests/tenancy-isolation.test.ts worker/src/index.ts
git commit -m "test: enforce cross-account resource isolation"
```

### Task 9: Add an ownership-safe customer order-detail endpoint

**Files:**
- Create: `worker/tests/customer-order-detail.test.ts`
- Modify: `worker/src/index.ts:13700-13780,19450-19465`

- [ ] **Step 1: Write failing endpoint tests**

Seed a signed-in user linked to customer A and an invoice containing two lines. Assert `GET /api/me/orders/inv-a` returns reference, status, created/payment/fulfilled dates, currency, shipping, line items with quantity/unit price/line total, and grand total. Assert a Draft or Void invoice is 404. Assert user A cannot fetch user B's invoice even when both are in the same active account. Assert active account A cannot fetch an invoice in B. Assert totals equal the list endpoint totals.

- [ ] **Step 2: Run the test and confirm route absence**

Run: `npx vitest run worker/tests/customer-order-detail.test.ts`

Expected: FAIL with 404 for the unregistered route.

- [ ] **Step 3: Extract the existing customer ownership predicate**

Create a local helper that loads the user's normalized email/phone and returns SQL bindings for the existing canonical `customers.user_id`, customer email fallback, and invoice WhatsApp fallback. Use it in both `handleGetMyOrders` and the new detail handler so list and detail cannot drift.

- [ ] **Step 4: Implement the detail handler**

Query the invoice with `i.id = ?`, `i.account_id = ?`, `i.deleted_at IS NULL`, `i.status NOT IN ('Draft','Void')`, and the shared ownership predicate. Then query lines with both `invoice_id = ?` and `account_id = ?`, left-join products for display names, and map:

```ts
{
  id,
  product_id,
  name: custom_name || product_name || 'Tea',
  quantity: Number(quantity),
  unit_price_usd: Number(price_at_sale),
  line_total_usd: Number(quantity) * Number(price_at_sale),
}
```

Return `subtotal_amount_usd`, `shipping_amount_usd`, and `total_amount_usd`. Load the owning account's configured WhatsApp and email and return only available contact values. Register `GET /api/me/orders/:id` after `/api/me/orders`.

- [ ] **Step 5: Run detail, tenancy, and invoice tests**

Run:

```bash
npx vitest run worker/tests/customer-order-detail.test.ts worker/tests/tenancy-isolation.test.ts worker/tests/invoice-domain.test.ts
```

Expected: all tests PASS and detail totals exactly match list totals.

- [ ] **Step 6: Commit the endpoint**

```bash
git add worker/tests/customer-order-detail.test.ts worker/src/index.ts
git commit -m "feat: add customer order detail endpoint"
```

### Task 10: Build the customer order-detail page and history journey

**Files:**
- Create: `tests/order-detail.spec.ts`
- Create: `src/pages/OrderDetailPage.tsx`
- Modify: `src/pages/OrderHistoryPage.tsx:95-125`
- Modify: `src/lib/api.ts:3070-3100`
- Modify: `src/types.ts`
- Modify: `src/App.tsx:1005-1025`

- [ ] **Step 1: Define the response type**

```ts
export interface CustomerOrderDetail {
  id: string;
  invoice_number: string;
  status: string;
  created_at: string;
  payment_date: string | null;
  fulfilled_at: string | null;
  currency: string;
  items: Array<{ id: string; product_id: string | null; name: string; quantity: number; unit_price_usd: number; line_total_usd: number }>;
  subtotal_amount_usd: number;
  shipping_amount_usd: number;
  total_amount_usd: number;
  contact: { whatsapp: string | null; email: string | null };
}
```

- [ ] **Step 2: Write browser tests for all states**

Mock history with `inv-a`, click its row, assert `/account/orders/inv-a`. Cover detail loading skeleton, success fields, retryable 500 error, 404 message with Back action, and an invoice with zero shipping. On Mobile Chrome assert `document.documentElement.scrollWidth <= window.innerWidth` and the last contact action is above the bottom nav.

- [ ] **Step 3: Run the browser test and confirm the row is static**

Run: `npx playwright test tests/order-detail.spec.ts --project='Mobile Chrome'`

Expected: FAIL because the order row does not navigate and the detail route does not exist.

- [ ] **Step 4: Add the API client**

```ts
order: async (id: string): Promise<CustomerOrderDetail> => {
  const res = await fetchWithTimeout(`${API_URL}/api/me/orders/${encodeURIComponent(id)}`, { headers: authHeaders() });
  return handleResponse(res);
},
```

- [ ] **Step 5: Implement the detail page**

Use `useParams`, `useQuery({ queryKey: ['me','orders',id] })`, the same unauthenticated redirect pattern as `OrderHistoryPage`, `TYPOGRAPHY_CLASSES`, safe currency/date formatting, and root classes:

```tsx
<div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-nav-gap-lg">
```

Render reference, status, dates, each line's name/quantity/unit price/line total, subtotal, shipping, total, then WhatsApp if configured and email otherwise. Contact actions are inquiries, not payment or checkout actions. Use a top-left Back button with `text-tea-text-sec hover:text-tea-text` and `tap-target` on undersized icons.

- [ ] **Step 6: Wire history and route**

Replace each static `<article>` with a `<button type="button">` that calls `navigate('/account/orders/' + encodeURIComponent(order.id))`, preserves the current visual row, has a visible arrow, and a minimum 44px target. Add:

```tsx
<Route path="/account/orders/:id" element={<ErrorBoundary><Suspense fallback={<EmblemLoader />}><OrderDetailPage /></Suspense></ErrorBoundary>} />
```

Do not alter any navigation label.

- [ ] **Step 7: Run component journey and required UI checks**

Run:

```bash
npx playwright test tests/order-detail.spec.ts --project='Mobile Chrome'
npm run lint
npm run lint:colors
```

Expected: all order-detail scenarios PASS, no horizontal overflow, TypeScript and color checks exit 0.

- [ ] **Step 8: Commit customer order details**

```bash
git add tests/order-detail.spec.ts src/pages/OrderDetailPage.tsx src/pages/OrderHistoryPage.tsx src/lib/api.ts src/types.ts src/App.tsx
git commit -m "feat: add customer order details"
```

### Task 11: Run the Release 1 integrated verification gate

**Files:**
- Modify only if a verification failure proves a Release 1 regression in a file already named above.

- [ ] **Step 1: Run static checks and production build**

Run:

```bash
npm run lint
npm run lint:colors
npm run build
```

Expected: all three commands exit 0; Vite creates `dist/` without TypeScript, color-token, or bundle errors.

- [ ] **Step 2: Run the complete Worker suite**

Run: `npm run test:worker`

Expected: every Worker test passes, including invoice repair, verification delivery, tenancy isolation, and customer order detail.

- [ ] **Step 3: Start the reserved development server**

Run: `npm run dev`

Expected: Vite serves `http://localhost:7777`; if port 7777 is already serving this worktree, reuse it rather than starting a second server.

- [ ] **Step 4: Run Release 1 browser journeys**

Run:

```bash
npx playwright test tests/read-entry-paths.spec.ts tests/read-index-articles.spec.ts tests/read-bottom-bar.spec.ts tests/signin-email-code.spec.ts tests/order-detail.spec.ts --project='Desktop Chrome' --project='Mobile Chrome'
npm run test:mobile
npx playwright test tests/inventory-scroll.spec.ts --project='Desktop Chrome' --project='Mobile Chrome'
```

Expected: all projects PASS; no page errors, horizontal overflow, hidden order contact actions, or Inventory height-chain regression.

- [ ] **Step 5: Rehearse the full migration chain**

Run:

```bash
rm -rf /tmp/teajia-r1-final-clean /tmp/teajia-r1-final-legacy
npx wrangler d1 execute teajia-r1-final-clean --local --persist-to /tmp/teajia-r1-final-clean --file worker/schema.sql
npx wrangler d1 execute teajia-r1-final-legacy --local --persist-to /tmp/teajia-r1-final-legacy --file worker/tests/fixtures/schema-through-098.sql
for f in worker/migrations/{099_compass_decision,100_curate_context,101_curate_imports,102_compass_sample_state,103_inventory_purpose_receipts,104_inventory_receipts,105_stock_movements,106_compass_promotion_identity,107_curate_import_idempotency,108_invoice_line_repair_audit,109_verification_challenges}.sql; do npx wrangler d1 execute teajia-r1-final-legacy --local --persist-to /tmp/teajia-r1-final-legacy --file "$f"; done
```

Expected: clean schema and legacy-upgrade rehearsal both exit 0 through migration 109.

- [ ] **Step 6: Verify production configuration without exposing secrets**

Run:

```bash
rg -n "SENDER_EMAIL|RESEND_API_KEY|DEV_RETURN_VERIFY_CODES" worker/wrangler.toml worker/src
rg -n "console\.(log|warn|error).*code|console\.(log|warn|error).*token" worker/src
```

Expected: sender/provider variables are documented; `DEV_RETURN_VERIFY_CODES` is never enabled in committed production configuration; the second command finds no statement that logs verification codes or JWTs.

- [ ] **Step 7: Commit any evidence-driven corrections, then record the release checkpoint**

```bash
git status --short
git log --oneline --max-count=12
```

Expected: the worktree is clean, and the log contains the Release 1 commits from Tasks 1-10. Do not claim real email delivery complete until a configured deployed-environment message is received; report that human/environment gate separately.

### Task 12: Update program documentation after fresh green evidence

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-launch-to-real-use-program-design.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Record only verified implementation state**

Under Release 1, change implementation status from unstarted to implemented and locally verified, listing the exact commands from Task 11 that passed. Keep deployed email receipt as pending until it has actually occurred. State that the historical invoice repair is previewable and no mutation has occurred unless an operator explicitly ran the confirmed apply endpoint.

- [ ] **Step 2: Add the changelog entry**

Add a dated `2026-07-12 — Launch-to-Real-Use Release 1` entry covering invoice invariant/repair preview, live Read routing, email-code verification, tenancy denial coverage, and customer order details. Explicitly say Google OAuth and inquiry-led commerce remain intact.

- [ ] **Step 3: Run documentation-sensitive checks**

Run: `npm run lint && npm run lint:colors && git diff --check`

Expected: all commands exit 0 and the diff contains no whitespace errors.

- [ ] **Step 4: Commit the verified release checkpoint**

```bash
git add docs/superpowers/specs/2026-07-12-launch-to-real-use-program-design.md docs/CHANGELOG.md
git commit -m "docs: record Release 1 trust floor"
```

## Release 1 completion conditions

- Invoice lines have one invariant: `price_at_sale` is a per-unit rate and totals are `quantity × price_at_sale`.
- Repair preview reports exact invoice and line changes, apply requires confirmation plus a fresh preview digest, and repeat apply changes nothing.
- Every Article entry navigates to `/article/:slug`; draft and nonexistent articles are not linked publicly; retired saved/history links remain absent.
- Email is the default verification channel for sign-in and event/guest flows; provider failure is explicit and retryable; logs expose neither codes nor tokens; Google OAuth remains available.
- Ordinary membership cannot read or mutate another account's customers, events, invoices, inventory, stock, or Curate records by list or direct ID; platform exceptions are tested independently.
- Order history reaches a scoped detail page containing reference, status, dates, lines, quantities, prices, totals, and inquiry contact without adding payment or checkout.
- Static checks, Worker tests, desktop/mobile journeys, Inventory regression coverage, production build, and clean/legacy migration rehearsals have fresh passing evidence.

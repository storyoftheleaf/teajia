# Unified Sales Remaining Phases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Teajia's approved sales program after Phase 1: a traceable retail order spine, immutable payment ledger, canonical store/network reporting, conserved wholesale transfers, and Tea Master seller attribution integration without turning Teajia into merchant-of-record.

**Architecture:** Preserve the existing inquiry-led WhatsApp/email close and `invoices` compatibility anchor while adding explicit order, fulfillment, payment, reporting, and wholesale records. Every mutation is account-scoped, idempotent, compare-and-swap fenced, and records an append-only event; every stock change uses the canonical stock-movement service. Integrate the committed Tea Master grant/attribution/settlement contracts before adding later migrations so no duplicate authority or settlement model is created.

**Tech Stack:** React 19, TypeScript, React Query, Cloudflare Workers, D1/SQLite, MCP, Vitest, Playwright.

---

## Delivery boundaries and migration allocation

- `126_tea_master_sales.sql` — integrate the committed Tea Master sales branch contract exactly once.
- `127_secure_inquiry_tracking.sql` — already present from Phase 1.
- `128_retail_sales_spine.sql` — orders, order lines, fulfillment records, command receipts, commercial events, delivery attempts, and reciprocal source links.
- `129_invoice_money_snapshots.sql` — immutable issued-invoice money/cost/FX snapshots.
- `130_payment_ledger.sql` — transactions, allocations, refunds, refund allocations, provider events, and reconciliation records.
- `131_wholesale_operating_ledger.sql` — reservations, shipments, receipts, cost layers, bills, and wholesale command receipts.

Do not renumber these migrations after any one is committed. Provider-specific credentials, production webhook activation, real-value payments, deployment, and publication remain human gates.

## Task 1: Integrate the committed Tea Master sales contracts

**Files:**
- Add from `codex/tea-master-sales-v1`: `worker/migrations/126_tea_master_sales.sql`
- Add from `codex/tea-master-sales-v1`: `worker/src/teaMasterSales.ts`
- Add from `codex/tea-master-sales-v1`: Tea Master sales tests and admin components
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/mcp.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/admin/components/QuickInvoiceModal.tsx`
- Modify: `src/admin/components/OrdersView.tsx`
- Test: `worker/tests/tea-master-sales-domain.test.ts`
- Test: `worker/tests/tea-master-sales-routes.test.ts`
- Test: existing Phase 1 invoice/inquiry suites

- [ ] **Step 1: Record the committed integration range and dirty-worktree exclusion**

Use only committed objects from `48061f61^..1ed13cf1`. `1ed13cf1e934a28af42c964612e6ffabd24f30f1` is the exact source checkpoint selected for integration. Do not copy, stage, or clean the source worktree's uncommitted `src/components/AccountPanel/LaunchpadView.test.tsx` or `tests/account-panel-mobile.spec.ts` changes.

Run:

```bash
git diff --name-status 48061f61^..1ed13cf1
git status --short
```

Expected: the current sales worktree is clean except for this plan; the source range contains migration 126, `teaMasterSales.ts`, routes, tests, grants, attribution, reservations, and settlement UI.

- [ ] **Step 2: Write the failing integration contract test**

Create `worker/tests/sales-phase-integration.test.ts` proving both branches' contracts coexist:

```ts
it('keeps Phase 1 validation while snapshotting authorized Tea Master attribution', async () => {
  const invalid = await createInvoice({ quantity: -1, sold_by_user_id: 'seller-a' });
  expect(invalid.status).toBe(400);
  expect(db.invoices).toHaveLength(0);

  const created = await createInvoice({
    sold_by_user_id: 'seller-a',
    lineItems: [{ product_id: 'tea-a', quantity: 25, price_at_sale: 1 }],
  });
  expect(created.status).toBe(201);
  expect(db.invoiceLines[0]).toMatchObject({
    stock_owner_user_id: 'owner-a',
    sales_grant_id: 'grant-a',
  });
});

it('keeps one account-scoped reservation after an idempotent retry', async () => {
  await reserveInvoice('invoice-a', 'reserve-a');
  await reserveInvoice('invoice-a', 'reserve-a');
  expect(db.activeHolds('invoice-a')).toEqual([{ product_id: 'tea-a', held_grams: 25 }]);
});
```

- [ ] **Step 3: Run the integration contract and verify RED**

Run:

```bash
npx vitest run worker/tests/sales-phase-integration.test.ts
```

Expected: FAIL because migration 126 and `teaMasterSales.ts` are absent from this branch.

- [ ] **Step 4: Integrate the committed contracts without replacing Phase 1**

Apply the committed Tea Master range in order. Resolve shared files manually with these invariants:

```ts
const validated = validateRetailInvoiceInput(rawInvoice);
const authorized = await authorizeInvoiceLines(env, {
  accountId: ctx.accountId,
  actorUserId: ctx.userId,
  actorRole: ctx.role,
  lines: validated.lineItems,
});
```

Validation and account ownership run before authorization, sequence allocation, reservation construction, or writes. Preserve Phase 1 inquiry security, account/JWT inbox fencing, currency conversion, lifecycle claim tokens, split/link fencing, and migration 127. Preserve Tea Master `sales_grants`, line snapshots, seller/payment-recipient snapshots, reservation helpers, and settlement builders. Migration rehearsal must expect 127 as the current tail until migration 128 is added.

- [ ] **Step 5: Verify both suites and commit**

Run:

```bash
npx vitest run worker/tests/sales-phase-integration.test.ts worker/tests/tea-master-sales-domain.test.ts worker/tests/tea-master-sales-routes.test.ts worker/tests/invoice-write-validation.test.ts worker/tests/invoice-split-link-concurrency.test.ts worker/tests/inquiry-security.test.ts
npm run lint
npm run lint:colors
git diff --check
```

Expected: all tests and checks pass.

Commit:

```bash
git add worker/migrations/126_tea_master_sales.sql worker/schema.sql worker/src/teaMasterSales.ts worker/src/index.ts worker/src/mcp.ts worker/tests src/lib/api.ts src/admin/components
git commit -m "feat: integrate Tea Master sales contracts"
```

## Task 2: Add the canonical retail order and fulfillment records

**Files:**
- Create: `worker/migrations/128_retail_sales_spine.sql`
- Create: `worker/src/retailSalesDomain.ts`
- Create: `worker/src/retailSalesService.ts`
- Create: `worker/src/stockMovementService.ts`
- Create: `worker/tests/retail-sales-domain.test.ts`
- Create: `worker/tests/retail-sales-routes.test.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/src/inventoryDomain.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/mcp.ts`
- Modify: `worker/tests/stock-movements.test.ts`

- [ ] **Step 1: Write failing domain tests for explicit state machines and idempotency**

```ts
describe('retail sales commands', () => {
  it.each([
    ['draft', 'confirmed', true],
    ['confirmed', 'cancelled', true],
    ['cancelled', 'confirmed', false],
  ])('order %s -> %s allowed=%s', (from, to, allowed) => {
    expect(canTransitionOrder(from, to)).toBe(allowed);
  });

  it('replays the same command and rejects a changed fingerprint', () => {
    const receipt = commandReceipt('accept_inquiry', 'accept-a', { inquiry_id: 'inq-a' });
    expect(receipt.replay({ inquiry_id: 'inq-a' })).toMatchObject({ replay: true });
    expect(() => receipt.replay({ inquiry_id: 'inq-b' })).toThrow('idempotency_conflict');
  });

  it('does not derive payment or fulfillment from invoice state', () => {
    expect(deriveCommercialState({ order: 'confirmed', invoice: 'issued', allocatedMinor: 0, fulfilledMinor: 0 }))
      .toEqual({ payment: 'unpaid', fulfillment: 'unallocated' });
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run worker/tests/retail-sales-domain.test.ts`

Expected: FAIL because the retail sales domain does not exist.

- [ ] **Step 3: Add migration 128 and mirror it in the schema**

The migration creates the following additive contract:

```sql
CREATE TABLE sales_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_id TEXT,
  source_inquiry_id TEXT,
  state TEXT NOT NULL CHECK(state IN ('draft','confirmed','cancelled')),
  transaction_currency TEXT NOT NULL,
  fx_rate_to_usd REAL NOT NULL,
  sold_by_user_id TEXT,
  payment_recipient_user_id TEXT,
  confirmed_at TEXT,
  cancelled_at TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, order_number),
  UNIQUE(account_id, source_inquiry_id)
);

CREATE TABLE sales_order_lines (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES sales_orders(id),
  product_id TEXT,
  custom_name TEXT,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit TEXT NOT NULL CHECK(unit IN ('g','unit')),
  unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor >= 0),
  transaction_currency TEXT NOT NULL,
  unit_price_usd REAL NOT NULL CHECK(unit_price_usd >= 0),
  cost_amount_minor INTEGER,
  cost_currency TEXT,
  stock_owner_user_id TEXT,
  sales_grant_id TEXT,
  owner_share_type TEXT NOT NULL DEFAULT 'percent',
  owner_share_value REAL NOT NULL DEFAULT 100,
  fulfillment_account_id TEXT NOT NULL
);

CREATE TABLE order_fulfillments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES sales_orders(id),
  state TEXT NOT NULL CHECK(state IN ('unallocated','reserved','partially_fulfilled','fulfilled','partially_returned','returned')),
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_fulfillment_lines (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  fulfillment_id TEXT NOT NULL REFERENCES order_fulfillments(id),
  order_line_id TEXT NOT NULL REFERENCES sales_order_lines(id),
  reserved_quantity REAL NOT NULL DEFAULT 0 CHECK(reserved_quantity >= 0),
  fulfilled_quantity REAL NOT NULL DEFAULT 0 CHECK(fulfilled_quantity >= 0),
  returned_quantity REAL NOT NULL DEFAULT 0 CHECK(returned_quantity >= 0)
);

CREATE TABLE commerce_command_receipts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, command_type, idempotency_key)
);

CREATE TABLE commerce_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE delivery_attempts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('whatsapp','email','copy')),
  state TEXT NOT NULL CHECK(state IN ('pending','channel_opened','sent','failed')),
  provider_reference TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE inquiries ADD COLUMN order_id TEXT;
ALTER TABLE inquiries ADD COLUMN accepted_at TEXT;
ALTER TABLE invoices ADD COLUMN sales_order_id TEXT;
ALTER TABLE invoices ADD COLUMN issued_at TEXT;
```

Add indexes for `(account_id,state,created_at)`, reciprocal source IDs, aggregate events, and fulfillment lines. Historical invoices are not silently backfilled as confirmed orders.

- [ ] **Step 4: Implement pure validation and command decoding**

`retailSalesDomain.ts` exports:

```ts
export type OrderState = 'draft' | 'confirmed' | 'cancelled';
export type FulfillmentState = 'unallocated' | 'reserved' | 'partially_fulfilled' | 'fulfilled' | 'partially_returned' | 'returned';
export function decodeIdempotencyKey(value: unknown): string;
export function fingerprintCommand(value: unknown): Promise<string>;
export function canTransitionOrder(from: OrderState, to: OrderState): boolean;
export function deriveFulfillmentState(lines: FulfillmentLineTotals[]): FulfillmentState;
export function minorFromMajor(value: number, currency: string): number;
```

Reject non-finite/negative money, zero/non-finite quantity, invalid ISO currency after normalizing `NT` to `TWD` and `Yuan` to `CNY`, mixed fulfillment accounts, and invalid transitions.

- [ ] **Step 5: Extract the canonical stock movement service**

Move `applyStockMovement` and its statement builders from `worker/src/index.ts` into `worker/src/stockMovementService.ts`. Preserve the public REST adapter and all existing stock-movement tests. The service signature is:

```ts
export async function applyStockMovement(
  env: { DB: D1Database },
  ctx: { accountId: string; email?: string | null },
  productId: string,
  input: StockMovementInput,
  extras?: MovementExtras,
): Promise<{ status: number; value: Record<string, unknown> }>;
```

All new reservation/fulfillment/return commands use deterministic keys such as `order:{orderId}:fulfill:{lineId}:{cumulativeQuantity}`.

- [ ] **Step 6: Implement the retail sales service and route tests**

`retailSalesService.ts` exposes account-scoped commands:

```ts
acceptInquiry(env, ctx, { inquiryId, idempotencyKey })
confirmOrder(env, ctx, { orderId, expectedState: 'draft', idempotencyKey })
cancelOrder(env, ctx, { orderId, expectedState: 'confirmed', idempotencyKey })
issueInvoice(env, ctx, { orderId, idempotencyKey })
reserveOrder(env, ctx, { orderId, expectedVersion, idempotencyKey })
fulfillOrder(env, ctx, { orderId, lines, expectedVersion, idempotencyKey })
returnOrder(env, ctx, { orderId, lines, expectedVersion, idempotencyKey })
```

`acceptInquiry` atomically links one inquiry, one account-local customer relationship, one order, copied order lines, one unallocated fulfillment, a command receipt, and events. Same-key replay returns the same IDs; another key on an already accepted inquiry returns the existing order without duplicating it. Product ownership is checked before statements are constructed.

Route tests prove account isolation, unchanged-payload replay, changed-payload conflict, concurrent acceptance, reservation underflow denial, partial fulfill/return, and no payment-state mutation.

- [ ] **Step 7: Adapt REST and MCP to the service**

Add REST commands under existing admin surfaces:

```text
POST /api/admin/inquiries/:id/accept
POST /api/admin/orders/:id/confirm
POST /api/admin/orders/:id/cancel
POST /api/admin/orders/:id/issue-invoice
POST /api/admin/orders/:id/reserve
POST /api/admin/orders/:id/fulfillments
POST /api/admin/orders/:id/returns
GET  /api/admin/orders/:id/timeline
```

Require `Idempotency-Key` for every mutation. Add equivalent MCP preview/confirm tools that delegate to the same service. Existing invoice fulfill/void endpoints become compatibility adapters and must not directly mutate stock.

- [ ] **Step 8: Run focused verification and commit**

```bash
npx vitest run worker/tests/retail-sales-domain.test.ts worker/tests/retail-sales-routes.test.ts worker/tests/stock-movements.test.ts worker/tests/admin-fulfillment-concurrency.test.ts worker/tests/mcp-fulfillment.test.ts
npm run lint
npm run lint:colors
git diff --check
git add worker/migrations/128_retail_sales_spine.sql worker/schema.sql worker/src/retailSalesDomain.ts worker/src/retailSalesService.ts worker/src/stockMovementService.ts worker/src/inventoryDomain.ts worker/src/index.ts worker/src/mcp.ts worker/tests
git commit -m "feat: add canonical retail sales spine"
```

## Task 3: Connect inquiry acceptance and explicit commands to the existing UI

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/admin/components/ActivityView.tsx`
- Modify: `src/admin/components/OrdersView.tsx`
- Modify: `src/admin/components/QuickInvoiceModal.tsx`
- Modify: `src/lib/whatsapp.ts`
- Create: `src/admin/components/OrderTimeline.tsx`
- Create: `src/admin/components/OrderTimeline.test.tsx`
- Test: `tests/inquiry-order-conversion.spec.ts`

- [ ] **Step 1: Write failing browser/API behavior tests**

The mounted test must click “Accept and create order” once, retry after a simulated timeout, and assert one order ID, one customer relationship, copied store-correct lines, and a visible timeline. It must also assert that opening WhatsApp renders `Channel opened`, never `Message sent`.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx playwright test tests/inquiry-order-conversion.spec.ts --project='Mobile Chrome'
```

Expected: FAIL because no acceptance control or order timeline exists.

- [ ] **Step 3: Add typed API commands and account-keyed mutations**

Every mutation captures the initiating account ID, checks token scope immediately before the request, supplies a stable idempotency key for retries, invalidates only initiating-account keys, and hides stale results after an account switch.

- [ ] **Step 4: Add acceptance, command controls, and timeline**

Use existing Inquiries and Orders tabs; do not add or rename navigation. Disable conflicting controls while a command is pending. Surface 409 conflicts and retryable failures. Timeline event labels distinguish `Inquiry accepted`, `Order confirmed`, `Invoice issued`, `Stock reserved`, `Partially fulfilled`, `Fulfilled`, `Returned`, `Channel opened`, `Email sent`, and `Delivery failed`.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run src/lib/api.inquiries.test.ts src/admin/components/OrderTimeline.test.tsx
npx playwright test tests/inquiry-order-conversion.spec.ts --project='Mobile Chrome'
npm run lint
npm run lint:colors
git diff --check
git add src/lib/api.ts src/admin/components/ActivityView.tsx src/admin/components/OrdersView.tsx src/admin/components/QuickInvoiceModal.tsx src/admin/components/OrderTimeline.tsx src/admin/components/OrderTimeline.test.tsx src/lib/whatsapp.ts tests/inquiry-order-conversion.spec.ts
git commit -m "feat: connect inquiries to explicit orders"
```

## Task 4: Add immutable invoice money snapshots and payment ledger

**Files:**
- Create: `worker/migrations/129_invoice_money_snapshots.sql`
- Create: `worker/migrations/130_payment_ledger.sql`
- Create: `worker/src/paymentDomain.ts`
- Create: `worker/src/paymentService.ts`
- Create: `worker/tests/payment-domain.test.ts`
- Create: `worker/tests/payment-routes.test.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/mcp.ts`

- [ ] **Step 1: Write failing payment-domain tests**

```ts
it('derives partial, paid, overpaid, refunded, and disputed without invoice flags', () => {
  expect(deriveInvoiceBalance({ issuedMinor: 10000, allocationsMinor: 2500, refundsMinor: 0, disputedMinor: 0 }).state).toBe('partial');
  expect(deriveInvoiceBalance({ issuedMinor: 10000, allocationsMinor: 10000, refundsMinor: 0, disputedMinor: 0 }).state).toBe('paid');
  expect(deriveInvoiceBalance({ issuedMinor: 10000, allocationsMinor: 12000, refundsMinor: 0, disputedMinor: 0 }).state).toBe('overpaid');
  expect(deriveInvoiceBalance({ issuedMinor: 10000, allocationsMinor: 10000, refundsMinor: 10000, disputedMinor: 0 }).state).toBe('refunded');
  expect(deriveInvoiceBalance({ issuedMinor: 10000, allocationsMinor: 10000, refundsMinor: 0, disputedMinor: 10000 }).state).toBe('disputed');
});

it('rejects cross-currency allocation and over-refund', () => {
  expect(() => validateAllocation({ paymentCurrency: 'AUD', invoiceCurrency: 'USD', amountMinor: 100 })).toThrow('currency_mismatch');
  expect(() => validateRefund({ refundableMinor: 100, amountMinor: 101 })).toThrow('refund_exceeds_available');
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run worker/tests/payment-domain.test.ts`

Expected: FAIL because `paymentDomain.ts` does not exist.

- [ ] **Step 3: Add immutable money and payment schema**

Migration 129 creates `invoice_money_snapshots` with one immutable row per issued invoice: `subtotal_minor`, `shipping_minor`, `tax_minor`, `discount_minor`, `total_minor`, transaction/reporting currencies, FX micros, COGS minor, and issued timestamp. Backfill only rows whose currency and base amount provenance is certain; leave ambiguous history absent.

Migration 130 creates:

```sql
CREATE TABLE payment_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('receipt','reversal','chargeback')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed','disputed','reversed')),
  method TEXT NOT NULL,
  external_reference TEXT,
  received_at TEXT NOT NULL,
  recorded_by_user_id TEXT,
  idempotency_key TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id,idempotency_key),
  UNIQUE(provider,provider_event_id)
);

CREATE TABLE payment_allocations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES payment_transactions(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id,transaction_id,invoice_id)
);

CREATE TABLE payment_refunds (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES payment_transactions(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL,
  external_reference TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed')),
  recorded_by_user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id,idempotency_key)
);

CREATE TABLE payment_refund_allocations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  refund_id TEXT NOT NULL REFERENCES payment_refunds(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  UNIQUE(account_id,refund_id,invoice_id)
);

CREATE TABLE payment_provider_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processing_state TEXT NOT NULL CHECK(processing_state IN ('received','processed','failed')),
  error_code TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  UNIQUE(provider,event_id)
);

CREATE TABLE payment_reconciliations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  statement_reference TEXT NOT NULL,
  transaction_id TEXT,
  state TEXT NOT NULL CHECK(state IN ('matched','unmatched','exception')),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  note TEXT,
  reconciled_by_user_id TEXT,
  reconciled_at TEXT,
  UNIQUE(account_id,provider,statement_reference)
);
```

- [ ] **Step 4: Implement the canonical payment domain and service**

Use safe integers only. Normalize legacy display aliases at the boundary. Allocation totals cannot exceed a successful transaction; refund allocations cannot exceed the successful allocated amount; currencies must match. Manual records require amount, method, received time, operator note or reference, recorder, and idempotency key. Provider-event processing is adapter-driven and unique by `(provider,event_id)`; no live provider is enabled in this task.

- [ ] **Step 5: Add REST/MCP commands and compatibility projection**

```text
GET  /api/admin/invoices/:id/payments
POST /api/admin/invoices/:id/payments/manual
POST /api/admin/payments/:id/allocations
POST /api/admin/payments/:id/refunds
POST /api/admin/reconciliation/import
GET  /api/admin/reconciliation
```

MCP `mark_invoice_paid` becomes a compatibility preview/confirm wrapper around one successful manual transaction plus allocation. It never writes `payment_status` directly. A transaction trigger/service may update the legacy flag as a compatibility projection, but all reads and reporting derive from ledger rows.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run worker/tests/payment-domain.test.ts worker/tests/payment-routes.test.ts worker/tests/mcp-fulfillment.test.ts
npm run lint
npm run lint:colors
git diff --check
git add worker/migrations/129_invoice_money_snapshots.sql worker/migrations/130_payment_ledger.sql worker/schema.sql worker/src/paymentDomain.ts worker/src/paymentService.ts worker/src/index.ts worker/src/mcp.ts worker/tests
git commit -m "feat: add immutable payment ledger"
```

## Task 5: Add payment and reconciliation controls to existing order surfaces

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/admin/components/OrdersView.tsx`
- Create: `src/admin/components/PaymentLedgerPanel.tsx`
- Create: `src/admin/components/PaymentLedgerPanel.test.tsx`
- Create: `tests/manual-payment-reconciliation.spec.ts`

- [ ] **Step 1: Write failing behavior coverage**

Cover partial manual payment, second payment to paid, overpayment warning, partial refund, duplicate save replay, failed reconciliation import, and account switch during a mutation. Assert the invoice lifecycle label does not change when payment state changes.

- [ ] **Step 2: Verify RED**

Run: `npx playwright test tests/manual-payment-reconciliation.spec.ts --project='Mobile Chrome'`

Expected: FAIL because the payment ledger panel does not exist.

- [ ] **Step 3: Implement the panel inside Orders detail**

Do not add navigation. Show immutable rows, allocated amount, refunded amount, derived balance/state, provider/reference, recorder, and reconciliation state. Manual entry and refund controls require explicit confirmation and stable retry keys. Never display or log unredacted sensitive provider metadata.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run src/admin/components/PaymentLedgerPanel.test.tsx src/lib/api.sales.test.ts
npx playwright test tests/manual-payment-reconciliation.spec.ts --project='Mobile Chrome'
npm run lint
npm run lint:colors
git diff --check
git add src/lib/api.ts src/admin/components/OrdersView.tsx src/admin/components/PaymentLedgerPanel.tsx src/admin/components/PaymentLedgerPanel.test.tsx tests/manual-payment-reconciliation.spec.ts
git commit -m "feat: record and reconcile order payments"
```

## Task 6: Build canonical store and network reporting plus customer continuity

**Files:**
- Create: `worker/src/salesReporting.ts`
- Create: `worker/tests/sales-reporting.test.ts`
- Create: `worker/tests/customer-cross-store-orders.test.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/mcp.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/admin/components/DashboardView.tsx`
- Modify: customer order pages only as required for merchant identity
- Test: `tests/sales-reporting-account-switch.spec.ts`

- [ ] **Step 1: Write failing metric-definition tests**

Fixtures must prove inquiry value, booked sales, issued receivables, fulfilled sales, cash collected, outstanding receivables, refunds, net collected sales, COGS, margin, and seller payable are distinct. Draft/unpaid invoices must not inflate cash; fulfillment must not imply payment; refunds reduce net collected; FX uses the sale-time snapshot.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run worker/tests/sales-reporting.test.ts worker/tests/customer-cross-store-orders.test.ts`

Expected: FAIL because no canonical reporting module/global self-history exists.

- [ ] **Step 3: Implement one reporting module used everywhere**

`salesReporting.ts` exports account and network projections. REST revenue/RFM handlers and MCP `sales_summary` delegate to it. Account reports require the active account and financial-report capability. Network aggregation requires platform owner/admin authority and is read-only; every row contains the source account and declared reporting currency. Seller payable reads `sales_settlements`; it never recalculates a second settlement model.

- [ ] **Step 4: Make signed-in customer order history cross-store and CRM-private**

Resolve the authenticated user globally through `customers.user_id`, return merchant name/slug/contact plus public order/payment/fulfillment projections, and never return store-private notes, tags, CRM contacts, or another customer's records. Store admin customer history remains account-local.

- [ ] **Step 5: Make dashboards account-switch safe**

Replace one-time effects with account-keyed React Query calls gated on matching token scope. Suppress cached prior-account metrics during switches and show an unavailable/retry state instead of zeros on errors.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run worker/tests/sales-reporting.test.ts worker/tests/customer-cross-store-orders.test.ts worker/tests/customer-order-detail.test.ts
npx playwright test tests/sales-reporting-account-switch.spec.ts tests/order-detail.spec.ts --project='Mobile Chrome'
npm run lint
npm run lint:colors
git diff --check
git add worker/src/salesReporting.ts worker/src/index.ts worker/src/mcp.ts worker/tests src/lib/api.ts src/admin/components/DashboardView.tsx src/pages tests
git commit -m "feat: unify sales reporting and customer history"
```

## Task 7: Disable unsafe wholesale receiving and add the conserved wholesale ledger

**Files:**
- Create: `worker/migrations/131_wholesale_operating_ledger.sql`
- Create: `worker/src/wholesaleDomain.ts`
- Create: `worker/src/wholesaleService.ts`
- Create: `worker/tests/wholesale-domain.test.ts`
- Create: `worker/tests/wholesale-stock-conservation.test.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/inventoryDomain.ts`

- [ ] **Step 1: Write the failing safety gate and conservation tests**

```ts
it('never executes the legacy receive side effects', async () => {
  const response = await legacyTransition('order-a', 'received');
  expect(response.status).toBe(409);
  expect(db.stockTotal()).toBe(1000);
  expect(db.publicBuyerListings()).toHaveLength(0);
});

it('conserves stock across partial shipment, receipt, rejection, and retry', async () => {
  await confirm({ quantity: 100, key: 'confirm-a' });
  await ship({ quantity: 80, key: 'ship-a' });
  await receive({ accepted: 60, rejected: 10, key: 'receive-a' });
  await receive({ accepted: 60, rejected: 10, key: 'receive-a' });
  expect(db.supplierOnHand()).toBe(920);
  expect(db.inTransit()).toBe(10);
  expect(db.buyerOnHand()).toBe(60);
  expect(db.rejected()).toBe(10);
  expect(db.networkConservedTotal()).toBe(1000);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run worker/tests/wholesale-domain.test.ts worker/tests/wholesale-stock-conservation.test.ts`

Expected: FAIL; the legacy receive path clamps/credits/publishes and the new domain is absent.

- [ ] **Step 3: Gate legacy receive before adding new commands**

The old generic transition route returns structured 409 `wholesale_receive_requires_operating_ledger` for `received`. Remove `processReceiveSideEffects` from the reachable path. The Purchase Orders legacy “mark received” action must use the new receipt command or remain disabled; it must never call generic stock increment.

- [ ] **Step 4: Add migration 131**

Create additive tables:

```text
wholesale_reservations(id, account_id, order_id, line_id, product_id, reserved_quantity, remaining_quantity, state, version)
wholesale_shipments(id, supplier_account_id, buyer_account_id, order_id, state, idempotency_key, shipped_at)
wholesale_shipment_lines(id, shipment_id, order_line_id, product_id, quantity, unit)
wholesale_receipts(id, buyer_account_id, shipment_id, state, idempotency_key, received_at)
wholesale_receipt_lines(id, receipt_id, shipment_line_id, accepted_quantity, rejected_quantity, backordered_quantity, buyer_product_id, cost_layer_id)
inventory_cost_layers(id, account_id, product_id, source_type, source_id, quantity, remaining_quantity, unit_cost_minor, currency, fx_rate_to_usd, landed_cost_minor)
supplier_bills(id, buyer_account_id, supplier_account_id, wholesale_order_id, invoice_id, currency, total_minor, state)
supplier_bill_lines(id, bill_id, order_line_id, quantity, unit_price_minor)
```

Use CHECK constraints for nonnegative quantities and explicit states; unique idempotency keys per owning account; unique receipt/line command identities; version columns for CAS.

- [ ] **Step 5: Implement explicit wholesale commands**

`wholesaleService.ts` exposes `confirmWholesale`, `shipWholesale`, `receiveWholesale`, `rejectWholesale`, and `cancelWholesale`. Confirm reserves available supplier stock. Ship cannot exceed remaining reservation and moves stock to an in-transit identity with canonical paired movements. Receipt cannot exceed shipped remainder and supports accepted/rejected/backordered quantities. Accepted stock creates or updates a Draft/private buyer holding (`is_public=0`, `shown_in_shop=0`, non-active listing), records FX/cost basis, and creates supplier AR plus buyer AP documents as issued/unpaid. Receipt never implies payment.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run worker/tests/wholesale-domain.test.ts worker/tests/wholesale-stock-conservation.test.ts worker/tests/stock-movements.test.ts worker/tests/payment-routes.test.ts
npm run lint
npm run lint:colors
git diff --check
git add worker/migrations/131_wholesale_operating_ledger.sql worker/schema.sql worker/src/wholesaleDomain.ts worker/src/wholesaleService.ts worker/src/inventoryDomain.ts worker/src/index.ts worker/tests
git commit -m "feat: conserve wholesale stock and documents"
```

## Task 8: Connect explicit wholesale shipment and receipt operations

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/types.ts`
- Modify: `src/admin/components/WholesaleOrderTimeline.tsx`
- Modify: `src/admin/views/PurchaseOrdersPage.tsx`
- Create: `tests/wholesale-partial-receipt.spec.ts`

- [ ] **Step 1: Write failing mounted workflow coverage**

Cover confirm, partial shipment, partial receipt, rejection, backorder, same-key replay, changed-payload conflict, insufficient supplier stock, buyer private holding, and account-switch suppression. Assert the supplier receivable and buyer bill are unpaid until a payment ledger entry exists.

- [ ] **Step 2: Verify RED**

Run: `npx playwright test tests/wholesale-partial-receipt.spec.ts --project='Mobile Chrome'`

Expected: FAIL because the UI only supports generic transitions/full receive.

- [ ] **Step 3: Add typed explicit commands and timeline controls**

Replace generic receive controls with quantity-aware shipment and receipt forms. Use stable retry keys, disable conflicting transitions while pending, and show server-derived remaining reserved/shipped/backordered quantities. New holdings are labelled `Private draft — review before publishing`.

- [ ] **Step 4: Verify and commit**

```bash
npx playwright test tests/wholesale-partial-receipt.spec.ts --project='Mobile Chrome'
npm run lint
npm run lint:colors
git diff --check
git add src/lib/api.ts src/types.ts src/admin/components/WholesaleOrderTimeline.tsx src/admin/views/PurchaseOrdersPage.tsx tests/wholesale-partial-receipt.spec.ts
git commit -m "feat: operate partial wholesale transfers"
```

## Task 9: Cross-phase attribution, reconciliation, rehearsal, and documentation

**Files:**
- Create: `worker/tests/unified-sales-rehearsal.test.ts`
- Create: `tests/unified-sales-rehearsal.spec.ts`
- Modify: `docs/STATE_OF_THE_SITE.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/CONSOLIDATED_DIRECTION.md` only to mark proven agent-runnable work complete
- Modify: migration rehearsal tests

- [ ] **Step 1: Write the complete synthetic rehearsal**

The Worker rehearsal creates and verifies:

1. Bali inquiry → customer/order → authorized seller snapshots → reserve → partial fulfill → issued invoice → partial manual payment → final payment → partial refund → reconciliation.
2. Australia inquiry and AUD snapshot without cross-account cache/data leakage.
3. Hosted Tea Master sale with grant, seller/stock-owner/payment-recipient attribution, fulfilled settlement owed, payment-derived collected cash, and no automatic split payout.
4. Two-account wholesale confirm/ship/partial receive/reject/backorder with conserved network stock, private buyer holding, cost layer, supplier AR, buyer AP, and no payment implication.
5. Duplicate commands/provider events replay once; changed fingerprints conflict; concurrent claims do not double stock, payment, settlement, or documents.

- [ ] **Step 2: Run the rehearsal RED, then fix only integration defects**

```bash
npx vitest run worker/tests/unified-sales-rehearsal.test.ts
npx playwright test tests/unified-sales-rehearsal.spec.ts --project='Mobile Chrome'
```

Expected on first run: any remaining cross-phase contract mismatch fails with a specific assertion. Fix adapters and schema mirrors; do not create alternative ledgers.

- [ ] **Step 3: Run complete verification**

```bash
npm run test:worker
npm run lint
npm run lint:colors
npm run build
npx playwright test tests/public-cart-store-safety.spec.ts tests/inquiry-order-conversion.spec.ts tests/manual-payment-reconciliation.spec.ts tests/sales-reporting-account-switch.spec.ts tests/wholesale-partial-receipt.spec.ts tests/unified-sales-rehearsal.spec.ts tests/order-detail.spec.ts --project='Mobile Chrome'
git diff --check
```

If the known verification-expiry tolerance flakes, rerun only `worker/tests/verification-routes.test.ts` and report both results honestly.

- [ ] **Step 4: Review against success criteria**

Confirm merchant, fulfiller, seller, stock owner, payment recipient, source inquiry, order, invoice, payment, fulfillment, stock movement, settlement, wholesale shipment, and receipt IDs are traceable. Confirm booked, fulfilled, collected, outstanding, refunded, margin, and payable metrics differ correctly. Confirm no public PII, mixed-store order, stock manufacture, duplicate payment truth, automatic split payout, or live provider activation.

- [ ] **Step 5: Update documentation and commit**

Document only behavior proven by the rehearsal. Explicitly list remaining human gates: real operator acceptance, payment-provider selection/signature credentials, real-value reconciliation, production migration rehearsal/backup, deployment, and real two-store wholesale acceptance.

```bash
git add worker/tests/unified-sales-rehearsal.test.ts tests/unified-sales-rehearsal.spec.ts docs/STATE_OF_THE_SITE.md docs/CHANGELOG.md docs/CONSOLIDATED_DIRECTION.md worker/tests/migration-017-rehearsal.test.ts
git commit -m "test: verify unified sales operating ledger"
```

## Final human and deployment gates

- Do not activate a live payment provider without an explicitly selected provider, signature-verification contract, credentials from Infisical/Cloudflare, duplicate-event rehearsal, and Adrian's approval.
- Do not record real money, mark real settlements paid, publish newly received wholesale inventory, or run real wholesale transfers during automated verification.
- Do not push, merge to main, or deploy until Adrian says `ship`.
- Production rollout requires D1 backup, additive-migration rehearsal on production-shaped data, rollback instructions, and post-deploy account-isolation/ledger reconciliation checks.

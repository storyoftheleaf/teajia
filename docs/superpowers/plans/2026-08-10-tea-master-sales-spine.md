# Tea Master Sales Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Tea Master sell their own stock or explicitly authorized person-owned stock inside one fulfillment account, with accurate reservation, deduction, attribution, and settlement records.

**Architecture:** Preserve the existing rule that one invoice belongs to one fulfillment account and can deduct only products in that account. Add a deep sales authorization module used by invoice creation, reservation, fulfillment, voiding, and MCP flows. Public identity remains the contributor profile; operational authority remains account membership plus bundles and a product-level sales grant.

**Tech Stack:** React 19, TypeScript, Cloudflare Workers, D1/SQLite, Vitest, Playwright, Tailwind v3.

---

### Task 1: Sales authorization and settlement domain

**Files:**
- Create: `worker/migrations/126_tea_master_sales.sql`
- Modify: `worker/schema.sql`
- Create: `worker/src/teaMasterSales.ts`
- Create: `worker/tests/tea-master-sales-domain.test.ts`
- Modify: `worker/tests/tea-master-migrations.test.ts`

- [ ] **Step 1: Write failing domain and migration tests**

Test these exact rules before implementation:

```ts
expect(resolveSalePermission({ actorRole: 'owner', actorUserId: 'adrian', stockOwnerUserId: 'rayi', activeGrant: null }).allowed).toBe(true);
expect(resolveSalePermission({ actorRole: 'staff', actorUserId: 'barry', stockOwnerUserId: null, activeGrant: null }).allowed).toBe(true);
expect(resolveSalePermission({ actorRole: 'staff', actorUserId: 'barry', stockOwnerUserId: 'barry', activeGrant: null }).allowed).toBe(true);
expect(resolveSalePermission({ actorRole: 'staff', actorUserId: 'barry', stockOwnerUserId: 'adrian', activeGrant: null }).allowed).toBe(false);
expect(resolveSalePermission({ actorRole: 'staff', actorUserId: 'barry', stockOwnerUserId: 'adrian', activeGrant: validGrant }).allowed).toBe(true);
expect(calculateSettlement({ gross: 100, ownerShareType: 'percent', ownerShareValue: 80 })).toEqual({ ownerAmount: 80, sellerAmount: 20 });
```

The migration rehearsal must prove foreign-key integrity and immutable fulfilled settlement history.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run worker/tests/tea-master-sales-domain.test.ts worker/tests/tea-master-migrations.test.ts`

Expected: failure because migration 126 and `teaMasterSales` do not exist.

- [ ] **Step 3: Add the schema**

Create:

```sql
CREATE TABLE sales_grants (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id TEXT NOT NULL REFERENCES users(id),
  price_floor REAL,
  owner_share_type TEXT NOT NULL DEFAULT 'percent' CHECK(owner_share_type IN ('percent','fixed')),
  owner_share_value REAL NOT NULL DEFAULT 100,
  quantity_limit REAL,
  starts_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sales_settlements (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  line_item_id TEXT NOT NULL REFERENCES invoice_line_items(id),
  product_id TEXT REFERENCES products(id),
  stock_owner_user_id TEXT REFERENCES users(id),
  seller_user_id TEXT NOT NULL REFERENCES users(id),
  grant_id TEXT REFERENCES sales_grants(id),
  gross_amount REAL NOT NULL,
  owner_amount REAL NOT NULL,
  seller_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'owed' CHECK(status IN ('owed','paid','reversed')),
  reversed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, line_item_id)
);

ALTER TABLE invoices ADD COLUMN sold_by_user_id TEXT REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN payment_recipient_user_id TEXT REFERENCES users(id);
ALTER TABLE invoice_line_items ADD COLUMN stock_owner_user_id TEXT REFERENCES users(id);
ALTER TABLE invoice_line_items ADD COLUMN sales_grant_id TEXT REFERENCES sales_grants(id);
```

Add account/product/seller and settlement status indexes. Mirror the exact schema in `worker/schema.sql`.

- [ ] **Step 4: Implement the pure domain module**

Export typed `resolveSalePermission`, `validateGrantTerms`, `calculateSettlement`, and `isGrantActive`. Keep database access out of this file.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npx vitest run worker/tests/tea-master-sales-domain.test.ts worker/tests/tea-master-migrations.test.ts`

Expected: all pass.

### Task 2: Worker sales contracts and invoice invariants

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/src/mcp.ts`
- Create: `worker/tests/tea-master-sales-routes.test.ts`
- Modify: `worker/tests/invoice-domain.test.ts`
- Modify: `worker/tests/mcp-fulfillment.test.ts`

- [ ] **Step 1: Write failing route tests**

Cover:

```ts
// Owner or the product owner can grant an active account member permission.
POST /api/sales/grants
GET /api/sales/grants?product_id=:productId
PUT /api/sales/grants/:id
DELETE /api/sales/grants/:id
GET /api/sales/eligible-products
GET /api/sales/settlements?mine=1
PUT /api/sales/settlements/:id
```

Prove a staff seller cannot invoice Adrian-owned stock without a grant, can invoice it with a grant, cannot go below the grant price floor or quantity limit, and cannot use a grant from another account. Prove invoice creation snapshots `sold_by_user_id`, `stock_owner_user_id`, and `sales_grant_id`.

Prove changing Draft to Pending replaces invoice holds atomically and rejects insufficient available stock after subtracting other unexpired holds. Prove fulfillment deletes holds and creates one settlement per stocked line. Prove void restores stock and marks the settlement reversed. Prove MCP record/fulfill paths use the same permission and settlement functions.

- [ ] **Step 2: Run route tests and verify RED**

Run: `npx vitest run worker/tests/tea-master-sales-routes.test.ts worker/tests/invoice-domain.test.ts worker/tests/mcp-fulfillment.test.ts`

Expected: missing routes and missing attribution fields.

- [ ] **Step 3: Add one deep Worker seam**

Inside the Worker, centralize these operations rather than duplicating query logic:

```ts
authorizeInvoiceLines(env, { accountId, actorUserId, actorRole, lines })
replaceInvoiceReservations(env, { accountId, invoiceId, lines, expiresAt })
buildSettlementStatements(env, { accountId, invoice, lines })
buildSettlementReversalStatements(env, { accountId, invoiceId })
```

Invoice creation and item replacement must call `authorizeInvoiceLines`. Draft invoices do not hold stock. The Draft to Pending transition must call `replaceInvoiceReservations` before changing status. Fulfillment must validate against physical stock while excluding that invoice's own hold, then deduct, release holds, and create settlements in the same D1 batch. Void must restore stock and reverse settlements in the same batch.

- [ ] **Step 4: Add grants and settlement routes**

Grant writes require the active account. Allow account owner-tier users to grant any product; allow a product owner to grant only their own product. The recipient must be an active member with Sell access. `DELETE` revokes instead of erasing history.

Eligible products return only location-owned stock, the actor's own stock, owner-tier access, or active grants. Return product name, owner name, physical stock, held stock, available stock, price floor, grant id, and permission reason.

Settlement reads expose only account owner-tier users or rows where the current user is seller or stock owner. Only owner-tier users may mark settlements paid.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run worker/tests/tea-master-sales-routes.test.ts worker/tests/invoice-domain.test.ts worker/tests/mcp-fulfillment.test.ts`

Expected: all pass.

### Task 3: Sales UI and Tea Master connections

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/admin/types.ts`
- Create: `src/admin/components/sales/salesDomain.ts`
- Create: `src/admin/components/sales/salesDomain.test.ts`
- Create: `src/admin/components/sales/SalesPermissionsPanel.tsx`
- Create: `src/admin/components/sales/SettlementLedger.tsx`
- Modify: `src/admin/components/QuickInvoiceModal.tsx`
- Modify: `src/admin/components/OrdersView.tsx`
- Modify: `src/admin/components/ProductEditPanel.tsx`
- Modify: `src/pages/AccountProfilePage.tsx`
- Modify: `src/pages/AccountSettingsPage.tsx`
- Modify: `src/components/AccountPanel/LaunchpadView.tsx`
- Modify: `tests/account-panel-mobile.spec.ts`

- [ ] **Step 1: Write failing UI tests**

Prove the product picker hides ineligible person-owned stock, labels eligible rows with stock owner and available quantity, explains grant price floors, and blocks invalid prices before submission. Prove order detail shows Seller, Stock owner, Fulfilled by, and settlement status. Prove product editing exposes “Allow another Tea Master to sell” only to the account owner or stock owner.

Prove Your Table provides a Sell entry only when the active membership has Sell access. It must open the existing `/admin/activity?tab=orders` surface, so public navigation and tab labels remain unchanged. Prove Profile and Settings link to each other and Profile links to Stock only when the hosted Tea Master account is active with Stock access.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npx vitest run src/admin/components/sales/salesDomain.test.ts src/admin/components/QuickInvoiceModal.test.tsx src/admin/components/OrdersView.test.tsx src/pages/AccountProfilePage.test.tsx src/pages/AccountSettingsPage.test.tsx`

Expected: missing sales UI and types.

- [ ] **Step 3: Add typed API methods and pure presentation helpers**

Add `api.sales.grants`, `api.sales.eligibleProducts`, and `api.sales.settlements`. Keep eligibility and label formatting in `salesDomain.ts`, not duplicated across components.

- [ ] **Step 4: Build the connected interfaces**

Use the existing quiet editorial admin language and semantic color tokens. Avoid a new public navigation label. Product edit gets the permission panel; Orders gets seller/owner/settlement details and a settlement ledger view; Quick Invoice consumes eligible products and shows explicit attribution. Every async surface needs loading, empty, error, and retry states.

Add a Your Table Sell tile only for Sell-capable memberships. Add reciprocal Profile and Settings links so public identity, store operation, and login security are not confused.

- [ ] **Step 5: Verify focused and browser behavior**

Run:

```bash
npx vitest run src/admin/components/sales/salesDomain.test.ts src/admin/components/QuickInvoiceModal.test.tsx src/admin/components/OrdersView.test.tsx src/pages/AccountProfilePage.test.tsx src/pages/AccountSettingsPage.test.tsx
npm run lint
npm run lint:colors
npm run build
npm run test:mobile
```

Expected: all relevant tests pass, no horizontal overflow, AccountPanel routes remain reachable, and InventoryView retains its internal scroll height.

### Task 4: Integrated review and documentation

**Files:**
- Modify: `docs/MULTI_STORE_PLAN.md`
- Modify: `docs/STATE_OF_THE_SITE.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Run the full Worker suite**

Run: `npx vitest run worker/tests`

Expected: all Worker tests pass.

- [ ] **Step 2: Review security and tenancy**

Confirm grants never cross account boundaries, an ordinary seller cannot list private owner or payment fields, invoice writes fail closed on database errors, settlement history survives grant revocation, and voiding reverses both inventory and money records.

- [ ] **Step 3: Update product truth**

Document that same-location authorized selling is shipped. Keep cross-account physical allocation, cross-location fulfillment, automatic payouts, partial returns, and marketplace payment capture explicitly deferred.

- [ ] **Step 4: Final verification**

Run: `git diff --check && npm run lint && npm run lint:colors && npm run build`

Expected: clean output and a production build.

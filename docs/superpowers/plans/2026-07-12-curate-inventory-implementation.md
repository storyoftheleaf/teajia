# Curate and Purpose-Based Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Curate's current one-tap field capture while adding durable Import, clearer decision and journey context, purpose-based physical Inventory, reviewed receipts, readiness signals, and movement-first stock.

**Architecture:** Curate remains the identity and knowledge layer. Inventory remains the account-scoped physical layer. New schemas and fields are additive and compatibility-first: legacy Compass status, product flags, publication gates, sample operations, CSV import, and stock writers remain readable until every replacement path is verified. Each task uses red-green TDD and produces a reversible commit.

**Tech Stack:** React 19, TypeScript, Zustand, React Query, Vite 6, Tailwind v3, Cloudflare Workers, D1, R2, Vitest, Playwright.

**Source design:** `docs/superpowers/specs/2026-07-12-curate-inventory-ingestion-design.md`

**Implementation defaults:**

- Curate decision values: `null | considering | selected | passed_on`.
- Classification readiness field: existing tea `type`.
- Description readiness field: existing product `description`.
- Retail readiness field: positive effective retail price.
- Stock readiness: an explicitly known quantity; zero is Ready but unavailable. Add `stock_known_at` rather than inferring knowledge from `stock_grams = 0`.
- Tea readiness only. Teaware remains `not_applicable` until separately designed.
- Samples remain two concepts: physical Sample holding and operational `TeaSample` portion/set.
- Incoming is derived from open receipt lines, never an Inventory purpose.

---

## File and module map

### New focused modules

- `src/components/TeaCompass/import/*` — temporary Import panel, evidence input, batch review, item correction.
- `src/components/TeaCompass/DecisionControl.tsx` — independent sourcing decision.
- `src/components/TeaCompass/EncounterContext.tsx` — quiet current Journey/Visit line.
- `src/components/TeaCompass/JourneyVisitSheet.tsx` — optional context editor.
- `src/components/TeaCompass/LibraryFilterSheet.tsx` — dimensional Library filters.
- `src/components/TeaCompass/SampleOrderAction.tsx` — persistent sample-cart access.
- `src/admin/components/inventory/domain.ts` — pure purpose/readiness/publication helpers.
- `src/admin/components/inventory/StockMovementPanel.tsx` — explicit stock changes.
- `src/admin/components/inventory/IncomingReceiptsPanel.tsx` — expected and partial receipts.
- `worker/src/curateImports.ts` — account-scoped import persistence handlers.
- `worker/src/inventoryDomain.ts` — purpose compatibility, receipts, readiness, movement primitives.

### Existing large files changed only at integration seams

- `src/components/TeaCompass/index.tsx`
- `src/components/TeaCompass/CaptureCard.tsx`
- `src/components/TeaCompass/BrowseView.tsx`
- `src/admin/components/InventoryView.tsx`
- `src/admin/components/ProductEditPanel.tsx`
- `worker/src/index.ts`

Do not broadly refactor these files while implementing this plan.

---

### Task 1: Characterize and freeze current Curate and sample behavior

**Files:**
- Modify: `tests/compass-capture.spec.ts`
- Create: `tests/compass-responsive.spec.ts`
- Create: `tests/compass-samples-parity.spec.ts`

- [x] **Step 1: Write authenticated API mocks shared by these tests**

Use the existing `inventory-scroll.spec.ts` pattern. Mock `/api/auth/me`, `/api/auth/refresh`, `/api/products`, `/api/rates`, `/api/compass/incoming`, and account membership endpoints. Required controls must fail loudly; do not use conditional `if (count())` assertions.

- [x] **Step 2: Add preservation assertions**

Assert on Desktop and Mobile Chrome:

```ts
await expect(page.getByRole('tab', { name: 'Source' })).toHaveAttribute('aria-selected', 'true');
await expect(page.getByRole('tab', { name: 'Tea' })).toHaveAttribute('aria-selected', 'true');
await expect(page.getByPlaceholder('Tea name (e.g., Tieguanyin, Earl Grey)')).toBeVisible();
await expect(page.getByPlaceholder('Price')).toBeVisible();
await expect(page.getByRole('tab', { name: 'Teaware' })).toBeVisible();
```

Also assert session switching, no horizontal document overflow, bottom-nav clearance, Samples opening `SampleCartPanel`, empty-cart start, count-bearing nonempty cart, and durable sample-set storage. Characterize the current `/admin/samples` redirect honestly. If historical set, label, or tasting UI is not runtime-reachable, record that verified baseline gap explicitly rather than fabricating coverage; Task 8 must integrate it before Samples moves.

- [x] **Step 3: Run preservation tests**

```bash
npx playwright test tests/compass-capture.spec.ts tests/compass-responsive.spec.ts tests/compass-samples-parity.spec.ts --project="Desktop Chrome" --reporter=list
npx playwright test tests/compass-capture.spec.ts tests/compass-responsive.spec.ts tests/compass-samples-parity.spec.ts --project="Mobile Chrome" --reporter=list
```

Expected: existing behavior tests pass. Any baseline product gap must be recorded explicitly before feature work, and future desired behavior belongs in the task that implements it.

- [x] **Step 4: Commit**

```bash
git add tests/compass-capture.spec.ts tests/compass-responsive.spec.ts tests/compass-samples-parity.spec.ts
git commit -m "test(curate): lock capture and sample behavior"
```

---

### Task 2: Make every deliberate Curate fragment saveable and resumable

**Files:**
- Create: `src/lib/teaCompassStore.test.ts`
- Modify: `src/lib/teaCompassStore.ts`
- Modify: `src/components/TeaCompass/types.ts`
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/components/TeaCompass/CaptureCard.tsx`
- Modify: `src/components/TeaCompass/SessionStack.tsx`
- Modify: `src/components/TeaCompass/BatchCaptureRow.tsx`
- Modify: `tests/compass-capture.spec.ts`

- [x] **Step 1: Write failing meaningful-fragment tests**

Test price, retail price, type, origin, year, form, classification/decision, buying quantity, teaware quantity/material/category, vendor, photo, and thread-note individually. Test untouched auto-created entry is discarded.

Desired contract:

```ts
expect(entryHasDeliberateInput({ ...blank, touchedFields: ['price'] })).toBe(true);
expect(entryHasDeliberateInput({ ...blank, touchedFields: [] })).toBe(false);
```

- [x] **Step 2: Verify RED**

```bash
npx vitest run src/lib/teaCompassStore.test.ts
```

Expected: FAIL because `touchedFields` and the unified predicate do not exist.

- [x] **Step 3: Implement one deliberate-input contract**

Add client metadata:

```ts
touchedFields: string[];
```

Every field updater records the field key. Default inherited currency/vendor values do not count until changed or confirmed. Replace all divergent emptiness checks in store, category switching, commit continuation, cleanup, and session remaining-entry logic with `entryHasDeliberateInput`.

Persist meaningful `pendingEntries`, `activeEntryId`, `sessionEntryIds`, touched metadata, category, and account scope with a Zustand storage version/migration. Do not persist blank shells. Rehydrate only drafts for the active account.

- [x] **Step 4: Verify GREEN**

```bash
npx vitest run src/lib/teaCompassStore.test.ts
npx playwright test tests/compass-capture.spec.ts --project="Desktop Chrome" --reporter=list
npx playwright test tests/compass-capture.spec.ts --project="Mobile Chrome" --reporter=list
```

Expected: all deliberate fragments survive Done and refresh; blank shell does not accumulate.

- [x] **Step 5: Commit**

```bash
git add src/lib/teaCompassStore.ts src/lib/teaCompassStore.test.ts src/components/TeaCompass/types.ts src/components/TeaCompass/index.tsx src/components/TeaCompass/CaptureCard.tsx src/components/TeaCompass/SessionStack.tsx src/components/TeaCompass/BatchCaptureRow.tsx tests/compass-capture.spec.ts
git commit -m "fix(curate): preserve every deliberate field fragment"
```

---

### Task 3: Harden Compass storage and add independent decision

**Files:**
- Create: `worker/tests/compass-storage.test.ts`
- Create: `worker/tests/compass-decision.test.ts`
- Create: `worker/migrations/099_compass_decision.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/teaCompassSync.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/components/TeaCompass/types.ts`

- [x] **Step 1: Write failing Worker tests**

Cover price-only create/sync/list, unknown update key `400`, ignored client ownership fields, cross-account isolation, partial sync preservation, JSON serialization, nullable decisions, invalid decision `400`, verdict/status independence, and no automatic Selected inference.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/compass-storage.test.ts worker/tests/compass-decision.test.ts
```

- [x] **Step 3: Add migration and shared codec**

Migration:

```sql
ALTER TABLE tea_compass_entries ADD COLUMN decision TEXT;
CREATE INDEX idx_compass_account_decision ON tea_compass_entries(account_id, decision);
```

Create a shared `COMPASS_COLUMNS` allowlist and JSON codec used by create, update, and sync. Replace arbitrary update-column interpolation. Replace `INSERT OR REPLACE` with `INSERT ... ON CONFLICT(id) DO UPDATE` while preserving ownership and unspecified fields.

Type:

```ts
export type CompassDecision = 'considering' | 'selected' | 'passed_on';
decision?: CompassDecision | null;
```

- [x] **Step 4: Verify GREEN**

```bash
npx vitest run worker/tests/compass-storage.test.ts worker/tests/compass-decision.test.ts
npm run lint
```

- [x] **Step 5: Commit**

```bash
git add worker/tests/compass-storage.test.ts worker/tests/compass-decision.test.ts worker/migrations/099_compass_decision.sql worker/schema.sql worker/src/index.ts src/lib/teaCompassSync.ts src/lib/api.ts src/components/TeaCompass/types.ts
git commit -m "feat(curate): add safe Compass decision storage"
```

---

### Task 4: Add Journey and Visit context without capture setup

**Files:**
- Create: `worker/migrations/100_curate_context.sql`
- Create: `worker/tests/curate-context.test.ts`
- Create: `src/components/TeaCompass/EncounterContext.tsx`
- Create: `src/components/TeaCompass/JourneyVisitSheet.tsx`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/teaCompassSync.ts`
- Modify: `src/lib/teaCompassStore.ts`
- Modify: `src/components/TeaCompass/types.ts`
- Modify: `src/components/TeaCompass/CaptureCard.tsx`
- Modify: `tests/compass-capture.spec.ts`
- Create: `tests/compass-library.spec.ts`

- [x] **Step 1: Write failing API and UI tests**

Test optional context, Visit without Journey, account ownership, vendor snapshot, multiple Visits per Journey, inherited recent context, clearing, editing afterward, and capture beginning with no context.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/curate-context.test.ts
npx playwright test tests/compass-capture.spec.ts tests/compass-library.spec.ts --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Implement additive context schema and endpoints**

Create account-scoped `curate_journeys` and `curate_visits`; add nullable `journey_id` and `visit_id` to entries. Routes:

```text
GET/POST /api/curate/journeys
PUT/DELETE /api/curate/journeys/:id
GET/POST /api/curate/visits
PUT/DELETE /api/curate/visits/:id
```

The capture UI shows one quiet line such as `Taiwan, Spring 2026 · Chen Family`. It inherits context but never requires it. The six-hour session remains separate.

- [x] **Step 4: Verify GREEN**

```bash
npx vitest run worker/tests/curate-context.test.ts
npx playwright test tests/compass-capture.spec.ts tests/compass-library.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
npm run lint:colors
```

- [x] **Step 5: Commit**

```bash
git add worker/migrations/100_curate_context.sql worker/tests/curate-context.test.ts worker/schema.sql worker/src/index.ts src/lib/api.ts src/lib/teaCompassSync.ts src/lib/teaCompassStore.ts src/components/TeaCompass/types.ts src/components/TeaCompass/EncounterContext.tsx src/components/TeaCompass/JourneyVisitSheet.tsx src/components/TeaCompass/CaptureCard.tsx tests/compass-capture.spec.ts tests/compass-library.spec.ts
git commit -m "feat(curate): add optional journey and visit context"
```

---

### Task 5: Build durable Import provenance and review API

**Files:**
- Create: `worker/migrations/101_curate_imports.sql`
- Create: `worker/src/curateImports.ts`
- Create: `worker/tests/curate-imports.test.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`

- [x] **Step 1: Write failing import persistence tests**

Test byte-for-byte pasted text, ordered items, source kinds, confidence/uncertainty JSON, accept idempotency, merge, abandon behavior, refresh durability, and foreign-account `404`.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/curate-imports.test.ts
```

- [x] **Step 3: Implement schema and handlers**

Create `curate_import_batches`, `curate_import_sources`, and `curate_import_items` as defined in the design. Store R2 object keys, never base64 in D1. Accepting an item creates/links one Compass entry but creates no product or stock.

Routes:

```text
POST /api/curate/imports
GET /api/curate/imports/:id
POST /api/curate/imports/:id/sources
PUT /api/curate/imports/:id/items/:itemId
POST /api/curate/imports/:id/items/:itemId/accept
POST /api/curate/imports/:id/items/:itemId/merge
```

- [x] **Step 4: Verify GREEN**

```bash
npx vitest run worker/tests/curate-imports.test.ts worker/tests/compass-storage.test.ts
npm run lint
```

- [x] **Step 5: Commit**

```bash
git add worker/migrations/101_curate_imports.sql worker/src/curateImports.ts worker/tests/curate-imports.test.ts worker/schema.sql worker/src/index.ts src/lib/api.ts
git commit -m "feat(curate): add durable import provenance"
```

---

### Task 6: Build the non-destructive Import panel and grouped batch review

**Files:**
- Create: `src/components/TeaCompass/import/ImportPanel.tsx`
- Create: `src/components/TeaCompass/import/ImportInput.tsx`
- Create: `src/components/TeaCompass/import/ImportBatchReview.tsx`
- Create: `src/components/TeaCompass/import/ImportItemRow.tsx`
- Create: `src/components/TeaCompass/import/ImportEvidencePreview.tsx`
- Create: `src/components/TeaCompass/import/importTypes.ts`
- Create: `src/components/TeaCompass/ImportBatchChip.tsx`
- Create: `tests/compass-import.spec.ts`
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/components/TeaCompass/SessionStack.tsx`

- [x] **Step 1: Write failing panel tests**

Cover text/photo/file/invoice input, parsing skeleton, retry, partial extraction, field uncertainty text, merge, accept one/all, deferred review, grouped batch chip, 30-item non-flooding behavior, focus trap/return, and unchanged active Tea/Teaware entry after close.

- [x] **Step 2: Verify RED**

```bash
npx playwright test tests/compass-import.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Implement panel and grouped review**

Import is a temporary panel, not a route or replacement field sheet. Accepted items open the existing `CaptureCard`. The grouped chip shows source, count, reviewed/remaining, and errors. Use `z-modal`, top-left panel Close, `pb-nav`, accessible file labels, `aria-live`, textual uncertainty, keyboard expansion, and no horizontal scroll.

- [x] **Step 4: Verify GREEN**

```bash
npx playwright test tests/compass-import.spec.ts tests/compass-responsive.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
npm run lint
npm run lint:colors
```

- [x] **Step 5: Commit**

```bash
git add src/components/TeaCompass/import src/components/TeaCompass/ImportBatchChip.tsx src/components/TeaCompass/index.tsx src/components/TeaCompass/SessionStack.tsx tests/compass-import.spec.ts
git commit -m "feat(curate): add grouped Import review"
```

---

### Task 7: Add decision UI and simplify Library retrieval

**Files:**
- Create: `src/components/TeaCompass/DecisionControl.tsx`
- Create: `src/components/TeaCompass/LibraryFilterSheet.tsx`
- Create: `src/components/TeaCompass/ActiveFilterSummary.tsx`
- Modify: `src/components/TeaCompass/CaptureCard.tsx`
- Modify: `src/components/TeaCompass/CompassEntryDetailPanel.tsx`
- Modify: `src/components/TeaCompass/BrowseCard.tsx`
- Modify: `src/components/TeaCompass/BrowseView.tsx`
- Modify: `src/components/TeaCompass/SessionReview.tsx`
- Modify: `src/lib/teaCompassStore.ts`
- Modify: `tests/compass-library.spec.ts`

- [x] **Step 1: Write failing decision and filter tests**

Test `null/Considering/Selected/Passed on`, independence from verdict/status/stock/publication, All/To taste/Selected primary views, dimensional filters, sort options, List/Photos, search across journey/vendor/place/type/origin/notes, persisted legacy filter migration, and accessible 44px controls.

- [x] **Step 2: Verify RED**

```bash
npx playwright test tests/compass-library.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Implement additive decision and Library filter model**

Keep legacy status readable. No-decision displays no badge. Use a labeled radio/pressed group. Replace Mine/Queue/Loved/Want/Pass peers with All/To taste/Selected; move decision, verdict, possession, journey, vendor, place, date, category, type, origin, year, price, sample state, photos, and missing information into the filter sheet. Keep Sort and display mode separate.

- [x] **Step 4: Verify GREEN**

```bash
npx playwright test tests/compass-library.spec.ts tests/compass-responsive.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
npm run lint:colors
```

- [x] **Step 5: Commit**

```bash
git add src/components/TeaCompass/DecisionControl.tsx src/components/TeaCompass/LibraryFilterSheet.tsx src/components/TeaCompass/ActiveFilterSummary.tsx src/components/TeaCompass/CaptureCard.tsx src/components/TeaCompass/CompassEntryDetailPanel.tsx src/components/TeaCompass/BrowseCard.tsx src/components/TeaCompass/BrowseView.tsx src/components/TeaCompass/SessionReview.tsx src/lib/teaCompassStore.ts tests/compass-library.spec.ts
git commit -m "feat(curate): separate decisions and Library filters"
```

---

### Task 8: Establish sample parity, then replace Samples with Import

**Files:**
- Create: `src/components/TeaCompass/SampleOrderAction.tsx`
- Modify: `src/components/TeaCompass/CaptureCard.tsx`
- Modify: `src/components/samples/SampleCartPanel.tsx`
- Modify: `src/components/TeaCompass/BrowseCard.tsx`
- Modify: `src/components/TeaCompass/BrowseView.tsx`
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/samples/sampleCartStore.ts`
- Modify: `tests/compass-samples-parity.spec.ts`
- Modify: `tests/compass-responsive.spec.ts`
- Modify: `tests/compass-import.spec.ts`

- [x] **Step 1: Write failing parity and replacement tests**

Require contextual empty-cart start, count-bearing `Sample order (N)`, existing panel, Save as Set, `/admin/samples`, labels, tastings, events/panels/customer purposes, product/Compass links, focus return, and accessibility. Then assert Tea/Teaware/Import in both responsive paths and absence of Samples from the capture-method row.

This task must first make historical sample sets, label generation, and tasting management runtime-reachable if Task 1 confirmed they are currently dead exports or redirect-only behavior. The capture-row replacement cannot proceed while those workflows remain unreachable.

- [x] **Step 2: Verify RED**

```bash
npx playwright test tests/compass-samples-parity.spec.ts tests/compass-responsive.spec.ts tests/compass-import.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Add persistent sample-order access before changing the row**

Do not change `TeaSample` or `SampleSet` semantics. Add accessible Sample order access on mobile and desktop. Preserve local durability and historical routes.

- [x] **Step 4: Replace the third capture method**

Change both responsive implementations from `Tea | Teaware | Samples` to `Tea | Teaware | Import`. Update the accessible label from `Capture type` to `Capture method`. Remove `samples` from `initialCaptureOption`; Import returns to the exact prior entry and focus/scroll state.

- [x] **Step 5: Verify GREEN**

```bash
npm run lint
npm run lint:colors
npx playwright test tests/compass-capture.spec.ts tests/compass-responsive.spec.ts tests/compass-import.spec.ts tests/compass-samples-parity.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
npm run test:mobile
```

- [x] **Step 6: Commit**

```bash
git add src/components/TeaCompass/SampleOrderAction.tsx src/components/TeaCompass/CaptureCard.tsx src/components/samples/SampleCartPanel.tsx src/components/TeaCompass/BrowseCard.tsx src/components/TeaCompass/BrowseView.tsx src/components/TeaCompass/index.tsx src/samples/sampleCartStore.ts tests/compass-samples-parity.spec.ts tests/compass-responsive.spec.ts tests/compass-import.spec.ts
git commit -m "feat(curate): replace Samples tab with Import safely"
```

---

### Task 9: Add pure Inventory purpose, readiness, and publication helpers

**Files:**
- Create: `src/admin/components/inventory/domain.ts`
- Create: `src/admin/components/inventory/domain.test.ts`
- Modify: `src/admin/types.ts`

- [x] **Step 1: Write failing pure-domain tests**

Contract:

```ts
type InventoryPurpose = 'working' | 'sample' | 'personal';
type TeaReadiness = { state: 'ready' | 'not_ready' | 'not_applicable'; missing: Array<'description' | 'retail_price' | 'classification' | 'stock_amount'> };
```

Test canonical-purpose precedence, legacy compatibility, conflicting flags, tea-only readiness, description, positive effective retail, non-Misc type, `stockKnownAt`, zero known stock, dual publication gates, and Hidden-but-Ready.

- [x] **Step 2: Verify RED**

```bash
npx vitest run src/admin/components/inventory/domain.test.ts
```

- [x] **Step 3: Implement pure helpers**

Export `effectivePurpose`, `legacyPurposeConflict`, `getTeaReadiness`, `getEffectivePublication`, movement reason labels, and direction validation. No React or network dependencies.

- [x] **Step 4: Verify GREEN and commit**

```bash
npx vitest run src/admin/components/inventory/domain.test.ts
git add src/admin/components/inventory/domain.ts src/admin/components/inventory/domain.test.ts src/admin/types.ts
git commit -m "feat(inventory): define purpose and readiness domain"
```

---

### Task 10: Add canonical Inventory purpose and reviewed receipt schema

**Files:**
- Create: `worker/migrations/102_inventory_purpose_receipts.sql`
- Create: `worker/src/inventoryDomain.ts`
- Create: `worker/tests/inventory-purpose.test.ts`
- Create: `worker/tests/curate-receipts.test.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/admin/types.ts`
- Modify: `src/types.ts`

- [x] **Step 1: Write failing purpose and receipt tests**

Test legacy sample/personal/working reads, conflicts, dual writes, CSV/single-create/listing mirror, account scoping, free 10g Sample receipt, Working receipt, Teaware units, rejection, idempotent retry, no partial commits, and no automatic publication.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/inventory-purpose.test.ts worker/tests/curate-receipts.test.ts
```

- [x] **Step 3: Implement schema and compatibility**

Add nullable `inventory_purpose` and `stock_known_at` to products/listings. Add `curate_receipt_proposals` with account, Compass/import/product/batch links, purpose, quantity/unit, acquisition kind, status, idempotency key, ledger link, and reviewer provenance. Prefer canonical purpose, fall back to legacy flags, and dual-write during transition.

Routes:

```text
POST /api/compass/entries/:id/receipt-proposals
PUT /api/curate/receipt-proposals/:id
POST /api/curate/receipt-proposals/:id/accept
POST /api/curate/receipt-proposals/:id/reject
```

Acceptance creates/links product, updates purpose, writes exactly one receipt movement, and returns the same result on retry.

- [x] **Step 4: Verify GREEN and commit**

```bash
npx vitest run worker/tests/inventory-purpose.test.ts worker/tests/curate-receipts.test.ts worker/tests/intake-batches.test.ts
npm run lint
git add worker/migrations/102_inventory_purpose_receipts.sql worker/src/inventoryDomain.ts worker/tests/inventory-purpose.test.ts worker/tests/curate-receipts.test.ts worker/schema.sql worker/src/index.ts src/lib/api.ts src/admin/types.ts src/types.ts
git commit -m "feat(inventory): add purpose and reviewed receipts"
```

---

### Task 11: Add normalized expected receipts and Incoming

**Files:**
- Create: `worker/migrations/103_inventory_receipts.sql`
- Create: `worker/tests/inventory-receipts.test.ts`
- Create: `src/admin/components/inventory/IncomingReceiptsPanel.tsx`
- Create: `tests/inventory-incoming.spec.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/src/inventoryDomain.ts`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/admin/types.ts`

- [x] **Step 1: Write failing receipt tests**

Test planned/ordered/in-transit/partial/received/cancelled, multiple open receipts per product, expected versus on-hand quantities, partial receipt, remaining cancellation, source provenance, intended purpose, legacy in-transit synthesis, cross-account rejection, and atomic ledger/balance updates.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/inventory-receipts.test.ts
npx playwright test tests/inventory-incoming.spec.ts --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Implement normalized receipts**

Create `inventory_receipts` and `inventory_receipt_lines`. Receiving calls the shared movement primitive, creates/reuses intake batch, updates received quantity and derived state, never counts expected quantity on hand, and never creates a `TeaSample` portion automatically.

- [x] **Step 4: Verify GREEN and commit**

```bash
npx vitest run worker/tests/inventory-receipts.test.ts worker/tests/curate-receipts.test.ts
npx playwright test tests/inventory-incoming.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
git add worker/migrations/103_inventory_receipts.sql worker/tests/inventory-receipts.test.ts worker/schema.sql worker/src/inventoryDomain.ts worker/src/index.ts src/lib/api.ts src/admin/types.ts src/admin/components/inventory/IncomingReceiptsPanel.tsx tests/inventory-incoming.spec.ts
git commit -m "feat(inventory): add expected and partial receipts"
```

---

### Task 12: Add idempotent movement-first stock API

**Files:**
- Create: `worker/migrations/104_stock_movements.sql`
- Create: `worker/tests/stock-movements.test.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/src/inventoryDomain.ts`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`

- [x] **Step 1: Write failing movement tests**

Cover Receipt, Sale, Sample use, Gift, Waste, Return, Recount, negative-balance `409`, account/batch scope, listing mirror, before/after, actor/note, idempotent retry, stale/concurrent balance, invoice compatibility, and failure atomicity.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/stock-movements.test.ts
```

- [x] **Step 3: Implement canonical movement primitive**

Add `movement_type`, `idempotency_key`, and `source_compass_entry_id` to `stock_ledger`. Route:

```text
POST /api/products/:id/movements
```

Use `applyStockMovement` from receipt confirmation and new UI. Preserve old endpoints temporarily and route absolute editing to Recount semantics. Transfer is not implemented as disappearance; it requires a valid destination/location reference.

- [x] **Step 4: Verify GREEN and commit**

```bash
npx vitest run worker/tests/stock-movements.test.ts worker/tests/auth-boundaries.test.ts worker/tests/intake-batches.test.ts worker/tests/mcp-fulfillment.test.ts
git add worker/migrations/104_stock_movements.sql worker/tests/stock-movements.test.ts worker/schema.sql worker/src/inventoryDomain.ts worker/src/index.ts src/lib/api.ts
git commit -m "feat(inventory): add atomic stock movements"
```

---

### Task 13: Decouple encounter save from product promotion

**Files:**
- Create: `worker/tests/compass-promotion.test.ts`
- Create: `src/components/TeaCompass/CreateInventoryRecordAction.tsx`
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/components/TeaCompass/useCommitAndPromote.ts`
- Modify: `src/lib/teaCompassStore.ts`
- Modify: `src/lib/teaCompassSync.ts`
- Modify: `src/components/TeaCompass/StatusActions.tsx`
- Modify: `src/components/TeaCompass/BrowseCard.tsx`
- Modify: `worker/src/index.ts`
- Modify: `tests/compass-capture.spec.ts`

- [x] **Step 1: Write failing promotion boundary tests**

Assert ordinary Done creates no product, Import acceptance creates no product, explicit Create Inventory is idempotent, linked legacy records remain valid, queued failures migrate safely, zero stock creates no ledger receipt, and publication defaults remain explicit.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/compass-promotion.test.ts
npx playwright test tests/compass-capture.spec.ts --project="Desktop Chrome" --reporter=list
```

- [x] **Step 3: Move product creation behind explicit action/receipt**

Preserve the existing backend promotion endpoint for compatibility and stale-link repair, but remove automatic invocation from Done. `CreateInventoryRecordAction` or accepted receipt invokes the idempotent flow. Existing linked entries remain unchanged.

- [x] **Step 4: Verify GREEN and commit**

```bash
npx vitest run worker/tests/compass-promotion.test.ts
npx playwright test tests/compass-capture.spec.ts tests/compass-import.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
git add worker/tests/compass-promotion.test.ts src/components/TeaCompass/CreateInventoryRecordAction.tsx src/components/TeaCompass/index.tsx src/components/TeaCompass/useCommitAndPromote.ts src/lib/teaCompassStore.ts src/lib/teaCompassSync.ts src/components/TeaCompass/StatusActions.tsx src/components/TeaCompass/BrowseCard.tsx worker/src/index.ts tests/compass-capture.spec.ts
git commit -m "feat(curate): separate encounters from Inventory creation"
```

---

### Task 14: Add purpose, Incoming, and Needs Development Inventory views

**Files:**
- Modify: `src/admin/components/inventory/config.ts`
- Modify: `src/admin/components/inventory/useInventoryProducts.ts`
- Modify: `src/admin/components/InventoryView.tsx`
- Modify: `src/admin/components/ProductEditPanel.tsx`
- Create: `tests/inventory-purpose-views.spec.ts`
- Modify: `tests/inventory-scroll.spec.ts`

- [x] **Step 1: Write failing view and readiness tests**

Test Working/Samples/Personal/All, operational Incoming/Needs development/To taste/Reorder/Low stock/Missing location, composable Tea/Teaware/search/group/sort/columns, old ForSale mapping, custom-view preservation, exact missing readiness fields, source-Compass links, Hidden-but-Ready, and unchanged publication.

- [x] **Step 2: Verify RED**

```bash
npx playwright test tests/inventory-purpose-views.spec.ts tests/inventory-scroll.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Implement purpose and action views**

Visually separate purpose from Needs attention. Replace overlapping Sample/Mine classification pills with Purpose while preserving a separate sample-size offering field if present. Show effective storefront sentence while retaining both gates. Show named readiness omissions, never a percentage. Opening missing work follows `sourceCompassEntryId`; unlinked records offer deliberate Develop in Curate.

- [x] **Step 4: Verify height chain and GREEN**

```bash
npm run lint
npm run lint:colors
npx playwright test tests/inventory-purpose-views.spec.ts tests/inventory-scroll.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

- [x] **Step 5: Commit**

```bash
git add src/admin/components/inventory/config.ts src/admin/components/inventory/useInventoryProducts.ts src/admin/components/InventoryView.tsx src/admin/components/ProductEditPanel.tsx tests/inventory-purpose-views.spec.ts tests/inventory-scroll.spec.ts
git commit -m "feat(inventory): add purpose and development views"
```

---

### Task 15: Add movement-first Inventory UI and ledger detail

**Files:**
- Create: `src/admin/components/inventory/StockMovementPanel.tsx`
- Create: `tests/inventory-movements.spec.ts`
- Modify: `src/admin/components/inventory/InventoryRow.tsx`
- Modify: `src/admin/components/inventory/QuickEditFields.tsx`
- Modify: `src/admin/components/InventoryView.tsx`
- Modify: `src/admin/components/ProductEditPanel.tsx`
- Modify: `src/admin/components/StockLedgerPanel.tsx`

- [x] **Step 1: Write failing movement UI tests**

Test Receive, Sample use, Gift, Waste, Return, Recount, Transfer destination requirement, before/after preview, inline insufficient-stock prevention, preserved form on error, ledger refresh, actor/note/reference display, accessible pagination, mobile full-width panel, focus return, and Inventory scroll after close.

- [x] **Step 2: Verify RED**

```bash
npx playwright test tests/inventory-movements.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Implement movement panel and recount semantics**

Normal stock interaction opens movement actions. Spreadsheet absolute stock editing becomes explicit Recount. Preserve invoice-driven Sale flow. Use `z-modal`, bottom-nav utilities, 44px targets, no horizontal scroll, and the existing height chain.

- [x] **Step 4: Verify GREEN and commit**

```bash
npx playwright test tests/inventory-movements.spec.ts tests/inventory-scroll.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
npm run lint:colors
git add src/admin/components/inventory/StockMovementPanel.tsx src/admin/components/inventory/InventoryRow.tsx src/admin/components/inventory/QuickEditFields.tsx src/admin/components/InventoryView.tsx src/admin/components/ProductEditPanel.tsx src/admin/components/StockLedgerPanel.tsx tests/inventory-movements.spec.ts
git commit -m "feat(inventory): make stock changes explicit movements"
```

---

### Task 16: Route structured CSV stock through purpose and movement logic

**Files:**
- Modify: `src/admin/components/CsvImportModal.tsx`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/inventoryDomain.ts`
- Create: `worker/tests/inventory-import-purpose.test.ts`
- Create: `tests/inventory-import-review.spec.ts`

- [x] **Step 1: Write failing import compatibility tests**

Test Purpose mapping, issue filtering, bulk defaults, exact counts, editable required fields, opening-balance preview, stable idempotency, receipt/batch label, one ledger movement per physical line, and no duplicated ledger insertion code.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/inventory-import-purpose.test.ts
npx playwright test tests/inventory-import-review.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Reuse shared intake/movement service**

Keep Inventory Import for normalized physical stock. Curate Import remains unstructured evidence. Review invalid rows rather than silently importing all; commit confirmed lines through the same purpose and movement primitives.

- [x] **Step 4: Verify GREEN and commit**

```bash
npx vitest run worker/tests/inventory-import-purpose.test.ts
npx playwright test tests/inventory-import-review.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
git add src/admin/components/CsvImportModal.tsx worker/src/index.ts worker/src/inventoryDomain.ts worker/tests/inventory-import-purpose.test.ts tests/inventory-import-review.spec.ts
git commit -m "feat(inventory): unify structured stock import"
```

---

### Task 17: Preserve sample portions and optionally ledger sample consumption

**Files:**
- Create: `worker/tests/sample-holding-separation.test.ts`
- Create: `tests/sample-workflows.spec.ts`
- Modify: `src/samples/types.ts`
- Modify: `src/samples/sampleStore.ts`
- Modify: `src/samples/SampleSetCreator.tsx`
- Modify: `src/components/samples/SampleCartPanel.tsx`
- Modify: `worker/src/index.ts`

- [x] **Step 1: Write failing separation tests**

Test Inventory Sample holding versus `TeaSample`, set/panel/event/customer-gift purposes, labels, tastings, historical sets, Compass/product/teaKey links, and optional explicit `SAMPLE_USE` confirmation. Assert creating a portion never silently consumes stock.

- [x] **Step 2: Verify RED**

```bash
npx vitest run worker/tests/sample-holding-separation.test.ts
npx playwright test tests/sample-workflows.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

- [x] **Step 3: Add explicit linked consumption without collapsing models**

Preserve the standalone sample model. If a portion links to a physical holding, offer an explicit quantity confirmation that uses the movement API. Keep historical `/admin/samples` and all existing labels/tastings.

- [x] **Step 4: Verify GREEN and commit**

```bash
npx vitest run worker/tests/sample-holding-separation.test.ts
npx playwright test tests/sample-workflows.spec.ts tests/compass-samples-parity.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
git add worker/tests/sample-holding-separation.test.ts tests/sample-workflows.spec.ts src/samples/types.ts src/samples/sampleStore.ts src/samples/SampleSetCreator.tsx src/components/samples/SampleCartPanel.tsx worker/src/index.ts
git commit -m "feat(samples): link portions without conflating holdings"
```

---

### Task 18: Full verification, migration rehearsal, and documentation

**Files:**
- Modify: `docs/STATE_OF_THE_SITE.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/superpowers/plans/2026-07-12-curate-inventory-implementation.md` checkboxes only

- [x] **Step 1: Apply migrations to disposable databases**

Run migrations from a clean schema and from a snapshot ending at migration `098`. Verify legacy Compass entries, products, unlinked products, flags, listings, ledger rows, and sample links remain readable.

- [ ] **Step 2: Run full automated verification**

```bash
npm run test:worker
npm run lint
npm run lint:colors
npm run build
npx vitest run src/lib/teaCompassStore.test.ts src/admin/components/inventory/domain.test.ts
npx playwright test tests/compass-capture.spec.ts tests/compass-responsive.spec.ts tests/compass-library.spec.ts tests/compass-import.spec.ts tests/compass-samples-parity.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
npx playwright test tests/inventory-scroll.spec.ts tests/inventory-purpose-views.spec.ts tests/inventory-movements.spec.ts tests/inventory-incoming.spec.ts tests/inventory-import-review.spec.ts tests/sample-workflows.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
npm run test:mobile
```

Expected: zero failures, zero horizontal-overflow regressions, Inventory scroller remains sized and scrollable.

- [ ] **Step 3: Run final independent reviews**

Request one spec-compliance review against the approved design and one code-quality/security review covering account scoping, idempotency, D1 atomicity, migration safety, responsive behavior, accessibility, and preservation of current Curate layout.

- [x] **Step 4: Update project documentation and commit**

```bash
git add docs/STATE_OF_THE_SITE.md docs/CHANGELOG.md docs/ROADMAP.md docs/superpowers/plans/2026-07-12-curate-inventory-implementation.md
git commit -m "docs: record Curate and Inventory ingestion rollout"
```

---

## Execution protocol

1. Execute tasks sequentially with a fresh implementation agent per task.
2. Every production change begins with a failing test and recorded RED output.
3. After each implementation commit, run a fresh spec-compliance review.
4. Only after spec compliance passes, run a separate code-quality review.
5. The original implementer fixes review issues; reviewers re-review until approved.
6. Never run parallel implementation agents against the shared worktree.
7. Preserve feature flags and compatibility reads until later tasks prove parity.
8. Do not alter the current Curate field-sheet composition.
9. Do not change navigation routes or labels outside the explicitly approved Samples-to-Import capture-row replacement.
10. Stop only for a genuine blocker, a migration safety issue, or a user-level design ambiguity not resolved in this plan.

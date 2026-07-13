# Curate AI Inventory Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn pasted Chinese/vendor evidence into a compact, reviewed batch that reuses existing vendors and Library identities, then creates real Inventory receipts and stock through the existing movement domain.

**Architecture:** Extend the durable Curate import model with one optional sourcing run, normalized vendor groups, schema-validated AI proposals, and idempotent batch finalization. AI performs evidence interpretation; pure code performs normalization, arithmetic, blocking validation, and match scoring. The React review surface renders a mobile-first hierarchy of batch, vendor groups, and compact editable items.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind v3, Cloudflare Workers, D1, R2, Anthropic multimodal API, Vitest, Playwright.

**Design:** `docs/superpowers/specs/2026-07-13-curate-ai-inventory-import-design.md`

---

## File and ownership map

### Worker/domain stream

- Create `worker/migrations/108_curate_import_analysis.sql`: additive batch analysis, vendor groups, receipt links.
- Create `worker/src/curateImportAnalysis.ts`: strict proposal codec, normalization, arithmetic, blocking validation, prompt construction.
- Create `worker/src/curateImportFinalize.ts`: vendor resolution and idempotent receipt/product/stock orchestration.
- Modify `worker/src/curateImports.ts`: analysis and finalization handlers, durable group/item updates.
- Modify `worker/src/index.ts`: environment binding and routes only.
- Modify `worker/schema.sql`: mirror migration.
- Create `worker/tests/curate-import-analysis.test.ts` and `worker/tests/curate-import-finalize.test.ts`.
- Modify `worker/tests/curate-imports.test.ts`: persistence and account-scope coverage.

### Frontend stream

- Modify `src/lib/api.ts`: typed analysis, group resolution, and finalization APIs.
- Create `src/components/TeaCompass/import/importReviewDomain.ts`: pure view grouping and blocking-summary helpers.
- Create `src/components/TeaCompass/import/ImportBatchSummary.tsx`.
- Create `src/components/TeaCompass/import/ImportVendorGroup.tsx`.
- Rewrite `src/components/TeaCompass/import/ImportItemRow.tsx` as compact/expandable mobile review.
- Modify `src/components/TeaCompass/import/ImportBatchReview.tsx` and `ImportPanel.tsx`.
- Modify `src/components/TeaCompass/import/ImportInput.tsx`: optional sourcing run and 16px mobile controls.
- Create/modify import component tests and `tests/compass-import.spec.ts`.

### Primary-agent integration seams

- Reconcile API/type changes between streams.
- Verify existing Journey, vendor/customer, product promotion, receipt, and stock movement APIs are reused.
- Run full focused and project verification.

---

### Task 1: Add deterministic import proposal domain

**Files:**
- Create: `worker/src/curateImportAnalysis.ts`
- Create: `worker/tests/curate-import-analysis.test.ts`

- [ ] **Step 1: Write failing proposal normalization tests**

Cover per-pack math, line-total math, kg/g conversion, Chinese names, blocking uncertainty, and multiple currencies using the public contract:

```ts
const proposal: ImportAnalysisProposal = {
  overview: '1 tea found',
  language: 'zh',
  groups: [{ key: 'chen', proposedVendorName: 'Chen Family Tea', items: [{
    sourceItemId: 'item-1', category: 'tea', originalName: '云南古树生普',
    englishName: 'Yunnan Ancient Tree Raw Pu’er', packWeight: 500,
    weightUnit: 'g', packCount: 2, priceAmount: 380, currency: 'CNY',
    priceBasis: 'per_pack', confidence: {}, uncertainty: {}, evidenceRefs: ['source-1:0-18'],
  }]}],
};
expect(normalizeImportProposal(proposal).groups[0].items[0]).toMatchObject({
  totalQuantityGrams: 1000, lineCost: 760, unitCost: 0.76,
});
```

- [ ] **Step 2: Run RED**

Run `npx vitest run worker/tests/curate-import-analysis.test.ts`. Expect failure because the module does not exist.

- [ ] **Step 3: Implement strict types and pure normalization**

Export:

```ts
export type ImportPriceBasis = 'per_pack' | 'line_total' | 'unknown';
export interface NormalizedImportItem { sourceItemId: string; category: 'tea' | 'teaware'; originalName: string | null; englishName: string | null; packWeight: number | null; weightUnit: 'g' | 'kg' | 'count' | null; packCount: number | null; priceAmount: number | null; currency: string | null; priceBasis: ImportPriceBasis; totalQuantityGrams: number | null; totalUnits: number | null; lineCost: number | null; unitCost: number | null; confidence: Record<string, number>; uncertainty: Record<string, string>; evidenceRefs: string[]; blockingFields: string[]; }
export function decodeImportAnalysisProposal(value: unknown): ImportAnalysisProposal;
export function normalizeImportProposal(value: ImportAnalysisProposal): NormalizedImportProposal;
export function buildImportAnalysisPrompt(evidence: ImportEvidenceForAnalysis, candidates: ImportMatchCandidates): string;
```

Reject non-finite/negative quantities and costs. Never infer `priceBasis` when evidence is ambiguous. Use integer grams where conversion is exact.

- [ ] **Step 4: Run GREEN and refactor**

Run `npx vitest run worker/tests/curate-import-analysis.test.ts`. Expect all tests passing.

- [ ] **Step 5: Commit**

Commit only the two task files as `feat(curate): add deterministic import analysis domain`.

---

### Task 2: Persist analysis and vendor groups, then call multimodal AI

**Files:**
- Create: `worker/migrations/108_curate_import_analysis.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/src/curateImports.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/tests/curate-imports.test.ts`

- [ ] **Step 1: Write failing API tests**

Add tests for optional `journey_id`, ordered vendor groups, account isolation, analysis state, manual correction preservation, strong/weak vendor candidates, and rerun safety. Mock the Anthropic fetch and assert the handler sends stored text/image evidence and existing account vendor candidates.

- [ ] **Step 2: Run RED**

Run `npx vitest run worker/tests/curate-imports.test.ts worker/tests/curate-import-analysis.test.ts`. Expect route/schema failures.

- [ ] **Step 3: Add additive schema**

Add batch columns `analysis_state`, `analysis_overview`, `analysis_language`, `analysis_version`, `analysis_model`, `analysis_error`, `finalize_idempotency_key`, `completed_at`. Create `curate_import_vendor_groups` with account/batch ownership, position, proposed name, resolved vendor customer ID, confidence, uncertainty JSON, and timestamps. Add `vendor_group_id` and `manually_corrected_fields_json` to items. Add `curate_import_receipts` linking batch/vendor group to an Inventory receipt with a unique account/group constraint.

- [ ] **Step 4: Implement analysis handler**

Add `POST /api/curate/imports/:id/analyze`. It must load account-scoped evidence, fetch existing `vendor`-tagged customers and journeys, call the configured Anthropic multimodal model, decode and normalize through Task 1, and store groups/items in a D1 batch. Preserve fields listed in `manually_corrected_fields_json` on rerun.

- [ ] **Step 5: Run GREEN**

Run the Task 2 test command and `npm run lint`.

- [ ] **Step 6: Commit**

Commit as `feat(curate): analyze durable import evidence`.

---

### Task 3: Finalize a reviewed import into Inventory

**Files:**
- Create: `worker/src/curateImportFinalize.ts`
- Create: `worker/tests/curate-import-finalize.test.ts`
- Modify: `worker/src/curateImports.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write failing finalization tests**

Test one and multiple vendor groups, existing/new vendors, optional/no sourcing run, existing/new Compass identity, existing/new product holding, blocking ambiguity, one receipt per vendor group, original cost/currency, accepted stock movements, foreign-account rejection, and retry idempotency.

```ts
const first = await finalizeCurateImport(ctx, batchId, 'finish-key');
const retry = await finalizeCurateImport(ctx, batchId, 'finish-key');
expect(retry).toEqual(first);
expect(await count('inventory_receipts')).toBe(2);
expect(await count('stock_movements')).toBe(10);
```

- [ ] **Step 2: Run RED**

Run `npx vitest run worker/tests/curate-import-finalize.test.ts`. Expect failure because finalization does not exist.

- [ ] **Step 3: Implement validation and reuse-first resolution**

Export `validateImportForFinalization` and `finalizeCurateImport`. Require resolved vendors and non-blocking physical quantity/cost fields. Reuse current Compass acceptance, product identity, receipt proposal/acceptance, and stock movement helpers; extract shared helpers from `worker/src/index.ts` only where necessary. Do not write stock directly.

- [ ] **Step 4: Add finalization route**

Add `POST /api/curate/imports/:id/finalize` accepting `{ idempotency_key: string }` and returning `{ batch, receipts, items }`.

- [ ] **Step 5: Run GREEN**

Run `npx vitest run worker/tests/curate-import-finalize.test.ts worker/tests/curate-receipts.test.ts worker/tests/curate-imports.test.ts` and `npm run lint`.

- [ ] **Step 6: Commit**

Commit as `feat(curate): finalize imports through inventory receipts`.

---

### Task 4: Add typed client API and pure review state

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/components/TeaCompass/import/importReviewDomain.ts`
- Create: `src/components/TeaCompass/import/importReviewDomain.test.ts`

- [ ] **Step 1: Write failing review-domain tests**

Test grouping, ready/needs-review partitions, batch totals, multiple currencies, vendor resolution state, and exact blocking-field summaries.

- [ ] **Step 2: Run RED**

Run `npx vitest run src/components/TeaCompass/import/importReviewDomain.test.ts`.

- [ ] **Step 3: Add API types and methods**

Extend `CurateImportDetail` with `groups` and analysis fields. Add `api.curateImports.analyze`, `updateGroup`, `createVendorForGroup`, `setJourney`, and `finalize`. Keep existing import methods compatible.

- [ ] **Step 4: Implement pure review helpers**

Export `buildImportReviewModel(detail)` returning ordered group rows, ready/review counts, currency totals, quantity totals, and `canFinalize`; export `importBlockingMessage(item)` for precise correction copy.

- [ ] **Step 5: Run GREEN and commit**

Run the focused test plus `npm run lint`; commit as `feat(curate): type inventory import review state`.

---

### Task 5: Build the compact grouped mobile review

**Files:**
- Create: `src/components/TeaCompass/import/ImportBatchSummary.tsx`
- Create: `src/components/TeaCompass/import/ImportVendorGroup.tsx`
- Modify: `src/components/TeaCompass/import/ImportItemRow.tsx`
- Modify: `src/components/TeaCompass/import/ImportBatchReview.tsx`
- Modify: `src/components/TeaCompass/import/ImportPanel.tsx`
- Modify: `src/components/TeaCompass/import/ImportInput.tsx`
- Create: `tests/compass-import.spec.ts`

- [ ] **Step 1: Write failing mobile Playwright tests**

At 390×844, mock a 10-item, 2-vendor analyzed batch. Assert one optional sourcing-run control, one tiny `Change` action per vendor heading, full vendor titles, all compact rows reachable vertically, ready-row editing, uncertain-row blocking, no repeated vendor/run controls inside items, and final `Add 10 teas to Inventory`.

- [ ] **Step 2: Run RED**

Run `npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --reporter=list` with the dev server. Expect missing grouped UI assertions.

- [ ] **Step 3: Implement approved hierarchy**

Render batch summary, optional sourcing run, vendor metadata line with the small top-right `Change`, full-width vendor name, compact item rows, and vertical item expansion. Ready rows remain editable. Only quantity/cost/vendor/identity ambiguity blocks finalization.

- [ ] **Step 4: Fix iOS zoom**

All import `input`, `textarea`, and `select` elements use `text-ui-16 lg:text-ui-13` (or an equivalent existing reusable class) so mobile computed font size is at least 16px. Preserve `tap-target`, `pb-nav`, `z-modal`, focus trap, and Cancel/Close conventions.

- [ ] **Step 5: Connect finalization**

The sticky final action calls `api.curateImports.finalize` once with a stable idempotency key, shows precise structured errors, and returns to Inventory/opens the created holdings through the existing navigation seam without changing global navigation labels.

- [ ] **Step 6: Run GREEN and commit**

Run Mobile and Desktop Chrome for `tests/compass-import.spec.ts`, import Vitest tests, `npm run lint`, and `npm run lint:colors`; commit as `feat(curate): add grouped inventory import review`.

---

### Task 6: Integrate, harden, and verify the complete flow

**Files:**
- Modify only files required by failing integration checks.
- Update: `docs/CHANGELOG.md` with the shipped behavior after verification.

- [ ] **Step 1: Run focused worker verification**

Run:

```bash
npx vitest run worker/tests/curate-import-analysis.test.ts worker/tests/curate-import-finalize.test.ts worker/tests/curate-imports.test.ts worker/tests/curate-receipts.test.ts worker/tests/inventory-import-purpose.test.ts
```

- [ ] **Step 2: Run focused client verification**

Run:

```bash
npx vitest run src/components/TeaCompass/import/importEvidence.test.ts src/components/TeaCompass/import/importReviewDomain.test.ts
npx playwright test tests/compass-import.spec.ts tests/compass-capture.spec.ts tests/inventory-scroll.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --reporter=list
```

- [ ] **Step 3: Run project gates**

Run `npm run lint`, `npm run lint:colors`, `npm run build`, and `npm run test:mobile`. Fix only regressions caused by this work.

- [ ] **Step 4: Validate migration and retry safety**

Apply migrations 099–108 to a fresh local D1 database and an upgrade fixture at 107, then run the finalization request twice. Confirm identical response IDs and no duplicate receipts or movements.

- [ ] **Step 5: Update changelog and commit**

Record the user-visible import behavior, verification commands, and deployment boundary. Commit as `docs(curate): record inventory import integration`.

- [ ] **Step 6: Final review**

Review the complete diff against every section of the design specification. Resolve all Critical and Important findings, rerun affected tests, then use the finishing-a-development-branch workflow.


# Curate AI Inventory Import Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all twenty pre-release findings so Curate import is concurrency-safe, reuse-first, evidence-honest, recoverable on mobile, and explicit about its Library and Inventory results.

**Architecture:** Harden the existing branch without replacing its durable import model. Worker changes establish atomic terminal-state guards, deterministic proposal/money/matching rules, and per-source evidence outcomes. Frontend changes consume those typed outcomes through searchable reuse controls, blocking-first editing, durable draft recovery, accessible modal isolation, and a batch receipt summary.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind v3, Zustand/React Query, Cloudflare Workers, D1, R2, Anthropic API, Vitest, Playwright.

**Design:** `docs/superpowers/specs/2026-07-13-curate-ai-inventory-import-design.md` section 14.

---

## Ownership map

- Worker safety: `worker/src/curateImports.ts`, `worker/src/curateImportAnalysis.ts`, `worker/src/curateImportFinalize.ts`, migration/schema, Worker tests.
- Evidence/recovery: Worker evidence handlers plus `ImportInput.tsx`, `ImportEvidencePreview.tsx`, `ImportEvidenceCard.tsx`, import draft helpers, API types, focused tests.
- Review experience: `ImportPanel.tsx`, `ImportBatchReview.tsx`, `ImportBatchSummary.tsx`, `ImportJourneyPicker.tsx`, `ImportVendorGroup.tsx`, `ImportItemRow.tsx`, completion summary, Playwright tests.
- Primary integration: reconcile shared API types, run all gates, repair or deliberately re-specify the seven Curate draft-lifecycle failures, update changelog.

### Task 1: Fence analysis and all review mutations from finalization

**Files:**
- Modify: `worker/migrations/119_curate_import_analysis.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/src/curateImports.ts`
- Test: `worker/tests/curate-imports.test.ts`
- Test: `worker/tests/curate-import-finalize.test.ts`

- [ ] **Step 1: Write failing race tests**

Add tests that pause the provider response, reserve/finalize the batch, then release analysis. Assert analysis returns `409` with `code: "analysis_superseded"`, the batch stays completed, and no groups/items are rewritten. Add a table-driven test invoking Journey, group, vendor creation, item update, upload, abandon, and analyze after reservation; every mutation must return `409` and leave rows unchanged.

- [ ] **Step 2: Run RED**

Run `npx vitest run worker/tests/curate-imports.test.ts worker/tests/curate-import-finalize.test.ts`. Expect the new completed-state and reserved-mutation assertions to fail.

- [ ] **Step 3: Add an analysis attempt token and atomic guards**

Add nullable `analysis_attempt_token` to the batch schema. At analysis start, generate a UUID and atomically set it only where the batch is nonterminal and `finalize_idempotency_key IS NULL`. Include a final guarded batch statement requiring the same token, nonterminal state, and no reservation. If the guarded write changes zero rows, return `analysis_superseded`; do not run the generic failure update. Add the same reservation/nonterminal predicate to every review mutation query rather than relying on a pre-read.

- [ ] **Step 4: Run GREEN and commit**

Run the Task 1 test command plus `npm run lint`. Commit as `fix(curate): fence import analysis and finalization`.

### Task 2: Make proposal validation, matching, currency, and privacy deterministic

**Files:**
- Modify: `worker/src/curateImportAnalysis.ts`
- Modify: `worker/src/curateImports.ts`
- Modify: `worker/src/curateImportFinalize.ts`
- Modify: `worker/migrations/119_curate_import_analysis.sql`
- Modify: `worker/schema.sql`
- Test: `worker/tests/curate-import-analysis.test.ts`
- Test: `worker/tests/curate-imports.test.ts`
- Test: `worker/tests/curate-import-finalize.test.ts`

- [ ] **Step 1: Write failing deterministic-domain tests**

Cover duplicate group keys/source IDs, Han original with missing English translation, low-confidence material fields, ambiguous `¥`, invalid ISO codes, exact decimal round trips, generic-name identity ties, composite unique winners, products linked through `source_compass_entry_id`, candidate count bounds, and absence of email/phone/WhatsApp in the provider prompt.

- [ ] **Step 2: Run RED**

Run `npx vitest run worker/tests/curate-import-analysis.test.ts worker/tests/curate-imports.test.ts worker/tests/curate-import-finalize.test.ts`.

- [ ] **Step 3: Implement strict validation and exact money**

Reject duplicate identifiers during proposal decoding. Add translation and confidence blockers during normalization. Normalize supported currencies to uppercase ISO 4217 codes and leave ambiguous symbols blocked. Preserve monetary values as canonical decimal strings or integer minor units in import/receipt provenance; convert to display numbers only at the typed API edge where existing consumers require them.

- [ ] **Step 4: Implement composite reuse-first matching**

Rank identity candidates using category plus normalized names, year, origin, form/classification, and vendor. Auto-match only a unique high-margin candidate; ties remain unresolved. Join products by `source_compass_entry_id` before resolution. Preselect a bounded candidate set locally and send only IDs, names, and relevant tea attributes to the provider.

- [ ] **Step 5: Run GREEN and commit**

Run the Task 2 tests plus the complete Worker test directory. Commit as `fix(curate): harden import matching and money`.

### Task 3: Make evidence honest, partial, removable, and recoverable

**Files:**
- Modify: `worker/src/curateImports.ts`
- Modify: `worker/migrations/119_curate_import_analysis.sql`
- Modify: `worker/schema.sql`
- Modify: `src/lib/api.ts`
- Modify: `src/components/TeaCompass/import/ImportInput.tsx`
- Modify: `src/components/TeaCompass/import/ImportEvidencePreview.tsx`
- Modify: `src/components/TeaCompass/import/ImportEvidenceCard.tsx`
- Create: `src/components/TeaCompass/import/importDraftStorage.ts`
- Create: `src/components/TeaCompass/import/importDraftStorage.test.ts`
- Test: `tests/compass-import.spec.ts`

- [ ] **Step 1: Write failing evidence tests**

Test mixed pasted text + DOCX + PDF, a 6 MB original with an analysis-safe derivative or preflight rejection, per-source statuses, attachment removal/clear-all, account-scoped local paste recovery, dirty-close confirmation, failed-file retry, and valid page/range evidence references.

- [ ] **Step 2: Run RED**

Run `npx vitest run worker/tests/curate-imports.test.ts src/components/TeaCompass/import/importDraftStorage.test.ts` and the evidence cases in `tests/compass-import.spec.ts`.

- [ ] **Step 3: Implement per-source outcomes**

Persist `analysis_status`, `analysis_error`, and structured reference metadata per source. Reference-only or oversized sources do not abort other usable evidence. Align UI preflight and Worker provider limits. Validate structured evidence locations against loaded sources. Keep originals private in R2.

- [ ] **Step 4: Implement draft and attachment recovery**

Store paste text, Journey ID, and attachment descriptors by account; browser `File` bodies cannot be restored, so restored attachment descriptors clearly request reselection while preserving filenames and source intent. Add Remove, Replace, and Clear all before upload. Close immediately when pristine; for dirty input, preserve it and offer `Keep draft` or `Discard` without losing data on Escape.

- [ ] **Step 5: Run GREEN and commit**

Run focused unit/browser tests, `npm run lint`, and `npm run lint:colors`. Commit as `feat(curate): recover import drafts and evidence`.

### Task 4: Add explicit lookup states and searchable reuse controls

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/components/TeaCompass/import/ImportPanel.tsx`
- Modify: `src/components/TeaCompass/import/ImportVendorGroup.tsx`
- Modify: `src/components/TeaCompass/import/ImportItemRow.tsx`
- Create: `src/components/TeaCompass/import/ImportMatchPicker.tsx`
- Test: `src/components/TeaCompass/import/importReviewDomain.test.ts`
- Test: `tests/compass-import.spec.ts`

- [ ] **Step 1: Write failing lookup and selection tests**

Cover loading/empty/error/retry for vendors and Journeys, disabled creation while reuse lookup failed, ranked vendor search, named proposed identity/holding matches, alternate existing identity selection, compatibility filtering, and globally disabled conflicting controls during a save.

- [ ] **Step 2: Run RED**

Run the import domain test and Desktop/Mobile `compass-import.spec.ts`.

- [ ] **Step 3: Implement typed lookup state and reusable picker**

Represent each lookup as `{status: 'loading'|'ready'|'empty'|'error', options, error}`. `ImportMatchPicker` is a labelled searchable combobox/listbox with keyboard navigation, visible proposed-match reasoning, selected record name, retry, and creation only after a successful empty/no-match state. Apply it to vendors, identities, and holdings, filtering holdings by account, category, identity, and purpose.

- [ ] **Step 4: Run GREEN and commit**

Run Task 4 tests, lint, and color lint. Commit as `feat(curate): add searchable import matching`.

### Task 5: Distill mobile review, fix accessibility, and add completion summary

**Files:**
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/components/TeaCompass/import/ImportPanel.tsx`
- Modify: `src/components/TeaCompass/import/ImportBatchReview.tsx`
- Modify: `src/components/TeaCompass/import/ImportBatchSummary.tsx`
- Modify: `src/components/TeaCompass/import/ImportJourneyPicker.tsx`
- Modify: `src/components/TeaCompass/import/ImportItemRow.tsx`
- Modify: `src/components/TeaCompass/import/ImportEvidenceCard.tsx`
- Create: `src/components/TeaCompass/import/ImportCompletionSummary.tsx`
- Test: `tests/compass-import.spec.ts`

- [ ] **Step 1: Write failing mobile and accessibility tests**

At 390×844 and desktop, assert one quiet collapsed Journey row, blocker-first fields, `All details`, distinct tea taxonomy labels, draft reset from refreshed props, accurate evidence status, inert/aria-hidden background, one accessible file action per chooser, described destructive confirmation, consistent busy controls, and a durable final receipt summary linking every result.

- [ ] **Step 2: Run RED**

Run `npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --project='Desktop Chrome' --reporter=list`.

- [ ] **Step 3: Implement the approved hierarchy**

Collapse Journey search/create behind Add/Change. Render only blocking fields initially, order them by vendor/identity/quantity/cost/acquisition impact, and put nonblocking metadata under `All details`. Refresh editor state when opening or when the item revision changes. Replace inaccurate destination/evidence copy with the Library + Inventory contract and per-source status.

- [ ] **Step 4: Implement modal isolation and batch completion**

Make the underlying Curate surface inert and `aria-hidden` while the dialog is open. Hide proxy file controls from the accessibility tree while keeping labelled trigger buttons. After finalization, show `ImportCompletionSummary` with created/reused status, all identities/holdings/receipts, quantity/cost, and explicit links; do not navigate directly to only the first product.

- [ ] **Step 5: Run GREEN and commit**

Run the complete import browser matrix, focused unit tests, lint, and color lint. Commit as `feat(curate): complete mobile import review`.

### Task 6: Close regressions and verify the merge candidate

**Files:**
- Modify only files required by failing regression checks.
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Repair or re-specify Curate draft lifecycle**

Run `tests/compass-capture.spec.ts` alone. Determine the intended current contract from product behavior and source history, then either restore eager/resumed blank drafts or update stale assertions to the deliberate lazy-draft behavior. Preserve entered fragments and add regression coverage for the chosen contract.

- [ ] **Step 2: Run complete verification**

Run:

```bash
npx vitest run worker/tests src/components/TeaCompass/import
npm run lint
npm run lint:colors
npm run build
npx playwright test tests/compass-import.spec.ts tests/compass-capture.spec.ts tests/inventory-scroll.spec.ts --project='Mobile Chrome' --project='Desktop Chrome' --reporter=list
npm run test:mobile
```

- [ ] **Step 3: Review every hardening contract**

Map each section 14 requirement to a passing test or inspected implementation. Run `git diff --check`, confirm no unrelated user changes were touched, and obtain independent final code review. Resolve all P0/P1 findings and rerun affected gates.

- [ ] **Step 4: Update changelog and commit**

Record the final behavior, supported/reference-only evidence formats, exact destination model, verification counts, and any deliberately deferred nonblocking limitation. Commit as `docs(curate): record hardened inventory import`.

- [ ] **Step 5: Publish the branch**

Push `codex/curate-ai-import`, open a draft pull request with the verification evidence, and keep the worktree for review iteration.

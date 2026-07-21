# Curate Import Failure Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete a persisted failed import immediately, with consistent language and confirmation in both Error and Review phases.

**Architecture:** Reuse the existing `api.curateImports.abandon` soft-delete behavior and centralize its confirmation UI in a small component shared by `ImportPanel` and `ImportBatchReview`. No Worker, API, or schema change is required.

**Tech Stack:** React 19, TypeScript, Playwright, Tailwind CSS tokens

---

### Task 1: Shared delete action and failed-state regression

**Files:**
- Create: `src/components/TeaCompass/import/ImportDeleteAction.tsx`
- Modify: `src/components/TeaCompass/import/ImportPanel.tsx`
- Modify: `src/components/TeaCompass/import/ImportBatchReview.tsx`
- Test: `tests/compass-import.spec.ts`

- [ ] **Step 1: Write the failing Playwright test**

Extend the existing initial-analysis-failure scenario so it expects a `Delete import` button before any close/reload, opens the confirmation, verifies Cancel receives focus, cancels once, then confirms deletion and verifies the panel and recovery entry disappear.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx playwright test tests/compass-import.spec.ts --project="Desktop Chrome" --grep "initial analysis failure"
```

Expected: FAIL because `Delete import` is absent from the error phase.

- [ ] **Step 3: Add the shared action**

Create `ImportDeleteAction` with `busy`, `onDelete`, and optional compact-layout props. It owns confirmation state and focus restoration. Labels must be `Delete import`, `Cancel`, and `Delete import` in the confirmation. Confirmation copy must explain that the import is removed while the saved record is retained.

- [ ] **Step 4: Wire both phases**

Render `ImportDeleteAction` in `ImportPanel`'s error phase only when `state.detail` exists, calling the existing `abandon` handler. Replace the bespoke `confirmAbandon` UI in `ImportBatchReview` with the shared action. Keep Retry on the commitment side and obey the project's Cancel/delete placement rules.

- [ ] **Step 5: Run focused verification and verify GREEN**

Run:

```bash
npx playwright test tests/compass-import.spec.ts --project="Desktop Chrome" --grep "initial analysis failure|recoverable through explicit"
npm run lint
npm run lint:colors
git diff --check
```

Expected: both focused Playwright tests pass; lint, color lint, and whitespace checks exit 0.

- [ ] **Step 6: Commit the task-scoped files**

```bash
git add docs/superpowers/specs/2026-07-21-curate-import-delete-failure-design.md docs/superpowers/plans/2026-07-21-curate-import-delete-failure.md src/components/TeaCompass/import/ImportDeleteAction.tsx src/components/TeaCompass/import/ImportPanel.tsx src/components/TeaCompass/import/ImportBatchReview.tsx tests/compass-import.spec.ts
git commit -m "fix(import): allow deleting failed imports"
```

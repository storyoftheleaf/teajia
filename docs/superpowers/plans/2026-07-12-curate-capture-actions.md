# Curate Capture Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the redundant capture verdict controls with an equal-width `Buy | Done | Sample` footer whose Sample action opens the current tea's tasting builder.

**Architecture:** Repurpose the mobile-only `CaptureVerdictRow` into a small presentation component named `CaptureActionFooter` with three explicit callbacks and no status/sample-cart mutation. Use it inside `CaptureCard` for mobile and mirror the same ordering and semantics in the existing desktop action bar, delegating Buy and Sample through `CaptureCardActions` so both layouts operate on the exact active entry.

**Tech Stack:** React 19, TypeScript, Tailwind v3 token classes, Zustand, Framer Motion, Playwright.

---

## File Map

- Create `src/components/TeaCompass/CaptureActionFooter.tsx`: shared three-action footer presentation.
- Delete `src/components/TeaCompass/CaptureVerdictRow.tsx`: obsolete four-verdict presentation.
- Modify `src/components/TeaCompass/CaptureCard.tsx`: wire mobile Buy, Done, and Sample; remove the separate Buy trigger and redundant status/sample-cart footer mutations.
- Modify `src/components/TeaCompass/index.tsx`: replace the desktop verdict bar with equal-width Buy, Done, and Sample controls.
- Modify `tests/compass-capture.spec.ts`: verify semantics, ordering, sizing, and removal on desktop and mobile.

### Task 1: Lock the footer contract with failing browser tests

**Files:**
- Modify: `tests/compass-capture.spec.ts`

- [ ] **Step 1: Add the failing action-hierarchy test**

Add a test that opens Compass and scopes to `[data-testid="capture-action-footer"]`. Assert its visible buttons have accessible names in this exact order:

```ts
const footer = page.getByTestId('capture-action-footer').filter({ visible: true });
await expect(footer.getByRole('button')).toHaveCount(3);
await expect(footer.getByRole('button')).toHaveText(['Buy', 'Done', 'Sample']);
await expect(page.getByRole('button', { name: 'Tasted', exact: true })).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Want', exact: true })).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Pass', exact: true })).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Bag it', exact: true })).toHaveCount(0);
```

Read the three button bounding boxes and assert their widths differ by no more than one pixel.

- [ ] **Step 2: Add the failing Sample behavior test**

Fill the tea name, set `Considering`, click Sample in the visible footer, and assert the current tea's tasting dialog opens. Read the active entry from `useTeaCompassStore` and assert `decision === 'considering'` and `sampleState` remains null/undefined.

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
npx playwright test tests/compass-capture.spec.ts --grep "capture action footer|Sample opens" --project='Desktop Chrome' --project='Mobile Chrome' --workers=1 --reporter=line
```

Expected: FAIL because `capture-action-footer` and the Sample button do not exist and the redundant verdict buttons remain.

- [ ] **Step 4: Commit the failing tests**

```bash
git add tests/compass-capture.spec.ts
git commit -m "test(curate): define capture footer actions"
```

### Task 2: Build the mobile footer and remove duplicated actions

**Files:**
- Create: `src/components/TeaCompass/CaptureActionFooter.tsx`
- Delete: `src/components/TeaCompass/CaptureVerdictRow.tsx`
- Modify: `src/components/TeaCompass/CaptureCard.tsx`

- [ ] **Step 1: Create `CaptureActionFooter`**

Implement a three-column grid with `data-testid="capture-action-footer"`. Accept `onBuy`, `onDone`, `onSample`, `doneEnabled`, and optional `className`. Render equal-width buttons in `Buy`, `Done`, `Sample` order. Give Done `bg-tea-gold text-tea-bg`; give Buy and Sample quiet bordered/token-based treatments. Every button must have `min-h-11 tap-target` and explicit `aria-label`.

- [ ] **Step 2: Wire the mobile callbacks**

In `CaptureCard`, replace `CaptureVerdictRow` with:

```tsx
<CaptureActionFooter
  className="lg:hidden"
  onBuy={() => {
    const defaultQty = entry.category === 'teaware' ? 1 : 100;
    if (!showBuyPicker) setBuyingQty(defaultQty);
    setShowBuyPicker(value => !value);
  }}
  onDone={handleCommit}
  onSample={openTastingOverlay}
  doneEnabled={entryHasContent(entry)}
/>
```

Remove the older standalone Buy button above the purchase picker while retaining its expanded picker, receipt review, and ledger behavior.

- [ ] **Step 3: Remove obsolete mutations and imports**

Delete mobile footer code that mutates `status`, `isSample`, `sampleState`, or `useSampleCartStore`. Remove imports and local selectors that are unused after this deletion. Do not remove legacy fields from types or persistence.

- [ ] **Step 4: Run focused tests**

Run the Task 1 Playwright command. Expected: mobile assertions pass; desktop remains red until Task 3.

- [ ] **Step 5: Commit the mobile implementation**

```bash
git add src/components/TeaCompass/CaptureActionFooter.tsx src/components/TeaCompass/CaptureCard.tsx src/components/TeaCompass/CaptureVerdictRow.tsx
git commit -m "feat(curate): simplify mobile capture actions"
```

### Task 3: Match the desktop footer and verify the whole flow

**Files:**
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `tests/compass-capture.spec.ts`

- [ ] **Step 1: Replace the desktop verdict bar**

Inside the existing desktop sourcing footer, remove Tasted, Want, Pass, Bag it, Share, and their divider elements. Render a `grid grid-cols-3` container with `data-testid="capture-action-footer"` and equal-width buttons in this order:

```tsx
<button onClick={() => captureCardActionsRef.current?.toggleBuy()}>Buy</button>
<button data-testid="compass-done-desktop" onClick={handleDoneClick}>Done</button>
<button onClick={() => captureCardActionsRef.current?.openTasting()}>Sample</button>
```

Done retains the gold fill; Buy and Sample use the same quiet treatment as mobile. Preserve existing readiness disabling on Done.

- [ ] **Step 2: Remove unused desktop state and imports**

Remove `isWantEntry`, `isPassEntry`, `captureEntryInCart`, sample-cart mutators, verdict icons, and Share footer code only where no longer used elsewhere. Keep the existing header/share affordance.

- [ ] **Step 3: Run footer tests and verify GREEN**

Run the Task 1 command. Expected: all selected Desktop and Mobile tests pass.

- [ ] **Step 4: Run regression verification**

Run:

```bash
npx vitest run src/lib/teaCompassStore.test.ts src/lib/teaCompassSync.test.ts
npx playwright test tests/compass-capture.spec.ts tests/compass-responsive.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --workers=1 --reporter=line
npm run lint
npm run lint:colors
npm run build
```

Expected: zero failures; only existing non-blocking build/chunk-size and color migration notices may remain.

- [ ] **Step 5: Commit the desktop implementation**

```bash
git add src/components/TeaCompass/index.tsx tests/compass-capture.spec.ts
git commit -m "feat(curate): align capture footer actions"
```

### Task 4: Independent review and production handoff

**Files:**
- Review: all files changed by Tasks 1–3

- [ ] **Step 1: Run a specification review**

Confirm the implementation matches `docs/superpowers/specs/2026-07-12-curate-capture-actions-design.md`, including footer order, equal sizing, gold Done, decision independence, and mobile-nav clearance.

- [ ] **Step 2: Run a code-quality review**

Check for duplicated callbacks, orphaned status/sample-cart imports, inaccessible labels, or lost Buy/Done behavior.

- [ ] **Step 3: Resolve findings and rerun affected verification**

Apply only changes needed for review findings, then rerun the focused Playwright test and any directly affected unit/lint command.

- [ ] **Step 4: Push `main` and verify deployment**

Push the reviewed commits. Monitor the `Deploy frontend` workflow to completion, then verify the live index-referenced AdminApp chunk returns `application/javascript` and the deployed admin footer renders without reloads.

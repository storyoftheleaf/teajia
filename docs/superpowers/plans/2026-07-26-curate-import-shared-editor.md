# Curate Import Shared Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Import Review use the current Curate Source visual language and shared presentation primitives, while moving incomplete imports from Source into Library's normal scrolling content with safe deletion.

**Architecture:** Keep Capture and Import as separate state/API adapters. Extract controlled Curate presentation primitives used by both, then compose Import Review as a continuous sheet with compact context, field-level uncertainty, inline actions, and no exposed provenance machinery. TeaCompass continues to own the account-scoped incomplete-import query and passes Library a small open/delete adapter.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Vitest, Playwright, React Query, existing Curate Import API.

---

## File map

- Create `src/components/TeaCompass/CuratePrimitives.tsx`: controlled field, disclosure, action band, and record-row presentation.
- Create `src/components/TeaCompass/CuratePrimitives.test.tsx`: server-rendered primitive contracts.
- Modify `src/components/TeaCompass/CaptureActionFooter.tsx`: adapt Capture actions to `CurateActionBand`.
- Modify `src/components/TeaCompass/DetailsRow.tsx`: adapt Capture details to `CurateDisclosure` without changing Capture state.
- Modify `src/components/TeaCompass/ImportBatchChip.tsx`: render a compact shared record row with Open and Delete.
- Create `src/components/TeaCompass/LibraryImportsSection.tsx`: render incomplete imports in Library even when the tea identity list is empty.
- Modify `src/components/TeaCompass/index.tsx`: remove Source's import strip; pass Library import/open/delete props; preserve query refresh and panel opening.
- Modify `src/components/TeaCompass/import/importFolioPresentation.ts`: concise one-line header and batch-summary helpers.
- Modify `src/components/TeaCompass/import/importFolioPresentation.test.ts`: presentation behavior tests.
- Modify `src/components/TeaCompass/import/ImportFolioHeader.tsx`: one-line sticky task bar without phase tabs.
- Modify `src/components/TeaCompass/import/ImportBatchReview.tsx`: compact context, nonsticky final action band, and quiet vendor grouping.
- Modify `src/components/TeaCompass/import/ImportVendorGroup.tsx`: continuous-sheet grouping and ready disclosure.
- Modify `src/components/TeaCompass/import/ImportItemRow.tsx`: controlled Curate fields, uncertainty-first sections, hidden provenance, concise row copy, save-and-advance callback.
- Modify `src/components/TeaCompass/import/ImportPanel.tsx`: wire focus/advance behavior and compact review shell.
- Modify `src/styles/card-utilities.css`: only shared primitive roles that cannot be expressed with the existing authoritative Curate roles.
- Modify `tests/compass-import.spec.ts`: end-to-end Source, Library, review, delete, retry, finalize, and overflow behavior.

### Task 1: Extract the shared Curate presentation layer

**Files:**
- Create: `src/components/TeaCompass/CuratePrimitives.tsx`
- Create: `src/components/TeaCompass/CuratePrimitives.test.tsx`
- Modify: `src/components/TeaCompass/CaptureActionFooter.tsx`
- Modify: `src/components/TeaCompass/DetailsRow.tsx`

- [ ] **Step 1: Write failing primitive contract tests**

Use `renderToStaticMarkup` to assert the controlled field exposes its label/status, the disclosure exposes `aria-expanded`/`aria-controls`, the action band keeps neutral actions before the primary action, and the record row exposes separate Open/Delete controls.

```tsx
it('renders a controlled Curate field with a field-level Confirm cue', () => {
  const html = renderToStaticMarkup(
    <CurateField label="English name" status="Confirm">
      <input aria-label="English name" value="Aged Liu Bao Tea" readOnly />
    </CurateField>,
  );
  expect(html).toContain('curate-field');
  expect(html).toContain('English name');
  expect(html).toContain('Confirm');
});

it('renders disclosure and action semantics shared by Capture and Import', () => {
  const disclosure = renderToStaticMarkup(<CurateDisclosure id="details" label="More tea details" open={false} onToggle={() => undefined}>Details</CurateDisclosure>);
  expect(disclosure).toContain('aria-expanded="false"');
  expect(disclosure).toContain('aria-controls="details"');
  const actions = renderToStaticMarkup(<CurateActionBand primary={{ label: 'Save tea', onClick: () => undefined }} neutral={[{ label: 'Cancel', onClick: () => undefined }]} />);
  expect(actions.indexOf('Cancel')).toBeLessThan(actions.indexOf('Save tea'));
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run src/components/TeaCompass/CuratePrimitives.test.tsx`

Expected: FAIL because `CuratePrimitives.tsx` does not exist.

- [ ] **Step 3: Implement controlled primitives using existing Curate roles**

Export these stable interfaces from `CuratePrimitives.tsx`:

```tsx
export interface CurateActionSpec {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busyLabel?: string;
  busy?: boolean;
  ariaLabel?: string;
}

export const CurateField: React.FC<{
  label: string;
  status?: string;
  helper?: React.ReactNode;
  className?: string;
  children: React.ReactElement;
}>;

export const CurateDisclosure: React.FC<{
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}>;

export const CurateActionBand: React.FC<{
  neutral?: CurateActionSpec[];
  primary: CurateActionSpec;
  className?: string;
}>;

export const CurateRecordRow: React.FC<{
  title: string;
  metadata: string;
  status?: string;
  openLabel?: string;
  onOpen: () => void;
  deleteLabel?: string;
  onDelete?: () => void;
  busy?: boolean;
}>;
```

The implementations must use `curate-field`, `curate-field-with-label`, `curate-action`, `curate-compact-target`, `curate-compact-chrome`, `border-tea-border`, and existing typography tokens. They must not own domain state, coerce values, or import Capture/Import stores.

- [ ] **Step 4: Migrate Capture adapters without behavior changes**

Render `CaptureActionFooter` through `CurateActionBand`, preserving `data-testid`, Buy expansion ARIA, Done enabled state, and optional Sample. Render `DetailsRow`'s disclosure chrome through `CurateDisclosure`, leaving all field/store behavior in `DetailsRow`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run src/components/TeaCompass/CuratePrimitives.test.tsx src/components/TeaCompass/CaptureActionFooter.test.tsx src/components/TeaCompass/DetailsRow.test.tsx`

Expected: PASS. If either existing test file is absent, run the primitive test plus `npm run lint` and record that no adapter-specific unit test existed.

- [ ] **Step 6: Commit**

```bash
git add src/components/TeaCompass/CuratePrimitives.tsx src/components/TeaCompass/CuratePrimitives.test.tsx src/components/TeaCompass/CaptureActionFooter.tsx src/components/TeaCompass/DetailsRow.tsx
git commit -m "refactor(curate): share editor presentation primitives"
```

### Task 2: Move incomplete imports into Library and add row deletion

**Files:**
- Modify: `src/components/TeaCompass/ImportBatchChip.tsx`
- Create: `src/components/TeaCompass/LibraryImportsSection.tsx`
- Create: `src/components/TeaCompass/LibraryImportsSection.test.tsx`
- Modify: `src/components/TeaCompass/index.tsx`
- Test: `tests/compass-import.spec.ts`

- [ ] **Step 1: Change the Playwright expectations first**

Add/replace scenarios so they prove:

```ts
await page.getByRole('tab', { name: 'Source' }).click();
await expect(page.getByRole('region', { name: 'Incomplete imports' })).toHaveCount(0);

await page.getByRole('tab', { name: 'Library' }).click();
const imports = page.getByRole('region', { name: 'Imports' });
await expect(imports).toBeVisible();
await expect(imports.getByRole('button', { name: /Open imported list/i })).toBeVisible();
await expect(imports.getByRole('button', { name: /Delete imported list/i })).toBeVisible();
```

The delete scenario must confirm once, send exactly one `/abandon` request, retain the source record in the mock, and remove the row immediately after success. Add a retry scenario where the first abandon fails and the second succeeds.

- [ ] **Step 2: Run the Library scenarios and verify RED**

Run: `npx playwright test tests/compass-import.spec.ts --grep "Library imports|delete imported list" --project=chromium`

Expected: FAIL because imports still render in the Source header strip and Library has no Imports region.

- [ ] **Step 3: Add a controlled Library import section**

Create `LibraryImportsSection` with:

```ts
interface LibraryImportsSectionProps {
  imports: CurateImportDetail[];
  busyImportId: string | null;
  errorByImportId: Record<string, string>;
  onOpen: (detail: CurateImportDetail) => void;
  onDelete: (detail: CurateImportDetail) => Promise<void>;
}
```

Render `<section aria-label="Imports">` only when `imports.length > 0`. Use `ImportBatchChip` as a `CurateRecordRow` adapter; do not add sticky, fixed, `shrink-0`, or independent scrolling styles. Mount the section immediately before `BrowseView` in both existing Library branches inside their normal scrolling tabpanels. Keeping it outside `BrowseView` ensures imports remain visible when the identity list takes its existing loading, error, or empty-state early return.

- [ ] **Step 4: Move ownership without changing query semantics**

In `TeaCompass`:

```ts
const openSavedImport = (detail: CurateImportDetail) => {
  setImportDetail(detail);
  setImportPanelVersion(version => version + 1);
  setImportOpen(true);
};
```

Remove the Source-only `aria-label="Incomplete imports"` strip and `showAllImports`. Render `LibraryImportsSection` before both mobile and desktop `BrowseView` instances. On successful abandon, update `['curate-imports', 'incomplete', activeAccountId]` and clear any selected import matching the abandoned batch. On failure, leave the row in place and expose the retryable inline error.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx playwright test tests/compass-import.spec.ts --grep "Library imports|delete imported list" --project=chromium`

Expected: PASS with no Source import region and one nonsticky Library Imports region.

- [ ] **Step 6: Commit**

```bash
git add src/components/TeaCompass/ImportBatchChip.tsx src/components/TeaCompass/LibraryImportsSection.tsx src/components/TeaCompass/LibraryImportsSection.test.tsx src/components/TeaCompass/index.tsx tests/compass-import.spec.ts
git commit -m "feat(curate): move saved imports into Library"
```

### Task 3: Replace the three-row Import header and sticky footer

**Files:**
- Modify: `src/components/TeaCompass/import/importFolioPresentation.ts`
- Modify: `src/components/TeaCompass/import/importFolioPresentation.test.ts`
- Modify: `src/components/TeaCompass/import/ImportFolioHeader.tsx`
- Modify: `src/components/TeaCompass/import/ImportBatchReview.tsx`
- Modify: `src/components/TeaCompass/import/ImportVendorGroup.tsx`
- Modify: `src/components/TeaCompass/import/ImportPanel.tsx`
- Test: `tests/compass-import.spec.ts`

- [ ] **Step 1: Write failing presentation and DOM tests**

Replace phase-tab assertions with concise context assertions:

```ts
expect(folioPhaseContext('review', reviewDetail)).toEqual({
  title: 'Review imported teas',
  status: '2 of 3 need attention',
});
expect(importBatchSummary(reviewDetail)).toBe('3 teas · 2 vendors · 3.5 kg · CNY 2,300');
```

In Playwright assert that `Record`, `Review`, and `Added` progress navigation is absent; `Review imported teas` appears once; the header's bounding box is one row on desktop and mobile; and no element inside review has `position: sticky` except the task header.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/components/TeaCompass/import/importFolioPresentation.test.ts && npx playwright test tests/compass-import.spec.ts --grep "compact import review" --project=chromium`

Expected: FAIL on the old title/status and phase navigation.

- [ ] **Step 3: Implement concise presentation helpers**

Keep `folioPhase` for input/review/completion switching, but make `folioPhaseContext` return `Review imported teas` and an `N of total need(s) attention` status during review. Add `importBatchSummary(detail)` that derives item noun/count, resolved vendor display, total grams formatted to kg when exact, and currency totals without inventing missing values.

- [ ] **Step 4: Recompose the shell**

Make `ImportFolioHeader` a single `sticky top-0` grid row containing Close, title, and compact status. Remove the phase array/nav and subtitle. In `ImportPanel`, reduce outer review padding to match the Source sheet and keep `pb-nav` only for actual mobile navigation clearance.

In `ImportBatchReview`, render:

```tsx
<p data-testid="import-batch-summary" className="curate-context-band px-2 py-2 text-ui-12 text-tea-text-sec">
  {importBatchSummary(detail)}
</p>
```

Replace the bottom `sticky` slab with an inline `CurateActionBand` after the list. Keep analysis retry, review later, new import, finalize eligibility, and safe delete behavior. `ImportVendorGroup` becomes a quiet cluster within `curate-source-sheet`; vendor selection remains available but the vendor name is no longer a large display heading.

- [ ] **Step 5: Run and verify GREEN**

Run: `npx vitest run src/components/TeaCompass/import/importFolioPresentation.test.ts && npx playwright test tests/compass-import.spec.ts --grep "compact import review" --project=chromium`

Expected: PASS; task header is one row and no oversized sticky footer remains.

- [ ] **Step 6: Commit**

```bash
git add src/components/TeaCompass/import/importFolioPresentation.ts src/components/TeaCompass/import/importFolioPresentation.test.ts src/components/TeaCompass/import/ImportFolioHeader.tsx src/components/TeaCompass/import/ImportBatchReview.tsx src/components/TeaCompass/import/ImportVendorGroup.tsx src/components/TeaCompass/import/ImportPanel.tsx tests/compass-import.spec.ts
git commit -m "refactor(curate): compact the import review shell"
```

### Task 4: Rebuild each imported tea as a shared continuous-sheet editor

**Files:**
- Modify: `src/components/TeaCompass/import/ImportItemRow.tsx`
- Modify: `src/components/TeaCompass/import/ImportVendorGroup.tsx`
- Modify: `src/components/TeaCompass/import/ImportPanel.tsx`
- Modify: `src/components/TeaCompass/import/importReviewDomain.ts`
- Create: `src/components/TeaCompass/import/importItemPresentation.test.ts`
- Modify: `tests/compass-import.spec.ts`

- [ ] **Step 1: Write failing uncertainty and editing tests**

Add unit tests for a pure helper that maps blocking fields into visible editor sections and labels:

```ts
expect(importEditorSections(['english_name', 'currency'])).toEqual(['identity', 'purchase']);
expect(importFieldNeedsConfirmation('currency', ['currency'])).toBe(true);
expect(importFieldNeedsConfirmation('year', ['currency'])).toBe(false);
```

Add Playwright coverage asserting collapsed rows show English/original name, quantity-cost equation, one decision message, and Review; normal UI contains neither `Record used for this item`, `Record location`, raw UUID/text ranges, `Exact source excerpt`, nor confident provenance labels. Expanded rows must expose Identity, Purchase, Inventory, `More tea details`, Cancel left, and Save tea right.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/components/TeaCompass/import/importItemPresentation.test.ts && npx playwright test tests/compass-import.spec.ts --grep "continuous import tea editor" --project=chromium`

Expected: FAIL because the helper is absent and old provenance/editing UI remains.

- [ ] **Step 3: Implement the pure presentation mapping**

Export from `importReviewDomain.ts`:

```ts
export type ImportEditorSection = 'identity' | 'purchase' | 'inventory';
const IMPORT_EDITOR_SECTION_FIELDS: Record<ImportEditorSection, Set<string>> = {
  identity: new Set(['name', 'englishname', 'originalname', 'chinesename', 'type', 'classification', 'year', 'form', 'origincountry', 'originregion', 'duplicateidentity', 'compassentryid', 'proposedcompassentryid']),
  purchase: new Set(['packcount', 'packweight', 'weightunit', 'totalquantitygrams', 'totalunits', 'quantity', 'priceamount', 'linecost', 'pricebasis', 'currency']),
  inventory: new Set(['disposition', 'productid', 'proposedproductid', 'inventoryholding', 'purpose', 'inventorypurpose']),
};
const normalizedImportField = (field: string) => field.replace(/_/g, '').toLocaleLowerCase();
export const importEditorSections = (blockingFields: string[]): ImportEditorSection[] =>
  (['identity', 'purchase', 'inventory'] as const).filter(section => blockingFields.some(field => IMPORT_EDITOR_SECTION_FIELDS[section].has(normalizedImportField(field))));
export const importFieldNeedsConfirmation = (field: string, blockingFields: string[]) => {
  const normalized = normalizedImportField(field);
  return blockingFields.some(blocker => normalizedImportField(blocker) === normalized);
};
```

Reuse the existing canonical-field alias resolution rather than maintaining a second uncertainty vocabulary.

- [ ] **Step 4: Compose ImportItemRow from shared primitives**

Keep `draftFromItem`, exact string values, `reviewedFieldsForImportSave`, match validation, and update payload semantics. Change only presentation and edit flow:

- collapsed button label is `Review`;
- hide source excerpt/evidence reference/provenance output from the normal DOM;
- use `CurateField` for editable controls, passing `status="Confirm"` only when `importFieldNeedsConfirmation` is true;
- group controls into `curate-cluster curate-zone-identity`, `curate-cluster curate-zone-purchase`, and an Inventory cluster;
- put nonblocking fields behind `CurateDisclosure` labeled `More tea details`;
- render Cancel/Save tea through `CurateActionBand`;
- on successful save, collapse and call optional `onSaved(itemId)`.

`ImportVendorGroup` owns one open item at a time and a collapsed `N ready` disclosure. `ImportBatchReview`/`ImportPanel` use `nextBlockingImportItemId` to focus and open the next unresolved tea after save without changing API payloads.

- [ ] **Step 5: Verify retry and draft preservation**

Extend the existing failed-update mock so Save tea fails once, leaves edited values rendered, exposes `Retry action`, and succeeds without clearing the draft. Confirm Cancel restores focus to the row's Review button.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npx vitest run src/components/TeaCompass/import/importItemPresentation.test.ts src/components/TeaCompass/import/importReviewDomain.test.ts && npx playwright test tests/compass-import.spec.ts --grep "continuous import tea editor|save imported tea|retry imported tea" --project=chromium`

Expected: PASS with exact quantities/costs preserved and no provenance machinery in the normal UI.

- [ ] **Step 7: Commit**

```bash
git add src/components/TeaCompass/import/ImportItemRow.tsx src/components/TeaCompass/import/ImportVendorGroup.tsx src/components/TeaCompass/import/ImportPanel.tsx src/components/TeaCompass/import/importReviewDomain.ts src/components/TeaCompass/import/importItemPresentation.test.ts tests/compass-import.spec.ts
git commit -m "feat(curate): reuse the tea editor for import review"
```

### Task 5: Visual, responsive, and regression verification

**Files:**
- Modify: `src/styles/card-utilities.css`
- Modify: files already listed above only when visual verification exposes a failing assertion
- Test: `tests/compass-import.spec.ts`

- [ ] **Step 1: Start the app and inspect the real screens**

Run: `npm run dev:test`

Open `/admin/compass` at desktop and 390×844. Verify Source has no saved-import furniture; Library's Imports section scrolls with content; the import header stays one row; review is a continuous sheet; Cancel/Save order is correct; no horizontal overflow exists; and the bottom nav does not cover actions.

- [ ] **Step 2: Add visual regression assertions before any polish fix**

In `tests/compass-import.spec.ts`, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, the Imports region moves when Library scrolls, the task header height stays within 64px, and no review action band overlaps the last tea row at mobile size.

- [ ] **Step 3: Apply only evidence-driven polish**

Use existing Curate roles first. Add CSS to `card-utilities.css` only when the inspection proves a shared primitive needs a reusable role. Do not add gradients, glows, nested cards, horizontal scrollers, perpetual motion, or new dependencies. Preserve reduced-motion behavior and current Source styling.

- [ ] **Step 4: Run complete verification**

Run, in order:

```bash
npx vitest run src/components/TeaCompass
npx playwright test tests/compass-import.spec.ts --project=chromium --project='Mobile Chrome'
npm run lint
npm run lint:colors
npm run build
git diff --check
```

Expected: all commands exit 0; Playwright reports no overflow, sticky obstruction, or console errors.

- [ ] **Step 5: Review the implementation against the approved design**

Confirm every requirement in `docs/superpowers/specs/2026-07-26-curate-import-shared-editor-design.md` has a corresponding passing test or inspected UI state. Confirm Capture behavior is unchanged and no source identifiers are exposed in Import Review.

- [ ] **Step 6: Commit**

```bash
git add src/styles/card-utilities.css src/components/TeaCompass tests/compass-import.spec.ts
git commit -m "test(curate): verify shared import editor polish"
```

# Curate Import Sourcing Folio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Transform the existing Curate Import drawer into the approved full-screen sourcing-folio workspace without changing the import data engine.

**Architecture:** Keep ImportPanel as the orchestration and accessibility boundary, but replace its drawer composition with a full-screen shell and explicit Evidence, Review, and Added presentation states. Add a small presentation-domain module for phase copy, blocker ordering, and next-issue navigation so visual components remain declarative and testable. Evolve the existing input, vendor, item, evidence, and completion components rather than duplicating the workflow.

**Tech Stack:** React 19, TypeScript, Tailwind v3 token classes, Vitest, and Playwright.

---

## File map

Create:

- src/components/TeaCompass/import/importFolioPresentation.ts: phase, context, ordering, and next-blocker helpers.
- src/components/TeaCompass/import/importFolioPresentation.test.ts: presentation-domain tests.
- src/components/TeaCompass/import/ImportFolioHeader.tsx: full-screen title, context, and accessible phase indicator.

Modify:

- src/components/TeaCompass/import/ImportPanel.tsx: full-screen shell, phase derivation, preserved focus and dirty-draft behavior.
- src/components/TeaCompass/import/ImportInput.tsx: editorial source-document layout.
- src/components/TeaCompass/import/ImportBatchReview.tsx: blocker traversal and sticky actions.
- src/components/TeaCompass/import/ImportBatchSummary.tsx: provenance and AI annotation.
- src/components/TeaCompass/import/ImportVendorGroup.tsx: vendor folio sections and blocker-first ordering.
- src/components/TeaCompass/import/ImportItemRow.tsx: Curate typography and Capture-compatible editor.
- src/components/TeaCompass/import/ImportJourneyPicker.tsx: remove side-stripe expansion.
- src/components/TeaCompass/import/ImportEvidenceCard.tsx: compact evidence provenance.
- src/components/TeaCompass/import/ImportEvidencePreview.tsx: quiet evidence list.
- src/components/TeaCompass/import/ImportCompletionSummary.tsx: vendor-led sourcing ledger.
- tests/compass-import.spec.ts: full-screen, phase, hierarchy, mobile, navigation, and completion contracts.
- docs/CHANGELOG.md: verified redesign entry.

No Worker, API, schema, migration, or navigation files should change.

---

### Task 1: Lock the folio presentation model with unit tests

**Files:**

- Create: src/components/TeaCompass/import/importFolioPresentation.ts
- Create: src/components/TeaCompass/import/importFolioPresentation.test.ts
- Read: src/components/TeaCompass/import/importReviewDomain.ts

- [ ] **Step 1: Write the failing presentation-domain tests**

Create importFolioPresentation.test.ts:

~~~ts
import { describe, expect, it } from 'vitest';
import {
  folioPhase,
  nextBlockingImportItemId,
  partitionImportItems,
} from './importFolioPresentation';

const row = (id: string, blocked: boolean) => ({
  item: {
    id,
    blocking_fields: blocked ? ['currency'] : [],
  },
});

describe('import folio presentation', () => {
  it('maps workflow state into the three approved phases', () => {
    expect(folioPhase({ phase: 'input', completion: false })).toBe('evidence');
    expect(folioPhase({ phase: 'parsing', completion: false })).toBe('evidence');
    expect(folioPhase({ phase: 'review', completion: false })).toBe('review');
    expect(folioPhase({ phase: 'review', completion: true })).toBe('added');
  });

  it('orders blocked rows before ready rows while preserving partition order', () => {
    const result = partitionImportItems([
      row('ready-1', false),
      row('blocked-1', true),
      row('ready-2', false),
      row('blocked-2', true),
    ]);
    expect(result.needsReview.map(value => value.item.id)).toEqual(['blocked-1', 'blocked-2']);
    expect(result.ready.map(value => value.item.id)).toEqual(['ready-1', 'ready-2']);
  });

  it('advances through blockers and wraps once', () => {
    const items = [
      row('blocked-1', true).item,
      row('ready-1', false).item,
      row('blocked-2', true).item,
    ];
    expect(nextBlockingImportItemId(items, null)).toBe('blocked-1');
    expect(nextBlockingImportItemId(items, 'blocked-1')).toBe('blocked-2');
    expect(nextBlockingImportItemId(items, 'blocked-2')).toBe('blocked-1');
  });
});
~~~

Use Partial<CurateImportItem> casts in the actual test so no production type is weakened.

- [ ] **Step 2: Run the test and verify RED**

Run:

~~~bash
npx vitest run src/components/TeaCompass/import/importFolioPresentation.test.ts
~~~

Expected: FAIL because importFolioPresentation.ts does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create importFolioPresentation.ts:

~~~ts
import type { CurateImportItem } from '../../../lib/api';
import type { ImportPanelState } from './importTypes';

export type ImportFolioPhase = 'evidence' | 'review' | 'added';

export const folioPhase = (input: {
  phase: ImportPanelState['phase'];
  completion: boolean;
}): ImportFolioPhase => {
  if (input.completion) return 'added';
  return input.phase === 'review' ? 'review' : 'evidence';
};

export const partitionImportItems = <T extends { item: Pick<CurateImportItem, 'blocking_fields'> }>(
  rows: T[],
) => ({
  needsReview: rows.filter(row => row.item.blocking_fields.length > 0),
  ready: rows.filter(row => row.item.blocking_fields.length === 0),
});

export const nextBlockingImportItemId = (
  items: Array<Pick<CurateImportItem, 'id' | 'blocking_fields'>>,
  currentId: string | null,
): string | null => {
  const blocked = items.filter(item => item.blocking_fields.length > 0);
  if (!blocked.length) return null;
  const currentIndex = blocked.findIndex(item => item.id === currentId);
  const nextIndex = (currentIndex + 1) % blocked.length;
  return blocked[nextIndex]?.id ?? null;
};
~~~

Add a folioPhaseContext helper in this file. It must return:

- Evidence: title Add vendor evidence and status Draft saved.
- Review: Review N teas/items from N vendor/vendors and the unresolved count.
- Added: Import complete and the actual added-item count.

Use importItemNoun from importReviewDomain.ts for tea/teaware-aware nouns.

- [ ] **Step 4: Run the focused test and verify GREEN**

~~~bash
npx vitest run src/components/TeaCompass/import/importFolioPresentation.test.ts
~~~

Expected: all presentation tests pass.

- [ ] **Step 5: Commit**

~~~bash
git add src/components/TeaCompass/import/importFolioPresentation.ts src/components/TeaCompass/import/importFolioPresentation.test.ts
git commit -m "test(curate): define import folio presentation"
~~~

---

### Task 2: Replace the drawer with the full-screen Curate shell

**Files:**

- Create: src/components/TeaCompass/import/ImportFolioHeader.tsx
- Modify: src/components/TeaCompass/import/ImportPanel.tsx
- Modify: tests/compass-import.spec.ts

- [ ] **Step 1: Write the failing browser contract**

Replace the obsolete “temporary modal” assertion with:

~~~ts
test('opens as a full-screen Curate workspace and preserves capture state', async ({ page }) => {
  await openCompass(page);
  await page.getByRole('tab', { name: 'Import', exact: true }).click();

  const shell = page.getByTestId('import-folio-shell');
  await expect(shell).toBeVisible();
  await expect(shell).toHaveClass(/fixed/);
  await expect(shell).toHaveClass(/inset-0/);
  await expect(shell).toHaveClass(/bg-tea-bg/);
  await expect(shell).not.toHaveClass(/max-w-2xl|ml-auto|border-l/);

  const progress = page.getByRole('navigation', { name: 'Import progress' });
  await expect(progress).toContainText('EvidenceReviewAdded');
  await expect(progress).toHaveAttribute('data-current-phase', 'evidence');
  await expect(page.getByText('Add vendor evidence')).toBeVisible();
});
~~~

Add to the analyzed-review fixture:

~~~ts
await expect(page.getByRole('navigation', { name: 'Import progress' }))
  .toHaveAttribute('data-current-phase', 'review');
await expect(page.getByText(/Review 10 teas from 2 vendors/)).toBeVisible();
~~~

- [ ] **Step 2: Run the focused browser cases and verify RED**

~~~bash
npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --grep='full-screen Curate workspace|groups ten editable teas'
~~~

Expected: FAIL because the drawer and old header remain.

- [ ] **Step 3: Create ImportFolioHeader**

Implement an accessible header with this public contract:

~~~ts
interface ImportFolioHeaderProps {
  phase: ImportFolioPhase;
  context: { title: string; status: string };
  busy: boolean;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}
~~~

The component must render:

- Close at top-left with the existing Close Import accessible name.
- Serif Import title in the center.
- Context title below it.
- Batch status on the right.
- A navigation region named Import progress.
- Evidence, Review, and Added as plain text.
- aria-current="step" on the active phase.
- data-current-phase on the navigation element.
- One fine bronze bottom rule on the active phase.
- No pills, rounded phase buttons, or clickable phase navigation.

Use TYPOGRAPHY_CLASSES and named text-ui classes.

- [ ] **Step 4: Convert ImportPanel to the full-screen shell**

Derive:

~~~ts
const currentFolioPhase = folioPhase({
  phase: state.phase,
  completion: Boolean(completion),
});
const folioContext = folioPhaseContext(currentFolioPhase, normalizedDetail);
~~~

Replace the backdrop and drawer wrappers with:

~~~tsx
<div
  ref={overlayRef}
  data-testid="import-folio-shell"
  className="fixed inset-0 sidebar-inset z-modal bg-tea-bg text-tea-text"
  role="presentation"
>
  <div
    ref={panelRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="curate-import-title"
    className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-tea-bg"
  >
    <ImportFolioHeader
      phase={currentFolioPhase}
      context={folioContext}
      busy={Boolean(busyId)}
      closeRef={closeRef}
      onClose={requestClose}
    />
    <div className="flex-1 min-h-0 overflow-y-auto" aria-live="polite">
      <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 lg:py-10">
        {/* Render the existing state-specific content here. */}
      </div>
    </div>
  </div>
</div>
~~~

In the real implementation, replace the comment with the current input, parsing, error, review, and completion branches unchanged.

Preserve:

- background inert and aria-hidden handling;
- focus containment;
- Escape handling;
- dirty-draft disclosure;
- global busy close lock;
- z-modal;
- pb-nav-gap on sticky mobile actions.

- [ ] **Step 5: Verify shell GREEN**

~~~bash
npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --grep='full-screen Curate workspace|groups ten editable teas'
npm run lint
npm run lint:colors
~~~

Expected: browser cases, TypeScript, and colors pass.

- [ ] **Step 6: Commit**

~~~bash
git add src/components/TeaCompass/import/ImportFolioHeader.tsx src/components/TeaCompass/import/ImportPanel.tsx tests/compass-import.spec.ts
git commit -m "feat(curate): make import a full-screen workspace"
~~~

---

### Task 3: Present Evidence as the sourcing document

**Files:**

- Modify: src/components/TeaCompass/import/ImportInput.tsx
- Modify: src/components/TeaCompass/import/ImportEvidencePreview.tsx
- Modify: src/components/TeaCompass/import/ImportEvidenceCard.tsx
- Modify: tests/compass-import.spec.ts

- [ ] **Step 1: Add the failing mobile Evidence test**

~~~ts
test('presents Evidence as a sourcing document on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Mobile Chrome', 'mobile composition contract');
  await openCompass(page);
  await page.getByRole('tab', { name: 'Import', exact: true }).click();

  const source = page.getByLabel('Vendor list or invoice');
  await expect(source).toBeVisible();
  await expect(source).toHaveCSS('font-size', '16px');
  await expect(source).not.toHaveClass(/rounded-md|bg-tea-surface/);
  await expect(page.getByText('DOC and DOCX are saved as reference-only and are not analyzed.')).toBeVisible();

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBe(0);
});
~~~

- [ ] **Step 2: Run and verify RED**

~~~bash
npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --grep='sourcing document on mobile'
~~~

Expected: FAIL because the textarea is a bordered settings control and its label differs.

- [ ] **Step 3: Implement the editorial source area**

In ImportInput:

- Change the label to Vendor list or invoice.
- Keep textarea text at text-ui-16 on mobile.
- Remove rounded background and surrounding border.
- Use font-body, transparent background, generous line-height, and a bottom divider.
- Keep the pasted content as the dominant element.
- Render the collapsed sourcing run below it.
- Render Add photos and Add files or invoices as neutral text actions separated by spacing, not outlined buttons.
- Keep the two hidden proxy inputs and their single accessible actions unchanged.
- Keep DOC/DOCX disclosure visible before selection.
- Keep the consequence copy and Start import behavior unchanged.

The textarea classes must be:

~~~tsx
className="mt-2 min-h-64 w-full resize-y border-0 bg-transparent px-0 py-3 font-body text-ui-16 leading-relaxed text-tea-text outline-none placeholder:text-tea-text-dim focus:ring-0"
~~~

- [ ] **Step 4: Quiet successful evidence**

For both evidence components:

- Resting, uploaded, analyzed, and reference-only rows use border-b border-tea-border py-3.
- Failed rows retain a full-width bordered error treatment.
- Routine Replace, Remove, and Clear use text-tea-text-sec.
- Retry may use bronze because it resolves active failure.
- All progress, source status, per-file retry, reselection, and deduplication logic remains unchanged.

Do not change evidence types, upload logic, or storage behavior.

- [ ] **Step 5: Run Evidence and recovery tests**

~~~bash
npx vitest run src/components/TeaCompass/import/ImportEvidencePreview.test.tsx src/components/TeaCompass/import/importEvidenceSelection.test.ts src/components/TeaCompass/import/importDraftStorage.test.ts
npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --grep='sourcing document on mobile|removes, replaces, and clears|recovers an account-scoped dirty draft|preflights the Worker'
~~~

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

~~~bash
npm run lint
npm run lint:colors
git add src/components/TeaCompass/import/ImportInput.tsx src/components/TeaCompass/import/ImportEvidencePreview.tsx src/components/TeaCompass/import/ImportEvidenceCard.tsx tests/compass-import.spec.ts
git commit -m "feat(curate): present import evidence as a sourcing document"
~~~

---

### Task 4: Build the vendor-led blocker-first Review folio

**Files:**

- Modify: src/components/TeaCompass/import/ImportBatchReview.tsx
- Modify: src/components/TeaCompass/import/ImportBatchSummary.tsx
- Modify: src/components/TeaCompass/import/ImportVendorGroup.tsx
- Modify: src/components/TeaCompass/import/ImportItemRow.tsx
- Modify: src/components/TeaCompass/import/ImportJourneyPicker.tsx
- Modify: tests/compass-import.spec.ts

- [ ] **Step 1: Add failing blocker-order and Next issue tests**

Add a review test that:

1. Opens the analyzed two-vendor fixture.
2. Reads data-import-item-id and data-blocked from each row in Chen Family Tea.
3. Asserts every blocked row precedes every ready row.
4. Clicks Next issue.
5. Asserts the target blocked article receives focus.
6. Clicks Next issue again and asserts focus advances to the next blocked article.
7. Confirms the mobile page has zero horizontal overflow.

Add to the existing 10-item test:

~~~ts
await expect(page.getByText('AI reading')).toBeVisible();
await expect(page.getByRole('heading', { name: 'Chen Family Tea' })).toHaveClass(/font-display/);
await expect(page.getByText('Needs review', { exact: true })).toBeVisible();
await expect(page.getByText('Ready', { exact: true })).toBeVisible();
~~~

- [ ] **Step 2: Run and verify RED**

~~~bash
npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --grep='advances Next issue|groups ten editable teas'
~~~

Expected: FAIL because server order is unchanged and Next issue is absent.

- [ ] **Step 3: Restyle the batch summary**

ImportBatchSummary must render:

- One provenance line containing item count, vendor count, total quantity, separate currency totals, and the optional sourcing run.
- An AI reading metadata label.
- The overview in italic font-body copy.
- No rounded callout or summary card.
- The existing collapsed ImportJourneyPicker.

Use the current model totals. Do not recompute money or quantity in the component.

- [ ] **Step 4: Partition vendor rows and remove side stripes**

In ImportVendorGroup:

~~~ts
const { needsReview, ready } = partitionImportItems(group.items);
~~~

Render:

- Metadata line with vendor, item count, and suggested/existing state.
- Full-width font-display text-ui-28 vendor heading.
- Absolute top-right Change action.
- One bottom divider.
- Needs review section only when nonempty.
- Ready section only when nonempty.
- Existing item props and callbacks.
- Change-vendor editor in a full-width divided region.

Remove border-l-2 from ImportVendorGroup and ImportJourneyPicker. Replace it with border-y or border-b plus vertical spacing.

- [ ] **Step 5: Restyle tea identity and edit expansion**

In ImportItemRow:

- Add data-import-item-id and data-blocked.
- Add tabIndex={-1}, scroll-mt-32, and visible focus treatment.
- English tea name uses font-display text-ui-20.
- Original/Chinese name keeps font-chinese.
- Weight and cost stay font-mono.
- Remove the side-stripe editor.
- Use a top divider and full-width recessed editing region.
- Rename primary picker labels to Match tea and Choose stock record.
- Keep Library identity and Inventory holding as secondary explanatory language.
- Preserve all review-field, blocker, matching, save, and All details behavior.

- [ ] **Step 6: Implement Next issue**

In ImportBatchReview:

~~~ts
const [currentIssueId, setCurrentIssueId] = useState<string | null>(null);

const focusNextIssue = () => {
  const nextId = nextBlockingImportItemId(detail.items, currentIssueId);
  if (!nextId) return;
  setCurrentIssueId(nextId);
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(
      '[data-import-item-id="' + CSS.escape(nextId) + '"]'
    );
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.focus({ preventScroll: true });
  });
};
~~~

When item blockers remain, the sticky footer shows unresolved count on the left and Next issue on the right. When no item blockers remain, it shows the existing final action with operator-facing copy Add N teas/items to Inventory. If a vendor is still unresolved, keep the final action disabled and show the existing Resolve each vendor helper immediately above it.

Keep Review later, New import, and Abandon import above the sticky commitment region.

- [ ] **Step 7: Run review tests**

~~~bash
npx vitest run src/components/TeaCompass/import/importFolioPresentation.test.ts src/components/TeaCompass/import/importReviewDomain.test.ts
npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --project='Desktop Chrome' --grep='advances Next issue|groups ten editable teas|preserves active edits|promotes naming blockers|disables every conflicting review control'
~~~

Expected: all focused unit and browser cases pass on both projects.

- [ ] **Step 8: Commit**

~~~bash
npm run lint
npm run lint:colors
git add src/components/TeaCompass/import/ImportBatchReview.tsx src/components/TeaCompass/import/ImportBatchSummary.tsx src/components/TeaCompass/import/ImportVendorGroup.tsx src/components/TeaCompass/import/ImportItemRow.tsx src/components/TeaCompass/import/ImportJourneyPicker.tsx tests/compass-import.spec.ts
git commit -m "feat(curate): build vendor-led import review"
~~~

---

### Task 5: Replace completion metrics with the sourcing ledger

**Files:**

- Modify: src/components/TeaCompass/import/ImportCompletionSummary.tsx
- Modify: tests/compass-import.spec.ts

- [ ] **Step 1: Add a failing completion-ledger test**

~~~ts
test('finishes as a vendor-led sourcing ledger without metric cards', async ({ page }) => {
  await finalizeAnalyzedImport(page);
  const summary = page.getByRole('region', { name: 'Import complete' });

  await expect(summary).toBeVisible();
  await expect(summary.getByText('Connected records')).toHaveCount(0);
  await expect(summary.getByRole('heading', { name: 'Chen Family Tea' })).toBeVisible();
  await expect(summary.getByText('Tea record reused')).toBeVisible();
  await expect(summary.getByText('Stock record created')).toBeVisible();
  await expect(summary.getByRole('link', { name: 'Open received receipt' }))
    .toHaveAttribute('href', /\/admin\/stock\?receipt=/);
  await expect(page.getByRole('navigation', { name: 'Import progress' }))
    .toHaveAttribute('data-current-phase', 'added');
});
~~~

- [ ] **Step 2: Run and verify RED**

~~~bash
npx playwright test tests/compass-import.spec.ts --project='Mobile Chrome' --grep='vendor-led sourcing ledger'
~~~

Expected: FAIL because the metric tiles and repeated item cards remain.

- [ ] **Step 3: Group finalization rows by actual vendor receipt**

Keep the existing result-to-detail item mapping, then derive:

~~~ts
const rowsByGroup = rows.reduce<Map<string, typeof rows>>((groups, row) => {
  const groupId = row.item.vendor_group_id || 'ungrouped';
  groups.set(groupId, [...(groups.get(groupId) ?? []), row]);
  return groups;
}, new Map());

const vendorByGroup = new Map(
  result.receipts.map(receipt => [receipt.groupId, receipt.vendorName])
);
~~~

Render one ledger section per group:

- Vendor receipt metadata label.
- font-display text-ui-28 vendor name.
- Divided tea rows.
- Serif tea name and Chinese name.
- Exact quantity and cost.
- Tea record created/reused from identityDisposition.
- Stock record created/reused from holdingDisposition.
- Existing Library and Inventory deep links.
- Exact received-receipt link using receipt.id.
- Actual Journey name from result.journey.
- Close summary left and Start another import right.

Remove the two metric tiles and card wrapper from each row. Do not infer dispositions, vendors, or Journey names.

- [ ] **Step 4: Run completion and Inventory regressions**

~~~bash
npx playwright test tests/compass-import.spec.ts tests/inventory-scroll.spec.ts --project='Mobile Chrome' --project='Desktop Chrome' --grep='vendor-led sourcing ledger|finalized receipt|inventory scroll'
~~~

Expected: completion ledger and Inventory height/deep-link tests pass.

- [ ] **Step 5: Commit**

~~~bash
npm run lint
npm run lint:colors
git add src/components/TeaCompass/import/ImportCompletionSummary.tsx tests/compass-import.spec.ts
git commit -m "feat(curate): finish imports as sourcing ledgers"
~~~

---

### Task 6: Verify the complete redesign and document it

**Files:**

- Modify: docs/CHANGELOG.md
- Verify: src/components/TeaCompass/import/*
- Verify: tests/compass-import.spec.ts
- Verify: tests/compass-capture.spec.ts
- Verify: tests/inventory-scroll.spec.ts

- [ ] **Step 1: Run all Worker and Import unit tests**

~~~bash
npx vitest run worker/tests src/components/TeaCompass/import
~~~

Expected: all tests pass without weakened behavioral assertions.

- [ ] **Step 2: Verify the exact worktree server**

~~~bash
npm run dev
pid=$(lsof -ti:7777 | head -1)
lsof -a -p "$pid" -d cwd -Fn
~~~

Expected cwd: /Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/.worktrees/curate-ai-import

- [ ] **Step 3: Run the complete browser matrix**

~~~bash
npx playwright test tests/compass-import.spec.ts tests/compass-capture.spec.ts tests/inventory-scroll.spec.ts --project='Mobile Chrome' --project='Desktop Chrome' --reporter=list
~~~

Expected: all applicable tests pass; only existing project-specific skips remain.

- [ ] **Step 4: Perform visual verification at four states**

Inspect at 390×844 and the standard desktop admin viewport:

1. Evidence with pasted Chinese vendor lines and two attachments.
2. Review with two vendors, blocked teas first, and compact ready teas.
3. One expanded blocker with evidence reference and Capture-compatible fields.
4. Added sourcing ledger with exact receipt links.

For each state confirm:

- full-screen shell reaches every viewport edge;
- no horizontal scroll;
- titles do not truncate;
- tiny Change does not displace vendor names;
- bronze is reserved for current attention and commitment;
- sticky footer clears mobile bottom navigation;
- no side-stripe editor or nested card stack remains.

Do not commit generated screenshots.

- [ ] **Step 5: Run project gates**

~~~bash
npm run test:mobile
npm run lint
npm run lint:colors
npm run build
git diff --check
~~~

Expected: mobile audit, TypeScript, colors, production build, and whitespace checks pass.

- [ ] **Step 6: Update the changelog**

Add:

~~~md
### Curate import sourcing folio

- Replaced the Curate Import drawer with a full-screen Evidence, Review, and Added workspace.
- Aligned Import with Curate's vendor-led editorial hierarchy, blocker-first review, compact ready teas, Capture-style editing, quiet evidence provenance, and sourcing-ledger completion.
- Preserved multilingual analysis, exact pack and money handling, vendor and record reuse, optional sourcing runs, recoverable drafts, per-file retries, and Inventory receipt finalization.
~~~

- [ ] **Step 7: Commit verification documentation**

~~~bash
git add docs/CHANGELOG.md
git commit -m "docs(curate): record sourcing folio redesign"
~~~

- [ ] **Step 8: Request independent final review**

The reviewer must inspect the full redesign diff and confirm:

- no API, Worker, money, matching, or finalization semantics changed;
- no navigation changed;
- focus, background isolation, Escape, dirty-draft, and busy behavior remain correct;
- full-screen layout and blocker traversal work on mobile and desktop;
- Inventory height-chain tests remain green;
- the result matches the approved sourcing-folio specification.

Do not push or merge until every Critical and Important finding is resolved and focused regressions pass again.

# Curate Interface Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Source, Library, and Samples a coherent mobile-first Curate workspace while repairing the account, persistence, lifecycle, and accessibility defects that currently make the interface unreliable.

**Architecture:** Preserve the existing TeaCompass component and server routes. First partition client state and connect Samples to the existing account-scoped D1 APIs, then repair lifecycle linkage, and only then recompose the presentation layer. All behavioral changes are test-first; visual changes use existing tokens and two text roles, 16px primary and 12px supporting.

**Tech Stack:** React 19, TypeScript, Zustand, React Query, Tailwind v3, Cloudflare Workers, D1, Vitest, Playwright.

---

## File map

- `src/lib/teaCompassStore.ts`, `src/lib/teaCompassSync.ts`, `src/hooks/useCompassSync.ts`: account-partitioned Curate cache and hydration lifecycle.
- `src/samples/sampleStore.ts`, `src/samples/sampleCartStore.ts`: account-partitioned Samples cache.
- `src/samples/sampleRepository.ts`: D1-backed set and portion adapter with local reconciliation.
- `src/lib/api.ts`: typed sample set and portion API calls already backed by Worker routes.
- `worker/src/index.ts`, `worker/tests/sample-request.test.ts`: valid account-scoped sample request set creation.
- `src/components/samples/SampleCartPanel.tsx`: list-to-batch persistence and Compass lifecycle linkage.
- `src/components/TeaCompass/index.tsx`, `BrowseView.tsx`, `BrowseCard.tsx`, `CompassEntryDetailPanel.tsx`, `LibraryFilterSheet.tsx`: Library semantics, accessibility, loading states, actions, and responsive composition.
- `src/components/TeaCompass/CaptureCard.tsx`, `DecisionControl.tsx`, `CaptureContextChips.tsx`, `EncounterContext.tsx`, `PhotoCapture.tsx`, `PricingRow.tsx`, `CaptureActionFooter.tsx`: Source visual system.
- `src/components/TeaCompass/SampleOrderAction.tsx`, `src/samples/SampleSetCreator.tsx`, `src/pages/SampleHistoryPage.tsx`: Samples language, accessibility, and member continuation.
- `src/styles/card-utilities.css`: shared Curate form and action primitives.
- `tests/compass-library.spec.ts`, `tests/compass-samples-parity.spec.ts`, `tests/compass-responsive.spec.ts`, `tests/sample-workflows.spec.ts`: end-to-end regressions.

### Task 1: Partition Curate and Samples by account

**Files:**
- Modify: `src/lib/teaCompassStore.ts`
- Modify: `src/lib/teaCompassSync.ts`
- Modify: `src/hooks/useCompassSync.ts`
- Modify: `src/samples/sampleStore.ts`
- Modify: `src/samples/sampleCartStore.ts`
- Test: `src/lib/teaCompassStore.test.ts`
- Test: `src/lib/teaCompassSync.test.ts`
- Create: `src/samples/sampleAccountIsolation.test.ts`

- [ ] **Step 1: Add failing store tests**

Add tests that seed account A and B, switch accounts, and assert only the selected account's committed entries, sample list, sample sets, and portions are exposed. Assert an unsynced A entry is never present in B's sync payload.

```ts
it('restores only the selected account entries', () => {
  seedAccountEntries('account-a', [entryA]);
  seedAccountEntries('account-b', [entryB]);
  useTeaCompassStore.getState().switchAccount('account-b');
  expect(useTeaCompassStore.getState().entries.map((entry) => entry.id)).toEqual([entryB.id]);
});
```

- [ ] **Step 2: Run tests and verify the account bleed failure**

Run: `npx vitest run src/lib/teaCompassStore.test.ts src/lib/teaCompassSync.test.ts src/samples/sampleAccountIsolation.test.ts`

Expected: FAIL because committed entries and sample stores use global persisted arrays.

- [ ] **Step 3: Implement account buckets**

Persist committed entries, sample sets, portions, and cart items behind account-id maps. Expose one `switchAccount(accountId)` operation per store. Keep existing public selectors returning only the active bucket so component consumers do not need account conditionals.

```ts
type AccountBuckets<T> = Record<string, T[]>;

function bucketFor<T>(buckets: AccountBuckets<T>, accountId: string | null): T[] {
  return accountId ? buckets[accountId] ?? [] : [];
}
```

Update hydration and sync to accept the active account explicitly and discard stale responses when the active account changes before completion.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/lib/teaCompassStore.test.ts src/lib/teaCompassSync.test.ts src/samples/sampleAccountIsolation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/teaCompassStore.ts src/lib/teaCompassSync.ts src/hooks/useCompassSync.ts src/samples/sampleStore.ts src/samples/sampleCartStore.ts src/lib/teaCompassStore.test.ts src/lib/teaCompassSync.test.ts src/samples/sampleAccountIsolation.test.ts
git commit -m "fix(curate): isolate local state by account"
```

### Task 2: Make sample requests, sets, and portions server-backed

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `worker/src/index.ts`
- Create: `worker/tests/sample-request.test.ts`
- Create: `src/samples/sampleRepository.ts`
- Create: `src/samples/sampleRepository.test.ts`
- Modify: `src/samples/sampleStore.ts`

- [ ] **Step 1: Add failing Worker contract test**

Create a request against a product, assert one account-scoped set exists, and assert the inserted `tea_samples.sample_set_id` references it.

```ts
expect(sample.sample_set_id).toBeTruthy();
expect(sampleSet.account_id).toBe(targetAccountId);
```

- [ ] **Step 2: Verify the request test fails**

Run: `npx vitest run worker/tests/sample-request.test.ts`

Expected: FAIL because the current insert omits the non-null sample set relationship.

- [ ] **Step 3: Repair the Worker request transaction**

Find or create one open `customer-request` set scoped to the target account and requester, then insert the sample with that set id. Never insert an unowned set or sample.

- [ ] **Step 4: Add failing repository tests**

Test list/create/update/delete adaptation for D1 snake_case payloads and idempotent reconciliation of local records with returned server records.

- [ ] **Step 5: Implement the repository**

Use `api.sampleSets` and `api.samples` as the only remote boundary. Store server ids, `accountId`, and sync state in the client model. Hydrate the active account on entry to Curate Samples.

- [ ] **Step 6: Run focused Worker and repository tests**

Run: `npx vitest run worker/tests/sample-request.test.ts src/samples/sampleRepository.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.ts worker/src/index.ts worker/tests/sample-request.test.ts src/samples/sampleRepository.ts src/samples/sampleRepository.test.ts src/samples/sampleStore.ts
git commit -m "fix(samples): persist requests and batches in D1"
```

### Task 3: Link sample list, batches, and Library lifecycle

**Files:**
- Modify: `src/components/samples/SampleCartPanel.tsx`
- Modify: `src/components/TeaCompass/types.ts`
- Modify: `src/components/TeaCompass/BrowseView.tsx`
- Modify: `src/samples/SampleSetCreator.tsx`
- Test: `tests/compass-samples-parity.spec.ts`
- Test: `tests/sample-workflows.spec.ts`
- Create: `src/samples/sampleLifecycle.test.ts`

- [ ] **Step 1: Add failing lifecycle unit tests**

Test that saving a list returns Compass updates with `sampleState: 'requested'` and `sampleSetId`, receipt advances to `received`, and tasting advances to `tasted` without changing decision or verdict.

- [ ] **Step 2: Run and verify the lifecycle failure**

Run: `npx vitest run src/samples/sampleLifecycle.test.ts`

Expected: FAIL because list saving currently creates local sample rows only.

- [ ] **Step 3: Implement atomic list-to-batch save**

Create the server set, create its portions, update linked Compass entries through the existing Compass update path, then clear the list only after every remote write succeeds. Surface an actionable error and preserve the list on failure.

- [ ] **Step 4: Remove status collapsing**

Delete mappings that translate sample `favorite` or `passed` into Compass sourcing status. Write only the explicit sample lifecycle and tasting fields.

- [ ] **Step 5: Add Playwright regression assertions**

Save a sample list and assert the item appears in To taste, the set heading opens the same batch, and the lifecycle label is Requested.

- [ ] **Step 6: Run lifecycle and parity tests**

Run: `npx vitest run src/samples/sampleLifecycle.test.ts`

Run with port 7777 test server: `npx playwright test tests/compass-samples-parity.spec.ts tests/sample-workflows.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/samples/SampleCartPanel.tsx src/components/TeaCompass/types.ts src/components/TeaCompass/BrowseView.tsx src/samples/SampleSetCreator.tsx src/samples/sampleLifecycle.test.ts tests/compass-samples-parity.spec.ts tests/sample-workflows.spec.ts
git commit -m "fix(samples): connect batches to the tasting queue"
```

### Task 4: Recompose Library and repair its behavior

**Files:**
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/components/TeaCompass/BrowseView.tsx`
- Modify: `src/components/TeaCompass/BrowseCard.tsx`
- Modify: `src/components/TeaCompass/CompassEntryDetailPanel.tsx`
- Modify: `src/components/TeaCompass/LibraryFilterSheet.tsx`
- Modify: `src/components/TeaCompass/ActiveFilterSummary.tsx`
- Modify: `src/lib/teaCompassSync.ts`
- Test: `tests/compass-library.spec.ts`
- Test: `tests/compass-responsive.spec.ts`

- [ ] **Step 1: Add failing Library behavior and accessibility tests**

Cover honest hydration error state, functional Buy, Share in detail, named active filters, no Co-Tasting, no nested buttons, 16px mobile inputs, and 44px card actions.

- [ ] **Step 2: Verify failures**

Run with the test server: `npx playwright test tests/compass-library.spec.ts tests/compass-responsive.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement honest state and action semantics**

Expose hydration status from the sync layer. Render loading, local-offline, error/retry, and truly empty states separately. Make Buy open the existing acquisition flow. Add Share to detail using the existing share modal callback.

- [ ] **Step 4: Rebuild semantic entry rows**

Replace the nested button card with a semantic article, one disclosure button, and a sibling action strip. Use only `text-ui-16` and `text-ui-12` within the working Library surface. Give every action `tap-target` or visible 44px height.

- [ ] **Step 5: Recompose responsive layout and filters**

Group all existing filter dimensions without deleting any. Render named removable active filters. On desktop, avoid independent date-group grids that strand a single card in half a row; use a coherent full-width list before selection and one complete detail action bar after selection.

- [ ] **Step 6: Remove contradictory Co-Tasting UI**

Delete both mobile and desktop entry points and their silent session-creation path. Do not alter event tasting or private journal flows.

- [ ] **Step 7: Run Library tests**

Run: `npx playwright test tests/compass-library.spec.ts tests/compass-responsive.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/TeaCompass/index.tsx src/components/TeaCompass/BrowseView.tsx src/components/TeaCompass/BrowseCard.tsx src/components/TeaCompass/CompassEntryDetailPanel.tsx src/components/TeaCompass/LibraryFilterSheet.tsx src/components/TeaCompass/ActiveFilterSummary.tsx src/lib/teaCompassSync.ts tests/compass-library.spec.ts tests/compass-responsive.spec.ts
git commit -m "feat(curate): rebuild the Library workspace"
```

### Task 5: Recompose Samples and member continuation

**Files:**
- Modify: `src/components/TeaCompass/SampleOrderAction.tsx`
- Modify: `src/components/samples/SampleCartPanel.tsx`
- Modify: `src/components/samples/AddToSampleButton.tsx`
- Modify: `src/samples/SampleSetCreator.tsx`
- Modify: `src/pages/SampleHistoryPage.tsx`
- Test: `tests/sample-workflows.spec.ts`
- Test: `tests/account-panel-mobile.spec.ts`

- [ ] **Step 1: Add failing flow and accessibility tests**

Assert Sample list and Sample batches language, 16px inputs, 44px controls, no automatic untitled batch, member detail links, and Taste/add to Journal continuation.

- [ ] **Step 2: Verify failures**

Run: `npx playwright test tests/sample-workflows.spec.ts tests/account-panel-mobile.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: FAIL on the new assertions.

- [ ] **Step 3: Recompose the full-screen Samples surface**

Use Sample list for the temporary request and Sample batches for persistent sets. Preserve grams, vendor grouping, print, WhatsApp, labels, purpose, notes, filters, status, archive, delete, import, add, and bulk actions. Apply the two-size typography and shared touch targets.

- [ ] **Step 4: Make member history actionable**

Link each row to `/s/:id`, show explicit lifecycle state, and route eligible received samples into the existing tasting/journal flow.

- [ ] **Step 5: Run Samples and account tests**

Run: `npx playwright test tests/sample-workflows.spec.ts tests/account-panel-mobile.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TeaCompass/SampleOrderAction.tsx src/components/samples/SampleCartPanel.tsx src/components/samples/AddToSampleButton.tsx src/samples/SampleSetCreator.tsx src/pages/SampleHistoryPage.tsx tests/sample-workflows.spec.ts tests/account-panel-mobile.spec.ts
git commit -m "feat(samples): clarify list and batch workflows"
```

### Task 6: Apply the Impeccable Source interface system

**Files:**
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/components/TeaCompass/CaptureCard.tsx`
- Modify: `src/components/TeaCompass/DecisionControl.tsx`
- Modify: `src/components/TeaCompass/CaptureContextChips.tsx`
- Modify: `src/components/TeaCompass/EncounterContext.tsx`
- Modify: `src/components/TeaCompass/PhotoCapture.tsx`
- Modify: `src/components/TeaCompass/PricingRow.tsx`
- Modify: `src/components/TeaCompass/CaptureActionFooter.tsx`
- Modify: `src/styles/card-utilities.css`
- Test: `tests/compass-capture.spec.ts`
- Test: `tests/compass-responsive.spec.ts`

- [ ] **Step 1: Add failing responsive presentation tests**

Assert every preserved Source control remains reachable, mobile form inputs are 16px, action targets are 44px, desktop has one capture-method control, no horizontal overflow, and bottom navigation does not obscure the footer.

- [ ] **Step 2: Verify failures**

Run: `npx playwright test tests/compass-capture.spec.ts tests/compass-responsive.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: FAIL on typography, duplicate desktop capture controls, and evidence-action composition.

- [ ] **Step 3: Add shared Curate primitives**

Create reusable `curate-primary`, `curate-support`, `curate-field`, `curate-section`, and `curate-action` classes using only approved tokens. Primary text is 16px, support is 12px, fields are 16px on mobile, and controls use the existing `tap-target` floor.

- [ ] **Step 4: Recompose mobile Source**

Keep the two navigation rows. Build one sourcing context band, labelled Scan label/Add photo evidence actions, and the visible Identity, Provenance, Pricing, Profile, Notes, Intent, Storage, and Buy sections in one scroll spine. Remove no field or action.

- [ ] **Step 5: Recompose desktop Source**

Use a 240–280px entry rail and a readable working sheet without the oversized dead area. Render Tea/Teaware/Import only once per desktop breakpoint. Align the persistent footer to the working sheet.

- [ ] **Step 6: Run Source tests**

Run: `npx playwright test tests/compass-capture.spec.ts tests/compass-responsive.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/TeaCompass/index.tsx src/components/TeaCompass/CaptureCard.tsx src/components/TeaCompass/DecisionControl.tsx src/components/TeaCompass/CaptureContextChips.tsx src/components/TeaCompass/EncounterContext.tsx src/components/TeaCompass/PhotoCapture.tsx src/components/TeaCompass/PricingRow.tsx src/components/TeaCompass/CaptureActionFooter.tsx src/styles/card-utilities.css tests/compass-capture.spec.ts tests/compass-responsive.spec.ts
git commit -m "feat(curate): apply the unified sourcing interface"
```

### Task 7: Full verification and visual review

**Files:**
- Modify as needed only when verification exposes a regression.

- [ ] **Step 1: Run unit and Worker verification**

Run: `npx vitest run src/lib/teaCompassStore.test.ts src/lib/teaCompassSync.test.ts src/samples`

Run: `npm run test:worker`

Expected: all tests pass.

- [ ] **Step 2: Run static verification**

Run: `npm run lint`

Run: `npm run lint:colors`

Run: `npm run build`

Expected: exit 0 for all commands.

- [ ] **Step 3: Run responsive workflow verification**

With the development server on port 7777, run:

`npx playwright test tests/compass-capture.spec.ts tests/compass-library.spec.ts tests/compass-samples-parity.spec.ts tests/compass-responsive.spec.ts tests/sample-workflows.spec.ts tests/account-panel-mobile.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: all tests pass with no horizontal overflow, console errors, focus zoom, or bottom-navigation overlap.

- [ ] **Step 4: Inspect authenticated desktop and mobile screens**

Inspect `/admin/compass` Source, Library, Sample list, Sample batches, and `/account/samples` at 390×844 and at least 1280×720. Verify the two-size system, visible control preservation, action semantics, theme tokens, and empty/loading/error states.

- [ ] **Step 5: Run final review and commit fixes**

Request a final spec and code-quality review across the branch. Fix every Critical or Important finding, rerun affected verification, and commit only verified corrections.


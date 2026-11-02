# Curate, one home: bring everything built into v1 across to v2, then switch

Surveyed 2026-11-01 at `bfe2314f` (= origin/main). Read-only survey; nothing built yet.

**Goal (Adrian):** v2 (`/admin/compass/v2`, `src/components/CurateV2/`) becomes the only Curate at `/admin/compass`. Nothing v1 can do today may be lost on the day of the switch.

## Stages at a glance

Each stage ships on its own, is showable to Adrian as a link plus screenshots, and ends with the v1 Playwright specs for its area gaining a v2 twin. The switch is last.

| # | Stage | What Adrian can see afterwards | Size |
|---|---|---|---|
| 1 | **The tea's own record**: one shared tea type, given name, story/description, quote-weight confirm, "Build this tea" (working material, voice, AI details, public description) | Open any tea in v2: name it, write its story, run Build this tea | L (~7h) |
| 2 | **AR Create links and transcripts**: the `?arSource=` receiver, the `?arPair=` connect sheet, linked talks on the tea | Open an AR Create link in v2 and link a talk to teas | M (~3h) |
| 3 | **Buying: orders on the tea, deliveries, supplier, price display**: order status on TeaFace, Manage delivery, supplier rename, display currency, order-confirm safeguards, sample batch line | A tea shows where it is in an order; partial arrivals work; the supplier can be renamed on its card | L (~7h) |
| 4 | **Imports, samples, Library views and the Library preview page**: three import fixes v1 got after the fork, "transferred to Stock" view, keep-tasting-open check, decision on `/dev/library-preview` | Import a list and keep correcting it after a reload; preview page still renders | M (~4h) |
| 5 | **The switch**: route, every deep link, redirects, worker Drive return, remaining specs, docs | `/admin/compass` is v2; every old link, printed QR tag and AR Create link still lands right | M (~4h) |

**Total: about 25h of build, 20 to 32h with spec porting.** Follow-up after the switch (not a stage): retire the v1 folder, about 4h, see "After the switch".

Do not start 5 until 1 to 4 have landed. Stages 2 and 3 both need 1 (the shared type and the Build this tea dialog), and are otherwise independent (different files), so they can run in parallel by two builders if split by files.

## The one principle: mount, do not copy

v2 was a copy of the v1 folder taken on 2026-10-07 and has had no real work since 2026-10-10. Copying again would fork again. v1's new pieces are mostly self-contained (they take an `entry`, and read the shared store and API), so v2 should **import them from `src/components/TeaCompass/` as they are** and dress them in v2's look later if wanted. Other sessions still fixing those files then fix v2 for free. They move into a shared folder only at the end (see "After the switch").

## Surprises worth knowing before starting

1. **v2 has its own copy of `types.ts`** (`CurateV2/types.ts`) that has drifted from `TeaCompass/types.ts`, which the shared store, sync, samples and graduation all use. v2's copy lacks `givenName`, `syncedGivenName`, `description`, `entryHasBeenTasted`, `entryNeedsTasting`, and its `compassEntryToProductDraft` still sets `stock_grams` from the quote (v1 fixed it to 0 on 2026-10-28). It is not called today, so nothing is wrong yet, but it is a loaded trap. **Stage 1 starts by deleting it and re-exporting v1's.**
2. **Coupling already goes both ways.** v2 imports `TeaCompass/types`, `TeaCompass/StructuredTeaFields`; `src/lib/libraryPurchaseState.ts` imports `CurateV2/shopOrders`; 21 other files outside both folders import `TeaCompass/*` (types, AutocompleteInput, PricingRow, VendorStrip, BrowseCard for the tasting journal, samples). The v1 folder cannot simply be deleted at the switch.
3. **Two deep-link params v2 silently drops today.** The v2 wrapper in `AdminApp.tsx:104-135` never passes `developProduct/developName/developType` (Stock's "Develop in Curate" link) and cannot express `tab=today|vendors|compare` because it imports v1's `CompassMode` type. And `arSource`/`arPair` (AR Create) are read by components v2 never mounts.
4. **`/dev/library-preview`** (`src/pages/LibraryPreviewPage.tsx`) is a read-only "development preview" that renders **v1's BrowseCard**. It is not under `/admin/compass`, but it keeps v1's card alive. Needs a decision (stage 4).
5. **Printed QR tags point at `/admin/compass?entry=ID`** (`TeaTagSheet`, both versions). That URL must work forever.
6. **`CurateQuotesPanel` is not a v1 feature.** It only mounts on `/admin/vendors/:id` (`VendorProfileView`). Neither Curate has it. Optional extra in stage 3, not a regression.
7. **Drive backup controls are v2-only** (`DriveLine`, Today). v1 never had them. The worker's OAuth return default is `/admin/compass/v2`.
8. **About 210 Playwright tests in ~30 spec files drive v1 screens** (37 files mention `/admin/compass` or `openCompass`). Most of the weight is in four specs that test v1's own chrome (Source/Library/Ledger tabs, capture-method tabs): compass-import 43, compass-capture 30, compass-library 26, curate-compact-canvas 21. v2's own two specs have 89 tests.

---

## The inventory

Format per item: **what it does** / **v1 mount** / **uses** / **v2 today** / **v2 home** / size.

### Stage 1: the tea's own record

**1.0 One tea type (prerequisite).**
Delete `CurateV2/types.ts` content and re-export `TeaCompass/types`. Fix v2 imports. v2 today: own drifted copy (`CurateV2/types.ts`). Size M (mechanical, but about 39 files import it).

**1.1 Given name.** The name Adrian chooses, kept before and after the tea reaches Stock (separate from the supplier's name). v1: `LibraryGivenName.tsx`, mounted `BrowseCard.tsx:144` (Library card) and `CompassEntryDetailPanel.tsx:119` (tea drawer). Uses `updateEntry` then `/api/compass/sync`, then invalidates `['products']`. v2 today: none (`entryDisplayTitle` in v2 ignores it; `CaptureCard.tsx:286` only reads a product's `given_name`). Home: TeaFace, tap-to-edit line under the tea name; `listName()`/list rows show it first. S.

**1.2 Story and description, provenance fields.** A working description (`entry.description`), notes, provenance and quote text fields, separate from supplier evidence. v1: `TeaRecordFields.tsx` (sections attributes, description, notes, provenance, quote), `CompassEntryDetailPanel.tsx:154-189`; reached by Library tab, tap a tea, drawer tabs Tea/Notes/Orders/Files. Uses `updateEntry`, sync. v2 today: `CaptureCard` has the structured fields and photos but no `description` or provenance. Home: behind "Edit all fields" (CaptureCard) as a Story section; TeaFace gets one "Story" row that shows the first line. M.

**1.3 Confirm what the quote covers.** A pack weight is only evidence until Adrian confirms; a sheet asks Grams/Jin/Cake/Brick/Tuo with presets, then saves quoted grams. v1: `LibraryQuoteWeight.tsx`, `BrowseCard.tsx:166`, drawer. Uses `onSave` to `pricePerUnitGrams` and form. v2 today: partial, `quotedGrams()` (TeaFace.tsx:47) assumes 357 g for a cake and shows "assumed". Home: TeaFace Cost row; when the weight is assumed, tapping "confirm weight" opens the sheet. S.

**1.4 Build this tea.** One full-screen review that brings a tea's sources, notes and voice together, finds missing record details with AI, and drafts a public description. v1: `TeaRecordAssistant.tsx` (`AssistantReview`), `TeaReviewDialog.tsx`, mounted `CompassEntryDetailPanel.tsx:151` ("Notes" tab); also opened by the AR receiver (`ArTranscriptHandoff.tsx:121`). Uses `api.compass.workingMaterial`, `api.compass.proposeDescription`, `api.compass.fileSaid`, `arCreateApi.link/remove`, notes store, `syncCompassEntries`. Parts, all mounted via the one dialog:
- Working material review (`WorkingMaterialReview.tsx`): what to keep from sources and notes.
- Draft voice material (`DraftVoiceMaterial.tsx`, `useVoiceRecorder`): talk into the dialog, transcript lands in notes.
- Public description (`TeaDescriptionReview.tsx`): writes for the shop, supplier claims stay attributed.
- Live transcript refresh (`useLiveTeaTranscripts.ts`, `awaitArJob`): re-reads the original talk from AR Create.
- Evidence and fact suggestions (`teaRecordEvidence.ts`, pure).
- Dialog shell with the focus fix (`TeaReviewDialog.tsx`, 01631a54), so it stays interactive over a drawer. This matters in v2: the dialog opens over TeaFace's overlay (`z-10` layer, `index.tsx:1590`).

v2 today: none. (v2's "What you said" sheet, `SaidSheet` plus `saidFiling.ts`, files a recording into parts and is a different, smaller thing; keep both.) Home: a "Build this tea" row on TeaFace (under Story) and a button inside CaptureCard's notes area; dialog stacks above TeaFace. M to mount, S to dress. L overall with tests (six tea-record specs).

**1.5 Keep tasting open when saving.** After the shared tasting saves, the session stays open (299bff2c). The behaviour sits in shared `components/tasting/TastingSession.tsx`; the Library-side wiring is in v1 `BrowseView/BrowseCard`. v2 today: Full tasting from TeaFace uses the same session component, so most of it should be there. To do: verify with a v2 twin of `tasting-save-stay.spec.ts`. S.

**1.6 Already in v2 (no work):** files and change history/undo (`RecordTools`, `CaptureCard.tsx:690`, copy of `CurateRecordTools` that v1 only made "flat"); photos and extraction (`CaptureCard`, `PhotoCapture`); notes and voice (TeaFace Talk and Note frames); queue, add to sample, create inventory record (expanded `BrowseCard`, desktop panel); delete (TeaFace); inline edit of name/year/price (v2's rows open the full form instead, per its spec, so not carried over).

### Stage 2: AR Create links and transcripts

**2.1 Transcript receiver, `?tab=library&arSource=SOURCE_ID`.** AR Create sends Adrian here; the page reads the full original through the paired connector, shows existing links, lets him pick one or several existing teas and link them, or open Build this tea with the transcript staged. v1: `ArTranscriptHandoff.tsx`, mounted `index.tsx:1756` (reads `location.search`, no props). Uses `arCreateApi.sourceLinks/link/job`, `awaitArJob`. v2 today: none, and the v2 route wrapper does not hold it. Home: mount once at the v2 shell (`CurateV2/index.tsx`, beside `SaidSheet`, line ~1673) as a sheet over whatever tab is showing; needs 1.4. M. The AR Create project pins this exact URL (`docs/AR_CREATE_TEA_LINK_CONTRACT.md:14`), so it cannot change.

**2.2 Connect AR Create, `?arPair=CODE`.** A sheet that claims a pairing code for the current shop. v1: `ArCreatePairing` in `ArTeaSources.tsx:46`, mounted `index.tsx:1755`. Uses `arCreateApi.claim`. v2: none. Home: same shell mount. S.

**2.3 Linked talks on a tea.** List of linked talks with Check original, stage passage, unlink (`ArTalkLinks`, inside Build this tea). Comes with 1.4. Optional: a "2 talks" word on TeaFace's Story row. S.

Specs that move: ar-transcript-handoff (3), tea-record-ar-linking (3).

### Stage 3: buying

**3.1 Order status on the tea.** The tea shows chosen/draft/ordered/partly received/received with Ordered, Received, Incoming quantities. v1: order ribbon on `BrowseCard` (`purchaseState` prop, `BrowseView.tsx:340`) and drawer group "Purchasing" (`CompassEntryDetailPanel.tsx:~180`). Uses `useLibraryPurchases()` / `libraryPurchaseStateOf` (`src/lib/libraryPurchaseState.ts`, already shared, already reads v2's `shopOrders`). v2 today: Today has On the way / To shelve lists; TeaFace and Teas rows show no order state. Home: an "Order" row on TeaFace (state, quantities, tap opens that order via `pushOrder`) and a small status word on Teas-tab rows. M.

**3.2 Manage delivery (partial and full arrivals).** Per receipt: receive some, receive all, cancel the remainder, tracking. v1: `LibraryReceiptActions.tsx` (opens `IncomingReceiptsPanel` in a sheet), `CompassEntryDetailPanel.tsx:185`. Uses `GET /api/purchase-orders/tracking`, `/api/inventory/receipt-lines/:id/receive`, `/cancel-remaining`; `LIBRARY_RECEIPTS_KEY`. v2 today: Today's "Arrived" accepts a whole receipt proposal only; `TodayView.tsx:294` has arrival files and history. Home: button on the TeaFace Order row and on the order screen (`OrderScreen`, `LedgerView.tsx`); Today keeps its one-tap Arrived. M. (Partial arrivals are "normal" per `CURATE_CONSUMER_CONTRACT.md`.)

**3.3 Rename the supplier.** Pencil by a supplier edits the shared supplier record and renames it everywhere, without moving any tea. v1: `LibrarySupplierActions.tsx`, `BrowseView.tsx:378` (group header), drawer `:122`. Uses `shared/SupplierSheet`, `applySupplierRenameLocally`. v2 today: none (VendorCard edits wechat, where, notes but not the name). Home: VendorCard header (`VendorCard.tsx`), pencil beside the name; teas lists re-read the name. S.

**3.4 Price display currency.** One button chooses to show every Library price in a chosen currency, or as quoted. v1: `LibraryCurrencyPicker.tsx`, `index.tsx:964` and `:1326`, `BrowseView.tsx:603`; preference in localStorage (`libraryPriceDisplay.ts`). Uses `useRates`. v2 today: none (v2 shows quote as entered). Home: Teas-tab header, one icon opening the sheet. S.

**3.5 Order-confirm safeguards from the 28 Oct "continuity" fix (72e3ac7d).** Before an order is confirmed the teas are saved to the server first (`ensureCompassEncounterSaved`); a second tap while confirming is ignored (`confirmationPending`); a pending receipt proposal is read back when the tea reopens (`api.compass.listReceiptProposals`) and Add to order says "Update receipt"; account switches mid-save are ignored; an unpriced tea is a line with no price, never a zero-cost purchase; teaware's Buy defaults to Personal (48da8c68). v1: `CaptureCard.tsx` (~220-270, 950-1000), `LedgerView.tsx`, `acquisitionPricing.ts`, `StatusActions`, `OrderSummary`. v2 today: some already (`orderBuy.ts:45` unpriced lines, `CaptureCard.tsx:188` Personal default, `placeOrder.ts` creates the proposals); missing: save-before-confirm, pending guard, proposal readback, account guards (`CurateV2/LedgerView.tsx` confirm path, `CaptureCard.tsx:938`). Home: v2's order screen confirm and CaptureCard's Add to order. M, careful: this is money.

**3.6 Sample batch line.** A sample tea says "Batch · name" and opens that batch in Samples (f8c0897a). v1: `BrowseCard.tsx` ~170, `BrowseView.tsx:139-144`. Uses `useSampleStore.sampleSets`, route `?sampleOrder=manage&set=ID`. v2 today: batch links on the Samples group header only (`BrowseView.tsx:487`). Home: TeaFace, one quiet line for a sample with a `sampleSetId`. S.

**3.7 Optional, not a regression: vendor quotes on the vendor's card.** `CurateQuotesPanel` mounts today only at `/admin/vendors/:id`. VendorCard could mount it (vendor things on VendorCard). S. Ask Adrian.

Specs that move: library-ledger-handoffs (2), library-workspace-handoffs (4), library-shop-row (7), library-metalwork (1), compass-receipt-possession (4), curate-v1-order-money (5, v1-specific, rewrite against v2 order screen), curate-flow-repair (3).

### Stage 4: imports, samples, Library views, preview page

**4.1 Import fixes v1 got after the fork.** v2 has the whole import flow (copy, `CurateV2/import/`, mounted `index.tsx:1696` and `:1204`/`:1460`). Three v1-only changes to port: (a) corrections typed in an import row survive a reload, per account/batch/item (`import/ImportItemRow.tsx` +34 lines, `import/importDraftStorage.ts` +21); (b) the saved-imports list lives apart from the browsing layout (`LibraryImportsSection.tsx`, b287ec54); (c) after deleting the last unfinished import, focus lands on whichever Library search box is showing (`index.tsx`, fe877bcb). Mount/copy: the import dir is a true copy, so this one is a straight file copy of the three diffs (or have v2 import v1's `import/` wholesale and delete v2's copy; preferred, 36 files that diff to nothing otherwise). M.

**4.2 "Transferred to Stock" view.** Library toggle that lists teas already handed to Inventory (`libraryEntryTransferred`, `BrowseView.tsx:137,209`). v2 today: none. Home: Teas tab filter sheet (`LibraryFilterSheet`). S.

**4.3 Samples.** Equivalent exists: `SampleOrderAction` (`CurateV2/index.tsx:845`), `?sampleOrder=manage&set=` (AdminApp wrapper passes both), `/admin/samples` redirect. Check only: specs `sample-workflows` (6), `compass-samples-parity` (11), `graduation-cost-prompt` (1) re-pointed. S.

**4.4 Library preview handoff (`/dev/library-preview`).** Read-only page that shows Adrian's real Library as v1's card grouped by supplier, behind an owner-approved code. Not under `/admin/compass`. It imports `TeaCompass/BrowseCard`, `librarySupplierGroups`, `types`. Decision: (a) keep it on v1's card files, moving those four files to `src/components/curate/` at retirement (S), or (b) re-point it at v2's Teas row (M, and the preview then shows v2's look, which is arguably the point). Recommend (a) now, (b) only if Adrian wants the preview to show v2.

Specs that move: compass-import (43, most are v1 chrome plus import behaviour; keep the import behaviour ones, retarget to v2's Add menu), tasting-* (8 files, ~16 tests), tasting-save-stay (1).

### Stage 5: the switch

**5.1 Route.** `AdminApp.tsx`: point `compass` at `CurateV2WithMode`; `compass/v2` and `curate/v2` become `<Navigate to="/admin/compass{search}">`; `compass-playbook` and `compass-current` (also `CompassWithMode` today, lines ~528-540) the same. Delete `CompassWithMode`. Import the `CompassMode` type from v2. Extend the tab map: `today`, `vendors`, `compare` plus the old `sourcing/library/buying/ledger/capture/samples/tasting/browse`. Pass `developProduct/developName/developType`. Landing with no params is now Today (v1 landed on Source); `DraftsView.tsx:49` and the `*` fallback (`:672`) inherit that.

**5.2 Deep links that must keep working** (all land at `/admin/compass`; v2 already handles `entry` by putting that tea's face on top, `index.tsx:405-411`):

| Link | From | v2 must do |
|---|---|---|
| `?entry=ID` | `InventoryView.tsx:1115`, `SampleFoldRow.tsx:24`, `AddProductModal.tsx:1561,1573`, `SampleSetCreator.tsx:858`, **printed QR tags** `TeaTagSheet.tsx:132` (both versions) | open the tea (works) |
| `?tab=library&entry=ID` | `sharedTeaRecord.ts:10` (Stock "View in Curate"), AR contract | Teas tab, tea face on top (works) |
| `?tab=sourcing&entry=ID` / `?tab=sourcing` | `InventoryView.tsx:1190,1215`, `ProductEditPanel.tsx:1431`, `SourcesView.tsx:1889` | Table tab (works) |
| `?tab=sourcing&developProduct=&developName=&developType=` | `ProductEditPanel.tsx:1432` | **needs wrapper to pass them** (v2 component supports it, `index.tsx:413-430`) |
| `?tab=buying&entry=ID`, `?tab=buying`, `?tab=ledger` | `ProductEditPanel.tsx:1043,1978`, `SampleSetCreator.tsx:1020,1151` | Orders tab; with `entry` ideally the tea's order, not just its face |
| `?sampleOrder=manage&set=ID` | `InventoryView.tsx:2146`, `adminBarTabs.ts:25`, `manageNav.ts:93`, `/admin/samples` redirect `AdminApp.tsx:565` | sample screen (works); v2's own `BrowseView.tsx:487` link rewritten to `/admin/compass` |
| `?tab=library&arSource=ID`, `?tab=library&arPair=CODE` | AR Create (other project, fixed) | stage 2 |
| `?capture=tea|teaware` | wrapper | works |
| `?tab=sourcing&fromSample=ID` | `SamplePage.tsx:574` | v1 never read `fromSample` either; harmless, leave |
| `/admin/compass/v2?...`, `/admin/curate/v2?...` | `ImportCompletionSummary.tsx:135`, `BrowseView.tsx:487`, bookmarks | redirect keeping the query; rewrite the two in-code links |
| Drive connect return | `worker/src/index.ts:29306,29314` default `/admin/compass/v2`; `DriveLine` sends `window.location.pathname` | redirect covers old links; change default to `/admin/compass`; update `worker/tests/curate-photos-go-to-drive.test.ts:101` (worker change, so it deploys with migrations path; no migration) |
| Nav | `adminBarTabs.ts:12-25`, `manageNav.ts:90`, `AdminApp.tsx:356,389` | already `/admin/compass` (unchanged) |

**5.3 Specs.** 37 files mention `/admin/compass` or `openCompass` (23 use the helper, 14 a direct `goto`); helper `tests/helpers/compassHarness.ts:479` `openCompass` becomes v2's. Three specs are already two-tree and just drop the v1 branch (`admin-incoming-demand`, `curate-selected-undo`, `curate-structured-fields`). By stage 5 most should already have a v2 twin (rule below); what remains is retiring v1-chrome-only tests (Source/Library/Ledger tab chrome in `compass-capture`, `compass-library`, `compass-responsive`, `curate-compact-canvas`: 85 tests, judge each: port the behaviour, drop the chrome). Run the full `e2e` lanes, not just these (CI shards are 4-way; `KNOWN_FAILING_E2E` is untouched).

**5.4 Docs.** `docs/PILLAR.md:90`, `docs/AR_CREATE_TEA_CONNECTION.md:59`, `docs/SITE_MAP.md:135-146`, `src/admin/INDEX.md:15`, `AdminApp.tsx:76-80` comment, TODO.md line 9, `CLAUDE.md` (project) if it names the Curate screens.

Size: route + links S, specs M, docs S.

## Rule for every stage: the spec travels with the feature

A stage is not done until the v1 specs for its area have a v2 twin that passes (use `openCurateV2` in the harness) and the v1 spec's old copy is left in place, still passing, until stage 5 deletes it. That keeps stage 5 from becoming a 200-test cliff.

## After the switch (follow-up, about 4h, not a stage)

Retire the v1 folder without breaking the 21 outside importers: first move the shared survivors (`types`, `AutocompleteInput`, `PricingRow` currency labels, `VendorStrip`, `StructuredTeaFields`, `BrowseCard`'s `getDateGroup`, `librarySupplierGroups`, `libraryPriceDisplay`, plus the pieces mounted by v2) into `src/components/curate/`, repoint imports, then delete `TeaCompass/` and v1-only CSS (`library-*`, `curate-compact-*` blocks in `card-utilities.css`) and 36 v1 unit tests that test deleted chrome. Do it in its own PR with a freeze announcement.

## Risks

- **Other sessions are still editing v1.** Everything under `src/components/TeaCompass/` and `src/components/curate/` is hot (23 commits in three weeks). Tell the other sessions now: new Curate features go to `CurateV2/` or to a mounted shared piece, not to v1-only files. The "mount, do not copy" rule lessens collision, since a v1 fix to a mounted piece is a v2 fix.
- **Shared files that will be touched by several stages**: `CurateV2/index.tsx` (1,710 lines; every stage mounts something), `CurateV2/TeaFace.tsx`, `CurateV2/CaptureCard.tsx`, `src/admin/AdminApp.tsx`, `src/styles/card-utilities.css` (huge, shared with v1), `src/lib/api.ts`, `src/lib/teaCompassStore.ts`. Stages 2 and 3 split cleanly by file only if stage 1's TeaFace rows land first. Plan one builder per stage; rebase on `origin/main` and re-run before merging (workspace rule).
- **Stage 1.0 is wide.** Replacing v2's `types.ts` touches about 39 files; do it as its own first PR so a conflict cannot hide in feature work.
- **Money paths (3.5)** change what Adrian pays and what shelves. Port with the same tests v1 got (receipt possession, order money) and walk it against the sandbox (`npm run sandbox`), never the live API.
- **The metered-service rule applies to new specs**: every spec imports `test` from `tests/fixtures.ts`; no spec reaches Cloudinary or the live AR Create bridge. AR specs must stub `arCreateApi`.
- **Test lanes**: v2's two specs use `compassHarness`, which is shared by 39 specs; changing harness defaults ripples through all. Add, do not alter.
- **v2's look is not v1's.** TeaFace has a one-row-per-fact design (`Row`, `curate-v2-label`). Each added row must keep its "no second line at phone width" and bottom-nav clearance rules; check every addition at 375px with the bottom bar drawn.

## Decisions (Adrian, 2026-11-02, chosen from screenshots)

1. Library preview page: **keep it on the old card for now** (4.4 option a).
2. Vendor quotes: **yes, on the vendor card** (3.7 is in stage 3).
3. After the switch, `/admin/compass` with no params **opens on Today**.

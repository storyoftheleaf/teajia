# Curate Interface Redesign

**Status:** Approved direction, ready for implementation planning
**Date:** 2026-07-13
**Surface:** Curate (`/admin/compass`) across Source, Library, Ledger header consistency, Sample list, Sample batches, and member Sample history
**Primary context:** Mobile sourcing first, desktop sourcing second

## 1. Purpose

Curate already contains the right capabilities, but the visible interface reads as several generations of controls assembled into the same screen. Navigation, capture method, sourcing decision, run and vendor context, journey context, photography, identity, provenance, pricing, notes, and commitment actions all use different visual treatments. The result is visually fragmented and inefficient despite the underlying workflow being correct.

This redesign improves the physical interface without reducing its capability. It does not remove fields, rename navigation, change routes, introduce a wizard, add accordions, or place current controls inside a new More menu. It creates one coherent, compact sourcing sheet whose hierarchy comes from alignment, typography, spacing, and restrained dividers.

## 2. Approved design principles

1. **Mobile is primary.** Curate must feel designed for sourcing on a phone. Desktop expands the same structure into a more efficient workspace rather than becoming a separate interface.
2. **Everything remains available.** Existing controls and fields stay directly present in the interface or retain their current explicit trigger. The redesign introduces no new progressive disclosure.
3. **Compact, not tiny.** The screen should feel tight and professional while remaining readable and touch-safe.
4. **Two text sizes.** The Curate working surface uses only 16px primary text and 12px supporting text. Hierarchy comes from family, weight, tone, and placement rather than large size jumps.
5. **No mobile focus zoom.** Inputs, selects, and textareas render at 16px on mobile.
6. **No oversized boxes.** Standard mobile controls use a 44px minimum interaction height without visually inflating every field. Desktop controls remain compact while retaining safe interaction targets.
7. **Editorial form, not dashboard.** Use whitespace, baselines, and dividers before cards. Do not introduce nested cards, KPI blocks, large bordered panels, or decorative pills.
8. **Bronze is rare.** Bronze marks selection, focus, and the primary commitment action. It is not used to decorate every group.
9. **Behavior is preserved.** Capture remains order-independent. Autosave, incomplete-entry handling, vendor selection, run management, journey context, photographs, pricing, notes, Buy, Done, and Sample retain their existing behavior.
10. **The current product direction wins.** Co-Tasting and cross-account review aggregation are removed from Curate because the canonical direction explicitly killed those social flows.
11. **Integrity precedes presentation.** Account isolation, honest hydration state, sample persistence, and sample-to-Library linkage must be repaired before the redesigned surfaces depend on them.

## 3. Complete preservation inventory

The redesign must preserve all of the following visible access and functionality:

- Back
- Source, Library, and Ledger
- Sample order and its count
- Voice capture
- Tea, Teaware, and Import
- Search and session entry selection on desktop
- New Entry
- Considering, Selected, and Passed on
- Run
- Vendor
- Share
- Sync state
- Journey or visit context
- Scan label
- Add photo and existing photo thumbnails
- Tea name
- Tea type
- Origin
- Year
- Chinese name
- Suggest Chinese name
- Currency
- Price
- Grams
- Tea form
- Quantity presets
- Retail price preview and shipping cost editing
- Duplicate warning
- Extraction confirmation
- Tasting profile when present
- Notes and note recording
- Intent controls and conditional storage controls
- Buy and its quantity or receipt workflow
- Done
- Sample
- Existing Teaware fields and actions

Existing controls that already open a focused sheet, such as Run, Vendor, tea type, form, and journey selection, may retain that behavior. The redesign must not add a new layer in front of them.

## 4. Typography

The Curate working surface uses two sizes only:

| Role | Size | Use |
|---|---:|---|
| Primary | 16px | Inputs, button labels, tabs, tea name, notes, values, primary actions |
| Supporting | 12px | Field labels, section labels, metadata, helper text, counts, sync state |

Typography rules:

- Plus Jakarta Sans carries operational UI, fields, buttons, labels, values, and metadata.
- Cormorant Garamond may distinguish the tea name and the active record identity, but it stays at 16px. It does not create a larger display tier.
- IBM Plex Mono is not introduced as a third visible voice in the capture form. Numeric alignment uses tabular figures within the primary sans.
- Lora is not used inside the Source form. It remains appropriate elsewhere for reading surfaces.
- Weight changes are restrained: regular for content, medium for selected controls and primary actions.
- Uppercase is limited to the existing top-level tabs and compact section labels. Ordinary field labels use sentence case.
- Text contrast never drops below the approved `tea-text-sec` floor for actions. Supporting labels may use `tea-text-dim` where they remain readable.

## 5. Mobile structure

Mobile uses one continuous vertical capture spine. Every section remains in the natural scroll flow.

### 5.1 Navigation header

The top header remains two rows because both levels are important:

1. Back, Source / Library / Ledger, Sample order, voice capture.
2. Tea / Teaware / Import.

Refinements:

- Prevent Sample order from wrapping into two lines. Its count remains visible.
- Use consistent 16px control text where space permits and 12px only for the count or supporting state.
- Remove decorative containers around peer tabs. Selection uses tone plus a single bottom or perimeter indication, not a pill inside a pill.
- Preserve the existing auto-collapse behavior only if it continues to reveal reliably on upward scroll.

### 5.2 Sourcing context

The sourcing context is one compact band immediately below the capture method:

1. Sourcing decision label with the three visible decision controls.
2. Run, Vendor, Share, New Entry, and sync status aligned on one wrapping row.
3. Journey or visit as a full-width text action.
4. Scan label, Add photo, and thumbnails as a labelled evidence row.

This band uses one surface treatment. Scan and Add photo must not appear as unexplained icons inside a floating rounded box. Their labels remain visible on mobile unless a documented viewport constraint proves impossible; if icons are retained, their accessible names and adjacent labels must remain explicit.

### 5.3 Identity

Identity is the first form section:

- Tea name and Type form one visual unit.
- Tea name uses the optional serif distinction at 16px.
- Type remains directly beneath or beside the name as a visible selector.
- The section is introduced with one 12px label and no enclosing card.

### 5.4 Provenance

Provenance contains:

- Origin as the flexible-width field.
- Year as the compact field in the same row when width allows.
- Chinese name and Suggest on the following row.

Fields share a single visual language. Use either quiet underline fields or restrained bordered fields consistently within the section. Do not mix underline, filled rectangle, and pill treatments without an interaction reason.

### 5.5 Pricing

Pricing remains fully visible and keeps its current behavior:

- Currency, price, grams, and form align as one acquisition row that wraps deliberately on narrow screens.
- Quantity presets remain visible.
- Retail preview and shipping cost remain directly below the row when present.
- Numbers use tabular figures without introducing a separate display size.

### 5.6 Profile, notes, intent, and storage

- Tasting profile remains visible when it has data.
- Notes remain always visible and directly editable.
- Intent controls remain inline.
- Conditional storage controls remain visible for Sheng, Shou, and Dark teas.
- These sections use the same 12px section label and 16px working text vocabulary.

### 5.7 Commitment footer

Buy, Done, and Sample remain persistently available.

- Done is the primary commitment action and receives the strongest resting emphasis.
- Buy and Sample remain peer secondary actions.
- The footer accounts for the mobile bottom navigation using the existing clearance utilities.
- Expanded Buy content remains in the form flow immediately above the footer.
- Disabled state remains readable and visually distinct without becoming nearly invisible.

## 6. Desktop structure

Desktop uses the same content order but allocates space more effectively.

### 6.1 Workspace grid

The Source screen becomes a two-column workspace:

- **Entry rail:** approximately 240 to 280px, containing search, Tea / Teaware / Import access where currently required by desktop behavior, the run entry list, and New Entry.
- **Working sheet:** consumes the remaining width, with a readable inner maximum around 720px and balanced breathing room.

The working sheet is not pinned to a narrow right half while the entry rail consumes excessive empty space. The divider between the rail and sheet remains quiet. The form aligns toward the left side of its working area rather than floating in the middle of a large blank panel.

### 6.2 Desktop form composition

- Decision and sourcing context sit at the top of the working sheet as one coherent band.
- Identity, provenance, pricing, profile, notes, intent, and storage follow the same order as mobile.
- Provenance and pricing may use wider horizontal rows, but no field changes semantic order between breakpoints.
- The action footer aligns with the working sheet, not the full application viewport.
- The desktop layout does not add a third contextual rail, summary dashboard, or additional cards.

### 6.3 Duplicate capture-method controls

The current desktop screen presents Tea / Teaware / Import in both the global capture-method row and the entry rail. The redesign must leave only one visually dominant capture-method control while preserving all current one-tap access. If both render paths must remain for responsive implementation reasons, one is hidden at the appropriate breakpoint rather than displayed twice.

This is a presentation correction, not a navigation change. Labels and destinations remain unchanged.

## 7. Component boundaries

The implementation should preserve behavior by refining existing components rather than replacing the Curate system.

- `src/components/TeaCompass/index.tsx`: responsive workspace, header hierarchy, desktop rail width, duplicate capture-method presentation, scroll and footer placement.
- `src/components/TeaCompass/CaptureCard.tsx`: form section rhythm, two-size typography, consistent field language, responsive rows.
- `src/components/TeaCompass/DecisionControl.tsx`: compact visible three-state control using the shared typography and control height.
- `src/components/TeaCompass/CaptureContextChips.tsx`: context action alignment and consistent visible labels without a More menu.
- `src/components/TeaCompass/EncounterContext.tsx`: journey or visit row alignment.
- `src/components/TeaCompass/PhotoCapture.tsx`: labelled evidence actions and compact thumbnail treatment.
- `src/components/TeaCompass/PricingRow.tsx`: consistent field styling and deliberate responsive wrapping.
- `src/components/TeaCompass/CaptureActionFooter.tsx`: mobile navigation clearance, desktop sheet alignment, readable state hierarchy.
- `src/styles/card-utilities.css`: reusable Curate field, section, and action styles only when repetition justifies them.

## 7A. Library design

Library is the committed encounter archive and decision workspace between Source and Inventory. It is not a passive gallery and must preserve its current retrieval, tasting, decision, sample, sharing, completion, and Inventory functions.

### Visible structure

- Search remains first.
- All, To taste, and Selected remain the three primary lenses.
- Filters, sort, and List/Photos remain directly visible.
- Active filters are named and individually removable rather than summarized only as a count.
- Incoming shares remain visible with accept and decline actions.
- Co-Tasting is removed from both responsive render paths.

### Filters

All current filter dimensions remain. The existing sheet groups them as:

1. Encounter: journey, vendor, place, date.
2. Tea: category, type, origin, year, price, photos.
3. State: sourcing decision, tasting verdict, possession.
4. Samples and Inventory: sample lifecycle and physical purpose.
5. Completeness: missing name, price, type, origin, or notes.

### Entry rows

- Each entry uses one semantic disclosure control followed by a separate action strip. Interactive elements are never nested inside another button.
- The collapsed row shows identity, origin or vendor, year/type, price when known, possession, sourcing decision, tasting verdict, and sample lifecycle when relevant.
- Mobile expands the row inline.
- Desktop starts as a coherent full-width list or grid. Selecting an entry creates one master-detail layout with the complete action set in the detail panel rather than duplicating actions between rail and panel.
- Every action is at least a 44px target on mobile.
- Buy opens the existing acquisition or receipt flow. It is never a visible no-op.
- Share is available from Library detail without reopening Source.
- Sample language reads `Add to sample list` and `In sample list`.

### Loading and failure

- Library distinguishes hydrating, empty, offline with local data, and failed-to-load states.
- A failed hydration never renders the empty-library message.
- Retry is visible for remote failures.

## 7B. Samples design and lifecycle

The interface distinguishes four independent concepts:

1. Sourcing decision.
2. Tasting verdict.
3. Sample lifecycle: requested, received, tasted.
4. Physical possession in Inventory.

These states are never translated into one another implicitly.

### Sample list

`Sample list` is the temporary vendor-grouped working request. It preserves:

- Add or remove from Library and relevant product surfaces.
- Gram presets and custom grams.
- Vendor grouping.
- Print and WhatsApp output.
- Save as sample batch.

Saving the list creates an account-scoped server-backed sample set and portions, links every source Compass entry, sets the lifecycle to requested, and makes the entries immediately appear under Library's To taste lens. The local list clears only after the server accepts the batch.

### Sample batches

`Sample batches` is the persistent operational record for sourcing, gifts, events, and panels. It preserves batch naming, vendor, purpose, notes, labels, filtering, tasting, status, archive, delete, import from Compass, quick add, and bulk actions.

- Sets and portions are hydrated from and written to the existing D1 APIs.
- Existing local records are reconciled without duplication and remain available during migration.
- QR labels resolve from another device.
- Creating or editing a batch does not create an empty untitled batch until the user deliberately starts one.
- Operational sample status does not overwrite sourcing decision or tasting verdict.

### Member Samples

Member Sample history becomes actionable without becoming a new social surface:

- Each row opens the existing `/s/:id` detail.
- Requested, Received, and Tasted are visible.
- Received samples offer `Taste / add to Journal` when a linked tea is available.
- Empty, loading, and error states are distinct.

### Sample request repair

The customer sample-request handler must always create or attach to a valid account-scoped set before inserting a portion. Worker tests cover the schema contract.

## 7C. Account isolation

- Committed Compass entries are partitioned by active account in local persistence.
- Switching accounts immediately clears the prior account's committed view, restores the selected account's cached entries, and hydrates that account from the server.
- Unsynced entries can never be submitted under a different active account.
- Sample list, sample sets, and sample portions use account-partitioned caches.
- A signed-out or missing-account state does not inherit the last account's data.

The visual redesign itself remains presentation-led, but the verified account-isolation and sample-persistence defects require focused store, API, Worker, and test changes. No unrelated schema or routing work is included.

## 8. Responsive and accessibility requirements

- Mobile verification target: 390 by 844.
- Desktop verification target: at least 1280 by 720.
- All input-like controls use 16px text on mobile to prevent browser focus zoom.
- All interactive controls meet the 44px touch target through visible height or the existing `tap-target` utility.
- No horizontal scrolling occurs at any supported width.
- Wrapping is deliberate and preserves readable grouping.
- Focus states use the approved bronze token and remain visible in both themes.
- Icon-only controls retain explicit accessible names.
- Close, Back, and Cancel controls continue to follow the project-wide placement and contrast rules.
- The mobile bottom navigation never obscures the form or action footer.
- Light and dark themes both use approved adaptive tokens.

## 9. Motion

- Preserve motion that communicates screen or state changes.
- Keep transitions between 150 and 250ms with ease-out curves.
- Do not add decorative entrance choreography.
- Do not animate layout properties for visual flourish.
- Header collapse must not cause content jumps or strand controls offscreen.

## 10. Non-goals

- No navigation rename or route change.
- No new fields.
- No removed fields.
- No new More menu.
- No wizard or required sequence.
- No new cards or dashboard widgets.
- No backend, schema, or API work.
- No redesign of Library or Ledger content beyond shared header consistency unless required to prevent a regression.
- No change to sourcing decision semantics.
- No change to order-independent capture, autosave, commit, or Import semantics. Samples changes are limited to the verified account, persistence, lifecycle, language, and accessibility repairs defined above.
- No social Co-Tasting or cross-account review aggregation.
- No algorithmic recommendations, ratings aggregation, or engagement mechanics.

## 11. Acceptance criteria

The redesign is complete when:

1. Every item in the preservation inventory remains visibly reachable and behaves as before.
2. Mobile presents one coherent vertical sourcing sheet with no new hidden sections.
3. Desktop uses its available width without the current oversized empty rail.
4. Tea / Teaware / Import does not appear twice at the same desktop breakpoint.
5. The working surface uses only 16px primary text and 12px supporting text.
6. Mobile inputs do not trigger browser focus zoom.
7. Standard controls remain compact and touch-safe.
8. No horizontal overflow appears at 390px.
9. The action footer clears the mobile bottom navigation.
10. `npm run lint`, `npm run lint:colors`, and relevant component tests pass.
11. `npm run test:mobile` passes with the development server running on port 7777.
12. Desktop and mobile screenshots of `/admin/compass` show consistent hierarchy, spacing, and typography in the actual authenticated interface.
13. Switching accounts cannot reveal or sync another account's Curate or Samples data.
14. Saving a sample list creates a server-backed batch and immediately populates Library's To taste lens.
15. A printed sample QR resolves from a second browser/device through D1.
16. The sample-request Worker path satisfies the non-null set relationship.
17. Library distinguishes loading, empty, and error states.
18. Buy performs a real acquisition action or is replaced by an accurate existing action.
19. Member Sample rows open detail and provide a tasting/journal continuation where applicable.
20. Co-Tasting is absent from Curate and no cross-account review aggregation is introduced.

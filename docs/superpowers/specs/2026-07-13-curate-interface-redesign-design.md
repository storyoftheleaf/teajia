# Curate Interface Redesign

**Status:** Approved direction, ready for implementation planning
**Date:** 2026-07-13
**Surface:** Curate (`/admin/compass`), with Source as the primary redesign target
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

No state store, API, worker, route, or database change is expected.

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
- No change to autosave, commit, purchasing, sampling, import, or sync behavior.

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


# Curate Sourcing Second-Pass Design

## Objective

Turn Curate Source into a compact sourcing instrument that keeps every existing function visible and accessible while allowing a tea sourcer to enter identity, price, tasting, notes, and evidence in any order. Mobile at 390×844 is the controlling layout; desktop must use its additional width without changing the interaction vocabulary.

## Confirmed constraints

- Preserve every current function. Do not move functions behind a More menu or remove them.
- Preserve the gram slider and its presets.
- Preserve 44×44 minimum interaction targets while making painted controls visually smaller.
- Keep Type and Year the same outer width, height, radius, and surface treatment.
- Keep Chinese-name Suggest inside the Chinese-name field.
- Keep Buy visually above and more prominent than Taste.
- Use fewer font sizes: 12px support/UI text and 16px editable values remain the principal scale.
- Prefer compact readable text over oversized headings.
- Use restrained bronze and dividers for orientation, not decorative color blocks.
- Do not enlarge or zoom existing field boxes.

## Physical scene

Adrian is standing at a vendor or sourcing desk, holding a phone in one hand, moving unpredictably between a label, a price, a tasting impression, and a decision. The dark Espresso surface remains appropriate, but secondary text and controls must withstand brighter ambient light than a quiet reading surface.

## Chosen direction: continuous annotated sheet

The current three equal slabs will become one continuous working sheet. Tea, Buy, and Taste remain explicit and visible, but each receives a different composition so the user remembers location by shape rather than repeatedly reading headings.

- **Tea** is an open editorial identity area: the name line is the anchor; two compact paired rows follow.
- **Buy** is a horizontal measurement band: price, grams, form, slider, and Buy action read as one commercial instrument.
- **Taste** is a quiet capture well: tasting launcher, note input, voice action, and intent detection form one compact end band.

Major groups use one strong divider; internal relationships use spacing and hairlines. Black gutters and repeated card backgrounds are removed. All groups share one optical left and right edge.

## Mobile composition

### Navigation

The two existing navigation levels remain visible, but their painted height and vertical padding are reduced. Labels and routes do not change. The target is to reclaim 16–24px without reducing touch areas.

### Decision

The sourcing decision remains a three-option radiogroup. Its outer hit area stays at least 44px; the painted segmented rail becomes 34–36px high. The selected state uses a restrained surface shift plus a non-color cue. The initial unselected state must look available, not disabled.

### Context and evidence

The current context region becomes two compact lines:

1. **Provenance line:** Run, Vendor, Journey/Visit.
2. **Evidence line:** Scan, permanent Photo slot, Share, New Entry, and sync state.

No function is hidden. Sync is styled as status, not as an equal call to action. Journey text must not truncate at the normal 390px viewport. Icon-only controls retain accessible names and stable positions; their grouping supplies visible meaning without new labels.

### Tea

- Replace the long name placeholder with `Tea name`.
- Keep Origin/Year and Chinese name/Type as paired rows.
- Empty placeholders must be visually distinct from real values.
- Type and Year remain exact geometric twins. Type uses a shorter empty value so the chevron is not cramped.
- Floating labels stay in place and do not add vertical height.

### Buy

- Price, grams, and form read as one measurement sentence through shared alignment and a continuous baseline.
- The gram slider stays visible. Add a restrained active track and a current-value cue that does not add a new row.
- Buy remains above Taste and visually stronger than tasting actions.
- The mobile Buy action remains associated with this band.

### Actions and readiness

- `Done` is the single commit action. Its disabled state is neutral, not bronze.
- When disabled, focus or activation announces concise readiness guidance without reserving permanent vertical space.
- When enabled, Done earns the sole full-strength bronze treatment.
- Buy remains the strongest contextual secondary action.
- Sample remains visible but is visually associated with Taste rather than presented as an equal commit action.
- Successful commit must produce a brief confirmation and preserve the existing replacement-draft behavior. Existing error and retry behavior remains intact.

### Taste, Notes, and Intent

Taste becomes a single compact band:

- Tasting profile and Add occupy one row.
- Notes remain a full-width editable field with the voice control inside it.
- Intent detection is integrated into the note band. The empty state is a quiet inline status, not a separate section.
- Detected intents remain individually actionable and dismissible with 44px targets.
- The top-level voice recorder and note recorder remain available, but use different visual roles so their scopes are distinguishable.

### Height contract

At 390×844, Tea, Buy, the Taste launcher, Notes, and the commit action must be reachable without scrolling between those zones. Safe-area and bottom navigation clearance remain mandatory. A small scroll allowance for expanded sheets, populated tasting data, errors, and purchase review is acceptable.

## Desktop composition

- Preserve the desktop sidebar and top navigation.
- Replace the nearly empty sourcing rail with useful current-run content: active entry, recent/incomplete entries, and New Entry. No new backend model is introduced; use the existing local session entries.
- Use the wider work area for a balanced canvas rather than simply stretching controls. Tea and Buy may form coordinated horizontal bands while Taste remains below.
- Keep the working canvas within a readable maximum width.
- Attach Buy/Done/Sample actions to the working canvas instead of a full-viewport bottom tray.
- Use the same action hierarchy and state treatments as mobile.

## Typography and color

- Keep the 12px/16px scale. Build hierarchy with weight, contrast, spacing, and alignment instead of adding sizes.
- Editable values and important outcomes use `tea-text`; supporting labels use `tea-text-sec`; placeholders use a clearly dimmer but accessible token.
- Bronze is reserved for the active navigation marker, selected decision cue, slider/current value cue, and enabled Done. No additional decorative bronze fields or cards.
- Section distinction comes from surface lightness and divider strength, not unrelated colors.

## Interaction states

Every changed control must retain default, focus-visible, active, disabled, loading, error, and success behavior where applicable.

- Decision: unselected, selected, keyboard focus.
- Photo: empty, uploading, failed/dismissible, populated, multiple-photo count.
- Slider: unset/default, selected preset, keyboard adjustment.
- Done: disabled with readiness guidance, enabled, committing, committed, failed.
- Sync: saved, saving, offline/error.
- Intent: none, detected, applied, dismissed.

No hover-only function is introduced. Motion remains 150–250ms and communicates state only.

## Component boundaries

- `CaptureCard.tsx`: continuous sheet structure, Tea/Buy/Taste composition, readiness guidance.
- `DecisionControl.tsx`: compact segmented decision rail and non-color selected cue.
- `CaptureContextChips.tsx` and surrounding context markup: provenance grouping.
- `PhotoCapture.tsx`: permanent evidence landmark and photo states.
- `PricingRow.tsx` / `GramSlider.tsx`: measurement-band alignment and active quantity cue.
- `CaptureActionFooter.tsx`: commit hierarchy shared across mobile and desktop.
- `IntentBar.tsx` / `NoteThread`: compact detected/empty integration.
- `TeaCompass/index.tsx`: desktop current-run rail and canvas-attached action placement.
- `card-utilities.css`: reusable sourcing-sheet, divider, target, and state treatments.

No backend, route, navigation-label, or data-model changes are part of this pass.

## Verification

Tests are written before production changes and must cover:

- The mobile primary workflow zones and Notes are reachable within the 390×844 working viewport above the bottom navigation.
- Painted controls remain compact while every target remains at least 44px.
- Decision selected/unselected states and ARIA radio behavior.
- Type/Year geometric parity.
- Photo slot stability across empty, uploading, failed, one-photo, and multiple-photo states.
- Done disabled/enabled visual state and readiness announcement.
- Buy quantity and gram slider remain operable.
- Intent empty and detected states remain accessible.
- Desktop current-run rail contains session entries and desktop actions align with the canvas.
- No horizontal overflow at mobile, tablet, or desktop widths.
- Existing Compass capture, Library, Sample, import, and receipt workflows remain intact.

Required checks: focused Playwright tests, relevant Compass regression tests, `npm run lint`, `npm run lint:colors`, and `npm run build`. Browser inspection must cover 390×844, a tablet/small laptop width, and 1280×900, followed by one critique-and-fix pass.

## Anti-goals

- No wizard or required entry order.
- No collapsible groups, More menu, or hidden primary functions.
- No new font family or broad type-scale expansion.
- No larger fields or oversized buttons.
- No card stack, colored dashboard tiles, gradients, glass effects, or decorative motion.
- No navigation or route changes.
- No backend work or new persistence model.

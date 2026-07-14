# Curate Compact Sourcing Canvas Design

## Purpose

Curate Source is primarily a phone workbench used while sourcing tea. Entry order is intentionally non-linear: an operator may name a tea, taste it, enter pricing, return to provenance, and add notes in any sequence. The interface must preserve every existing function, keep controls immediately reachable, and use stable visual clusters instead of repeated explanatory labels.

## Approved direction

Use a compact, order-independent sourcing canvas. Buying appears above Tasting. The gram slider remains the primary quantity control and continues to use form-aware preset quantities. Suggest Chinese Name becomes a trailing action inside the Chinese-name field, while Type occupies the compact control position to the field's right.

## Mobile composition

1. A quiet two-level header keeps Source, Library, Ledger, Sample List, Tea, Teaware, and Import visible with smaller painted controls and full touch targets.
2. Context is a compact utility band: decision, Run, Vendor, journey/visit, Scan Label, Add Photo, Share, sync, and New Entry remain available without large boxed buttons.
3. Tea identity is the strongest visual cluster: Tea Name, Origin, Year, Chinese Name, and Type.
4. Buying follows identity: Currency, Price, Form, and the existing form-aware gram slider.
5. Tasting follows Buying and stays visually lighter: Profile, Notes, and Intent remain visible.
6. Buy, Done, and Sample remain continuously reachable in the existing action footer with correct bottom-navigation clearance.

## Visual language

- Four stable visual regions use proximity, divider captions, and very subtle neutral surface shifts.
- Bronze is limited to current selection, focus, and meaningful status.
- Visible buttons are 32–36px high where practical; the interactive hit area remains at least 44×44px.
- Editable controls remain 16px to prevent iOS focus zoom. Action and support text use the tighter established UI scale.
- The layout is asymmetric rather than a uniform grid. Field widths follow information value: Tea Name is full width; Origin is wider than Year; Chinese Name is wider than Type.
- No core function moves behind a More menu, accordion, or sequential step.

## Responsive behavior

- 320–767px: compact single-column canvas optimized for 390×844.
- 768–1023px: two-column editorial composition for related clusters without changing information architecture.
- 1024px+: retain the desktop rail and use the wider pane for compact cluster alignment rather than stretching fields.

## Acceptance criteria

- At 390×844, Buying is before Tasting in DOM and visual order.
- Type shares the Chinese-name row; Suggest is an embedded trailing field action.
- The gram slider remains visible and form-aware.
- The Profile entry point is visible within the initial phone viewport or immediately at its lower edge, without the former long travel.
- All pre-existing controls remain reachable and retain accessible names and 44px touch targets.
- No horizontal overflow occurs at 320px, 390px, 768px, or desktop widths.
- Dark and light themes use only approved Teajia color tokens.


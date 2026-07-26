# Curate Import Shared Editor Design

## Purpose

Import Review must feel and behave like the existing Curate tea editor, not like a separate wizard. Source begins an import. Library owns saved imports. Capture and Import share the same presentational components so a field, spacing, disclosure, or action correction propagates to both surfaces.

This design is based on the current Curate Source continuous-sheet implementation on `main`, including the sourcing-zone refinement introduced by commit `dbadadab`. The current Source implementation is the authority. Import adapts to it; Source is not restyled back toward Import.

## Problems being corrected

- Incomplete import cards are mounted outside the Source scroll region and behave like permanent header furniture.
- Import Review uses a three-line header and a large sticky footer that consume the working canvas.
- `ImportItemRow` duplicates Curate fields, disclosures, spacing, and actions instead of using a shared component layer.
- Internal evidence identifiers, source ranges, and provenance compete with the tea information Adrian needs to verify.
- Expanded tea editing is long and system-oriented instead of matching Curate's compact continuous sheet.

## Information architecture

### Source

Source keeps the **Import** capture option for starting a new import. It does not show saved or incomplete import rows.

### Library

Library gains an **Imports** section inside its normal scroll content. It is not sticky and does not sit above the Library header or filters.

The section appears only when incomplete imports exist. Each import is a compact Curate-style row with:

- import title;
- reviewed and total item count;
- number needing attention;
- **Open** action;
- **Delete** action.

Delete uses the existing safe abandon operation. It removes the import from the incomplete list while retaining the original source record and evidence for audit and recovery. Confirmation states that consequence plainly. Completed imports leave the Imports section; the resulting tea identities remain in Library and inventory holdings remain in Inventory where applicable.

## Shared component boundary

`CaptureCard` must not be rendered inside Import. It owns capture-specific Zustand state, tasting, notes, ledger, vendor effects, and commit behavior. Reusing it directly would couple two different workflows.

Instead, the current Curate presentation is extracted into controlled, domain-neutral components. Capture and Import supply their own state adapters and save behavior.

### Shared primitives

1. **CurateField**
   - Owns the existing `curate-field`, recessed surface, floating-label, focus, typography, mobile font-size, input, select, and textarea presentation.
   - Accepts controlled values and callbacks without coercing exact imported numeric strings.
   - Supports an optional status slot for a concise **Confirm** cue.

2. **CurateDisclosure**
   - Owns the compact Curate disclosure row and reveal behavior.
   - Used by Capture details and Import's **More tea details** section.
   - Keeps open state controlled so each workflow owns its data lifecycle.

3. **CurateActionBand**
   - Owns Curate's compact neutral and primary action styling, accessible 44-pixel targets, disabled and busy states, and responsive two- or three-action layout.
   - `CaptureActionFooter` becomes a Buy, Done, and Sample adapter.
   - Import uses the same primitive for Cancel and Save tea, and for its final batch action.

4. **CurateRecordRow**
   - Owns the compact continuous-list row used for Library's incomplete imports and other Curate record summaries.
   - Supports primary text, compact metadata, status, Open, and optional Delete without becoming a card.

5. Existing CSS roles remain authoritative:
   - `curate-source-sheet`;
   - `curate-cluster`;
   - `curate-zone-context`;
   - `curate-zone-identity`;
   - `curate-zone-purchase`;
   - `curate-primary` and `curate-support`;
   - `curate-action`, `curate-compact-target`, and `curate-compact-chrome`.

`PricingRow`, `DetailsRow`, `CaptureContextChips`, and `CaptureCard` are not reused wholesale. Their presentation is shared through the primitives above while their domain-specific state and behaviors remain in their existing adapters.

## Import Review composition

### Header

Use one compact sticky task bar:

- close control on the left;
- **Review imported teas** in the center;
- concise progress on the right, such as **1 of 3 needs attention**.

Remove the separate Import title row, the repeated “Review 3 teas from 1 vendor” subtitle, and Record, Review, Added phase navigation. Record handling is backstage; Added is a completion state, not persistent navigation.

### Batch context

The first scrollable row summarizes the import in one line:

**3 teas · Huang Wei · 3.5 kg · CNY 2,300**

Sourcing run is a quiet context control below it when present or needed. Vendor is compact context, not a display headline.

### Tea rows

Needs-attention teas appear first. Ready teas follow under a compact **2 ready** disclosure.

A collapsed tea row shows:

- English name;
- Chinese or original supplier name;
- quantity and cost equation;
- one plain-language unresolved decision;
- **Review** action.

The row does not display source excerpts, UUIDs, text ranges, evidence references, or confident provenance labels.

### Expanded tea editor

Expansion uses the same continuous Curate sheet and field rhythm as the current tea editor.

1. **Identity**
   - English name;
   - Chinese name;
   - type;
   - origin;
   - year.

2. **Purchase**
   - pack weight and unit;
   - pack count;
   - price and currency;
   - price interpretation;
   - calculated total grams and line cost as quiet supporting copy.

3. **Inventory**
   - destination: received, in transit, or Library only;
   - Library tea match;
   - Inventory holding when applicable;
   - inventory purpose when applicable.

Only unresolved fields are expanded initially. **More tea details** reveals the remaining editable fields through `CurateDisclosure`.

Field-level uncertainty is shown only when it changes a decision. The cue is the word **Confirm** next to the editable field. Confident AI interpretation has no visible badge. Source IDs, evidence locations, and provenance states remain stored and available to the system but are not part of the normal editing interface.

Cancel is always left. Save tea is always right. Saving collapses the row and advances to the next tea needing attention when one exists.

## Batch actions and sticky behavior

- Remove the large elevated sticky slab at the bottom of Import Review.
- Per-tea actions are inline through `CurateActionBand`.
- The final batch action appears as a compact inline action band after the tea list.
- While work remains, it shows the remaining count and **Review next tea**.
- When all decisions are resolved, it shows the appropriate final action, such as **Add 3 teas to Inventory**.
- Only the single-line task header remains sticky.
- Library's Imports section and all import rows scroll normally.

## Copy

Use task language, not system language:

- “1 need review” becomes **1 of 3 needs attention**.
- “3 unresolved” becomes **3 decisions remaining** only where a field count is useful.
- “Edit tea” becomes **Review**.
- “Close editing” is removed; Cancel owns escape from an edit.
- “All details” becomes **More tea details**.
- “Confirm duplicate resolution and Inventory purpose” becomes **Choose the tea match and how this stock will be used.**
- “Record used for this item,” “Record location,” and raw evidence references are removed from the normal interface.

## Data flow

1. Source creates and analyzes an import with the existing API.
2. Incomplete imports refresh into Library's Imports section through the existing account-scoped query.
3. Opening a Library import launches Import Review with the existing normalized detail.
4. The Import adapter maps imported values into shared controlled Curate fields without losing exact price strings or provenance metadata.
5. Save tea continues to use the existing item update API and reviewed-field rules.
6. Finalize continues to create or merge Library identities and Inventory holdings through the existing atomic finalize operation.
7. Delete continues to use the existing abandon operation and immediately removes the row from Library's incomplete Imports section.

## Error handling

- Failed analysis remains recoverable from Import Review.
- Failed Open, Save, Finalize, or Delete actions preserve the current interface and expose a specific retry action.
- Delete confirmation and retry must never leave a stale destructive callback armed after another operation succeeds.
- Draft values survive lookup errors and failed saves.

## Responsive and accessibility requirements

- No horizontal scrolling.
- Every interactive target keeps the 44-pixel floor.
- Editable controls remain at least 16 pixels on mobile to prevent browser zoom.
- The one-line header must wrap or abbreviate status without becoming a second row.
- Disclosures expose state to assistive technology and restore focus after Cancel.
- Status icons always have text or accessible labels; color never carries meaning alone.
- Mobile bottom-navigation clearance uses the existing utilities rather than an oversized painted footer.

## Verification

Tests must cover:

- Source no longer renders incomplete import rows;
- Library renders incomplete imports inside its scroll content;
- Library import rows open and safely delete the correct import;
- completed and abandoned imports disappear from Library's Imports section;
- the header remains one line at desktop and mobile widths;
- Import Review uses shared field, disclosure, and action primitives;
- only uncertain fields show **Confirm**;
- internal source identifiers and record locations are absent from normal Review UI;
- collapsed, expanded, Cancel, Save, Save-and-advance, Retry, and Finalize flows;
- existing Capture behavior remains unchanged after component extraction;
- desktop and mobile Import/Library Playwright coverage has no overflow or sticky obstruction;
- TypeScript lint, color lint, production build, and whitespace checks pass.

## Non-goals

- Changing AI extraction, translation, or validation logic.
- Permanent deletion of source evidence.
- Replacing Capture's store or Import's API model.
- Rendering `CaptureCard` directly inside Import.
- Adding a new top-level navigation destination or renaming Source or Library.

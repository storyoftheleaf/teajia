# Curate Import Sourcing Folio

**Status:** Approved visual direction, pending written-spec review

## Purpose

Redesign Curate Import as a full-screen Curate workspace. The underlying import behavior remains intact: paste or attach evidence, let AI interpret multilingual vendor material, review uncertain fields, reuse existing records where possible, and finalize acquired stock into Inventory.

The current right-side sheet is functionally complete but visually detached from Curate. The redesign should feel like reviewing a sourcing folio assembled inside Curate, not processing database rows in a separate admin tool.

## Design anchor

The interface should feel like a carefully set sourcing document:

- vendor provenance establishes the structure;
- tea names and original Chinese names carry the hierarchy;
- quantities and costs use precise mono metadata;
- editing stays collapsed until something needs attention;
- aged bronze is reserved for current attention and commitment;
- whitespace and hairline dividers replace most bordered cards;
- the completed import reads like a ledger or receipt.

The approved visual companion is the sourcing-folio mockup with three states: Evidence, Review, and Added.

## Goals

1. Make Import full-screen at every breakpoint.
2. Make Import unmistakably part of Curate through its header, typography, spacing, context patterns, and surface treatment.
3. Preserve the mobile-first long vertical review flow.
4. Put blockers before ready material without hiding vendor context.
5. Keep ready teas compact and editable only on demand.
6. Preserve all existing evidence, recovery, matching, finalization, concurrency, and accessibility behavior.
7. Make completion feel like a sourcing ledger instead of a success dashboard.

## Non-goals

- No API, database, matching, money, or finalization changes.
- No new navigation route or changes to Curate, Source, Library, Ledger, or bottom-navigation labels.
- No per-item sourcing-run assignment.
- No desktop-only table or horizontal review layout.
- No decorative animation, new color system, new typography, or new component library.
- No restoration of browser `File` bodies from saved drafts.

## Screen architecture

Import remains an overlay launched from the existing Import capture tab, but it becomes a true full-screen Curate surface:

- `fixed inset-0 sidebar-inset z-modal` shell;
- `bg-tea-bg` or the established warm Curate surface treatment;
- no dim backdrop;
- no right alignment, drawer border, or `max-w-2xl` sheet;
- background Curate content remains inert and `aria-hidden` while Import is open;
- a full-width Curate-style header and phase line remain visible;
- content uses a centered working measure on larger screens and the full available width on mobile;
- the primary footer respects `pb-nav-gap` and the existing mobile bottom-navigation clearance.

The centered desktop canvas should not become a card. Full-screen describes the workspace boundary; the content itself is composed with whitespace and dividers.

## Header

The header uses Curate's panel grammar:

- top-left: Close control;
- center: serif `Import` title with one contextual status line;
- top-right: concise batch state, such as `2 need review` or `Draft saved`;
- below: restrained text phases, `Evidence`, `Review`, and `Added`.

The active phase is indicated with text contrast and one fine bronze rule. The phases are status indicators, not rounded tabs, pills, or a generic wizard.

Example contextual lines:

- Evidence: `Add vendor evidence`
- Review: `Review 10 teas from 2 vendors`
- Added: `Import complete`

## Evidence phase

The pasted vendor list or invoice is the visual focus.

- Use an open editorial document area rather than a boxed settings textarea.
- The section label is metadata; the pasted content uses calm readable body typography.
- Photos, files, invoices, and the optional sourcing run sit below as secondary text actions.
- Show the DOC/DOCX reference-only limitation before selection.
- Keep the Library-to-Inventory consequence copy, but reduce it to one quiet explanatory line.
- The sticky footer shows draft/translation context on the left and one primary start action on the right.

The optional sourcing run remains collapsed as `No sourcing run · Add` or the selected run with `Change`.

## Review phase

### Batch context

Start with one provenance line containing the vendor count, tea count, evidence count, and selected sourcing run. Avoid separate cards for these values.

The AI overview follows as a short editorial annotation:

- label: `AI reading`;
- concise serif or italic body copy;
- no large colored callout;
- confidence language stays specific and calm.

### Vendor sections

Vendor sections organize the complete review.

- metadata line: vendor, tea count, and match state;
- full-width serif vendor name;
- tiny `Change` action in the upper-right without truncating the title;
- optional sourcing-run context below the title;
- one hairline divider, no surrounding card.

Within each vendor, items are ordered:

1. `Needs review`
2. `Ready`

If a vendor has no blockers, omit the empty `Needs review` label.

### Tea rows

Collapsed tea rows use Curate's editorial identity hierarchy:

- ready or blocker state at the leading edge;
- serif English name;
- original or Chinese name using the established Chinese font;
- quantity, pack equation, cost, and total in quiet mono metadata;
- blocker message only when required;
- small `Edit` action at the trailing edge.

Ready rows remain compact. The redesign must not force users through each item.

### Blocker progression

The sticky footer shows the unresolved count and a primary `Next issue` action while blockers remain. `Next issue` scrolls and focuses the next unresolved tea in document order.

When every item is ready, the footer changes to the existing final commitment action. The action copy should describe the outcome in operator language, for example `Add 10 teas to Inventory`.

## Item editing

Expanded editing reuses the established Curate capture vocabulary wherever possible.

- Use whitespace and a top divider or recessed full-width region; do not use a side-stripe border.
- Blocker-related fields appear first.
- `All details` remains progressive disclosure.
- Tea type, origin, year, form, vendor, price, quantity, and notes should visually match their Capture counterparts.
- `Match tea` is the primary operator-facing label for the Library identity selection.
- `Choose stock record` is the primary operator-facing label for the Inventory holding selection.
- Canonical terms may appear as secondary clarification where needed.
- Cancel stays left; Save stays right.

The underlying `reviewed_fields`, matching, lookup, and save semantics do not change.

## Evidence presentation

Evidence should read as provenance, not attachment administration.

- Successful sources collapse into a quiet filename/source line or thumbnail.
- The source currently supporting a blocker may expand to show the relevant page/range reference.
- Failed or reference-only sources retain explicit status, recovery, Replace, Remove, and retry behavior.
- Do not place each successful evidence source in its own prominent bordered card.

## Visual language

### Typography

- Display serif: screen title, vendor names, tea names, and the AI annotation.
- Chinese serif: original and Chinese names.
- UI sans: controls, labels, statuses, and helper copy.
- Mono: weights, pack equations, prices, currency, and technical evidence references.
- Use `TYPOGRAPHY_CLASSES` and the named `text-ui-*` scale.

### Color

- Warm Espresso background and existing Curate surface tokens.
- Cream primary text, muted secondary text, and subtle hairline borders.
- Full bronze only for the active phase, current blocker, focus treatment, and primary commitment action.
- Ready states should use the existing muted success treatment, not another bright accent.
- Routine actions such as Edit, Change, Replace, Retry, and Open remain neutral until hover or focus.

### Composition

- Favor whitespace, alignment, indentation, and dividers.
- Remove metric tiles and repeated nested cards.
- Avoid uniform `space-y-*` rhythm across the whole screen; vary section spacing intentionally.
- No horizontal scrolling.

## Added phase

Replace the current completion metric cards with one sourcing-ledger composition.

- opening line: how many teas are connected to Library and Inventory;
- actual sourcing-run name when present;
- vendor sections with receipt context;
- tea lines showing quantity, cost, and created/reused dispositions;
- direct links to the tea record, stock record, and exact received receipt;
- `Close summary` on the left;
- `Start another import` on the right.

The completion screen uses the actual finalization response and must not infer created/reused state.

## Responsive behavior

### Mobile

- One continuous vertical document.
- Full-width vendor and tea titles.
- No side-by-side review panes.
- Sticky header context and sticky action footer.
- `Next issue` keeps blocker traversal thumb-friendly.
- Every interactive control retains a 44px target and 16px text input floor.
- Footer uses the existing bottom-navigation clearance utilities.

### Desktop

- Same document order and interaction model as mobile.
- Centered working measure with more generous side space.
- No modal sheet and no mandatory two-column split.
- The full-screen shell creates focus while the content retains a readable editorial measure.

## Accessibility

- Preserve focus trapping, Escape behavior, dirty-draft disclosure, global busy locking, and background isolation.
- The phase indicator exposes the current phase programmatically.
- Vendor sections and tea rows use meaningful headings and regions.
- `Next issue` moves both scroll position and keyboard focus.
- Status never relies on bronze or green alone; use text and accessible labels.
- Full-screen conversion must not introduce a second active dialog or duplicate file controls.
- Reduced motion is respected; any transitions communicate state and remain within 150–250ms.

## Behavior preserved

The redesign must retain all existing behavior and tests for:

- Chinese-name retention and English translation;
- exact pack math and exact monetary strings;
- vendor matching and creation;
- optional batch-level sourcing runs;
- Library identity and Inventory holding reuse/creation;
- evidence upload, reference-only files, per-file failure isolation, and retry;
- recoverable account-scoped drafts and file reselection honesty;
- explicit review of low-confidence values;
- finalization idempotency, concurrency fencing, receipt creation, and exact receipt links;
- completed imports not reopening as active review.

## Component direction

The implementation should evolve the existing component boundaries rather than rewrite the import engine:

- `ImportPanel`: full-screen shell, header, phase state, sticky footer, focus behavior.
- `ImportInput`: editorial source document and restrained evidence actions.
- `ImportBatchReview`: provenance line, AI annotation, blocker traversal, vendor ordering.
- `ImportVendorGroup`: folio section with blocker-first/ready grouping.
- `ImportItemRow`: Curate identity typography and Capture-compatible editor styling.
- `ImportEvidenceCard` and `ImportEvidencePreview`: compact provenance presentation.
- `ImportCompletionSummary`: sourcing-ledger ending.

Reusable visual patterns belong in `src/styles/card-utilities.css` only when they serve more than one component.

## Acceptance criteria

1. Import occupies the full Curate viewport at mobile and desktop sizes.
2. No dim backdrop, right-side drawer, or modal-width panel remains.
3. Evidence, Review, and Added are visibly and programmatically distinct phases.
4. Vendor names and tea identities lead the visual hierarchy.
5. Blocked teas appear before ready teas within each vendor.
6. Ready teas remain collapsed and compact.
7. `Next issue` advances to and focuses the next blocker.
8. The AI overview reads as an editorial annotation, not an alert card.
9. Successful evidence is visually quiet; failures remain actionable.
10. Side-stripe editors and completion metric tiles are removed.
11. Completion is grouped by vendor and lists actual created/reused destinations and receipts.
12. Mobile has no horizontal overflow and respects bottom-navigation clearance.
13. Existing import functional, accessibility, Worker, and Inventory tests remain green.
14. Focused mobile and desktop screenshots visually match the approved sourcing-folio direction.

## Verification

- focused Import component tests;
- Worker import and finalization tests to guard unchanged data behavior;
- Desktop Chrome and Mobile Chrome Import Playwright suites;
- keyboard-only close, phase, edit, match, `Next issue`, and completion traversal;
- 390×844 mobile screenshot review for Evidence, Review, expanded blocker, and Added;
- desktop screenshot review at the standard admin viewport;
- `npm run lint`;
- `npm run lint:colors`;
- `npm run build`;
- `git diff --check`.

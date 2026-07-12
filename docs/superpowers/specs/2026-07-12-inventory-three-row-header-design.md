# Inventory Three-Row Header Design

## Objective

Replace the inventory screen's six visually separate header bands with three compact rows while preserving every currently visible control. This is a composition and sticky-behavior change, not a feature reduction.

## Approved composition

The initial inventory viewport contains exactly three horizontal rows above the product data:

```text
TEA  WARES  Search  Incoming  Retail  Group  Sort    [location] Bali  USD  More
PURPOSE   All   Working   Samples   Personal          Needs attention +
Product   Stock   Retail   Type   Source   Origin   Leaf   Year
```

Rows one and two scroll away with the inventory content. The column-heading row remains sticky inside the existing inventory scroll container.

## Row 1: global and operational tools

The first row combines the existing global header and the existing inventory operations:

- Tea and Wares selectors
- Search button
- Incoming
- Retail/Cost toggle
- Group
- Sort
- Location icon followed by `Bali`
- Currency selector (`USD` in the reference state)
- More actions

All controls remain directly visible and labeled, except Search and More, whose established icons are sufficiently recognizable and retain accessible labels. `Teajia Bali` is shortened to a location icon plus `Bali`.

Search starts as a button. Activating it temporarily replaces the central portion of row one with the existing search input; it must not add a fourth row, overlay the column headings, or alter the inventory height chain. Closing or submitting search restores the normal row composition while preserving the query.

Incoming remains a direct control rather than moving into More. Retail/Cost, Group, and Sort retain their existing menus and behavior; only their triggers move into row one.

## Row 2: inventory views

The second row contains every existing purpose and attention entry point:

- `Purpose` label
- All
- Working
- Samples
- Personal
- Needs attention +

Purpose choices use compact text tabs rather than large outlined tiles. The active purpose is communicated with text color plus a short gold underline or restrained `tea-accent-sub` background. Needs attention remains fully visible at the opposite end of the same row and continues to reveal the existing attention views.

Custom saved views must remain accessible using the current view behavior. If a custom view is active, its name replaces the corresponding active-view text without creating a new band.

## Row 3: table columns

The existing column-heading row remains intact and is the only sticky header within the inventory scroll container. It continues to provide column labels and column-sort interactions for Product, Stock, Retail, Type, Source, Origin, Leaf, Year, and any other currently enabled columns.

The sticky row must preserve horizontal table alignment and must not introduce page-level horizontal scrolling.

## Visual treatment

- Three rows, with no banners or detached toolbars between them.
- One subtle divider below row two and the existing divider below the column headings.
- No large empty vertical gaps.
- Compact controls retain the 44-by-44 interaction floor through the existing `tap-target` utility without requiring 44px-wide visible boxes.
- Use the safe Teajia color tokens and `TYPOGRAPHY_CLASSES`/named UI text scale.
- Active or focused controls may use tea gold; passive borders use `tea-border` without opacity modifiers.
- The three rows read as a single ledger instrument, not stacked cards.

## Responsive behavior

The approved information architecture applies below `md`, including the narrow layout shown in the reference screenshot. Controls may tighten their internal gaps and visible padding, but labels and control availability may not be removed, moved into overflow, or replaced by unexplained icons to make the row fit.

At widths where row one cannot fit in its normal state, the layout uses the available full width and compact spacing. Search expansion is the only allowed temporary replacement state. There is no horizontal page scroll.

At phone width (390px), the same three-row information architecture redistributes the operational triggers without removing them: row one contains Tea, Wares, Search, Incoming, location, currency, and More; Retail/Cost, Group, and Sort follow Needs attention in row two. Every interactive control keeps a distinct, non-overlapping 44-by-44-pixel box. This responsive redistribution does not create a fourth row or move any control into overflow.

Desktop may keep its current broader toolbar geometry where it already presents the controls in a single compact surface, but its hierarchy should match the same three groups: global/operations, views, and columns.

## Interaction and state requirements

- Existing handlers, query parameters, saved views, counts, menus, sorting, grouping, price mode, incoming navigation, currency, location, and account actions remain functionally unchanged.
- Vendor and batch filter context must integrate into the first or second row as compact inline state, not create an additional banner.
- Opening the action rail or product panel must preserve the existing right-side clearance behavior.
- The mobile bottom navigation and its clearance remain unchanged.
- No navigation labels, destinations, or routes change as part of this work.

## Accessibility

- Preserve accessible names, pressed/selected state, expanded state, and keyboard behavior for all moved controls.
- Search receives focus when expanded and returns focus to its trigger when closed.
- Compact visual sizing must not reduce effective tap targets below 44 by 44 pixels.
- Active purpose and sort states cannot rely on color alone.

## Verification

- Confirm exactly three visible header rows in the initial narrow inventory viewport.
- Confirm only the column-heading row remains sticky after scrolling.
- Confirm every control listed in rows one and two remains visible and functional.
- Confirm search expands within row one without adding height.
- Confirm no horizontal overflow at 390 by 844 and at the reference viewport.
- Run `npm run lint`, `npm run lint:colors`, and the mobile Playwright suite, including the inventory scroll regression test.
- Verify the inventory scroll container retains a usable height and the documented ancestor height chain remains intact.

## Out of scope

- Removing or hiding existing controls
- Changing navigation, routes, or tab labels
- Changing inventory business logic
- Reworking the table columns or product data model
- Adding new filter or sorting capabilities

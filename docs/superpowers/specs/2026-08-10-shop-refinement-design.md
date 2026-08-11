# Shop Refinement Design

**Date:** 2026-08-10
**Status:** Approved direction; implementation pending
**Surface:** Public `/shop`, Tea tab, tea product detail, and launch catalogue hygiene

## Purpose

Make the public shop easier to enter, trust, and buy from without redesigning it. The existing tea ledger remains the visual and structural authority. The work adds one slim layer of organization, corrects launch-level commerce defects, and removes unfinished public content.

The finished shop should feel as though these controls were always part of it: same type roles, thin rules, compact rows, espresso ground, rare bronze, and no new card language.

## Success criteria

1. `/shop` still opens on Tea and immediately shows the complete available-tea ledger.
2. Within Tea, a slim secondary tab row reads, in this order: **All teas**, **My selection**, **Find a tea**.
3. All teas is the default on every new shop visit and cold load.
4. My selection is controlled by Adrian through the existing `isCurated` product flag and uses the same compact ledger language as All teas.
5. Find a tea applies existing canonical tasting filters and returns the reader to All teas; it does not introduce an algorithm or recommendation engine.
6. Sold-out teas stop competing with available teas and remain reachable through a quiet past-teas archive.
7. A tea opens reliably from the ledger on mobile and desktop, preserving scroll and filter state.
8. The ledger, product page, cart, and WhatsApp handoff display one consistent total and a correctly formatted per-gram rate.
9. No malformed, zero-price, placeholder, or unapproved product content is presented as launch-ready.
10. The mobile shop has no horizontal overflow, cropped internal tabs, obstructed controls, or tap targets below the existing 44px floor.

## Design boundary

### Preserve

- The existing Shop header and the Tea / Teaware / Sets / Liked category tabs.
- Existing routes and navigation labels outside the new Tea subview tabs.
- The current ledger composition, grouping by tea type, search, filters, prices, favorites, and product modal/page behavior.
- Cormorant Garamond, Lora, Plus Jakarta Sans, the established type roles, semantic color tokens, grain, spacing rhythm, and thin dividers.
- Inquiry-led commerce and the WhatsApp order conversation.
- Existing tasting taxonomy, human curation, and URL-backed filter state.

### Do not add

- A new visual world, hero, card grid, large featured cards, carousel, or imagery-led catalogue.
- New primary navigation, routes, backend architecture, recommendation service, personalization model, ranking, reviews aggregation, or automated checkout.
- New typography families, arbitrary type sizes, decorative pills, or additional accent colors.
- Horizontal scrolling for the new tab row or finder controls.

## Information architecture

The current Shop category tabs remain unchanged. The new view selector exists only inside the Tea category, immediately above the existing sticky search/filter toolbar.

### 1. All teas

This is the default view and retains the existing tea ledger.

- Show public, active, sale-ready, in-stock teas by default.
- Preserve the existing Type, Place, Feeling, Sort, Liked, mood/flavor, weight, and search controls.
- Preserve current grouping and sorting behavior unless availability requires removing sold-out rows.
- Add a quiet available count where it fits the current toolbar or ledger heading without creating a new large section.
- End the available list with a text link: **Past teas · sold out archive**.
- Activating that link shows sold-out public teas in the same ledger style and offers a clear return to available teas.

The archive is historical provenance, not a fourth persistent tab. It must not compete with the three primary Tea views.

### 2. My selection

This is Adrian's public shelf, not reader personalization.

- Source items from existing public, active products where `isCurated === true`.
- Hide sold-out or otherwise non-sale-ready products from this view; past selections remain available through the sold-out archive when appropriate.
- Render selections through the same reusable ledger row and type roles as All teas.
- Each row may show the existing name, provenance, year, tasting signature, price, favorite control, and product-opening interaction. Do not create a large card or a second product-summary component.
- If no products are curated, render a quiet empty state: **No current selection. Explore all teas.** The action returns to All teas.
- Adrian continues to manage the selection through the existing Curated control in the product/admin surfaces. No new public editing UI is introduced.

### 3. Find a tea

This is a compact entry into the existing filters.

- Present three typographic choices plus a direct return to All teas.
- Use thin ruled rows and the same label/body roles as the shop; no large tiles.
- Initial choices:
  - **Light and fragrant** → canonical flavor term `floral`.
  - **Grounding and deep** → canonical feeling term `grounding`.
  - **Clear and focused** → canonical feeling term `clarifying`.
  - **Open all teas** → clear finder-applied filters and return to All teas.
- Selecting a choice clears conflicting finder-applied state, applies the existing `flavor` or `feel` filter through the current state/URL synchronization, switches to All teas, and leaves the active filter visible in the existing toolbar.
- These are hand-authored doors into the taxonomy. They do not inspect reader behavior or generate recommendations.

## Visual and typographic contract

The new UI uses the project's existing roles rather than approximate look-alikes:

- Shop title: existing page-header treatment.
- Internal view tabs: `LABEL` / Plus Jakarta Sans 11px uppercase, compact horizontal spacing, one thin bottom rule, and a one-pixel bronze active marker.
- Section heading where needed: `HEADING`, Cormorant Garamond 20px.
- Product names and explanatory sentences: `BODY`, Lora 15px with the existing dark-surface leading.
- Metadata: `LABEL`, Plus Jakarta Sans 11px.
- Prices: `BODY` size plus `NUMERAL`, tabular figures.

The internal tab row must visually recede beneath Tea / Teaware / Sets / Liked. It is a local view selector, not a second primary navigation bar.

The implementation must reuse `TYPOGRAPHY_CLASSES` and the shop's shared roles from `src/components/shared/typeRoles.ts`. It must not reproduce the mockup's CSS values directly.

## Component boundaries

### `TeaInventory`

Owns Tea-view state and continues to own filter state, product modal routing, grouping, and the inventory query result. Add a local view union:

```ts
type TeaShopView = 'all' | 'selection' | 'find';
```

Initialize it to `all`. This is local presentation state; do not add a new route. Existing filter query parameters remain shareable.

### `TeaShopViewTabs`

A small shop-owned component that renders the three view controls in the approved order. It receives the active view and `onChange`. It knows nothing about inventory or filtering.

### `TeaFinder`

Renders the four approved typographic choices and reports a canonical filter intent to `TeaInventory`. It contains no inventory matching logic.

### Reusable ledger rendering

Extract the existing tea ledger row/group rendering only as far as necessary to render both All teas and My selection without duplicating markup. The extracted unit must preserve the current click, keyboard, favorite, admin-edit, stock, tasting-count, price, focus, and modal-opening behavior.

Do not refactor unrelated portions of the large `TeaInventory` file.

## State transitions

| Current state | Action | Result |
|---|---|---|
| Any Tea view | Select All teas | Show available ledger with current non-finder filters preserved. |
| Any Tea view | Select My selection | Show sale-ready `isCurated` products in the shared ledger treatment. |
| Any Tea view | Select Find a tea | Show only the finder choices. |
| Find a tea | Choose a finder path | Apply its canonical filter, switch to All teas, expose the active filter in the existing toolbar. |
| Find a tea | Open all teas | Clear finder-applied state and switch to All teas. |
| All teas | Open past teas | Show sold-out public teas using the same ledger renderer. |
| Past teas | Return to available | Restore the available ledger and existing non-availability filters. |
| Any ledger | Open a tea | Open the URL-backed Alcove modal with the ledger preserved underneath. |
| Product modal | Close / Back / Escape | Return to the exact ledger view and position. |

Switching between the three Tea views must not mutate the top-level Tea / Teaware / Sets / Liked selection.

## Commerce corrections

### Canonical price display

- Use the existing numeric product price as the single source for selected-weight totals.
- Use the dedicated per-gram formatter for rate copy; never pass one gram through the whole-total formatter.
- Ledger, product modal, cold-loaded product page, cart, and WhatsApp message must agree for the same weight and currency.
- The primary order control shows the selected weight and exact total. Per-gram context may remain secondary and must never truncate into a misleading number.
- Preserve localized visible pricing and fixed-USD structured data behavior already documented in `shopPrice.ts` and `ProductPage.tsx`.

### Product opening

- Verify the current background-location route on the implementation branch before changing it; production may lag the branch.
- A row press must show the Alcove modal immediately while changing the URL to `/shop/product/:id`.
- Cold loading that URL must continue to render `ProductPage`.
- Browser Back, the close control, Escape, and carousel navigation must retain their current contracts.
- Add regression coverage rather than replacing this architecture.

### Order access and reassurance

- After adding from a cold-loaded product page, the order/cart remains reopenable after the temporary toast disappears.
- Keep the inquiry reassurance adjacent to the order action: the order is sent through WhatsApp and Adrian confirms availability and delivery details.
- Do not introduce payment collection or automated checkout.

## Catalogue hygiene

This implementation must distinguish code safeguards from production content operations.

### Code safeguards

- Zero or invalid prices must not produce a purchasable public row or order action.
- Empty names, unresolved set items, or absent required identifiers must fail visibly in admin/validation rather than leaking raw IDs to the public shop.
- Public components must not invent fallback sales copy such as `Unknown` when omission is more honest.
- Existing `is_public`, active-status, tenancy, stock, and store scoping remain authoritative.

### One-time launch cleanup

Before production mutation, produce a read-only list of public records with malformed names, zero prices, placeholder text, inconsistent casing, unresolved set references, or stale factual copy. Adrian reviews the list. Approved corrections or unpublishing are then performed through existing admin/data tooling with explicit targets; there is no blanket destructive cleanup.

The known placeholder product impression must be removed or unpublished through a targeted data operation. No production data is mutated merely by shipping the UI code.

## Error and empty states

- Preserve the current load-error message and retry action.
- My selection empty: **No current selection. Explore all teas.**
- Finder result empty: reuse the current no-match state, retain the visible active filter, and offer Clear filters.
- Past teas empty: **No past teas in this shop.** with a return to available teas.
- If a curated product becomes unavailable while viewed, remove it from My selection on refetch rather than leaving a dead order action.

## Responsive behavior

- The internal tab labels must remain fully visible at 390px without horizontal scroll. Use compact gaps and available width; do not abbreviate the approved labels.
- All tab and finder interactions retain a 44px effective tap target using the existing `tap-target` or shared hit-area treatment without visually enlarging the text.
- The sticky toolbar remains below the page/category headers and must not cover ledger rows.
- Product commerce controls retain mandatory mobile-bottom-nav clearance.
- No new fixed layer may compete with the global floating navigation.

## Accessibility

- Use tab semantics only if the panels follow the complete accessible tabs contract (`tablist`, `tab`, `tabpanel`, arrow-key navigation, selected state, focus management). Otherwise render the controls as ordinary buttons with `aria-pressed`; do not create incomplete tab semantics.
- Preserve keyboard opening of tea rows and visible focus treatment.
- Announce result-count changes after finder choices and availability changes through a polite live region.
- Do not convey selected view, availability, or error state through bronze alone.

## Verification

### Focused tests

- All teas is the initial view.
- View order is All teas, My selection, Find a tea.
- My selection includes only public, active, in-stock `isCurated` teas.
- Each finder choice applies the expected canonical filter and returns to All teas.
- Past teas excludes available teas; default All teas excludes sold-out teas.
- The same extracted ledger row opens the modal and toggles favorite state in All teas and My selection.
- Per-gram pricing preserves cents and totals match the cart at 10g, 50g, 100g, and a custom weight.
- Direct product add leaves a persistent route to the cart/order panel.

### Browser verification

- Desktop and 390×844 mobile: no horizontal overflow, clipped tabs, obscured rows, or bottom-nav collisions.
- Product row opens Alcove; Close, Escape, Back, and cold load behave correctly.
- Finder → filtered All teas → product → Back retains the filtered ledger and position.
- My selection empty and populated states.
- Available and past-teas states.
- Slow-load, error, and retry states.

### Required commands

```bash
npm run lint
npm run lint:colors
npm run build
npm run test:mobile
```

Run the focused unit/component tests while building, then the full relevant verification once. Inspect the actual shop screen on desktop and mobile before reporting completion.

## Delivery sequencing

1. Add regression tests for current product opening and pricing behavior.
2. Extract the reusable ledger unit without changing its rendered behavior.
3. Add the slim Tea view controls and All teas default.
4. Add My selection from `isCurated`.
5. Add Find a tea using canonical existing filters.
6. Add available/past-teas separation.
7. Correct price formatting and persistent order access.
8. Run the read-only launch-data hygiene report; keep production mutation separately approved and targeted.
9. Verify mobile/desktop, type roles, colors, build, and mobile suite.

## Acceptance boundary

This design is complete when the public shop reads as the same Teajia ledger with three quiet ways to use it, the order path is trustworthy, and unfinished launch content is identified or removed. Any request for larger merchandising modules, new imagery systems, new navigation, personalization, checkout, or backend curation architecture requires a new explicit design decision.

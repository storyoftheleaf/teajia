# T2-07: Show Price-Per-Gram on Product Cards

**Status:** [ ] Not started
**Priority:** High
**Group:** B (Shop UX)
**Files:** `src/components/shop/AlcoveCard.tsx`, `src/components/shop/TeaInventory.tsx`, `src/components/shop/CollectionTab.tsx`

## Problem
Product cards show total price but not $/g. Specialty tea buyers need to compare value across teas. Requires mental math currently.

## Requirements
- Display price-per-gram prominently on all tea product cards and detail views
- Format: "$X.XX/g" in secondary text near the total price
- Add "Sort by: Price per gram" option in TeaInventory
- Teaware shows per-unit price (already does)

## Implementation Notes
- `pricePerGramUSD` field already exists on PublicProduct type
- AlcoveCard shows total price in the Add button — add $/g above the slider
- TeaInventory grid cards — add $/g below the product name
- CollectionTab cards — add subtle $/g display

## Acceptance Criteria
- [ ] $/g visible on all tea cards (grid and list view)
- [ ] $/g visible in AlcoveCard detail view
- [ ] Sort-by-price-per-gram option available
- [ ] Teaware shows per-unit price (confirm existing behavior)

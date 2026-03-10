# T3-13: Show Stock Level Indicators

**Status:** [ ] Not started
**Priority:** Medium
**Group:** B (Shop UX)
**Files:** `src/components/shop/AlcoveCard.tsx`, `src/components/shop/TeaInventory.tsx`, `src/components/shop/CollectionTab.tsx`

## Problem
Users don't see stock levels until they max out the gram slider. No urgency signals for low-stock items. No "sold out" prevention at cart level.

## Requirements
- Show stock status on product cards: "In Stock", "Low Stock" (< 100g), "Limited" (one-of-a-kind), "Sold Out"
- Color-code: green for in stock, amber for low, red for sold out
- Disable add-to-cart for sold out items
- Prevent adding more than available stock to cart

## Implementation Notes
- `stockGrams` and `isOneOfAKind` fields exist on products
- `status: 'Sold Out'` already in product type — use it
- Gram slider already caps at `stock_g` — just need visual indicator
- Consider "Only Xg remaining" text when stock < 100g

## Acceptance Criteria
- [ ] Stock status visible on all product cards
- [ ] Low stock items show urgency indicator
- [ ] Sold out items disable add-to-cart
- [ ] Cart prevents exceeding available stock

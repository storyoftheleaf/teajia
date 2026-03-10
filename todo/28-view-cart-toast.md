# T2-08: Add "View Cart" Toast After Adding Items

**Status:** [ ] Not started
**Priority:** High
**Group:** B (Shop UX)
**Files:** `src/components/shop/AlcoveCard.tsx`, `src/App.tsx` or new toast component

## Problem
After adding a product, the only signals are a 1.8s green flash and a tiny badge increment. Users may not realize the add succeeded or forget they have cart items.

## Requirements
- After successful add-to-cart, show a floating toast: "Added! View Cart (X items)"
- Toast is tappable — opens cart panel
- Auto-dismisses after 5 seconds
- Stacks if multiple items added quickly (show latest)
- Non-blocking — doesn't interfere with continued browsing

## Implementation Notes
- AlcoveCard already has success state (`isAdded` for 1.8s) — extend this
- Could use a global toast system (similar to admin's undo toast pattern)
- Position: bottom-center on mobile, bottom-right on desktop
- Include item name and total cart count

## Acceptance Criteria
- [ ] Toast appears after every add-to-cart action
- [ ] Toast shows item name and cart count
- [ ] Tapping toast opens cart panel
- [ ] Auto-dismisses after 5 seconds
- [ ] Doesn't block product browsing

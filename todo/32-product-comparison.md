# T3-32: Add Product Comparison Feature

**Status:** [ ] Not started
**Priority:** Medium
**Group:** F (Visual Polish)
**Files:** New `src/components/shop/CompareView.tsx`, `src/components/shop/TeaInventory.tsx`

## Problem
No way to compare teas side-by-side. Users browsing 139+ teas can't easily evaluate relative value, origin, or tasting profile differences.

## Requirements
- Add "Compare" toggle on product cards (max 3-4 items)
- Side-by-side comparison view showing: name, type, origin, year, $/g, tasting notes, mood, lore
- Accessible from a floating "Compare (X)" button when items are selected
- Clear all / remove individual items from comparison

## Implementation Notes
- Store comparison selection in Zustand or local state
- Comparison view could be a full-screen overlay or a dedicated panel
- Column layout on desktop, stacked cards on mobile
- Highlight differences between compared items

## Acceptance Criteria
- [ ] Users can select items for comparison
- [ ] Side-by-side view shows key attributes
- [ ] Works on both desktop and mobile
- [ ] Easy to add/remove items from comparison

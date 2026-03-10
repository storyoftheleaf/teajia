# T3-34: Add Swipe/Carousel Indicators to AlcoveModal

**Status:** [ ] Not started
**Priority:** Medium
**Group:** B (Shop UX)
**Files:** `src/components/shop/AlcoveModal.tsx`

## Problem
Product modal carousel has no visual indication that swiping between products is possible. No arrows, dots, or "X of Y" counter. Desktop users never discover this feature.

## Requirements
- Add prev/next arrow buttons on desktop (left/right of modal)
- Add dot indicators or "3 of 15" counter on mobile
- Show arrows on hover (desktop)
- Disable prev on first item, next on last item (with visual feedback)

## Implementation Notes
- AlcoveModal already has swipe navigation logic — just needs visual UI
- `items` array and current index available in component
- Arrows: use lucide-react `ChevronLeft`/`ChevronRight`
- Position: outside the card on desktop, overlay on mobile
- Consider keyboard hint: small "← →" text on first open

## Acceptance Criteria
- [ ] Desktop shows prev/next arrows on hover
- [ ] Mobile shows position indicator (dots or counter)
- [ ] Boundary items show disabled arrow
- [ ] Keyboard navigation hint shown on first visit

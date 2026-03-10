# T1-02: Fix Dead Share Button on AlcoveCard

**Status:** [ ] Not started
**Priority:** Critical
**Group:** B (Shop UX)
**Files:** `src/components/shop/AlcoveCard.tsx`, `src/components/ShareModal.tsx`

## Problem
The Share button on AlcoveCard has no `onClick` handler. Users tap it and nothing happens. Destroys trust in the interface.

## Requirements
- Connect Share button to the existing ShareModal or Web Share API
- Share should include: product name, description, and URL (once T1-01 is done, include product URL)
- Fallback to copy-to-clipboard if Web Share API unavailable

## Implementation Notes
- ShareModal already exists and works for stories — adapt for products
- AlcoveCard already has share button JSX (~line 539-557) — just needs onClick
- Consider using `navigator.share()` for mobile with fallback to modal
- Product share text: "{name} — {origin} {type} from Teajia"

## Acceptance Criteria
- [ ] Share button triggers share action on tap
- [ ] Works on both mobile (native share) and desktop (copy link / social links)
- [ ] Shared link leads to the product (depends on T1-01)

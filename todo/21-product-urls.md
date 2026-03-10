# T1-01: Make Product Modals URL-Backed

**Status:** [ ] Not started
**Priority:** Critical
**Group:** A (Routing & URLs)
**Files:** `src/components/shop/AlcoveModal.tsx`, `src/components/Shop.tsx`, `src/App.tsx`

## Problem
Product detail modals don't update the URL. Back button closes the shop entirely. Products can't be shared via URL or bookmarked.

## Requirements
- Add URL param for active product (e.g., `/shop?product=tie-guan-yin` or `/shop/:productId`)
- Browser back button should close the modal, not leave the shop
- Direct URL access should open the shop with that product's modal pre-opened
- Product URL should be copyable/shareable

## Implementation Notes
- AlcoveModal receives `item` prop — need to sync this with URL state
- Use `useSearchParams` from react-router to read/write product param
- On modal open: `setSearchParams({ product: item.id })`
- On modal close: `setSearchParams({})` (remove param)
- On page load: if `?product=xxx` exists, find and open that product

## Acceptance Criteria
- [ ] Opening a product updates the URL
- [ ] Sharing the URL opens the same product
- [ ] Back button closes the modal (returns to catalog)
- [ ] Forward button re-opens the modal

# TODO 08: Add Homepage Product Showcase Above the Fold

**Priority:** P1 — HIGH
**Impact:** Conversion, clarity of purpose, first-impression engagement
**Effort:** Low-Medium (1 day)
**Category:** Conversion / UX

---

## Problem

The homepage's first viewport is used for a rotating tea philosophy quote. A first-time visitor cannot determine within 5 seconds whether Teajia is a shop, magazine, consulting firm, or school.

There is:
- No product showcase above the fold
- No "bestsellers" or "featured teas"
- No "Shop Now" button
- No pricing visible until scrolling past the editorial content
- The seasonal tea pick appears below the fold

## What to Build

A "Featured Teas" section positioned within or immediately after the identity/insight section. Should show:

- 3–4 featured or bestselling teas in a horizontal scroll or grid
- Product image, name, tea type, price per gram
- "Quick Add" button on each card
- "Browse All Teas →" link to Shop

### Design Constraints
- Must maintain the editorial/artisanal tone — not a generic product grid
- Use the Alcove card system (`AlcoveCard.tsx`) or a simplified variant
- Keep the tea insight as a secondary element (move below, or make it a subtle banner)

## Data Source

Products are already available via `usePublicProducts()` hook. Filter for:
- `isFeatured === true` — explicitly featured teas
- OR `status === 'Active' && isPublic === true` — top 4 by some criteria

## Files to Modify

- `src/components/HomePage.tsx` — Add featured products section
- `src/context/InventoryContext.tsx` — Already provides products; may need a `featuredProducts` getter

## Verification

- First-time visitor sees tea products within the first viewport
- Each product card is clickable (navigates to Shop or product detail page)
- "Quick Add" adds item to cart without leaving the page
- Cart badge in sidebar/tab bar updates immediately
- Mobile layout shows horizontal scroll for featured teas
- Editorial tone is preserved — doesn't look like a generic e-commerce grid

## Related Issues

- #03 (product detail pages — featured teas should link to `/shop/:slug`)
- #15 (trust signals — product count, reviews near featured section)

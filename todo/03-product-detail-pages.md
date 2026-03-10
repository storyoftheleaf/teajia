# TODO 03: Create Dedicated Product Detail Pages (`/shop/:slug`)

**Priority:** P0 — CRITICAL
**Impact:** SEO, shareability, conversion depth, social media linking
**Effort:** Medium (2–3 days)
**Category:** Structure / Conversion

---

## Problem

Individual teas have no dedicated URL. Products only appear in card overlays or modal drawers. This means:

- No SEO indexing for individual products
- No shareable product links for social media or messaging
- No deep linking from editorial articles to specific teas
- No bookmarking
- 139 products with zero organic search presence

## What to Build

A full product page at `/shop/:slug` (e.g., `/shop/aged-sheng-2015`) showing:

- Product hero image (large, high quality)
- Tea type badge and origin info
- Product name (givenName + chineseName + productName)
- Description and lore
- Tasting notes (visual chips or tags)
- Processing notes, mood, experience, liquor color
- Price per gram with currency toggle
- "Add to Cart" button (prominent, sticky on mobile)
- Related teas ("You might also like") — same tea type or origin
- Back to Shop link

## Files to Create/Modify

- `src/App.tsx` — Add route: `<Route path="/shop/:slug" element={<ProductPage />} />`
- New: `src/pages/ProductPage.tsx` — Full product detail component
- `src/lib/api.ts` — May need a single-product endpoint or filter from existing data
- `src/components/Shop.tsx` — Update product card clicks to navigate to `/shop/:slug` instead of opening a modal
- `src/components/shop/AlcoveCard.tsx` — Add link behavior

## Slug Strategy

Generate slug from product data: `${givenName}-${year || ''}`.toLowerCase().replace(/\s+/g, '-')

Alternatively, use the product `id` as the slug: `/shop/product-abc123`

## Verification

- Each product has a unique, shareable URL
- Direct navigation to `/shop/some-tea` loads the correct product
- Browser back button returns to the Shop listing
- Social sharing shows product-specific og:image and description (#02)
- Mobile layout has sticky "Add to Cart" at bottom

## Related Issues

- #02 (SEO meta tags — product pages need `<Helmet>`)
- #04 (checkout flow — product page should have clear path to cart)
- #15 (trust signals — product page needs reviews/social proof)

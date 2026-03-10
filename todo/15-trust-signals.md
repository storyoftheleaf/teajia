# TODO 15: Add Trust Signals to Homepage and Shop

**Priority:** P3 — MEDIUM-LOW
**Impact:** Conversion rate, credibility, first-impression trust
**Effort:** Low (1 day)
**Category:** Conversion

---

## Problem

Almost zero trust signals exist on the public site:

- No customer reviews or ratings
- No product count surfaced ("139+ artisan teas" would be powerful)
- No shipping/returns policy visible before checkout
- No secure payment indicators
- No "about the vendor" information on product cards
- The ConsultPage has one random testimonial — too little social proof
- The email capture form doesn't explain what subscribers receive

## What to Add

### Homepage
- **Product count badge:** "139+ artisan teas from 12 origins" near the hero or featured section
- **Testimonial carousel:** 2–3 rotating testimonials (data exists in `src/data/consultTestimonials.ts`)
- **Email capture context:** Change "Stay Connected" to something like "Weekly tea notes — brewing tips, new arrivals, and seasonal picks"

### Shop
- **Product count in header:** "Showing 42 of 139 teas" or "42 teas in Green"
- **Shipping banner:** "Free shipping on orders over $XX" (sticky or at top of shop)
- **Origin badges:** Highlight the diversity — "Sourced from Taiwan, China, Japan, Indonesia"

### Cart / Checkout
- **Return policy link:** "30-day return policy" or equivalent, visible before checkout
- **Secure order indicator:** Even for WhatsApp orders, reassure the user

### Product Cards / Detail Pages
- **"About the seller" snippet:** Brief mention of Adrian's sourcing philosophy
- **Tea count per type:** "1 of 23 Oolong teas in our collection"

## Data Sources

Most of this data already exists in the codebase:
- Product count: `usePublicProducts()` → `products.length`
- Testimonials: `src/data/consultTestimonials.ts`
- Origin data: Product `originCountry` field
- Tea type counts: Group products by `type`

## Files to Modify

- `src/components/HomePage.tsx` — Add product count, testimonial section
- `src/components/Shop.tsx` — Add product count header, shipping banner
- `src/components/shared/CartPanel.tsx` — Add return policy link
- `src/components/EmailCapture.tsx` — Update copy to explain value

## Verification

- Homepage shows at least 2 trust signals above the fold
- Shop header shows product count
- Cart shows return/shipping policy before checkout
- All trust signals use real data (not hardcoded placeholder numbers)

## Related Issues

- #08 (homepage product showcase — trust signals live near featured products)
- #04 (checkout flow — trust signals reduce checkout abandonment)

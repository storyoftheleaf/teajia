# TODO 06: Split CartPanel into PublicCart and AdminCart

**Priority:** P1 — HIGH
**Impact:** Maintainability, UX clarity, bundle size
**Effort:** Medium (2–3 days)
**Category:** Architecture / UX

---

## Problem

`src/components/shared/CartPanel.tsx` is 59.6KB — a massive single component handling two completely different user journeys:

- **Public mode:** Simple checkout form + WhatsApp order builder
- **Admin mode:** Customer autocomplete, multi-currency display, invoice generation, PDF export

Mixing them creates:
- A maintenance nightmare (every change risks breaking the other mode)
- Poor public UX (unnecessary complexity loaded for simple checkout)
- Bundle bloat (admin-only code loaded for public users)
- Missing `<form>` element in public mode (no autofill, no Enter-to-submit)
- No debounce on admin customer search (API spam on every keystroke)

## What to Build

### PublicCart (~10KB target)
- Cart item list with quantity controls
- Remove item (with undo)
- Simple checkout form wrapped in `<form>`:
  - Name (with autofill)
  - Contact (WhatsApp/phone, with autofill)
  - Location/City
  - Notes (optional)
- Order summary with total
- "Place Order" button → WhatsApp message (or on-site flow per #04)
- Clean, focused, fast

### AdminCart (~30KB target, lazy-loaded)
- Full cart with multi-currency display
- Customer autocomplete (with debounce — 300ms minimum)
- Shipping cost input (with validation — no negative values)
- Currency selector
- Invoice generation + PDF export
- Abandoned cart recovery
- All admin-specific features

## Files to Create/Modify

- `src/components/shared/CartPanel.tsx` — Keep as a thin wrapper that conditionally renders:
  - `<PublicCart />` when `mode === 'public'`
  - `<AdminCart />` (lazy-loaded) when `mode === 'admin'`
- New: `src/components/shared/PublicCart.tsx`
- New: `src/components/shared/AdminCart.tsx`
- Shared: Extract cart item display into `src/components/shared/CartItem.tsx`

## Verification

- Public cart loads instantly (no admin code in bundle)
- Admin cart loads on demand when admin opens it
- Public checkout form supports browser autofill
- Enter key submits the form
- Admin customer search has visible debounce (no keystroke lag)
- Undo functionality works in both modes
- Cart state (Zustand) works correctly for both modes

## Related Issues

- #04 (checkout flow — PublicCart is where the improved checkout lives)

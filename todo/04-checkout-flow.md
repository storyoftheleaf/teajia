# TODO 04: Improve Checkout Flow (On-Site or Structured Order Form)

**Priority:** P1 — HIGH
**Impact:** Conversion rate (potentially 2–5x improvement)
**Effort:** High (1–2 weeks)
**Category:** Conversion

---

## Problem

The purchase flow exits the website entirely — users are redirected to WhatsApp to complete an order. This causes:

- 30–50% drop-off at the WhatsApp redirect step
- No order confirmation on-site
- No order history
- No payment processing
- A hardcoded fallback WhatsApp number (`+18313259164`) that may send orders to the wrong recipient
- The checkout form is not wrapped in a `<form>` element — no browser autofill, no Enter-to-submit
- Success message appears for only 3 seconds

## Options (Choose One)

### Option A: Stripe Integration (Best)
- Full on-site checkout with credit card processing
- Order confirmation page
- Email receipts
- Effort: 1–2 weeks

### Option B: Structured Order Form → Email/Webhook (Medium)
- Keep the form-based flow but send orders to a Cloudflare Worker
- Worker sends order email to admin + confirmation email to customer
- No payment processing, but orders are captured reliably
- Effort: 3–5 days

### Option C: Improve WhatsApp Flow (Minimum)
- Wrap checkout in a `<form>` element with proper autofill attributes
- Show a confirmation screen before redirecting to WhatsApp
- Pre-fill the WhatsApp message with structured order data
- Make success message persistent (not 3-second timeout)
- Fix the hardcoded fallback number
- Effort: 1–2 days

## Files to Modify

- `src/components/shared/CartPanel.tsx` — Primary target (59.6KB, needs restructuring regardless)
- `src/lib/api.ts` — Add order submission endpoint (Options A/B)
- `src/App.tsx` — Add order confirmation route (Options A/B)
- New: `src/pages/OrderConfirmation.tsx` (Options A/B)

## Verification

- User can complete a purchase without leaving the site (Options A/B)
- Or: user sees a clear confirmation before WhatsApp redirect (Option C)
- Form fields support browser autofill
- Enter key submits the form
- Order data is captured reliably (no silent failures)
- Mobile flow is smooth (no tiny tap targets, no layout shifts)

## Related Issues

- #07 (split CartPanel — should happen before or alongside this)
- #08 (homepage product showcase — needs somewhere to go after "Add to Cart")

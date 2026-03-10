# T1-03: Clarify the Checkout Model

**Status:** [ ] Not started
**Priority:** Critical
**Group:** C (Checkout & Trust)
**Files:** `src/components/shared/CartPanel.tsx`

## Problem
Users expect traditional payment after "Checkout." Getting WhatsApp/email compose is jarring. The biggest mental model violation on the site.

## Requirements
- Rename "Checkout" button to "Send Inquiry" or "Request This Order"
- Add visible explanation in the cart: "We confirm every order personally — availability, pricing, and shipping are confirmed via WhatsApp or email"
- Show this messaging BEFORE the user fills the inquiry form, not after
- Frame personal service as a feature, not a limitation

## Implementation Notes
- CartPanel.tsx handles both public and admin modes (~993 lines)
- Public mode checkout step needs copy changes and an info banner
- Consider adding a small "How ordering works" expandable section in cart view
- Order reference (TJ-XXXXXX) should be prominently displayed and saved to localStorage

## Acceptance Criteria
- [ ] No button says "Checkout" — replaced with clearer language
- [ ] Cart view includes explanation of the ordering process
- [ ] Order reference is visible and saved for user's records
- [ ] User understands they're sending an inquiry BEFORE filling the form

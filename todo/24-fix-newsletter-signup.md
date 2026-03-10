# T1-04: Connect Newsletter Signup to Backend

**Status:** [ ] Not started
**Priority:** Critical
**Group:** C (Checkout & Trust)
**Files:** `src/components/EmailCapture.tsx`, API worker (backend)

## Problem
Newsletter signup stores email only in localStorage and logs to console. Users believe they subscribed but the email never reaches any mailing list. A trust violation.

## Requirements
- Submit email to a backend endpoint (e.g., `/api/newsletter/subscribe`)
- Show clear success message with what they'll receive
- Handle errors gracefully (show retry option)
- Consider sending a welcome/confirmation email

## Implementation Notes
- EmailCapture.tsx currently: `console.log('Email subscription:', email)` + localStorage
- Need a new API endpoint in the Cloudflare Worker
- Options: Store in D1 table, forward to email service (Mailchimp, Resend, etc.), or at minimum store in D1 for admin export
- Add value proposition to the form: "Monthly tea insights, seasonal picks, and first access to rare teas"

## Acceptance Criteria
- [ ] Email is sent to backend on submit
- [ ] Backend stores the subscription
- [ ] Error state shown if submission fails
- [ ] Success message includes what they'll receive

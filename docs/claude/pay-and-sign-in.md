# Pay privacy and customer sign-in

> Moved verbatim from CLAUDE.md on 2026-11-03 so it loads only when needed. The short rules stay in [CLAUDE.md](../../CLAUDE.md).

## Pay is private, and approval is permanent

**Pressing Pay on a creator's page never shows a bank detail to the public.** The transfer details behind
`GET /api/public/people/:slug/payment-methods` open for exactly three viewers: the contributor, an account
they approved, and whoever holds a share link. Everyone else gets a 403 with the gate (`code: pay_private`)
and enough of the person to ask them. The rule is `decidePayAccess` in [worker/src/payAccessDomain.ts](../../worker/src/payAccessDomain.ts)
and it sits on the read itself, not on the page that renders it; migration `0022` holds the two tables.

- **An account is approved once, for good.** A visitor presses Pay, meets the gate, and asks (which needs an
  account, so the request carries a name). The request lands at the contributor's Your Table and under
  Payment on their profile page, Approve on the right, Decline on the left. There is no revoke and no expiry:
  the relationship is "has bought tea from me", which does not lapse. Decline removes the request; the person
  may ask again.
- **A link is a URL and simply opens.** `payment_share_links.token` rides on the pay URL as `?t=`. One per
  invoice (minted the first time the invoice earns a live pay link in `resolveInvoicePayments`, so every
  order shares the same URL and the amount is the balance still owed) and one open link per contributor,
  from Your Table. Opening a link while signed in records an approval for that account. There is no
  "I have a link" step anywhere; do not add one.
- The token is stored as typed, not hashed: the orders list has to print the same link on every read, and what
  it unlocks is the published methods, which a database leak exposes directly anyway.
- Enforced by [worker/tests/pay-is-private.test.ts](../../worker/tests/pay-is-private.test.ts) and
  `tests/creator-pay-gate.spec.ts`. Sandbox fixtures: Amara's account is approved for Kenji; Kenji's open
  link is printed by `npm run sandbox:seed-creators`.

## Customer sign-in surfaces (Google OAuth)
"Continue with Google" must stay present on all five customer/admin auth surfaces, each linking to `${API_URL}/api/auth/google?return=<path>` (never a bare relative `/api/auth/google` — the API is on a separate origin from the app, so a relative link 404s on teajia.com): `src/pages/SignInPage.tsx`, `src/pages/SignUpPage.tsx`, `src/components/AccountPanel/index.tsx`, `src/admin/components/AuthModal.tsx`, `src/components/events/RSVPFormSheet.tsx`. The worker callback (`handleGoogleCallback` in `worker/src/index.ts`) redirects the user back to the **app** origin via `env.APP_URL` (defaults to `https://www.teajia.com`), NOT `url.origin` — `url.origin` is the worker and has no app routes. The frontend reads `#oauth_token=` on load (`src/App.tsx`). Two orphaned `LoginScreen.tsx` files (`admin/`, `admin-panel/`) are dead demo code — do not wire auth into them.

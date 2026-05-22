# Follow-up: finish Claude mobile OAuth connector flow

> Created 2026-05-09. OAuth 2.1 + dynamic client registration shipped end-to-end
> for Teajia's MCP server, but Claude mobile fails at the consent step. One
> targeted debug session away from working. Deferred to keep the parent build
> shippable rather than chasing an iOS in-app browser quirk live.

## Current state

Voice control through Claude desktop works today using manually-minted tokens
from `/admin/mcp-tokens`. The OAuth flow added on top of that lets Claude
desktop/mobile/ChatGPT use their built-in "Add custom connector" UI instead
of requiring users to paste raw tokens.

**What works (verified via `wrangler tail`):**

1. Claude mobile hits `POST /mcp` without auth → worker returns `401` with
   `WWW-Authenticate: Bearer realm="mcp", resource_metadata="..."` header.
2. Claude fetches `/.well-known/oauth-protected-resource` → 200.
3. Claude fetches `/.well-known/oauth-authorization-server` → 200.
4. Claude calls `POST /oauth/register` → 201 with `client_id`.
5. Claude opens `GET /oauth/authorize?client_id=...&code_challenge=...&...`
   in the iOS in-app browser.
6. Worker 302s to `https://teajia.pages.dev/admin/oauth-consent?<same query>`.
   Confirmed via `curl -sI` that the `Location` header carries every param.
7. Phone browser loads `teajia.pages.dev/admin/oauth-consent?...` — page
   renders (no 404, no auth gate failure).

**The bug:**

The consent page (`src/admin/views/OAuthConsentView.tsx`) reports
`client_id, redirect_uri, code_challenge, code_challenge_method=S256` as
missing — meaning `useSearchParams()` returned empty for all of them, even
though the worker's `Location` header carried them and the page itself
rendered (so React Router matched the route).

## Three candidate causes (ranked by likelihood)

### A. iOS in-app browser is stripping the query string on the 302 follow

Claude mobile opens consent URLs in an in-app `SFSafariViewController` or
`WKWebView`. Some iOS in-app browser implementations have been observed to
truncate URL parameters past a length threshold, particularly when the
`code_challenge` is a long base64url string. **Verification:** ask Adrian to
tap the address bar on the consent page and screenshot the full URL. If
params are missing in the address bar, this is the cause.

**Fix:** encode the entire OAuth context into a single short `state`-like
parameter (e.g. a worker-side opaque key that maps back to the full param
set in D1), or move params into the URL path as segments. Path-segment
version is uglier but bulletproof.

### B. `useSearchParams()` not parsing on a hash router or basename issue

Less likely — if React Router didn't recognize the route, you'd get a 404
view, not the "missing parameters" error. Still worth checking that the
admin sub-router isn't stripping query on its `Outlet`.

**Verification:** add a one-line debug `console.log(window.location.href)`
at the top of `OAuthConsentView` and check Safari remote inspector. If
`window.location.href` has the params but `useSearchParams()` doesn't,
swap to `new URLSearchParams(window.location.search)`.

### C. The SPA `_redirects` rule (`/* /index.html 200`) drops the query

Cloudflare Pages rewrites preserve query strings by spec, but worth a sanity
check. `curl -i 'https://teajia.pages.dev/admin/oauth-consent?test=1'` →
inspect whether the served HTML's URL still has `?test=1` in the address bar
when loaded in a real browser.

## Resume protocol

1. Open this file, re-read the "current state" section.
2. Adrian opens Claude mobile, deletes any existing Teajia connector, adds
   `https://teajia-api.lightcodes.workers.dev/mcp` as a new custom connector,
   taps **Connect**.
3. When the consent page appears, Adrian taps the URL bar and screenshots it.
4. Compare the screenshot to the expected URL format below.
5. Apply the fix from whichever candidate cause matches.

**Expected URL format on a working consent page:**

```
https://teajia.pages.dev/admin/oauth-consent?response_type=code
  &client_id=<uuid>
  &redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback
  &code_challenge=<43-char base64url>
  &code_challenge_method=S256
  &state=<opaque>
  &scope=mcp
  &resource=https%3A%2F%2Fteajia-api.lightcodes.workers.dev%2Fmcp
```

## Code that's already in place

- `worker/src/mcp.ts` — `oauthAuthorize`, `oauthAuthorizeDecision`, `oauthToken`,
  `oauthRegister`, both discovery endpoints. Hardcodes
  `FRONTEND_ORIGIN = 'https://teajia.pages.dev'` for the 302 target.
- `worker/migrations/067_oauth.sql` — `oauth_clients`, `oauth_codes` (applied
  to remote D1, idempotent).
- `src/admin/views/OAuthConsentView.tsx` — the consent page; this is where
  the bug surfaces, but the bug is likely upstream of the React mount.
- `src/admin/AdminApp.tsx` — route `/admin/oauth-consent` registered behind
  `isAdmin` guard.

## Why we deferred

The worker side is verified correct (logs prove every step before the
consent page works as designed). The remaining bug is a browser/transport
quirk that needs the failing URL from Adrian's phone to diagnose
deterministically. Iterating on hunches blindly is more expensive than
waiting for the screenshot.

## Out of scope for this follow-up

- Voice control via Claude desktop already works through the manual-token
  path; no need to OAuth that surface.
- ChatGPT connector — once mobile works, ChatGPT likely works for free
  (same spec). If it doesn't, that's a separate follow-up.

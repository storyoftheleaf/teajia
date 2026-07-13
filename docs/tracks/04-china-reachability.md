# Track 4: China Reachability

> A sourcing tool that fails behind the GFW fails at its primary place of use — Adrian sources in mainland China, so every remaining third-party dependency (Unsplash, hardcoded API hosts, Google-only sign-in, wa.me-only checkout) has to fall to something reachable.

Status: pre-launch, in development.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [ ] **C2: rehost or remove the reachable Unsplash/picsum remainder.** The 2026-07-13 source scan reports 106 occurrences across 14 files: 51 Unsplash and 55 Picsum. Removing `/magazine-archive` and its six legacy photo essays eliminated 60 Unsplash occurrences; the current `/read` route family now has zero stock-host dependencies. Confirmed live remainder includes `/about` and Shop starter cards; classify the remaining Learn, collection, Advise, community, and demo datasets by route reachability before replacing them. `public/_headers:7` still whitelists both hosts in `img-src`/`media-src` and can be tightened after the reachable remainder is gone.
  - Fix pattern: same one C1 already proved. Upload each distinct photo through the existing R2 pipeline (`worker/src/index.ts:5658` image-upload handler, served back via `/api/media/<key>` — see `src/lib/mediaUrl.ts`) or drop static copies into `public/` if they don't need admin-editable URLs (product thumbs / seed data are static enough for `public/`). Rewrite each of the 22 files' URLs to the new same-origin path.
  - Done when: `grep -r "unsplash.com\|picsum.photos" src/` returns nothing, and `img-src`/`media-src` in `public/_headers:7` no longer list either host. (hours, mechanical but wide — ~55 images to source/upload)

- [ ] **C4: kill hardcoded `https://api.teajia.com`.** `src/pages/BriefingPage.tsx:20-23` and `src/pages/McpPage.tsx:5-9` both hardcode the apex-subdomain host that gets GFW-filtered (the same failure class `api.teajia.com`'s same-origin proxy already fixed everywhere else) — and it's not in `public/_headers:7`'s `connect-src` allowlist, so it's also a CSP violation for every visitor, not just China. `public/llms.txt:11` separately still advertises the dead `teajia-api.lightcodes.workers.dev` host for the public MCP endpoint.
  - Fix: replace both with the `window.location.origin` pattern already used in `src/lib/api.ts:159-161` (prod = own origin, dev = `VITE_API_URL`).
  - Update `public/llms.txt:11` to the same-origin `/mcp/public` path (depends on C5 shipping first, since that path doesn't exist yet — see below).
  - Done when: BriefingPage save/load and the McpPage display both work with `api.teajia.com` blocked at the OS level; CSP console has no `connect-src` violation on either page. (mins)

- [ ] **C6: finish the China auth fallback — verification + UI hint only, most of the work already shipped.** Google OAuth (`accounts.google.com`) is blocked in China on all five "Continue with Google" surfaces (SignInPage, SignUpPage, AccountPanel, AuthModal, RSVPFormSheet). What's actually still missing is narrower than the source audit assumed:
  - Already covers a locked-out Google-only user: `handleForgotPassword` (`worker/src/index.ts:1724`) sends a real password-reset email via Resend, independent of the `/api/verify/*` OTP system Track 1 item 4 covers. Confirmed live in prod: `RESEND_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME` are all set (`wrangler secret list`). A Google-linked user with no password can request a reset email and set one, even with no existing session.
  - Already covers a signed-in Google-only user on a working device: self-service "Set a password" in Account Settings, shipped `86d3e8f6` — `password_hash`-less accounts skip the current-password check.
  - What's left: none of the five auth surfaces mention China, Google being blocked, or point at "forgot password" as the fallback — a China-based Google-only user sees a dead "Continue with Google" button with no hint what to do next.
  - Fix: one line of copy under the Google button on all five surfaces (e.g. "Google sign-in unreachable in some regions — use email + password, or reset your password below") plus verify the forgot-password email round-trip actually completes from behind the GFW (Resend is a US-based API called edge-side from the Worker, should be unaffected, but unverified).
  - Done when: all five surfaces show the fallback hint; one verified round-trip (test account, GFW-simulated or real CN device) from "Google blocked" → forgot-password email → new password → signed in. (hours)

- [ ] **C7: decide and build the WeChat/email checkout fallback.** `src/lib/whatsapp.ts:132-133` is the single link builder; ~16 files call it for checkout (`src/components/shop/ProductInquiry.tsx`, `WhatsAppOrder.tsx`, `src/components/shared/PublicCart.tsx`, `AdminCart.tsx`, `src/components/samples/SampleOrderModal.tsx`, `src/pages/PublicCollectionPage.tsx`, `ForYourSpacePage.tsx`, `ProductPage.tsx`, `SessionPage.tsx`, `SpacesPage.tsx`, plus admin-side share surfaces). `wa.me` is blocked in China — a customer physically there cannot complete checkout at all today.
  - The groundwork exists: `wechat` is already a first-class `ContactChannel` (`src/admin/types.ts:135`) and a vendor field (`src/components/TeaCompass/types.ts:37`), just not surfaced on the public checkout path.
  - Adrian's call: WeChat contact path (mirror the wa.me link builder with a WeChat ID / QR) vs. explicit email-first fallback for CN visitors. The inquiry model (CART → INQUIRY → CONFIRM) survives either way — only the final hand-off channel changes.
  - Once decided: add the fallback branch to `whatsapp.ts`'s link builder (or a sibling `wechat.ts`/`checkoutFallback.ts`), gate it behind a CN-visitor hint (timezone/locale heuristic, or an explicit "having trouble reaching WhatsApp?" link), wire through the ~16 call sites.
  - Done when: a checkout flow with WhatsApp unreachable still has one working path to reach Adrian. (day — decision + build)

- [ ] **C5: proxy MCP through the reachable origin.** `functions/api/[[path]].ts` only forwards `/api/*`; `/mcp` and `/mcp/public` still live solely on `teajia-api.lightcodes.workers.dev`, unreachable from China. Voice/agent control fails there.
  - Fix: add `functions/mcp/[[path]].ts`, same pattern as `functions/api/[[path]].ts` (fetch-and-forward with `redirect: 'manual'`) — the OAuth authorize/redirect flow at `worker/src/mcp.ts:3655-3794` needs the same manual-redirect handling the API proxy already does for Google's 302.
  - Update `public/llms.txt:11` to advertise the same-origin path instead of the workers.dev host (do together with C4's llms.txt fix above).
  - Done when: `curl https://teajia.com/mcp/public` (or the equivalent same-origin call) returns a valid MCP response with the workers.dev host blocked. (hours)

- [ ] **Verify the worker→Groq voice leg from China, add raw-audio fallback.** `handleTranscribe` (`worker/src/index.ts:5454-5493`) is an edge-side Worker→Groq call (same class as the already-unaffected Worker→Google OAuth/Gemini calls), so it should be reachable — unverified from an actual CN connection. On failure it currently just 502s and the client (`src/hooks/useVoiceCapture.ts:79-93`) discards the recorded blob entirely; nothing persists it anywhere.
  - Verify: confirm a transcription request completes from a China-based connection (or GFW-simulated test).
  - Fallback: on a Groq failure, persist the raw audio (worker: write to `MEDIA_BUCKET` R2 and return a reference instead of a bare 502; client: on error, keep the blob and offer "retry" instead of silently dropping it — `useVoiceCapture.ts`'s `onstop` handler is the spot).
  - Done when: a transcription failure never loses the recording — worst case the user gets the raw audio back to retry or re-transcribe later. (hours)

### Polish

- [ ] **Remove dead preconnect + stale service-worker cache rules.** `index.html:73` preconnects to the dead `teajia-api.lightcodes.workers.dev` host (do together with C4). `vite.config.ts:49-56` still has a `CacheFirst` rule for `https://media.teajia.co/` and `vite.config.ts:57-68` one for the now-orphaned `/media/` path — both superseded by `/api/media/<key>` (shipped `d0f75b97`, July 8), which today only gets the generic `NetworkFirst` `/api/` rule at `vite.config.ts:42`. Fix: delete both dead rules, add (or extend) a `CacheFirst` rule matching `/api/media/` — these are immutable UUID-keyed objects and deserve the aggressive caching the dead rules were trying to give them. `vite.config.ts:69-75`'s `fonts.(googleapis|gstatic).com` rule is also dead (fonts fully self-hosted since C3/earlier) — delete. (mins)
- [ ] **Delete orphaned `functions/media/[[path]].ts`.** Proxies to `media.teajia.co`, a domain that `src/lib/mediaUrl.ts`'s own comment says "no longer resolves." Nothing in the frontend links to `/media/<key>` anymore (`grep` confirms zero live references outside this file's own comment) — all media now resolves through `/api/media/<key>` in the Worker (`worker/src/index.ts:18787`). Safe delete. (mins)

## Already shipped

- C1: same-origin media proxy — uploads serve from `/api/media/<key>` (`worker/src/index.ts:18787`, `src/lib/mediaUrl.ts`, shipped `d0f75b97`), and `public/_headers:7` already lists `media.teajia.co` in `img-src`/`media-src`/`connect-src` (the CSP half of C1 that the source audit flagged as unverified is fixed).
- C3: PDF fonts self-hosted — `InvoicePdf.tsx`, `PurchaseOrderPdf.tsx`, `LedgerPdf.tsx` all load `/fonts/PlusJakartaSans-Regular.ttf` instead of `fonts.gstatic.com`.
- Same-origin API proxy — `functions/api/[[path]].ts` forwards all `/api/*` through the app's own origin; sign-in, saves, uploads all ride `teajia.com/api/*`.
- GFW retry logic — `src/lib/api.ts:452-520` handles both GFW failure modes (mid-handshake reset, blackholed connection) with fresh-connection retries.
- `api.teajia.com` domain migration off `*.workers.dev` for the primary API host (superseded by the same-origin proxy above; the bare `api.teajia.com` host itself is still what C4 needs to stop referencing directly).
- China auth fallback, most of it: password field already live on all five "Continue with Google" surfaces; self-service "Set a password" for Google-linked accounts with an active session (`86d3e8f6`); email-based forgot-password reset via Resend, confirmed configured in production (`RESEND_API_KEY`/`SENDER_EMAIL`/`SENDER_NAME` all set). Only the UI hint and CN verification remain (C6 above).
- `wechat` contact field already modeled on the admin/vendor side (`src/admin/types.ts:135`, `src/components/TeaCompass/types.ts:37`) — not yet a checkout fallback (C7), but the data shape exists.

## Sources

- `docs/AUDIT_2026-07_READ_CURATE_CHINA.md` (live — §1 China/GFW reachability; kept per doc disposition as the active work queue until findings close)

## Cross-track dependencies

- C6's remaining scope is smaller than Track 1 item 4 ("verification-code delivery") implies for it — the `/api/verify/*` OTP system Track 1 item 4 covers is a separate mechanism from the already-working `forgotPassword` email reset used here. Track 1 item 4 still matters for event RSVP/customer verification codes, just not as a blocker for C6 anymore.
- Track 1 items "P3/P4 compass integrity" (localStorage bleed across accounts, silent promotion failure) are worse on flaky GFW connections but are fixed in Track 1, not here — don't duplicate.
- C4 and C5's `public/llms.txt:11` fix should land together (both touch the same line).

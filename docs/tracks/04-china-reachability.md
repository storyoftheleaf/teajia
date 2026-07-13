# Track 4: China Reachability

> A sourcing tool that fails behind the GFW fails at its primary place of use — Adrian sources in mainland China, so every remaining third-party dependency (Unsplash, hardcoded API hosts, Google-only sign-in, wa.me-only checkout) has to fall to something reachable.

Status: launch-program technical reachability floor complete and locally verified; real mainland-network validation remains pending.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [x] **C2: remove stock-media runtime dependencies.** All 174 historical Unsplash/Picsum occurrences are removed: dormant graphs were deleted and live founder, Shop-set, and contributor surfaces use code-native plates. No owned photographs were claimed. Stock hosts were removed from CSP; the source and built-output audit reports zero findings and scanner-policy tests pass 10/10.

- [x] **C4: remove hardcoded browser API origins.** Browser API consumers use the centralized same-origin helper, Pages uses a configured Worker upstream and fails closed, and public MCP metadata advertises the same-origin route. Scanner coverage prevents the retired literals from returning.

- [x] **C6: provide a non-Google authentication path.** Email OTP is implemented for sign-in and event/guest verification with password reset still available for linked accounts. Google OAuth remains optional, not required. Local provider-boundary and UI tests pass; a deployed Resend receipt and real mainland round trip remain external validation gates.

- [x] **C7: provide an email inquiry fallback.** Public inquiry surfaces resolve configured account contact data and retain an explicit email path when WhatsApp is unavailable. The inquiry-led commerce model is unchanged and focused contact tests pass.

- [x] **C5: proxy MCP and OAuth through the reachable origin.** Same-origin Pages routes forward `/mcp`, `/oauth/*`, and the supported discovery endpoints through the configured Worker upstream with manual redirect handling. Protected-resource metadata and MCP authentication challenges advertise the validated public Pages origin rather than the Worker hostname. Local proxy/policy coverage is complete; deployed mainland-network verification remains pending.

- [ ] **Verify the worker→Groq voice leg from China, add raw-audio fallback.** `handleTranscribe` (`worker/src/index.ts:5454-5493`) is an edge-side Worker→Groq call (same class as the already-unaffected Worker→Google OAuth/Gemini calls), so it should be reachable — unverified from an actual CN connection. On failure it currently just 502s and the client (`src/hooks/useVoiceCapture.ts:79-93`) discards the recorded blob entirely; nothing persists it anywhere.
  - Verify: confirm a transcription request completes from a China-based connection (or GFW-simulated test).
  - Fallback: on a Groq failure, persist the raw audio (worker: write to `MEDIA_BUCKET` R2 and return a reference instead of a bare 502; client: on error, keep the blob and offer "retry" instead of silently dropping it — `useVoiceCapture.ts`'s `onstop` handler is the spot).
  - Done when: a transcription failure never loses the recording — worst case the user gets the raw audio back to retry or re-transcribe later. (hours)

### Polish

- [x] **Remove dead preconnect and stale service-worker cache rules.** Generated policy now keeps browser traffic on same-origin API/media paths, removes Google Fonts runtime caching, and excludes mutation/OTP responses from caching.
- [x] **Delete orphaned legacy media proxy.** Browser media resolves through the current same-origin API path; the retired proxy is gone.

## Already shipped

- C1: same-origin media proxy — uploads serve from `/api/media/<key>` (`worker/src/index.ts:18787`, `src/lib/mediaUrl.ts`, shipped `d0f75b97`), and `public/_headers:7` already lists `media.teajia.co` in `img-src`/`media-src`/`connect-src` (the CSP half of C1 that the source audit flagged as unverified is fixed).
- C3: PDF fonts self-hosted — `InvoicePdf.tsx`, `PurchaseOrderPdf.tsx`, `LedgerPdf.tsx` all load `/fonts/PlusJakartaSans-Regular.ttf` instead of `fonts.gstatic.com`.
- Same-origin API proxy — `functions/api/[[path]].ts` forwards all `/api/*` through the app's own origin; sign-in, saves, uploads all ride `teajia.com/api/*`.
- GFW retry logic — `src/lib/api.ts:452-520` handles both GFW failure modes (mid-handshake reset, blackholed connection) with fresh-connection retries.
- Same-origin MCP/OAuth proxy, centralized browser origin policy, email OTP fallback, and configured email inquiry fallback are implemented and locally verified.

## Sources

- `docs/AUDIT_2026-07_READ_CURATE_CHINA.md` (live — §1 China/GFW reachability; kept per doc disposition as the active work queue until findings close)

## Cross-track dependencies

- C6 shares the implemented verification delivery boundary with Tracks 1 and 7. A deployed Resend receipt and real mainland-network round trip remain validation gates, not missing implementation.
- Track 1 items "P3/P4 compass integrity" (localStorage bleed across accounts, silent promotion failure) are worse on flaky GFW connections but are fixed in Track 1, not here — don't duplicate.
- C4 and C5 landed together around the same-origin MCP/public metadata boundary.

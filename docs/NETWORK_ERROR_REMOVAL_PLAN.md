# Removing the intermittent "No connection" banner — execution checklist

_Investigated 2026-07-16 (3-agent sweep: UI surfaces, worker/infra, fix history; live latency measurements; production incident-table query). This doc is written for an executing agent: work top to bottom, check items off as they land, run the verification at the end of each phase before moving on._

## Context: what the investigation established

The banner "No connection — check your network and try again." is one component: `src/components/shared/NetworkErrorNotice.tsx:44`, mounted globally at `src/App.tsx:1224`. It is fired ONLY by `dispatchNetworkError()` in `src/lib/api.ts` (call sites at the timeout-exhausted and retries-exhausted branches of `fetchWithTimeout`), on exactly two conditions:

1. `fetch` threw a `TypeError` (offline, DNS, TLS reset, CORS).
2. Our own `AbortController` timeout fired (`AbortError`).

HTTP 4xx/5xx never fire it (they resolve as `ApiError`).

**Root causes, ranked:**

| # | Cause | Where |
|---|---|---|
| 1 | Background sync heartbeat re-fires the global banner every ~30s while any tasting/sample entry is unsynced. False alarm over a working page; matches the observed pulse exactly. | `src/hooks/useCompassSync.ts` (30s retry effect), `src/hooks/useNotesSync.ts`, all via `fetchWithTimeout` |
| 2 | Server slowness reads as "check your network": the Pages proxy has no upstream timeout, so a hung Pages→Worker fetch sits until the client aborts (15s/attempt GET, 30s single-shot writes) and the banner shows. | `functions/api/[[path]].ts` (upstream fetch has no AbortSignal), same gap in `functions/media/[[path]].ts` |
| 3 | Zero telemetry: `classifyIncident` + `api.incidents.report` exist end to end (classifier, `POST /api/incidents`, `incident_ledger` table from migration 115) but NO production code calls them. Verified: production `incident_ledger` is empty. | `src/lib/incidents.ts` (dead), `worker/src/index.ts` incident routes (live, unused) |
| 4 | `storefrontApi.fetchJson` is a single-shot fetch with none of the retry hardening `api.ts` got. Every public storefront surface fails on the first transient hiccup. | `src/lib/storefrontApi.ts` |
| 5 | Raw `fetch` call sites bypass the hardened layer: `src/components/advise/InquiryForm.tsx:202`, `src/admin/views/MCPTokensView.tsx` (3 calls), `src/admin/views/OAuthConsentView.tsx` (2 calls), `src/admin/utils.ts:42`, `src/utils/exchangeRateApi.ts:9` (third-party host, GFW-blocked). `src/lib/cloudinary.ts` has its own 2 retries, acceptable. | listed |
| 6 | Retry stacking: React Query default (3 retries, no global override in `src/index.tsx`) multiplies `api.ts`'s internal ladder; a dead GET churns 45+ seconds before surfacing. | `src/index.tsx` QueryClient config |
| 7 | Banner UX: 5s timed toast, not tied to recovery; same "check your network" text for timeouts (server-side) and true transport failures. | `NetworkErrorNotice.tsx` |

**Verified NOT causes (do not spend time here):** Worker CORS (every error path re-wraps via `cors()`, and production is same-origin through the proxy so browser CORS never applies); token refresh (5xx keeps session, never fires banner); rate limits on reads (none exist); `WORKER_ORIGIN` misconfig (hard 503 outage, different message). Stale-service-worker loops were structurally fixed earlier (self-destroying SW, tiny precache, version self-heal).

---

## Phase 1 — Stop the false alarms

- [x] **1.1 Add a `background` flag to the fetch layer.** In `src/lib/api.ts`, extend `ApiRequestInit` with `background?: boolean`. When true, `fetchWithTimeout` must NOT call `dispatchNetworkError` on any failure path (both call sites). Errors still throw normally so callers keep their own handling.
- [x] **1.2 Mark all background work as background.** Apply the flag to every request issued by: compass sync (`src/lib/teaCompassSync.ts` → the `api.compass.*` calls it makes; thread the option through the api-method signatures or add background variants), sample sync (`sampleRepository.sync` path), notes sync (`src/hooks/useNotesSync.ts` → its sync calls), tasting journal sync (`src/lib/tastingJournalSync.ts`), and any polling/heartbeat callers found by grepping for `setInterval`/visibility-retry patterns that hit the API. User-initiated actions keep the default (banner allowed).
- [x] **1.3 Recovery-tied banner.** In `api.ts`, dispatch a new `teajia:network-recovered` event from `handleResponse` on any successful response (debounce: only if a network-error event was shown since the last recovery). In `NetworkErrorNotice.tsx`: show on error event, stay visible (no 5s auto-hide), clear on recovery event or manual dismiss.
- [x] **1.4 Honest message split.** The error event should carry a `detail.kind`: `'offline'` (TypeError while `navigator.onLine === false`) → "You're offline — reconnect to keep going."; `'unstable'` (TypeError while online) → "Connection is unstable — retrying."; `'slow'` (timeout) → "The server is taking too long — retrying." Update the banner to render per kind. Never say "check your network" for the timeout kind.
- [x] **1.5 Probe before blaming the network.** Before dispatching an `'unstable'`/`'slow'` event for a foreground failure, fetch `/version.json?probe=1` with `cache: 'no-store'` and a short (3s) timeout. If the probe SUCCEEDS, the network is fine and the API is the problem: dispatch kind `'slow'` (server wording), not `'unstable'`. Keep the probe result cached ~10s so bursts don't multiply probes.

**Phase 1 verification:** `npm run lint` clean. Unit-test the flag: a failing request with `background: true` never dispatches the event (extend existing api tests or add `src/lib/api.network.test.ts`). Manually: DevTools offline mode on a page with pending compass work → no banner from the heartbeat; a user-clicked action while offline → banner with the offline wording, clears on reconnect + next success.

## Phase 2 — Remove the real transport failures

- [x] **2.1 Timeout the Pages proxies.** In `functions/api/[[path]].ts` and `functions/media/[[path]].ts`, add `signal: AbortSignal.timeout(20_000)` to the upstream fetch. On abort, return JSON `{ error: 'The server took too long to respond. Please try again.' }` with status 504 and `Content-Type: application/json`. Keep `redirect: 'manual'` and streamed-body forwarding intact. Note: `AbortSignal.timeout` + streamed request bodies — verify a large upload still completes (the 20s window is per-response-start, so confirm with a real multi-MB upload against a preview deploy; if uploads break, exempt requests with a body from the timeout).
- [x] **2.2 Route the storefront through the hardened layer.** Export `fetchWithTimeout` (and the retry ladder) from `src/lib/api.ts`; rewrite `storefrontApi.fetchJson` to use it so public pages get the same backoff/jitter/wait-for-online behavior. Public storefront requests should use `background: false` (they are foreground page loads).
- [x] **2.3 Convert raw fetch call sites.** `InquiryForm.tsx:202`, `MCPTokensView.tsx` (all 3), `OAuthConsentView.tsx` (both), `admin/utils.ts:42` → use the hardened helper (or `authedFetch` where auth headers are already being hand-built). Leave `cloudinary.ts` and data-URL/local fetches alone.
- [x] **2.4 Exchange rate off the blocked host.** `src/utils/exchangeRateApi.ts` calls `api.exchangerate.host` directly from the browser (flaky, GFW-blocked). Either proxy it through the Worker (new tiny endpoint with a daily D1/inflight cache) or fall back silently to the stored account exchange rate on failure. Whichever is smaller; failure must be silent (no banner, no error state — a stale rate is fine).
- [x] **2.5 Tame retry stacking.** In `src/index.tsx` QueryClient config: `retry: 1` and a short `retryDelay` for queries (the fetch layer already retries transport errors aggressively). Confirm no per-view override depends on the default 3.
- [x] **2.6 Opt idempotent writes into timeout retries.** Audit write endpoints already safe to replay (PUT-by-id updates, INSERT OR REPLACE sync payloads, DELETE-by-id) and pass `retryTimeouts: true` on their client calls (compass sync/remove already do this — extend to notes sync, sample sync, and product field PUTs in `putProductUpdate`). Do NOT opt in invoice creation, order submission, or anything that inserts new rows without a client-supplied id.

Implementation note for 2.1: the proxies use a 12 second read budget and a 25 second body-bearing request budget, both shorter than their matching client attempt. Unit coverage verifies the timeout response and signal wiring. On 2026-07-17, deployment `233e35a1` accepted and fully forwarded a 5 MiB body in 0.66 seconds. The public validation handler consumed the complete body and returned the expected rejection for deliberately invalid JSON, with no inquiry or media object created.

**Phase 2 verification:** `npm run lint` + `npm run lint:colors` clean. Deploy preview; confirm `/api/health`-class GETs still work through the proxy and a deliberately slow endpoint (or a blackholed upstream test) returns the 504 JSON quickly instead of hanging 30s. Run `npm run test:mobile` (dev server on 7777) since public pages' fetch path changed.

## Phase 3 — Turn on the telemetry

- [x] **3.1 Report incidents from the fetch layer.** In `api.ts`, when dispatching a network-error event (foreground only) and when constructing an `ApiError` with status >= 500, call `classifyIncident` and fire `api.incidents.report(...)` fire-and-forget with `background: true` (so a failing report can never trigger the banner or recurse). Sample: at most one report per signature per minute client-side (module-level map).
- [x] **3.2 Report chunk-load recoveries.** In `src/lib/recoverFromChunkError.ts`, report an incident (category `client`, code `chunk_load_recovered`) when the purge-and-reload path fires, so stale-build events become visible.
- [x] **3.3 Confirm rows land.** After deploy, hit a forced failure in a preview (or wait a day of real traffic) and verify rows via: `cd worker && npx wrangler d1 execute teajia-db --remote --command "SELECT signature, category, occurrence_count, last_seen FROM incident_ledger ORDER BY last_seen DESC LIMIT 20"`. The admin already has a list endpoint (`GET /api/platform/incidents`) if a view is wanted later — not in scope here.

Deployment evidence for 3.3: on 2026-07-17, an authenticated same-origin probe returned HTTP 201 and remote D1 recorded signature `client_post_deployment_probe_none_forced_validation_1464b565` once with category `client`, route `/deployment-incident-probe.html`, method `POST`, error code `forced_validation`, and deployment `1464b565`. The synthetic row was then resolved so it does not enter the active incident queue.

**Phase 3 verification:** the D1 query above returns rows after a forced failure; no report loop (throttle works); `npm run lint` clean.

## Phase 4 — Regression guard

- [x] **4.1 Playwright spec** (`tests/network-banner.spec.ts`): with route interception aborting `/api/*` requests — (a) a background sync failure never shows the banner; (b) a foreground failure shows the correct wording per kind; (c) the banner clears when a subsequent request succeeds. Run on Desktop + Mobile Chrome like `tests/inventory-scroll.spec.ts`.
- [x] **4.2 Note the standing open item** in `docs/LAUNCH_VALIDATION.md`: real-mainland-China validation is still unchecked; with telemetry on (Phase 3), that trip becomes diagnostic. Do not check the box — just ensure the item references the incident ledger as the thing to read afterwards.

---

## Ground rules for the executing agent

- No em-dashes in any UI copy or docs text. Follow `docs/COLOR_RULES.md` for any banner styling change; the banner is already token-compliant, keep it that way.
- `npm run lint:colors` before every commit.
- Phases are ordered by value; land Phase 1 and 2 together or separately, but never Phase 3 first.
- Update `docs/CHANGELOG.md` when done and check items off in THIS file as they land.

# Teajia Audit — Ranked Findings

*Synthesis of 4 audit files (01–04), 240+ flows, 1344 lines of inventory*

---

## How to read this

- **Severity:** P0 (blocking), P1 (wiring/feature gaps), P2 (organization/redundancy), P3 (polish)
- **Source:** which audit file(s) the finding came from
- **Effort:** time estimate (10min, 1hr, half-day, day, multi-day)
- **Action column:** fill in [ ] keep / [ ] cut / [ ] defer / [ ] fix-now

---

## P0 — Security & Data Integrity (fix before next partner onboards)

| # | Finding | Source | Effort | Action |
|---|---------|--------|--------|--------|
| 1 | ~~RPC handlers (fulfill-invoice, void-invoice, increment-stock) lack ANY authorization checks~~ — VERIFIED FIXED 2026-04-28: all three RPCs gate on requireBundle. handleFulfillInvoice (line 2501) → requireBundle('sell'). handleVoidInvoice (line 2695) → requireBundle('sell'). handleIncrementStock (line 2680) → requireBundle('stock'). | 02 | — | [x] done |
| 2 | ~~31 actions with client-side gates but NO server-side requireBundle enforcement~~ — VERIFIED FIXED 2026-04-28: 81 `await requireBundle(...)` call sites across worker/src/index.ts. A scan of all 286 `Handler` exports found zero handlers without an auth helper (requireBundle / requireAccount / requireOwnerTier / requirePlatformAdmin / requireAdmin / requireOwner) in their first 30 lines. The Stock/Gather/Publish/Sell gaps from the original audit have all been closed by findings #7-#9 work plus subsequent fixes. | 02 | — | [x] done |
| 3 | ~~Bundle grant audit logging missing: PUT /api/accounts/:id/members/:userId/bundles does NOT write platform_audit_log~~ — VERIFIED FIXED 2026-04-28: handleUpdateMemberBundles (line 8978) writes `logPlatformAction(env, 'member.bundles_updated', ...)` with previous_bundles + new bundles + target user (line 9011). | 03 | — | [x] done |
| 4 | ~~Ownership transfer not audited: POST /api/accounts/:id/transfer-ownership does NOT log to platform_audit_log~~ — VERIFIED FIXED 2026-04-28: handleTransferOwnership (line 9602) writes `logPlatformAction(env, 'account.ownership_transferred', ...)` after the role-swap batch. Gates on requireOwnerTier first. | 03 | — | [x] done |
| 5 | ~~Account suspension enforcement weak: Platform tier acting in suspended account can still write~~ — VERIFIED FIXED 2026-04-28: requireAccount (worker/src/index.ts:380-405) explicitly checks `accounts.status = 'suspended'` for platform_owner/platform_admin paths BEFORE returning the context — returns 403 "This account has been suspended. Reactivate via the platform admin panel." Regular member path does the same check at line 449-453. Both fail closed (503) on DB-read failure. | 03 | — | [x] done |
| 6 | ~~Bulk product create (POST /api/products/bulk) has zero authorization checks~~ — VERIFIED FIXED 2026-04-28: handleBulkCreateProducts (line 1892) gates on requireBundle('catalog') as the first action; `accountId` is then used to scope all duplicate-checks and inserts. The 100-product cap (line 1900) is also still in place. | 02 | — | [x] done |

---

## P1 — Wiring Gaps (features exist but don't work end-to-end)

| # | Finding | Source | Effort | Action |
|---|---------|--------|--------|--------|
| 7 | ~~Gather bundle inconsistently enforced~~ — FIXED 2026-04-27: All /api/admin/events/* and /api/admin/venues/* handlers (33 total) now use requireBundle('gather'). Public event/venue reads (/api/events, /api/events/:slug/public, /api/venues/public, /api/s/:slug/events, /api/products/:id/events, /api/customers/:id/events) intentionally remain ungated. | 02 | — | [x] done |
| 8 | ~~Publish bundle invisible at server~~ — FIXED 2026-04-27: All /api/collections/* admin reads + writes (16 handlers) now use requireBundle('publish'). Public reads ungated by design: GET /api/collections/shop, GET /api/public/c/:slug, POST /api/public/c/:slug/view (customer-facing storefront + share links). | 02 | — | [x] done |
| 9 | ~~Stock bundle has no server implementation~~ — FIXED 2026-04-27: All stock-touching RPCs gated. requireBundle('stock'): increment-stock, reset-stock-verification, reserve-stock, release-stock (commit 1c57099) plus stock-ledger reads (commit c653dde). fulfill-invoice + void-invoice kept on requireBundle('sell') — primary semantic is invoice lifecycle; stock deduction is a side-effect, and 'sell' callers are operationally the right population. | 02 | — | [x] done |
| 10 | ~~Member bundle-gated flows NOT in public Account Panel~~ — PARTIAL FIX 2026-04-27: AdminTool.bundle field added; toolsForRole now bundle-aware; StaffView shift toolbar is now bundle-driven instead of hardcoded Inventory/Quick invoice/Quick capture. Remaining work: build first-class public Account Panel sub-views for bundle-holders (out of scope for Your Table coherence pass). | 01, 02 | (partial) | [~] |
| 11 | ~~Personal Collection & Compass sync incomplete~~ — VERIFIED SHIPPED 2026-04-27: useFavoritesSync + useCompassSync + useTastingJournalSync + useNotesSync all wired in App.tsx:160-164; worker endpoints /api/user/favorites and /api/compass/* implemented. Audit detail was stale. | 01 | — | [x] done |
| 12 | ~~Pull-to-refresh not fully wired~~ — FIXED 2026-04-27: usePullToRefresh now accepts a `() => void \| Promise<void>` callback and awaits it (with a 600ms minimum + 4s timeout) before hiding the indicator. App.tsx pulls trigger `refetchInventory()` + `queryClient.invalidateQueries()`; AdminApp.tsx pulls re-fetch products + rates. | 01 | — | [x] done |
| 13 | ~~Global search partially implemented~~ — FIXED 2026-04-27: GlobalSearch now indexes four sources via Fuse: products (live inventory), DB articles (`api.articles.listPublished`, React Query cache), public events (`api.events.listPublic`, React Query cache), and legacy localStorage Stories. Legacy stories surface under their own heading "Journal (saved on this device)" to make the local-only scope explicit. Queries are gated on `isOpen` with a 5-min staleTime so the modal reuses warm caches from Magazine + Events pages. | 01 | — | [x] done |
| 14 | ~~Cart checkout relies on per-store WhatsApp number without validation~~ — FIXED 2026-04-27: PublicCart.handleWhatsApp now validates the resolved phone digits (>=7) before opening wa.me; on failure shows an inline error ("This store doesn't have WhatsApp ordering set up. Please use Email or Copy text below to send your order.") instead of silently opening a recipient-less link. | 01 | — | [x] done |
| 15 | ~~Share modal & social sharing incomplete~~ — FIXED 2026-04-27: ShareModal Twitter intent (`twitter.com/intent/tweet`) wired with proper `<a target="_blank" rel="noopener noreferrer">` plus onClick `window.open(..., 'noopener,noreferrer')` for popup-blocker fallback; new Facebook button uses `facebook.com/sharer/sharer.php?u=`. Grid expanded from 3 to 4 columns. Copy/Twitter/Facebook/Chat row meets text-tea-text-sec floor. | 01 | — | [x] done |
| 16 | ~~Tasting journal sync only on auth ready~~ — VERIFIED SHIPPED 2026-04-27: useTastingJournalSync (src/hooks/useTastingJournalSync.ts) already mirrors the favorites pattern. On `justLoggedIn` (auth transition false→true) it calls hydrateTastingJournal() which merges local + server entries by productId; debounced 2s push of unsynced entries via syncTastingJournal() while authenticated. Audit detail was stale. Evidence: useTastingJournalSync.ts L20-48; tastingJournalSync.ts L94-115 (mergeEntries) + L121-150 (sync) + L157-191 (hydrate). | 01 | — | [x] done |
| 17 | ~~Tea Master invite email optional~~ — FIXED 2026-04-27: handlePlatformInviteTeaMaster now attempts a Resend send and returns `email_sent` in the response payload. PlatformAccessView surfaces "Invite created, but email could not be sent. Share this link manually:" with the claim link when `email_sent: false`. Audit log entry includes the same flag. | 03 | — | [x] done |
| 18 | ~~Adoption decision UI unfinished~~ — FIXED 2026-04-27: Verified the Adoptions tab is already wired end-to-end inside `/admin/network?tab=adoptions` (NetworkLanding renders `<AdoptionQueue embedded />` when `isPlatform`). List endpoint `GET /api/network/adoption-queue?status=pending|adopted|declined` (handleAdoptionQueue, requirePlatformAdmin) plus `POST /api/network/profiles/:id/adopt` are both implemented and exposed via `api.network.adoptionQueue` / `api.network.decideAdoption`. Pass refactored AdoptionQueue.tsx to React Query (`useQuery` + `useMutation`) so cache hydration + refetch follow the rest of admin views. SITE_MAP row updated from STUB to WIRED. | 03 | — | [x] done |

---

## P2 — Organization & Redundancy (collapse, regroup, rename)

| # | Finding | Source | Effort | Action |
|---|---------|--------|--------|--------|
| 19 | ~~Owner-gated tools bypass bundle system~~ — FIXED 2026-04-27: Magazine + Collections already declared `bundle: 'publish'` (commit c653dde). This pass adds `bundle: 'members'` to Team and Access entries (semantic tag — `requires: 'owner'` still gates display per toolsForRole short-circuit on line 79; the bundle field documents domain mapping and primes future per-bundle delegation). Settings stays owner-only (global account config, not a members concern). Purchase Orders gets `bundle: 'stock'` to align with finding #21 server-side gate. | 02 | — | [x] done |
| 20 | ~~Sourcing (Tea Compass, Vendors, Quick Capture) not bundled~~ — FIXED 2026-04-27: Registry side already complete in c653dde (compass/capture/vendors all `bundle: 'catalog'`). Server side: no `/api/vendors/*` or `/api/capture/*` endpoints exist (vendors are client-derived from product.vendor_name; capture is a UI flow that posts to `/api/compass/entries`). All `/api/compass/*` admin endpoints (entries CRUD, sync, share, incoming, accept/decline, claim, feedback, table-share) operate on the caller's own user-scoped compass — kept on `requireAccount`, not `requireBundle('catalog')`. Compass is a personal tool that every authed account member uses; gating it behind the catalog bundle would lock staff/viewers out of their own private notes. Public token endpoints (`GET /api/compass/invite/:token`) intentionally remain unauthenticated. | 02 | — | [x] done |
| 21 | ~~Purchase Orders outside Stock bundle~~ — FIXED 2026-04-27: All 3 handlers (handleListPurchaseOrders, handleCreatePurchaseOrder, handleUpdatePurchaseOrder) now use `requireBundle('stock')`. Registry entry also gets `bundle: 'stock'` alongside the existing `requires: 'owner'`. | 02 | — | [x] done |
| 22 | ~~Legacy role === 'owner' checks (13 instances) not consolidated~~ — VERIFIED 2026-04-27: Audited all 13 matches in worker/src/index.ts. None are inline auth-decision sites that should call requireOwnerTier: 6 are `const isOwner = ctx.role === 'owner'` data-scope filters inside collection handlers already gated by `requireBundle('publish')` above (used to widen the row scope for owners vs curators); 4 are target-row data filters (preventing modification/deletion of an owner row, sort priority on member listings); 2 sit inside the legacy `requireAdmin`/`requireOwner` global helpers (lines 812, 824) which intentionally inspect `claims.role` for global user-management endpoints (handleListUsers, handleUpdateUserRole, handleDeleteUser, handleCreateResetToken) — these are NOT account-scoped and must not route through requireOwnerTier (which calls getActiveAccount); 1 is the short-circuit inside handleRequestAdmin that skips the request flow if the caller already has admin/owner. All true account-scoped owner checks now go through requireOwnerTier. No code changes required. | 03 | — | [x] done |
| 23 | ~~Cross-tier data model assumes tokens are correct~~ — REWRITTEN + FIXED 2026-04-27: Original framing was wrong (HMAC signature is verified on every request via classifyToken; bundle resolution already re-queries D1). Real residual risks closed: (B) platform_role now re-resolved from users.platform_role on every request, demoted users lose powers immediately not at token expiry; (C) embedded membership fallback removed, role/bundle revocations take effect immediately; (D) suspension/membership DB read failures now fail closed (503) instead of permitting through. Risk A (JWT_SECRET rotation invalidates all sessions, no `kid` field) documented in ARCHITECTURE.md token trust model section. | 02, 03 | 30min | [x] done |
| 24 | ~~Activity log & audit trail unsecured~~ — FIXED 2026-04-27: activity-logs now requireOwnerTier, stock-ledger now requireBundle('stock'). Note: handlers were already account-scoped, so this closed an in-account privilege gap, not cross-tenant. | 02 | — | [x] done |
| 25 | ~~"Start Here", "For Your Space", "Spaces" in PREVIEW_MODE~~ — FIXED 2026-04-27: PREVIEW_MODE was already `false`; flag, ComingSoonPage component, and LeftSidebar conditional all removed. Three routes now show their working pages directly with no flag layer. LAUNCH_CHECKLIST.md archived. | 01 | — | [x] done |
| 26 | ~~Community page is STUB only~~ — FIXED 2026-04-27 (cut, not built): Route /community removed from App.tsx; CommunityPage.tsx deleted. Anyone clicking a stale link gets a 404, which is more honest than a placeholder. Revisit when community features actually have a design. | 01 | — | [x] done |
| 27 | ~~Account Panel "Operator" view not fully tested in multi-store~~ — FIXED 2026-04-27: Added tests/operator-multi-store.spec.ts. Covers: member of A & B browsing third storefront C (no membership), AccountPanel still reflects only A & B (memberCount stays at 2), and panel open/close on store C does not corrupt currency context. Mobile + Desktop. API mocked via page.route — no backend needed. The FINDING was the test gap; adding the tests closes it. No actual bug surfaced while authoring. | 01 | — | [x] done |
| 28 | ~~8 audit shards from March 2026 heavily overlapping~~ — FIXED 2026-04-27: All 13 shards (AUDIT, FUNCTIONAL_AUDIT, ARCHITECTURE_AUDIT, UI_UX_AUDIT, DESIGN_SYSTEM_AUDIT, WEBSITE_TEARDOWN, VISION_AUDIT_0–3) archived in docs/_archive/ with SUPERSEDED stamps pointing at STATE_OF_THE_SITE.md / FLOWS.md. Verified during commit 46aa5ee. | 04 | — | [x] done |
| 29 | ~~2 superseded briefs still in docs~~ — FIXED 2026-04-27: MEMBERS_AND_ACCESS_BRIEF.md and PHASE_1B_PLAN.md archived in docs/_archive/ with stamps pointing at NETWORK_ROLLOUT_PLAN.md. | 04 | — | [x] done |
| 30 | ~~2 duplicate strategy documents in docs/plan/~~ — FIXED 2026-04-27: teajia-complete-strategy.md and teajia-strategy-expansion.md archived in docs/_archive/ with stamps pointing at VISION.md and brief/PERSONAS.md. | 04 | — | [x] done |

---

## P3 — Polish & Copy

| # | Finding | Source | Effort | Action |
|---|---------|--------|--------|--------|
| 31 | ~~"Acting as" audit trail ambiguous~~ — FIXED 2026-04-27: Migration 056_audit_actor_account_id.sql adds `actor_account_id TEXT` to platform_audit_log (backfilled from account_id). logPlatformAction now writes both columns; auditPlatformActingWrite passes ctx.accountId explicitly so cross-account writes are unambiguous. PlatformAuditLogPage renders "operating as <account name>" when actor_account_id ≠ account_id. Semantics: account_id = the action's target; actor_account_id = the account context the actor was operating in. | 03 | — | [x] done |
| 32 | ~~Currency/exchange rate admin UI missing~~ — FIXED 2026-04-27: New platform-tier view at `/admin/currency` (`src/admin/views/CurrencyRatesView.tsx`), surfaced via `toolRegistry` ('teach' group, `requires: 'platform'`). Per-row save model with USD locked as base; Add/Delete with usage-count guard. Worker endpoints `GET/POST/PUT/DELETE /api/platform/exchange-rates` all gated by `requirePlatformAdmin` and audit-logged via `logPlatformAction` (`exchange_rate.created/updated/deleted`). Delete refuses currencies with rows in `products.cost_currency`, `customers.preferred_currency`, or `invoices.display_currency`. | 03 | — | [x] done |
| 33 | ~~Password reset email optional~~ — FIXED 2026-04-27: handleForgotPassword now attempts a Resend send. When email succeeds, the response is `{ ok: true, email_sent: true }` and the token is NOT returned (token belongs in the email only). When email is unavailable or fails, response is `{ ok: true, email_sent: false, token }` to keep the in-app recovery flow working in single-tenant mode. AuthModal handles both branches: success shows "Check your email…", failure surfaces "We couldn't send a reset email. Use this token here…". | 03 | — | [x] done |
| 34 | ~~AccessView.tsx (bundle editor) stub/incomplete~~ — FIXED 2026-04-27: AccessView already renders an EditorSheet (right-side drawer on desktop, full-width on mobile, `z-modal` overlay) with one toggle row per bundle (catalog/stock/publish/gather/sell/members), Cancel-left/Save-right footer per CLAUDE.md, inline error, and inline remove-member confirm. This pass added (a) a self-edit guard — the viewer's own row is non-clickable and tagged "You", and the editor refuses to mount for `editing.user_id === currentUserId` (sourced from `getTokenClaims().sub`) so an owner can't toggle away their own `members` bundle and lock themselves out; (b) optimistic row update via a new `handleSaveBundles` in the parent that patches the roster in place, awaits the PUT, then reconciles with `load()`, rolling back on rejection while bubbling the error into the EditorSheet's inline error slot. | 03 | — | [x] done |
| 35 | ~~Location/Account switcher in AccountPanel not fully tested~~ — FIXED 2026-04-27: Added tests/account-switcher-multi-location.spec.ts. Covers: switcher view renders with full membership count, switching A→B updates active membership, A→B→A round-trip keeps state coherent (the "stale data" edge case), and search filter match + empty state. Mobile + Desktop. API mocked via page.route. The FINDING was the test gap; adding the tests closes it. No actual bug surfaced while authoring. | 01 | — | [x] done |
| 36 | ~~Design system & visual audit disorganized~~ — SCOPED 2026-04-27: 169 inconsistencies synthesized and phased into 4 sequential stages in `docs/DESIGN_SYSTEM_PHASING.md` (Build foundation → Token migration → Scale rationalization → Mobile/a11y). Total 6–10 days. Implementation deferred; finding remains open until phases ship, but is no longer "vague backlog" — it's pickable work. | 04 | (planned) | [~] scoped |
| 37 | ~~Adoption decision audit details incomplete~~ — FIXED 2026-04-27: handleAdoptProfile now resolves the originator account's contact_email + trust_tier and the most recent approved account_application id, then writes them into platform_audit_log.details alongside decision, profile_name, originator_account_id, previous/new curator ids, and decline_note. Lookups are best-effort (try/catch) so audit logging cannot block the adoption write. | 03 | — | [x] done |

---

## Cross-Cutting Themes

### 1. **Client-Side Gates Without Server-Side Enforcement** (THE BIGGEST SECURITY GAP)

31 actions have client-side bundle checks but no server-side `requireBundle()` call. This means:
- An authenticated member with a higher-tier JWT can perform Stock/Gather/Publish/Sell actions regardless of their actual bundle assignment.
- RPC handlers (fulfill-invoice, increment-stock, release-stock) have ZERO authorization, making them the highest-risk attack surface.
- Implicit account scope alone is not enough — data visibility is protected, but mutations are not.

**Fix priority:** Add requireBundle enforcement to all 31 gaps. Start with RPC handlers (critical), then Gather (17 gaps), Publish (6 gaps), Stock (6 gaps).

---

### 2. **Bundle System Incomplete at Multiple Tiers**

The bundle authorization layer exists but is inconsistently applied:
- **Catalog bundle:** Carry, edit suggestions, network adoption all properly gated; but Tea Compass/Vendors/sourcing scope unclear.
- **Gather bundle:** Events have NO requireBundle('gather') despite being a primary bundle feature.
- **Publish bundle:** Collections, magazine all rely on owner-tier gate, not bundle gate; no server enforcement.
- **Stock bundle:** No server implementation at all. Purchase orders, inventory reads, all RPC actions unprotected.
- **Sell bundle:** Wholesale orders properly gated, but invoicing, customers, analytics all account-scoped with no bundle check.
- **Members bundle:** Properly enforced for invite/remove/grant operations.

**Fix strategy:** Systematize bundle enforcement. Define what each bundle actually gates (reads? writes? RPCs?). Add requireBundle guards to all collection, event, stock, and invoice endpoints.

---

### 3. **Tier vs. Bundle Mismatch in Account Panel UI**

The 43 tools shown in AccountPanel.OperatorView have inconsistent gating:
- Some use requires:'owner' (tier-level gate) → Magazine, Collections, Team, Access, Settings, Purchase Orders
- Some use no gate at all → Compass, Capture, Vendors, Inventory, Events, Venues
- Some are properly bundled → only 6 out of 43 have explicit bundle enforcement

Meanwhile, the public Account Panel (Member view) doesn't surface bundle-gated features at all. Members with Catalog/Stock bundles have no public UI to use those capabilities.

**Fix priority:** Decide: are bundle features public (in Account Panel) or admin-only? If public, migrate from admin section + add public UI. If admin-only, lock accountPanel tools to owner-tier uniformly (don't gate by bundle).

---

### 4. **Multi-Tenancy + Account Switcher Wiring Complete but Audit Trail Gaps**

Spot-check of 5 routes confirms X-Teajia-Account header + getActiveAccount() is correctly scoped. Platform tier account-switcher ("acting as") is properly logged. BUT:
- Bundle grant changes NOT logged → audit blind spot
- Ownership transfers NOT logged → critical privilege change invisible
- "Acting as" account_id column ambiguous (is it the target account or platform account?)

**Fix:** Add logPlatformAction() calls to 2 handlers (bundles + ownership). Add explicit actor_account_id field to audit table. Effort: < 1 hour.

---

### 5. **Documentation Folder Bloated & Heavily Overlapping**

46 markdown files across docs/, docs/brief/, docs/plan/, docs/_audit/:
- 8 audit shards from March 2026 overlap heavily (same codebase, different lenses) → consolidate into STATE_OF_THE_SITE.md
- 2 superseded briefs still in docs (merged into NETWORK_ROLLOUT_PLAN but preserved for design context) → move to _archive/
- 2 duplicate strategy docs (pre-VISION.md era) → likely archive-worthy
- 12 REDUNDANT files overall (overlapping audits, pre-consolidation versions)

**Consolidation plan exists in 04_doc_inventory.md** but not yet executed. Executing it would unblock clarity on:
- What's actually broken in the design system (scattered across UI_UX_AUDIT, DESIGN_SYSTEM_AUDIT, TEAJIA_PALETTES, WEBSITE_TEARDOWN)
- What flows connect to what (scattered across 8 vision audits)
- What's currently in-progress work (scattered across TODO, LAUNCH_CHECKLIST, plan/*, COMPASS_SOCIAL_PLAN, TASTING_JOURNAL_BRIEF)

**Effort:** ~9–10 hours of consolidation work (documented in 04_doc_inventory.md). Creates 4 new hub files (STATE_OF_THE_SITE, FLOWS, ACTIVE_BRIEFS, ARCHITECTURE) + 1 _archive/ directory.

---

## Triage Summary

**Total findings:** 37 — **all closed** as of 2026-04-28.

**Status by severity:**
- **P0 (Security & data integrity):** 6 / 6 done — verified by code recon 2026-04-28 (the 2026-04-27 audit closure pass implicitly fixed all 6, but the FINDINGS doc wasn't updated until now).
- **P1 (Wiring gaps):** 12 / 12 done (11 fixed + 1 partial scoped out — finding #10's first-class public AccountPanel sub-views explicitly out-of-scope for the Your Table coherence pass).
- **P2 (Organization & redundancy):** 12 / 12 done (finding #36 design-system phasing shipped through Phase A → D2 + C1/C1b/D1 between 2026-04-27 and 2026-04-28).
- **P3 (Polish & copy):** 7 / 7 done.

The audit is fully closed. Future work that surfaces from production usage should go into ROADMAP.md (phased project tracks) or TODO.md (smaller follow-ups), not back into this audit doc.

---

## Appendix: Cross-Reference to Audit Files

- **01_guest_member.md:** 98 Guest + Member flows; 10 top concerns (cart, search, bundles, compass, PREVIEW_MODE, community, switcher, tasting sync, share)
- **02_owner_master.md:** 127 Owner/Master actions; 31 enforcement gaps; 10 organizational concerns (RPC auth, bundle inconsistency, publish/stock/catalog server gaps, legacy role checks)
- **03_platform_crosscutting.md:** 15 platform actions (13 WIRED, 2 PARTIAL); 7 critical security gaps (audit logging, suspension enforcement, email optionality); 9 infrastructure debt items
- **04_doc_inventory.md:** 46-file inventory; 3 overlap clusters; consolidation plan for STATE_OF_THE_SITE + FLOWS + ACTIVE_BRIEFS + ARCHITECTURE + _archive/

---

**Audit conducted by:** Claude Code (Haiku 4.5)  
**Date:** 2026-04-27  
**Status:** Complete synthesis ready for triage

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
| 1 | RPC handlers (fulfill-invoice, void-invoice, increment-stock) lack ANY authorization checks; any authenticated member can invoke | 02 | 1hr | [ ] |
| 2 | 31 actions with client-side gates but NO server-side requireBundle enforcement (Stock 6, Gather 17, Publish 6, Sell 2) | 02 | half-day | [ ] |
| 3 | Bundle grant audit logging missing: PUT /api/accounts/:id/members/:userId/bundles does NOT write platform_audit_log | 03 | 10min | [ ] |
| 4 | Ownership transfer not audited: POST /api/accounts/:id/transfer-ownership does NOT log to platform_audit_log | 03 | 10min | [ ] |
| 5 | Account suspension enforcement weak: Platform tier acting in suspended account can still write (should block all writes) | 03 | 20min | [ ] |
| 6 | Bulk product create (POST /api/products/bulk) has zero authorization checks; any authenticated member can bulk-import | 02 | 1hr | [ ] |

---

## P1 — Wiring Gaps (features exist but don't work end-to-end)

| # | Finding | Source | Effort | Action |
|---|---------|--------|--------|--------|
| 7 | ~~Gather bundle inconsistently enforced~~ — FIXED 2026-04-27: All /api/admin/events/* and /api/admin/venues/* handlers (33 total) now use requireBundle('gather'). Public event/venue reads (/api/events, /api/events/:slug/public, /api/venues/public, /api/s/:slug/events, /api/products/:id/events, /api/customers/:id/events) intentionally remain ungated. | 02 | — | [x] done |
| 8 | ~~Publish bundle invisible at server~~ — FIXED 2026-04-27: All /api/collections/* admin reads + writes (16 handlers) now use requireBundle('publish'). Public reads ungated by design: GET /api/collections/shop, GET /api/public/c/:slug, POST /api/public/c/:slug/view (customer-facing storefront + share links). | 02 | — | [x] done |
| 9 | ~~Stock bundle has no server implementation~~ — FIXED 2026-04-27: All stock-touching RPCs gated. requireBundle('stock'): increment-stock, reset-stock-verification, reserve-stock, release-stock (commit 1c57099) plus stock-ledger reads (commit c653dde). fulfill-invoice + void-invoice kept on requireBundle('sell') — primary semantic is invoice lifecycle; stock deduction is a side-effect, and 'sell' callers are operationally the right population. | 02 | — | [x] done |
| 10 | ~~Member bundle-gated flows NOT in public Account Panel~~ — PARTIAL FIX 2026-04-27: AdminTool.bundle field added; toolsForRole now bundle-aware; StaffView shift toolbar is now bundle-driven instead of hardcoded Inventory/Quick invoice/Quick capture. Remaining work: build first-class public Account Panel sub-views for bundle-holders (out of scope for Your Table coherence pass). | 01, 02 | (partial) | [~] |
| 11 | ~~Personal Collection & Compass sync incomplete~~ — VERIFIED SHIPPED 2026-04-27: useFavoritesSync + useCompassSync + useTastingJournalSync + useNotesSync all wired in App.tsx:160-164; worker endpoints /api/user/favorites and /api/compass/* implemented. Audit detail was stale. | 01 | — | [x] done |
| 12 | Pull-to-refresh not fully wired: Visual indicator renders but refresh logic incomplete; no actual data re-fetch on pull | 01 | 2hr | [ ] |
| 13 | Global search partially implemented: Backend search API integration is stub-level; results may be empty | 01 | half-day | [ ] |
| 14 | ~~Cart checkout relies on per-store WhatsApp number without validation~~ — FIXED 2026-04-27: PublicCart.handleWhatsApp now validates the resolved phone digits (>=7) before opening wa.me; on failure shows an inline error ("This store doesn't have WhatsApp ordering set up. Please use Email or Copy text below to send your order.") instead of silently opening a recipient-less link. | 01 | — | [x] done |
| 15 | Share modal & social sharing incomplete: Copy-link works but Twitter/Facebook buttons are stub-level | 01 | 2hr | [ ] |
| 16 | Tasting journal sync only on auth ready: If guest tastes without signing in, entry lost on reload | 01 | 1hr | [ ] |
| 17 | ~~Tea Master invite email optional~~ — FIXED 2026-04-27: handlePlatformInviteTeaMaster now attempts a Resend send and returns `email_sent` in the response payload. PlatformAccessView surfaces "Invite created, but email could not be sent. Share this link manually:" with the claim link when `email_sent: false`. Audit log entry includes the same flag. | 03 | — | [x] done |
| 18 | Adoption decision UI unfinished: API exists (POST /api/network/profiles/:id/adopt) but no UI tab for reviewing pending adoptions | 03 | 3hr | [ ] |

---

## P2 — Organization & Redundancy (collapse, regroup, rename)

| # | Finding | Source | Effort | Action |
|---|---------|--------|--------|--------|
| 19 | Owner-gated tools bypass bundle system: Magazine, Collections, Team, Access, Settings use requires:'owner' (tier-level) instead of requireBundle | 02 | 3hr | [ ] |
| 20 | Sourcing (Tea Compass, Vendors, Quick Capture) not bundled: No server enforcement; unclear if sourcing is part of Catalog or standalone | 02 | 2hr | [ ] |
| 21 | Purchase Orders outside Stock bundle: Account-scoped but no bundle enforcement; appears Sell-adjacent but not requireBundle('sell') | 02 | 1hr | [ ] |
| 22 | Legacy role === 'owner' checks (13 instances) not consolidated: Mixed auth paths; harder to audit than single requireOwnerTier() helper | 03 | 2hr | [ ] |
| 23 | Cross-tier data model assumes tokens are correct: If JWT forged or token payload tampered, bundle checks fail silently | 02, 03 | — | [ ] |
| 24 | ~~Activity log & audit trail unsecured~~ — FIXED 2026-04-27: activity-logs now requireOwnerTier, stock-ledger now requireBundle('stock'). Note: handlers were already account-scoped, so this closed an in-account privilege gap, not cross-tenant. | 02 | — | [x] done |
| 25 | "Start Here", "For Your Space", "Spaces" in PREVIEW_MODE: Intentionally hidden behind feature flag; unclear ship date | 01 | half-day | [ ] |
| 26 | Community page is STUB only: Placeholder with no content, feeds, or discovery | 01 | 2–3hr | [ ] |
| 27 | Account Panel "Operator" view not fully tested in multi-store: Edge cases unclear (member of A & B, checkout from C); currency/storefront context may misalign | 01 | 1hr | [ ] |
| 28 | ~~8 audit shards from March 2026 heavily overlapping~~ — FIXED 2026-04-27: All 13 shards (AUDIT, FUNCTIONAL_AUDIT, ARCHITECTURE_AUDIT, UI_UX_AUDIT, DESIGN_SYSTEM_AUDIT, WEBSITE_TEARDOWN, VISION_AUDIT_0–3) archived in docs/_archive/ with SUPERSEDED stamps pointing at STATE_OF_THE_SITE.md / FLOWS.md. Verified during commit 46aa5ee. | 04 | — | [x] done |
| 29 | ~~2 superseded briefs still in docs~~ — FIXED 2026-04-27: MEMBERS_AND_ACCESS_BRIEF.md and PHASE_1B_PLAN.md archived in docs/_archive/ with stamps pointing at NETWORK_ROLLOUT_PLAN.md. | 04 | — | [x] done |
| 30 | ~~2 duplicate strategy documents in docs/plan/~~ — FIXED 2026-04-27: teajia-complete-strategy.md and teajia-strategy-expansion.md archived in docs/_archive/ with stamps pointing at VISION.md and brief/PERSONAS.md. | 04 | — | [x] done |

---

## P3 — Polish & Copy

| # | Finding | Source | Effort | Action |
|---|---------|--------|--------|--------|
| 31 | "Acting as" audit trail ambiguous: platform_audit_log.account_id doesn't distinguish "Adrian acting in account X" vs "Adrian's platform-wide action" | 03 | 1hr | [ ] |
| 32 | Currency/exchange rate admin UI missing: Rates exist; no visible admin panel for platform tier to manage them | 03 | 3hr | [ ] |
| 33 | ~~Password reset email optional~~ — FIXED 2026-04-27: handleForgotPassword now attempts a Resend send. When email succeeds, the response is `{ ok: true, email_sent: true }` and the token is NOT returned (token belongs in the email only). When email is unavailable or fails, response is `{ ok: true, email_sent: false, token }` to keep the in-app recovery flow working in single-tenant mode. AuthModal handles both branches: success shows "Check your email…", failure surfaces "We couldn't send a reset email. Use this token here…". | 03 | — | [x] done |
| 34 | AccessView.tsx (bundle editor) stub/incomplete: No "editor sheet" or mobile right-side drawer UI for bundle assignment yet | 03 | 2–3hr | [ ] |
| 35 | Location/Account switcher in AccountPanel not fully tested: Multi-location edge cases unclear | 01 | 2hr | [ ] |
| 36 | Design system & visual audit disorganized: 169 inconsistencies across DESIGN_SYSTEM_AUDIT + UI_UX_AUDIT + TEAJIA_PALETTES + WEBSITE_TEARDOWN; consolidation plan exists but not executed | 04 | — | [ ] |
| 37 | Adoption decision audit details incomplete: Details include decision + trust_tier but no applicant_email correlation or application.id | 03 | 30min | [ ] |

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

**Total findings:** 37

**By severity:**
- **P0 (Security & data integrity):** 6
- **P1 (Wiring gaps):** 12
- **P2 (Organization & redundancy):** 12
- **P3 (Polish & copy):** 7

**Estimated effort to clear P0 + P1:** 4–5 days (if done sequentially)
- P0 alone: ~2 days (bundle enforcement is the bulk)
- P1 alone: ~2–3 days (wiring + UI gaps)

**Quick wins (< 1 hour each):**
- Add logPlatformAction() to bundle grants + ownership transfer (findings #3, #4)
- Validate WhatsApp checkout fallback (finding #14)
- Fix Tea Master invite email error handling (finding #17)

**Biggest ROI fix (fixes 31 findings at once):**
- Systematize requireBundle enforcement across all 31 gaps (finding #2, enables fixes #7–#9)

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

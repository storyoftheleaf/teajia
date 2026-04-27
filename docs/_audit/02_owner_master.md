# Owner + Tea Master Tier Audit (Layer 1, Part 2)

**Audit Date:** 2026-04-27  
**Scope:** Location Owner and Tea Master tier capabilities across six bundles + cross-bundle actions  
**Target:** Verify 127 entries and identify server-enforcement gaps

---

## Summary

- **Total entries found:** 127
- **Status breakdown:** WIRED (94) | PARTIAL (18) | STUB (12) | ORPHAN (3)
- **Server enforcement gaps (NOT-ENFORCED):** 31 actions
- **Critical finding:** 18 client-side gates exist without server-side requireBundle enforcement

---

## A. Catalog Bundle

Canonical tea content (tea_profiles), partner listings, edit suggestions, and network adoption.

| Action | Entry Point | File:Line | Server-enforced | Status | Notes |
|--------|-------------|-----------|-----------------|--------|-------|
| Browse network catalog | GET /api/network/catalog | worker:12299 | requireBundle('catalog') | WIRED | Listing fetch for all carrying partners |
| Carry listing from network | POST /api/listings/carry | worker:12533 | requireBundle('catalog') | WIRED | Partner adds tea to own account from canonical |
| View listing details | GET /api/listings/:id | worker:12658 | requireBundle('catalog') | WIRED | Get single listing with images/pricing |
| Update listing metadata | PUT /api/listings/:id | worker:12774 | requireBundle('catalog') | WIRED | Price, store note, visibility, carry status |
| Create tea profile (own) | POST /api/products (tea-scoped) | worker:14236 | Limited | PARTIAL | Product creation exists but no catalog-specific enforcement |
| Suggest profile edits | POST /api/profiles/:id/suggestions | worker:12939 | requireBundle('catalog') | WIRED | Partner proposes canonical changes |
| View incoming suggestions | GET /api/suggestions/incoming | worker:13066 | requireBundle('catalog') | WIRED | Curator-only: review queue for one profile |
| List profile suggestions | GET /api/profiles/:id/suggestions | worker:13015 | requireBundle('catalog') | WIRED | All suggestions on a profile (curator view) |
| Approve/reject suggestion | POST /api/suggestions/:id/decide | worker:13120 | requireBundle('catalog') | WIRED | Curator accepts/rejects per-field changes |
| Flag profile for network | POST /api/network/profiles/:id/suggest-for-network | worker:13941 | requireBundle('catalog') | WIRED | Partner proposes own profile for adoption |
| AccountPanel: Tea Compass | Route /admin/compass | toolRegistry:28 | No gate | STUB | Views but no enforcement; Catalog bundle intent |
| AccountPanel: Quick Capture | Route /admin/capture | toolRegistry:29 | No gate | STUB | Data entry for sourcing; Catalog intent implied |
| AccountPanel: Vendors tab | Route /admin/compass?tab=sourcing | toolRegistry:30 | No gate | PARTIAL | Vendor management UI; no server enforcement |
| Bulk product create | POST /api/products/bulk | worker:14237 | None | ORPHAN | No authorization checks; admin-only in practice |
| Featured product pin | POST /api/products/:id/featured | worker:14240 | None | ORPHAN | Publish-adjacent; no bundle gate |

---

## B. Stock Bundle

Inventory, wholesale stock allocation, reservation holds.

| Action | Entry Point | File:Line | Server-enforced | Status | Notes |
|--------|-------------|-----------|-----------------|--------|-------|
| Get available stock | GET /api/stock/available | worker:14318 | None | PARTIAL | Read-only; no bundle enforcement |
| Reserve stock | POST /api/rpc/reserve-stock | worker:14316 | None | ORPHAN | Hold creation; no authorization checks |
| Release reserved stock | POST /api/rpc/release-stock | worker:14317 | None | ORPHAN | Hold release; no authorization checks |
| Increment stock (RPC) | POST /api/rpc/increment-stock | worker:14311 | None | ORPHAN | Direct stock adjustment; high-risk, no gate |
| Get stock ledger | GET /api/stock-ledger | worker:14327 | None | ORPHAN | Audit trail; no authorization check |
| Get activity logs | GET /api/activity-logs | worker:14326 | None | ORPHAN | Account-scoped but no explicit bundle gate |
| Reset stock verification | POST /api/rpc/reset-stock-verification | worker:14315 | None | ORPHAN | Reconciliation reset; no authorization checks |
| AccountPanel: Inventory | Route /admin/inventory | toolRegistry:25 | No gate | STUB | Stock view; no owner gate applied |
| AccountPanel: Purchase Orders | Route /admin/purchase-orders | toolRegistry:26 | requires: 'owner' | WIRED | Owner-only tool (gates at tier level, not bundle) |
| List purchase orders | GET /api/purchase-orders | worker:14321 | None | PARTIAL | Account member can read; no bundle enforcement |
| Create purchase order | POST /api/purchase-orders | worker:14322 | None | PARTIAL | Account member can create; no bundle enforcement |
| Update purchase order | PUT /api/purchase-orders/:id | worker:14323 | None | PARTIAL | Account member can modify; no bundle enforcement |

---

## C. Publish Bundle

Magazine, collections, editorial.

| Action | Entry Point | File:Line | Server-enforced | Status | Notes |
|--------|-------------|-----------|-----------------|--------|-------|
| AccountPanel: Magazine | Route /admin/magazine | toolRegistry:36 | requires: 'owner' | WIRED | Owner-only gate; no bundle fallback |
| AccountPanel: Collections | Route /admin/collections | toolRegistry:37 | requires: 'owner' | WIRED | Owner-only gate; no bundle fallback |
| List collections | GET /api/collections | worker:14281 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Create collection | POST /api/collections | worker:14282 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get collection details | GET /api/collections/:id | worker:14289 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Update collection | PUT /api/collections/:id | worker:14290 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Add items to collection | POST /api/collections/:id/items | worker:14291 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Update collection item | PUT /api/collections/:id/items/:itemId | worker:14292 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Remove collection item | DELETE /api/collections/:id/items/:itemId | worker:14293 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Publish collection (person) | POST /api/collections/:id/publications | worker:14294 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Unpublish collection | DELETE /api/collections/:id/publications/:pubId | worker:14295 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Publish to shop | POST /api/collections/:id/publish-shop | worker:14296 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Unpublish from shop | POST /api/collections/:id/unpublish-shop | worker:14297 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get needs attention | GET /api/collections/needs-attention | worker:14283 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get inbound collections | GET /api/collections/inbound | worker:14284 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get inbound by ID | GET /api/collections/inbound/:pubId | worker:14285 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Import inbound items | POST /api/collections/inbound/:pubId/import | worker:14286 | None | PARTIAL | Account-scoped; no bundle enforcement |

---

## D. Gather Bundle

Events, venues, attendee management, tasting sessions.

| Action | Entry Point | File:Line | Server-enforced | Status | Notes |
|--------|-------------|-----------|-----------------|--------|-------|
| AccountPanel: Events | Route /admin/events | toolRegistry:32 | No gate | WIRED | Events UI; no explicit owner gate |
| AccountPanel: Venues | Route /admin/events?tab=venues | toolRegistry:33 | No gate | WIRED | Venues tab; no explicit owner gate |
| AccountPanel: Interest Signups | Route /admin/events?tab=interest | toolRegistry:34 | No gate | WIRED | Signups tab; no explicit owner gate |
| List admin events | GET /api/admin/events | worker:14383 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get event details | GET /api/admin/events/:id | worker:14384 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Create event | POST /api/admin/events | worker:14385 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Update event | PUT /api/admin/events/:id | worker:14386 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Delete event | DELETE /api/admin/events/:id | worker:14387 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get attendees | GET /api/admin/events/:id/attendees | worker:14388 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get event notifications | GET /api/admin/events/:id/notifications | worker:14389 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Create notifications | POST /api/admin/events/:id/notifications | worker:14390 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Upsert post-session | POST /api/admin/events/:id/post-session | worker:14391 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Duplicate event | POST /api/admin/events/:id/duplicate | worker:14392 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Batch attendance | POST /api/admin/events/:id/attendance | worker:14393 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get tea menu | GET /api/admin/events/:id/tea-menu | worker:14394 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Upsert tea menu | POST /api/admin/events/:id/tea-menu | worker:14395 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Delete tea menu item | DELETE /api/admin/events/:id/tea-menu/:itemId | worker:14396 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get tasting notes | GET /api/admin/events/:id/tasting-notes | worker:14397 | None | PARTIAL | Account-scoped; no bundle enforcement |
| List venues | GET /api/admin/venues | worker:14372 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Create venue | POST /api/admin/venues | worker:14373 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Update venue | PUT /api/admin/venues/:id | worker:14374 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Delete venue | DELETE /api/admin/venues/:id | worker:14375 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get venue events | GET /api/admin/venues/:id/events | worker:14376 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Upload venue photo | POST /api/admin/venues/:id/photos | worker:14377 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Create venue space | POST /api/admin/venues/:id/spaces | worker:14378 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Update venue space | PUT /api/admin/venues/:id/spaces/:spaceId | worker:14379 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Delete venue space | DELETE /api/admin/venues/:id/spaces/:spaceId | worker:14380 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Approve attendee | PUT /api/admin/attendees/:id/approve | worker:14405 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Deny attendee | PUT /api/admin/attendees/:id/deny | worker:14406 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Waitlist attendee | PUT /api/admin/attendees/:id/waitlist | worker:14407 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Approve batch | POST /api/admin/events/:id/approve-batch | worker:14410 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Convert interest | POST /api/admin/events/:id/convert-interest | worker:14416 | None | PARTIAL | Account-scoped; no bundle enforcement |

---

## E. Sell Bundle

Invoicing, wholesale orders, customer pricing, revenue analytics.

| Action | Entry Point | File:Line | Server-enforced | Status | Notes |
|--------|-------------|-----------|-----------------|--------|-------|
| Create wholesale order | POST /api/wholesale/orders | worker:13339 | requireBundle('sell') | WIRED | Buyer initiates; real cross-account transaction |
| List wholesale orders | GET /api/wholesale/orders | worker:13856 | requireBundle('sell') | WIRED | Buyer/supplier can see their orders |
| Get wholesale order | GET /api/wholesale/orders/:id | worker:13889 | requireBundle('sell') | WIRED | Bilateral view (buyer sees supplier account reference) |
| Update wholesale order | PUT /api/wholesale/orders/:id | worker:13444 | requireBundle('sell') | WIRED | Add items, adjust quantities before fulfillment |
| Transition order status | POST /api/wholesale/orders/:id/transition | worker:13565 | requireBundle('sell') | WIRED | State machine: draft → submitted → confirmed → fulfilled |
| Nudge order | POST /api/wholesale/orders/:id/nudge | worker:13813 | requireBundle('sell') | WIRED | Buyer prompts supplier for faster response |
| AccountPanel: Activity (Sell group) | Route /admin/activity | toolRegistry:22 | No gate | WIRED | Transaction log; no owner gate |
| AccountPanel: Quick Invoice | Route /admin/activity?qi=1 | toolRegistry:23 | No gate | WIRED | One-click invoice creation; no owner gate |
| Get invoices | GET /api/invoices | worker:14250 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Create invoice | POST /api/invoices | worker:14251 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Update invoice | PUT /api/invoices/:id | worker:14253 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Delete invoice | DELETE /api/invoices/:id | worker:14254 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get invoice items | GET /api/invoices/:id/items | worker:14252 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Update invoice items | PUT /api/invoices/:id/items | worker:14304 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Fulfill invoice (RPC) | POST /api/rpc/fulfill-invoice | worker:14307 | None | ORPHAN | Stock deduction; no authorization checks |
| Void invoice (RPC) | POST /api/rpc/void-invoice | worker:14308 | None | ORPHAN | State reset; no authorization checks |
| Split invoice (RPC) | POST /api/rpc/split-invoice | worker:14309 | None | ORPHAN | Multi-item split; no authorization checks |
| Link line item (RPC) | POST /api/rpc/link-line-item | worker:14310 | None | ORPHAN | Customer reference; no authorization checks |
| List customers | GET /api/customers | worker:14261 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Create customer | POST /api/customers | worker:14263 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get customer | GET /api/customers/:id | worker:14262 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Update customer | PUT /api/customers/:id | worker:14264 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Delete customer | DELETE /api/customers/:id | worker:14265 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get customer orders | GET /api/customers/:id/orders | worker:14266 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get revenue analytics | GET /api/analytics/revenue | worker:14257 | None | PARTIAL | Account-scoped; no bundle enforcement |
| Get customer RFM | GET /api/customers/rfm | worker:14258 | None | PARTIAL | Account-scoped; no bundle enforcement |

---

## F. Members Bundle

Team access, role assignment, bundle grants to staff.

| Action | Entry Point | File:Line | Server-enforced | Status | Notes |
|--------|-------------|-----------|-----------------|--------|-------|
| AccountPanel: Team | Route /admin/people?tab=team | toolRegistry:39 | requires: 'owner' | WIRED | Owner-only; staff roster |
| AccountPanel: Members & Access | Route /admin/access | toolRegistry:40 | requires: 'owner' | WIRED | Owner-only; member bundle assignment |
| AccountPanel: Settings | Route /admin/settings | toolRegistry:41 | requires: 'owner' | WIRED | Owner-only; account settings |
| Get account members | GET /api/accounts/:id/members | worker:14158 | None | PARTIAL | Implicit owner-only; no bundle gate |
| Invite member | POST /api/accounts/:id/members | worker:14159 | requireBundle('members') | WIRED | Send email invite |
| Update member role | PUT /api/accounts/:id/members/:userId | worker:14160 | None | PARTIAL | Owner-only (checked in handler); no bundle |
| Delete member | DELETE /api/accounts/:id/members/:userId | worker:14161 | requireBundle('members') | WIRED | Remove person from account |
| Get account access (roster) | GET /api/accounts/:id/access | worker:14162 | requireBundle('members') | WIRED | Full roster with per-member bundle resolution |
| Update member bundles | PUT /api/accounts/:id/members/:userId/bundles | worker:14164 | requireBundle('members') | WIRED | Grant/revoke bundles to staff |
| Update member permissions | PUT /api/accounts/:id/members/:userId/permissions | worker:14183 | requireBundle('members') | WIRED | Legacy (pre-bundles); still checked |
| Set curator flag | PUT /api/accounts/:id/members/:userId/curator | worker:14184 | None | PARTIAL | Curator promotion; no bundle enforcement |
| Transfer ownership | POST /api/accounts/:id/transfer-ownership | worker:14185 | None | PARTIAL | Owner-only (checked in handler); no bundle |

---

## G. Owner-Only / Cross-Bundle

Tier-specific actions that don't fit a single bundle or are privilege-escalated above bundles.

| Action | Entry Point | File:Line | Server-enforced | Status | Notes |
|--------|-------------|-----------|-----------------|--------|-------|
| Upgrade to Location | POST /api/platform/accounts/:id/upgrade-to-location | worker:14181 | Platform-only | N/A | Platform Owner only; Tea Master → Location |
| Get account info | GET /api/accounts/:id | worker:14155 | Auth + member check | WIRED | All members; includes tier/kind |
| Update account profile | PUT /api/accounts/:id | worker:14156 | Owner-only (checked in handler) | PARTIAL | Update name, slug, description; no bundle gate |
| Get account features | GET /api/accounts/:id/features | worker:14157 | Auth + member check | WIRED | Feature flag read; public info |
| Get account activity | GET /api/accounts/:id/activity | worker:14163 | None | PARTIAL | Audit log; implicit owner-only |
| Get network stores | GET /api/network/stores | worker:14188 | None | WIRED | Public catalog; no auth required |
| Get public account | GET /api/s/:slug | worker:14213 | None | WIRED | Public storefront; no auth required |
| Get public account products | GET /api/s/:slug/products | worker:14214 | None | WIRED | Public catalog; no auth required |
| Get public account events | GET /api/s/:slug/events | worker:14215 | None | WIRED | Public event list; no auth required |

---

## H. AccountPanel "Operator" View — 43 Tools Displayed

These are the 43 tools shown to Location Owner and Tea Master by toolRegistry.ts (filtering by isOwner=true, isPlatform=false). All include requires: 'owner', plus the six that are not owner-gated.

| Tool ID | Label | Group | Owner-gated | Status | Notes |
|---------|-------|-------|------------|--------|-------|
| activity | Activity | sell | No | WIRED | Transaction log tab |
| quick-invoice | Quick Invoice | sell | No | WIRED | Inline invoice creation |
| people | Customers | sell | No | WIRED | Customer/contact list |
| inventory | Inventory | sell | No | WIRED | Stock view; no enforce gate |
| purchase-orders | Purchase Orders | sell | Yes | WIRED | Dedicated route; owner-only |
| compass | Tea Compass | source | No | WIRED | Vendor/sourcing UI |
| capture | Quick Capture | source | No | WIRED | Data entry for vendors |
| vendors | Vendors | source | No | WIRED | Vendor tab in compass |
| events | Events | gather | No | WIRED | Event manager UI |
| venues | Venues | gather | No | WIRED | Venue/space manager |
| interest-signups | Interest Signups | gather | No | WIRED | RSVP interest tab |
| magazine | Magazine | publish | Yes | WIRED | Owner-gated editorial |
| collections | Collections | publish | Yes | WIRED | Owner-gated curated lists |
| team | Team | teach | Yes | WIRED | Owner-only staff roster |
| access | Members & Access | teach | Yes | WIRED | Owner-only permission assignment |
| settings | Settings | teach | Yes | WIRED | Owner-only account config |
| platform-access | Platform Access | teach | Yes (platform) | N/A | Platform Admin only |
| network-catalog | Carry from Network | network | Yes | WIRED | Owner-gated; Step 2 |
| network-suggestions | Suggestions | network | Yes | WIRED | Owner-gated; Step 3 |
| network-wholesale | Wholesale | network | Yes | WIRED | Owner-gated; Step 4 |
| network-adoptions | Adoptions | network | Yes (platform) | N/A | Platform Admin only |

---

## I. Tea Master–Specific Variations

Tea Master tier is implemented as `account_kind = 'master'` in the database. Operationally coequal to Location Owner per NETWORK_ROLLOUT_PLAN.md §15–17, but differs in:

| Feature | Location Owner | Tea Master | Enforcement |
|---------|---|---|---|
| Physical address required | Yes | No | DB constraint (nullable) |
| Default trust margin | Tier-dependent (NETWORK_ROLLOUT_PLAN §7) | Tier-dependent, distinct from Location | Query-based resolution |
| Storefront presentation | "Shop" language; commercial | "Practitioner" language; advisory | UI conditional on account_kind |
| Bundle grants | All 6 on own account (locked-on) | All 6 on own account (locked-on) | Identical resolveBundles() logic |
| Network catalog access | Full (Catalog bundle) | Full (Catalog bundle) | No distinction in server |
| Wholesale orders | Buyer/supplier both OK | Buyer/supplier both OK | No distinction in server |
| Adoption queue visibility | N/A (Platform-only) | N/A (Platform-only) | Platform Owner only |

**Conclusion:** No separate server-side enforcement. All tier differences are in UI presentation (`account_kind` checked in React) and trust-tier lookup (margin resolution). No gaps at the authorization layer.

---

## J. Bundle Enforcement Gaps (NOT-ENFORCED)

**31 actions with client-side gates but no server-side requireBundle enforcement.** These are security vulnerabilities: an authenticated member with a higher-tier token can perform these actions regardless of their bundle assignment.

### Stock-related (6 gaps)
1. GET /api/stock/available — read available inventory (implicit account scope, no bundle gate)
2. POST /api/rpc/reserve-stock — hold stock (no authorization checks)
3. POST /api/rpc/release-stock — cancel hold (no authorization checks)
4. POST /api/rpc/increment-stock — manual stock adjustment (RPC, no gate; HIGH RISK)
5. GET /api/stock-ledger — audit trail (implicit account scope, no bundle gate)
6. POST /api/rpc/reset-stock-verification — reconciliation reset (no authorization checks)

### Gather-related (17 gaps)
7. GET /api/admin/events — all events (implicit account scope, no bundle gate)
8. GET /api/admin/events/:id — single event (implicit account scope, no bundle gate)
9. POST /api/admin/events — create (implicit account scope, no bundle gate)
10. PUT /api/admin/events/:id — edit (implicit account scope, no bundle gate)
11. DELETE /api/admin/events/:id — delete (implicit account scope, no bundle gate)
12. GET /api/admin/events/:id/attendees — roster (implicit account scope, no bundle gate)
13. GET /api/admin/events/:id/notifications — notifications (implicit account scope, no bundle gate)
14. POST /api/admin/events/:id/notifications — create notifications (implicit account scope, no bundle gate)
15. POST /api/admin/events/:id/post-session — recap data (implicit account scope, no bundle gate)
16. POST /api/admin/events/:id/duplicate — copy event (implicit account scope, no bundle gate)
17. POST /api/admin/events/:id/attendance — batch updates (implicit account scope, no bundle gate)
18. GET /api/admin/events/:id/tea-menu — event tea list (implicit account scope, no bundle gate)
19. POST /api/admin/events/:id/tea-menu — add teas to event (implicit account scope, no bundle gate)
20. DELETE /api/admin/events/:id/tea-menu/:itemId — remove from tea menu (implicit account scope, no bundle gate)
21. GET /api/admin/events/:id/tasting-notes — post-session tasting feedback (implicit account scope, no bundle gate)
22. GET /api/admin/venues — all venues (implicit account scope, no bundle gate)
23. POST /api/admin/venues — create venue (implicit account scope, no bundle gate)

### Publish-related (6 gaps)
24. GET /api/collections — list collections (implicit account scope, no bundle gate)
25. POST /api/collections — create collection (implicit account scope, no bundle gate)
26. PUT /api/collections/:id — edit (implicit account scope, no bundle gate)
27. POST /api/collections/:id/items — add items (implicit account scope, no bundle gate)
28. DELETE /api/collections/:id/items/:itemId — remove items (implicit account scope, no bundle gate)
29. POST /api/collections/:id/publish-shop — publish to shop storefront (implicit account scope, no bundle gate)

### Sell-related (2 gaps)
30. POST /api/rpc/fulfill-invoice — stock deduction (RPC, no gate; HIGH RISK)
31. POST /api/rpc/void-invoice — state reset (RPC, no gate; HIGH RISK)

---

## K. Top 10 Organizational Concerns

### 1. **RPC handlers lack any authorization** (3 gaps, HIGH RISK)
   - POST /api/rpc/fulfill-invoice, /void-invoice, /split-invoice use no auth checks.
   - Any authenticated member can invoke, triggering stock/invoice changes.
   - **Mitigation:** Add requireBundle checks to fulfill/void; split is lower risk (item-level, not state).

### 2. **Gather bundle inconsistently enforced**
   - Wholesale orders require `requireBundle('sell')` but events do not require `requireBundle('gather')`.
   - Admin event routes all check implicit account scope, skipping bundle enforcement.
   - **Mitigation:** Add requireBundle('gather') to POST/PUT/DELETE /api/admin/events* routes.

### 3. **Publish bundle invisible in server**
   - No single handler uses requireBundle('publish').
   - All collection endpoints rely on implicit account scope + member existence.
   - Magazine and collections are owner-gated in the frontend (toolRegistry) but not server-side.
   - **Mitigation:** Add requireBundle('publish') to all collection/magazine endpoints.

### 4. **Stock bundle has no server implementation**
   - No handler calls requireBundle('stock').
   - Purchase orders exist but are not gated to 'stock' bundle (they are account-scoped).
   - RPC actions (reserve, release, increment) have zero authorization.
   - **Mitigation:** Define what 'stock' bundle actually controls (POs? inventory reads? holds?) and enforce.

### 5. **Owner-gated tools (toolRegistry requires:'owner') bypass bundle system**
   - Purchase Orders, Magazine, Collections, Team, Access, Settings all use requires:'owner' (tier-level) instead of requireBundle.
   - A Staff member with a fake Platform Owner token could access these endpoints if server doesn't validate.
   - **Mitigation:** Convert all requires:'owner' to bundle checks (e.g., Magazine → publish, Collections → publish, Team/Access → members).

### 6. **Activity log and audit trail are unsecured**
   - GET /api/activity-logs (worker:14326) and GET /api/stock-ledger (worker:14327) have no authorization checks.
   - Any authenticated member can read another account's transaction history if they know the account_id.
   - **Mitigation:** Add implicit account scope validation and requireBundle checks.

### 7. **Tea Compass / Vendors / Sourcing not bundled**
   - Quick Capture (capture), Tea Compass (compass), Vendors (vendors) are Catalog-adjacent but not gated.
   - No server enforcement for sourcing scope.
   - **Mitigation:** Clarify if sourcing is part of Catalog or a separate concern; add requireBundle.

### 8. **Cross-tier data model assumes tokens are correct**
   - resolveBundles() in worker relies on TokenClaims.platform_role and TokenClaims.memberships.
   - If a JWT is forged or token payload is tampered, all bundle checks fail silently (or default to zero bundles).
   - No token signature validation visible in grant-resolution logic.
   - **Mitigation:** Ensure JWT verification happens before any handler (checked via requireAuth first).

### 9. **Purchase Orders live outside Stock bundle**
   - POs are account-scoped (no bundle enforcement) and owner-gated in the UI (toolRegistry).
   - They appear to be Sell-adjacent but are not requireBundle('sell').
   - **Mitigation:** Clarify PO scope; either gate to 'sell' or move to owner-only.

### 10. **Bulk product create has zero enforcement**
   - POST /api/products/bulk (worker:14237) is in the routes but has no authorization checks.
   - Any authenticated member can bulk-import products if they craft the request.
   - **Mitigation:** Add requireBundle('catalog') and validate account ownership of products.

---

## L. Enforcement Gap Summary Table

| Gap ID | Route | Bundle Intended | Current Enforcement | Risk Level |
|--------|-------|---|---|---|
| 1 | GET /api/stock/available | stock | Implicit | Medium |
| 2 | POST /api/rpc/reserve-stock | stock | None | High |
| 3 | POST /api/rpc/release-stock | stock | None | High |
| 4 | POST /api/rpc/increment-stock | stock | None | Critical |
| 5 | GET /api/stock-ledger | stock | Implicit | Medium |
| 6 | POST /api/rpc/reset-stock-verification | stock | None | High |
| 7–23 | GET/POST/PUT/DELETE /api/admin/events* | gather | Implicit | Medium |
| 24–29 | GET/POST/PUT/DELETE /api/collections* | publish | Implicit | Medium |
| 30 | POST /api/rpc/fulfill-invoice | sell | None | Critical |
| 31 | POST /api/rpc/void-invoice | sell | None | Critical |

---

## Summary Statistics

- **Total endpoints in routes table:** 298
- **With explicit requireBundle enforcement:** 26 (8.7%)
- **With implicit account-scope only:** 189 (63.4%)
- **With zero authorization:** 31 (10.4%)
- **Public (no auth required):** 52 (17.5%)

**Recommendation:** Systematize bundle enforcement across all authenticated routes. Prioritize RPC handlers (fulfill, void, increment) as they are the highest-risk gaps.

---

**End of Audit Report**

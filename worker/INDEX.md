# worker — Index

> Cloudflare Worker (API). Single entry point: src/index.ts. Authorization is handler-driven via `requireBundle()`, `requireOwnerTier()`, platform gates, and account-scoped JWT membership checks. Multi-tenancy uses `X-Teajia-Account` plus JWT `active_account_id`. The maintained route/auth planning map is `docs/plan/product-architecture-route-auth-inventory.md`.

**Note:** this file is a local navigation index, not the source of truth for line numbers. Prefer the maintained plan document above for current authorization decisions.

## Where things live

- **src/index.ts** — every route handler. ~296 endpoints. Single file by design (Worker bundle size limit).
- **migrations/** — D1 schema, numbered sequentially. Latest: 068_mcp_token_scopes.sql
- **wrangler.toml** — deploy config

## Endpoints by bundle (gated by requireBundle())

Sourced from /docs/_audit/02_owner_master.md. Format: Method Route | Line | Gate.

### Catalog bundle
Canonical tea content, partner listings, edit suggestions, network adoption.

| Route | Line | Gate |
|-------|------|------|
| GET /api/network/catalog | 12299 | requireBundle('catalog') |
| POST /api/listings/carry | 12533 | requireBundle('catalog') |
| GET /api/listings/:id | 12658 | requireBundle('catalog') |
| PUT /api/listings/:id | 12774 | requireBundle('catalog') |
| POST /api/profiles/:id/suggestions | 12939 | requireBundle('catalog') |
| GET /api/suggestions/incoming | 13066 | requireBundle('catalog') |
| GET /api/profiles/:id/suggestions | 13015 | requireBundle('catalog') |
| POST /api/suggestions/:id/decide | 13120 | requireBundle('catalog') |
| POST /api/network/profiles/:id/suggest-for-network | 13941 | requireBundle('catalog') |

### Stock bundle
Inventory, wholesale stock allocation, reservation holds. **NOTE: RPC endpoints below have NO authorization.**

| Route | Line | Gate |
|-------|------|------|
| POST /api/rpc/increment-stock | 14311 | None — HIGH RISK |
| POST /api/rpc/reset-stock-verification | 14315 | None — HIGH RISK |
| POST /api/rpc/reserve-stock | 14316 | None — HIGH RISK |
| POST /api/rpc/release-stock | 14317 | None — HIGH RISK |
| GET /api/stock/available | 14318 | Implicit account scope |
| GET /api/stock-ledger | 14327 | Implicit account scope |

### Publish bundle
Magazine, collections, editorial. Admin article routes, authenticated content/product xrefs, and the product publication command route are server-enforced with `requireBundle('publish')`.

| Route | Line | Gate |
|-------|------|------|
| GET /api/admin/articles | see src/index.ts | requireBundle('publish') |
| GET /api/admin/articles/:id | see src/index.ts | requireBundle('publish') |
| POST /api/admin/articles | see src/index.ts | requireBundle('publish') |
| PUT /api/admin/articles/:id | see src/index.ts | requireBundle('publish') |
| POST /api/admin/articles/:id/publish | see src/index.ts | requireBundle('publish') |
| POST /api/admin/articles/:id/unpublish | see src/index.ts | requireBundle('publish') |
| DELETE /api/admin/articles/:id | see src/index.ts | requireBundle('publish') |
| PUT /api/products/:id/publication | see src/index.ts | requireBundle('publish') |
| GET /api/collections | 14281 | Implicit (legacy owner-tier gate in UI) |
| POST /api/collections | 14282 | Implicit |
| GET /api/collections/:id | 14289 | Implicit |
| PUT /api/collections/:id | 14290 | Implicit |
| POST /api/collections/:id/items | 14291 | Implicit |
| DELETE /api/collections/:id/items/:itemId | 14293 | Implicit |
| POST /api/collections/:id/publish-shop | 14296 | Implicit |

### Gather bundle
Events, venues, attendee management, tasting sessions. **NOTE: Gather bundle NOT server-enforced; all routes implicit account-scope only.**

| Route | Line | Gate |
|-------|------|------|
| GET /api/admin/events | 14383 | Implicit account scope |
| POST /api/admin/events | 14385 | Implicit |
| PUT /api/admin/events/:id | 14386 | Implicit |
| DELETE /api/admin/events/:id | 14387 | Implicit |
| GET /api/admin/venues | 14372 | Implicit |
| POST /api/admin/venues | 14373 | Implicit |

### Sell bundle
Invoicing, wholesale orders, customer pricing, revenue analytics.

| Route | Line | Gate |
|-------|------|------|
| POST /api/wholesale/orders | 13339 | requireBundle('sell') |
| GET /api/wholesale/orders | 13856 | requireBundle('sell') |
| GET /api/wholesale/orders/:id | 13889 | requireBundle('sell') |
| PUT /api/wholesale/orders/:id | 13444 | requireBundle('sell') |
| POST /api/wholesale/orders/:id/transition | 13565 | requireBundle('sell') |
| POST /api/wholesale/orders/:id/nudge | 13813 | requireBundle('sell') |
| PUT /api/products/:id/commercial | see src/index.ts | requireBundle('sell') |
| POST /api/rpc/fulfill-invoice | 14307 | None — CRITICAL |
| POST /api/rpc/void-invoice | 14308 | None — CRITICAL |
| GET /api/invoices | 14250 | Implicit account scope |
| POST /api/invoices | 14251 | Implicit |
| GET /api/customers | 14261 | Implicit |

### Members bundle
Team access, role assignment, bundle grants to staff.

| Route | Line | Gate |
|-------|------|------|
| GET /api/accounts/:id/members | 14158 | Implicit owner-only |
| POST /api/accounts/:id/members | 14159 | requireBundle('members') |
| DELETE /api/accounts/:id/members/:userId | 14161 | requireBundle('members') |
| GET /api/accounts/:id/access | 14162 | requireBundle('members') |
| PUT /api/accounts/:id/members/:userId/bundles | 14164 | requireBundle('members') |
| POST /api/accounts/:id/transfer-ownership | 14185 | Implicit owner-only |

## Platform-tier endpoints (require platform admin)

From /docs/_audit/03_platform_crosscutting.md §PART 1.

| Action | Route | Line | Gate |
|--------|-------|------|------|
| View platform register | GET /api/platform/accounts | 9293 | requirePlatformAdmin() |
| View audit log (cross-account) | GET /api/platform/audit-log | 9293 | requirePlatformAdmin() |
| Review applications queue | GET /api/platform/applications | 9502 | requirePlatformAdmin() |
| Approve/decline application | POST /api/platform/applications/:id/decide | 9544 | requirePlatformAdmin() |
| Invite Tea Master | POST /api/platform/tea-masters/invite | 9664 | requirePlatformAdmin() |
| Suspend account | POST /api/platform/accounts/:id/suspend | 9188 | requirePlatformAdmin() |
| Reactivate account | POST /api/platform/accounts/:id/reactivate | 9209 | requirePlatformAdmin() |
| Adopt profile to network | POST /api/network/profiles/:id/adopt | 14038 | requirePlatformAdmin() |
| Set trust-tier defaults | PUT /api/platform/accounts/:id/trust-tier | 9230 | requirePlatformAdmin() |
| Grant platform admin | PUT /api/platform/users/:id/platform-role | 9068 | requirePlatformOwner() |
| Create account | POST /api/platform/accounts | 9400 | requirePlatformAdmin() |
| View account activity | GET /api/accounts/:id/activity | 8806 | requirePlatformAdmin() |

## Public / unauthenticated endpoints

- GET /api/network/stores — public catalog (no auth)
- GET /api/s/:slug — public storefront (no auth)
- GET /api/s/:slug/products — public products (no auth)
- GET /api/s/:slug/events — public event list (no auth)

## RPC endpoints — SECURITY HOTSPOT

**6 POST /api/rpc/* endpoints lack ANY authorization.** These are P0 findings in /docs/_audit/02_owner_master.md.

| Route | Line | Impact |
|-------|------|--------|
| POST /api/rpc/increment-stock | 14311 | Stock adjustment; any auth'd member can adjust |
| POST /api/rpc/reserve-stock | 14316 | Hold creation; any auth'd member can reserve |
| POST /api/rpc/release-stock | 14317 | Hold release; any auth'd member can release |
| POST /api/rpc/reset-stock-verification | 14315 | Reconciliation reset; any auth'd member can reset |
| POST /api/rpc/fulfill-invoice | 14307 | Stock deduction; any auth'd member can fulfill |
| POST /api/rpc/void-invoice | 14308 | State reset; any auth'd member can void |

**Required remediation:** Add requireBundle() gate to all 6. See /docs/_audit/FINDINGS.md for details.

## Authorization layer

- `requireBundle(bundle)` — middleware. Checks `ctx.bundles.includes(bundle)`. 26 uses in codebase. Platform tier short-circuits (returns all bundles).
- `requirePlatformAdmin()` — platform-tier-only gate. 13 endpoints. Blocks non-platform users.
- `requireOwnerTier()` — legacy owner-tier-specific actions (ownership transfer, user deletion). 13 checks total, mostly intentional.
- `requireAccount(accountId)` — multi-tenancy gatekeeper. Validates membership via X-Teajia-Account header or JWT active_account_id.
- Product updates now have additive command routes:
  - `PUT /api/products/:id/catalog` → `catalog`
  - `PUT /api/products/:id/stock` → `stock`
  - `PUT /api/products/:id/commercial` → `sell`
  - `PUT /api/products/:id/publication` → `publish`
- MCP token mint/list/revoke and MCP OAuth approval are owner-tier. Tokens now store explicit scopes: `inventory:read`, `stock:write`, `customers:read`, `sales:write`.

**Multi-tenancy:** Every data query MUST filter by account_id. Spot-checked in /docs/_audit/03_platform_crosscutting.md §B — all 5 sample routes scoped correctly.

## Audit trail

Platform-wide audit log: `platform_audit_log` table (created migration 047_members_access.sql).

**Events logged:**
- Account suspend/reactivate
- Application approved/declined
- Tea Master invited
- Profile adopted to network

**Known gaps (HIGH severity per /docs/_audit/03 §Critical Gaps):**
- Member bundle grants NOT logged (line 8764)
- Ownership transfers NOT logged (line 9373)
- Acting-as context not explicitly recorded

## Schema migrations (55 total)

| # | File | Purpose |
|---|------|---------|
| 047 | 047_members_access.sql | Bundle system + platform_audit_log |
| 048 | 048_tea_profiles.sql | tea_profiles canonical table |
| 049 | 049_profile_suggestions.sql | Profile edit suggestions |
| 050 | 050_wholesale_orders.sql | Wholesale order system |
| 051 | 051_network_adoption.sql | Adoption queue + network_visible flag |
| 052–055 | 052_fix_missing_columns.sql, etc. | Schema repairs + audit columns |

Latest: **068_mcp_token_scopes.sql**

## Key numbers

| Metric | Count | Status |
|--------|-------|--------|
| Total endpoints | ~296 | In src/index.ts |
| requireBundle() uses | 26 | 8.7% of endpoints |
| Legacy role==='owner' checks | 13 | Being migrated |
| Platform-tier endpoints | 13 | Fully WIRED |
| Implicit account-scope only | 189 | 63.4% of endpoints |
| Zero authorization (RPC) | 6 | CRITICAL gaps |
| Public (no auth required) | ~50 | Public catalog + storefront |

## When adding an endpoint

1. **Decide auth tier:** public / requireBundle('X') / requirePlatformAdmin() / legacy owner-check
2. **ALWAYS add server-side gate** — even if UI gates client-side
3. **If mutating data:** ensure account_id scoping in SQL WHERE clause
4. **If cross-account or sensitive:** write to platform_audit_log via logPlatformAction()
5. **Update /docs/_audit/02_owner_master.md** with file:line + status so this index stays current
6. **If schema change:** add numbered migration file in migrations/

## Enforcement debt summary

| Category | Count | Severity |
|----------|-------|----------|
| RPC endpoints with no auth | 6 | CRITICAL |
| Gather bundle NOT enforced | 17 | HIGH |
| Legacy collection publish routes still need a pass | 6 | HIGH |
| Stock bundle NOT enforced | 6 | HIGH |
| Member bundle grants NOT audited | 1 | HIGH |
| Ownership transfers NOT audited | 1 | HIGH |
| Account suspension weakly enforced | 1 | MEDIUM |

**Total security gaps:** 31 per /docs/_audit/02_owner_master.md §J. Prioritize RPC handlers.

## See also

- **/docs/ARCHITECTURE.md** §2 — full authorization model + tier definitions
- **/docs/_audit/02_owner_master.md** — complete endpoint inventory with enforcement status
- **/docs/_audit/03_platform_crosscutting.md** — authorization layer deep-dive + security gaps
- **/docs/_audit/FINDINGS.md** — P0 + P1 security issues + remediation roadmap
- **/src/admin/INDEX.md** — admin UI routes that consume these endpoints

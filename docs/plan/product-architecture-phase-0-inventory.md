# Product Architecture Phase 0 Inventory

*Working inventory for the Product Architecture Initiative.*

Last updated: 2026-05-09

---

## Purpose

This document turns Phase 0 from the implementation plan into a concrete inventory. It records the current domain objects, route/auth surface, client state risks, article contract split, and the first safety fixes applied.

Use this before implementation sessions so we can start from the current map instead of re-sweeping the entire repository.

## Domain Object Inventory

| Object | Meaning | Current source of truth | Scope | Notes |
|---|---|---|---|---|
| Tea profile | Canonical tea identity: name, origin, varietal, harvest year, description, photos | `tea_profiles` migration and network handlers | Network / curator-owned | Should hold what the tea is, not what one person experienced |
| Product listing | Per-account expression of a canonical profile: price, stock, store note, local photos | `product_listings` migration and network handlers | Account-owned | The right model for partner autonomy |
| Legacy product | Current inventory/product record used by large parts of admin and shop | `products` table, `Product` types, product API | Account-owned | Still the dominant operational model; needs careful transition to profiles/listings |
| Tasting session | Shared or structured tasting event around one or more teas | Session routes and co-tasting migrations | User/account/session | Must not become live phone-at-table behavior by default |
| Personal journal entry | Private memory of what someone tasted and what stayed with them | `customer_tasting_journal`, Zustand `tastingJournal` | User/account | Should remain notebook-like, not performative |
| Compass entry | Field sourcing/capture record for tea or teaware encountered in the world | `tea_compass_entries`, `teaCompassStore` | User/account/local-first | Professional capture instrument, not customer-facing journal |
| Article | Editorial object with blocks, author/contributor, category, references, status | `articles` table, public/admin article types | Account/editorial | Contract currently split between public and admin types |
| Contributor profile | Person whose expertise or authorship appears in editorial context | Contributor routes and components | Public/editorial | Recognition layer for serious tea people |
| Event | Gathering hosted before/during/after a tea session | Events tables/routes/components | Account/public | App prepares and remembers; it should not occupy the table |
| Order inquiry | Relationship-based public buying request | Inquiries/cart flow | Public/account | Correctly not a commodity checkout |
| Wholesale order | Trust-gated partner sourcing flow | Wholesale order migrations/routes/views | Buyer/supplier accounts | Should read as professional relationship, not marketplace cart |
| Account | Store, practitioner, platform, or partner container | Accounts/memberships/bundles | Tenant boundary | Core security and network boundary |
| Membership | User relationship to an account | JWT claims + account membership tables | User/account | Drives active account and scoped access |
| Bundle | Capability group such as stock, sell, gather, publish, catalog, members | `requireBundle`, tool registry | Account/user | Should become route-inventory visible |
| Trust tier | Relationship signal controlling wholesale/network access | Account fields and platform controls | Account/platform | Given by Adrian/platform, not earned through UI mechanics |

## Route/Auth Inventory

The maintained route/auth companion is now `product-architecture-route-auth-inventory.md`. Keep the high-level summary here and put detailed route decisions there.

The Worker route table lives in `worker/src/index.ts`. Current auth is handler-driven: route requirements are embedded inside handlers rather than declared in the route table.

| Route group | Examples | Intended access | Current posture | Follow-up |
|---|---|---|---|---|
| Public auth | `/api/auth/login`, `/api/auth/signup`, reset/password routes | Public | Public by design | Keep public |
| Authenticated account | `/api/accounts/me`, `/api/accounts/switch` | Signed-in user | Auth helpers in handlers | Keep account switch paired with cache invalidation |
| Platform admin | `/api/platform/*` | Platform owner/admin | Platform checks in handlers | Add route inventory tests |
| Public network | `/api/network/stores` | Public | Public by design | Keep public-safe fields only |
| Network catalog/listings | `/api/network/catalog`, `/api/listings/*`, `/api/profiles/*/suggestions` | Catalog/sell bundles by action | `requireBundle` appears in network handlers | Inventory each handler's bundle |
| Wholesale | `/api/wholesale/orders*` | Sell bundle, buyer/supplier-aware | `requireBundle('sell')` appears in handlers | Add allowed/denied tests |
| Products/inventory | `/api/products`, stock RPCs, stock ledger | Stock/catalog/sell/publish depending field/action | Legacy update remains broad; new product command routes are bundle-gated by field domain | Migrate UI/MCP callers to command routes before retiring broad update |
| Customers/sources | `/api/customers*` | Sell/catalog/gather/publish depending relationship context | `requireAccount`; customer type filter now validated/bound | Decide customer relationship taxonomy before tightening |
| Events admin | `/api/admin/events*`, attendees, venues | Gather bundle | Many handlers use `requireBundle('gather')` | Add route inventory tests |
| Articles admin | `/api/admin/articles*` | Publish bundle | `requireBundle('publish')` | Add representative allow/deny tests |
| Public articles/contributors | `/api/articles*`, `/api/people*` | Public published content | Public by design | Keep published-only |
| Xrefs | `/api/xref/*`, `/api/public/xref/*` | Publish bundle for authenticated routes; public-safe reads for public routes | Admin routes now `requireBundle('publish')`; public routes no-auth with `PUBLIC_FIELDS` | Add representative allow/deny tests |
| Personal memory | `/api/tasting-journal`, `/api/me/*`, sessions, connections | Signed-in user | Auth/account handlers | Clarify user-vs-account ownership |

### Route/Auth Follow-Ups

- Use `product-architecture-route-auth-inventory.md` as the maintained route table until a generated route inventory exists.
- Add tests for representative bundle denial and allowance.
- Migrate legacy product UI writes to the command routes before tightening the broad compatibility endpoint.
- Decide customer relationship taxonomy before applying customer route bundles.
- Keep public reads constrained to public-safe fields.

## Client State Inventory

### React Query

Central admin hooks now include active account and user scope in their query keys:

- `useProducts` -> `['products', accountScope, userScope]`
- `useRates` -> `['rates', accountScope, userScope]`
- `useCustomers` -> `['customers', accountScope, userScope]`
- `useActivityLogs` -> `['activity_logs', accountScope, userScope, params]`
- `useStockLedger` -> `['stock_ledger', accountScope, userScope, productId, limit, offset]`

Sensitive admin query families are excluded from disk persistence:

- `customers`
- `activity_logs`
- `stock_ledger`
- account-scoped `products`

### Zustand

`teajia-storage` still uses one persisted key, but scoped reset behavior now protects the sensitive slices below when the authenticated user or active account changes.

| Slice | Current persistence | Desired classification | Notes |
|---|---|---|---|
| Admin cart | Persisted and reset on user/account change | Account-scoped | Should not move between active accounts |
| Public cart | Persisted and reset on user/account change | Store/account or guest scoped | Public shop location matters |
| Currency | Persisted | User preference with account override | Account default currently updates on switch |
| Favorites | Persisted and reset on user/account change | User or guest-local, then sync | Needs guest-to-member decision |
| Tasting journal | Persisted and reset on user/account change | User/account personal memory | Should not leak across users |
| Recently viewed | Persisted and reset on user/account change | Guest/user local | Safe if product IDs are public/account-aware |
| Compare items | Persisted and reset on user/account change | Guest/user local | Account/store context matters |
| Inventory view config | Persisted and reset on user/account change | Account/user scoped | Saved views can be account-specific |
| Draft product | Persisted and reset on user/account change | Account-scoped | Prevents wrong-account draft restore |
| Memberships / active account | Persisted | Auth-derived session state | Hydrated from JWT; persistence should be reviewed |

### Account Switching

The AccountPanel location switch now invalidates React Query caches after a successful switch. This closes the gap where AccountSwitcher invalidated broadly but AccountPanel's switcher did not.

The Zustand store now also resets account/user-scoped slices when `activeAccountId` or `activeUserId` changes. `useAuth.logout`, session-expiry handling, and JWT hydration call through the same boundary, so sensitive local state is cleared on logout, session expiry, login as a different user, or active-account switch.

## Article Contract Inventory

| Area | Current contract | Supports rich blocks? | Notes |
|---|---|---|---|
| `src/types.ts` | Canonical rich `ArticleBlock` union with cover, chapter, Q&A, stat, recipe, tasting notes, embeds, back matter | Yes | Shared by public reader, admin editor, API client, and parser |
| `src/admin/types.ts` | Re-exports shared article types | Yes | Keeps old admin imports working without a second contract |
| `ArticleEditorModal` | Intro, paragraph, section heading, quote, image, divider, plus read-only preservation for richer block kinds | Partially | Editor cannot express all reader-supported blocks yet, but it no longer drops them |
| `ArticlePage` / reader | Rich paginated 4:5 article system | Yes | Strong product direction, but large file |
| `SinglePageRenderer` | Many layout variants | Yes | Needs keeper-list curation before full editor exposure |
| `scripts/parseDirectives.ts` | Imports shared article block type | Partially | Parser still creates simple blocks, but it now targets the canonical contract |

### Article Follow-Ups

- Create a block registry with reader support, editor support, validation, and fallback behavior.
- Curate magazine keeper templates before exposing all variants in the editor.

## Safety Fixes Applied In This Slice

- Customer `type` filter in `worker/src/index.ts` is now validated and bound instead of interpolated into SQL.
- Admin article `status` filter in `worker/src/index.ts` is now validated and bound instead of interpolated into SQL.
- Central admin query keys now include active account and user scope.
- Sensitive admin query families are excluded from React Query disk persistence.
- AccountPanel account switching now invalidates React Query after a successful switch.
- Tasting editor optimistic product updates now patch all account-scoped product query caches instead of only the old unscoped `['products']` key.
- Zustand account/user-scoped slices now reset on account switch, user switch, logout, and session expiry.
- Admin article routes now require the `publish` bundle, including draft list/read, create, update, publish, unpublish, and archive/delete.
- Authenticated article/module/project product xref routes now require the `publish` bundle; public xref routes remain no-auth and public-field-only.
- Product command routes now split catalog, stock, commercial, and publication writes behind `catalog`, `stock`, `sell`, and `publish` bundle gates.
- Article block types are now canonical in `src/types.ts`; admin imports re-export the shared contract, public reader/parser imports use it directly, and the editor preserves richer unsupported blocks.
- Magazine admin rows now fetch the full article before editing so list responses without `blocks` cannot overwrite rich article content.
- MCP OAuth approval now verifies the Teajia JWT server-side and re-checks owner-tier account access before minting an OAuth code.

## Next Recommended Implementation Pull

1. Add Worker route auth tests for publish-bundle enforcement on admin articles, authenticated xrefs, product command routes, and MCP OAuth approval.
2. Migrate product UI and MCP product tools from broad product update calls to catalog/stock/commercial/publication command routes.
3. Decide whether scoped state should be upgraded from reset-on-boundary to per-account saved buckets.
4. Build the article block registry and validation layer.
5. Add tests for account switching cache isolation and SQL filter validation.

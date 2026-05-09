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

The Worker route table lives in `worker/src/index.ts`. Current auth is handler-driven: route requirements are embedded inside handlers rather than declared in the route table.

| Route group | Examples | Intended access | Current posture | Follow-up |
|---|---|---|---|---|
| Public auth | `/api/auth/login`, `/api/auth/signup`, reset/password routes | Public | Public by design | Keep public |
| Authenticated account | `/api/accounts/me`, `/api/accounts/switch` | Signed-in user | Auth helpers in handlers | Keep account switch paired with cache invalidation |
| Platform admin | `/api/platform/*` | Platform owner/admin | Platform checks in handlers | Add route inventory tests |
| Public network | `/api/network/stores` | Public | Public by design | Keep public-safe fields only |
| Network catalog/listings | `/api/network/catalog`, `/api/listings/*`, `/api/profiles/*/suggestions` | Catalog/sell bundles by action | `requireBundle` appears in network handlers | Inventory each handler's bundle |
| Wholesale | `/api/wholesale/orders*` | Sell bundle, buyer/supplier-aware | `requireBundle('sell')` appears in handlers | Add allowed/denied tests |
| Products/inventory | `/api/products`, stock RPCs, stock ledger | Stock/catalog depending action | Mixed helper usage | Map read/write bundle requirements explicitly |
| Customers/sources | `/api/customers*` | Account/staff context | `requireAccount`; customer type filter now validated/bound | Decide whether any routes require specific bundle |
| Events admin | `/api/admin/events*`, attendees, venues | Gather bundle | Many handlers use `requireBundle('gather')` | Add route inventory tests |
| Articles admin | `/api/admin/articles*` | Publish bundle for writes; read posture needs decision | Writes use publish bundle; list/get currently account-level | Decide whether draft reads require publish bundle |
| Public articles/contributors | `/api/articles*`, `/api/people*` | Public published content | Public by design | Keep published-only |
| Xrefs | `/api/xref/*`, `/api/public/xref/*` | Admin write/public read | Mixed public/admin handlers | Confirm write bundle requirements |
| Personal memory | `/api/tasting-journal`, `/api/me/*`, sessions, connections | Signed-in user | Auth/account handlers | Clarify user-vs-account ownership |

### Route/Auth Follow-Ups

- Build a generated or maintained route table with method, path, handler, public/account/bundle/platform requirement.
- Add tests for representative bundle denial and allowance.
- Decide admin article read posture: account-level versus publish-bundle.
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

`teajia-storage` still persists mixed state. This needs a deeper classification pass.

| Slice | Current persistence | Desired classification | Notes |
|---|---|---|---|
| Admin cart | Persisted | Account-scoped | Should not move between active accounts |
| Public cart | Persisted | Store/account or guest scoped | Public shop location matters |
| Currency | Persisted | User preference with account override | Account default currently updates on switch |
| Favorites | Persisted | User or guest-local, then sync | Needs guest-to-member decision |
| Tasting journal | Persisted | User/account personal memory | Should not leak across users |
| Recently viewed | Persisted | Guest/user local | Safe if product IDs are public/account-aware |
| Compare items | Persisted | Guest/user local | Account/store context matters |
| Inventory view config | Persisted | Account/user scoped | Saved views can be account-specific |
| Draft product | Persisted | Account-scoped | Could create wrong-account draft restore |
| Memberships / active account | Persisted | Auth-derived session state | Hydrated from JWT; persistence should be reviewed |

### Account Switching

The AccountPanel location switch now invalidates React Query caches after a successful switch. This closes the gap where AccountSwitcher invalidated broadly but AccountPanel's switcher did not.

## Article Contract Inventory

| Area | Current contract | Supports rich blocks? | Notes |
|---|---|---|---|
| `src/types.ts` | Rich `ArticleBlock` union with cover, chapter, Q&A, stat, recipe, tasting notes, embeds, back matter | Yes | Best current candidate for canonical type |
| `src/admin/types.ts` | Simpler six-block union | No | Admin type can lose editorial range |
| `ArticleEditorModal` | Intro, paragraph, section heading, quote, image, divider | Partially | Editor cannot express all reader-supported blocks |
| `ArticlePage` / reader | Rich paginated 4:5 article system | Yes | Strong product direction, but large file |
| `SinglePageRenderer` | Many layout variants | Yes | Needs keeper-list curation before full editor exposure |
| `scripts/parseDirectives.ts` | Imports admin article block type | Limited | Parser may reinforce simplified contract |

### Article Follow-Ups

- Make `src/types.ts` the canonical article block source or move the canonical union to a shared article contract file.
- Update admin/editor/parser imports to use the canonical type.
- Create a block registry with reader support, editor support, validation, and fallback behavior.
- Curate magazine keeper templates before exposing all variants in the editor.

## Safety Fixes Applied In This Slice

- Customer `type` filter in `worker/src/index.ts` is now validated and bound instead of interpolated into SQL.
- Admin article `status` filter in `worker/src/index.ts` is now validated and bound instead of interpolated into SQL.
- Central admin query keys now include active account and user scope.
- Sensitive admin query families are excluded from React Query disk persistence.
- AccountPanel account switching now invalidates React Query after a successful switch.
- Tasting editor optimistic product updates now patch all account-scoped product query caches instead of only the old unscoped `['products']` key.

## Next Recommended Implementation Pull

1. Add a maintained route/auth inventory, either generated from the route table or curated in documentation.
2. Classify Zustand persisted slices and decide which ones become account-scoped keys.
3. Unify article block types across public, admin, parser, and API client.
4. Decide whether admin article read endpoints should require the Publish bundle.
5. Add tests for account switching cache isolation and SQL filter validation.

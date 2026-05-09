# Product Architecture Route/Auth Inventory

*Companion inventory for the Product Architecture Initiative.*

Last updated: 2026-05-09

---

## Purpose

Teajia is not only an ecommerce app. It is a taste-preserving operating system for tea practice: editorial authority, sourcing, inventory, relationships, events, personal memory, and multi-store trust all meet in the same product.

That makes route authorization a product-design concern, not just a security concern. The question is not only "can this user call this endpoint?" It is also "does this action belong to their role in the tea network?"

This document records the current Worker route surface by access level, identifies mismatches between product intent and server enforcement, and gives the next implementation pulls a concrete checklist.

## Access Model

| Access level | Meaning | Server helper | Product meaning |
|---|---|---|---|
| Public | No login required | None | Published, public-safe surfaces only |
| Token-authenticated | Valid user token, no account boundary required | Route-specific JWT checks | Personal auth/session tasks |
| Account member | Valid user plus active account membership | `requireAccount` | The caller belongs to this store/practice |
| Bundle-gated | Account member plus capability bundle | `requireBundle` | The caller holds a named operational capability |
| Owner-tier | Account owner or platform tier acting as owner | `requireOwnerTier` | Account-level authority and financial/member decisions |
| Platform admin | Platform owner/admin | `requirePlatformAdmin` / `requirePlatformOwner` | Network governance and platform operations |

Current bundle vocabulary:

| Bundle | Intended domain |
|---|---|
| `catalog` | Canonical tea/profile work, sourcing, carry-from-network, edit suggestions |
| `stock` | Inventory quantities, stock ledger, purchase orders, stock holds |
| `publish` | Magazine, collections, public editorial/curatorial surfaces |
| `gather` | Events, venues, attendees, sessions as hosted gatherings |
| `sell` | Invoices, wholesale, customer commerce operations |
| `members` | Team, bundle grants, member access |

## Verified Route Groups

| Route group | Examples | Current server posture | Product read |
|---|---|---|---|
| Auth | `/api/auth/login`, `/api/auth/signup`, `/api/auth/refresh`, password reset, Google OAuth | Public or token-specific by handler | Correct. These are doors into identity, not account operations. |
| Account session | `/api/accounts/me`, `/api/accounts/switch`, `/api/accounts/:id/access` | Account-aware handlers | Correct core boundary. Account switching now also clears scoped client state and invalidates caches. |
| Account member management | `/api/accounts/:id/members*`, bundle updates, transfer ownership | `members` or owner-tier/platform checks in handlers | Correct direction. These routes define who may act inside the practice. |
| Platform admin | `/api/platform/*` | `requirePlatformAdmin` / `requirePlatformOwner` | Correct. These routes govern the network itself. |
| Public storefront | `/api/s/:slug`, `/api/s/:slug/products`, `/api/products/public`, `/api/collections/shop` | Public-safe handlers | Correct if public field whitelists remain strict. |
| Public editorial | `/api/articles`, `/api/articles/:slug`, `/api/people*` | Public published-only handlers | Correct. The public reads are the published magazine surface. |
| Public xrefs | `/api/public/xref/articles/:id/products`, module/project variants | Public handler scoped to Bali/platform account and `PUBLIC_FIELDS` | Correct. This supports article colophons without exposing private inventory fields. |
| Admin articles | `/api/admin/articles*` | `requireBundle('publish')` | Correct as of this pass. Drafts, publishes, unpublishes, and archive/delete belong to editorial authority. |
| Authenticated xrefs | `/api/xref/*`, `/api/products/:id/articles|modules|projects` | `requireBundle('publish')` | Correct as of this pass. Linking products into editorial/learning/project context is publishing work. |
| Collections | `/api/collections*` admin routes | `requireBundle('publish')` | Correct. Collections are curated publication objects, including person/share/shop publication. |
| Network catalog/listings | `/api/network/catalog`, `/api/listings/*`, profile suggestions | Mixed by action, generally `catalog`/`sell` | Mostly aligned. Needs a route-level test set. |
| Wholesale | `/api/wholesale/orders*` | `requireBundle('sell')` | Correct. Wholesale is commerce relationship management. |
| Events/admin venues | `/api/admin/events*`, `/api/admin/venues*` | `requireBundle('gather')` | Correct. Gathering operations are separate from publishing or selling. |
| Purchase orders | `/api/purchase-orders*` | `requireBundle('stock')` | Correct. Purchase orders are inventory procurement. |
| Stock RPCs and ledgers | reserve/release/increment/ledger routes | `stock` where stock is primary, `sell` where invoice lifecycle is primary | Mostly aligned. Field-level product update remains unresolved. |
| Customers | `/api/customers*`, customer tags, customer journey | `requireAccount` | Needs policy decision. Customers currently mix sales, vendors, event participants, and editorial recipients. |
| Products | `/api/products`, `/api/products/:id` | Mixed: list/create/update/delete are account-level; bulk create is `catalog`; stock-specific routes are `stock` | Needs product model split. Legacy product rows combine catalog, stock, and sell concerns. |
| Compass/personal notes | `/api/compass/*`, `/api/notes`, `/api/tasting-journal` | Account/user auth | Deliberate. These are personal/professional memory tools, not only catalog operations. |
| MCP tokens | `/api/admin/mcp-tokens*` | Account/admin handler surface | Needs explicit inventory in a follow-up because agent access is high leverage. |

## Corrections Applied In This Pass

### Admin Articles

The following routes now require the `publish` bundle:

| Method | Route | Why |
|---|---|---|
| `GET` | `/api/admin/articles` | Lists drafts and archived editorial material. |
| `GET` | `/api/admin/articles/:id` | Reads unpublished article bodies and block structure. |
| `POST` | `/api/admin/articles` | Creates editorial objects. |
| `PUT` | `/api/admin/articles/:id` | Changes editorial content, metadata, and status. |
| `POST` | `/api/admin/articles/:id/publish` | Publishes to the public magazine. |
| `POST` | `/api/admin/articles/:id/unpublish` | Pulls a public article back into draft. |
| `DELETE` | `/api/admin/articles/:id` | Archives editorial material. |

### Content/Product Cross-References

The authenticated xref handlers now require the `publish` bundle:

| Handler family | Routes | Why |
|---|---|---|
| Article-product links | `/api/xref/articles/:id/products*` | Article colophons are part of published editorial context. |
| Module-product links | `/api/xref/modules/:id/products*` | Learning content references are publishing decisions. |
| Project-product links | `/api/xref/projects/:id/products*` | Consult/project references are public-facing product-context decisions. |
| Reverse product linked content | `/api/products/:id/articles`, `/api/products/:id/modules`, `/api/products/:id/projects` | Reveals the editorial graph around a product. |

## Product Boundary Decisions Still Needed

### 1. Legacy Product Row

`products` currently carries at least three distinct domains:

| Domain | Examples | Likely bundle |
|---|---|---|
| Catalog identity | name, origin, year, processing, terroir, tasting profile, lore, product imagery | `catalog` |
| Inventory | stock grams, low stock threshold, stock verification, purchase state, in-transit fields | `stock` |
| Commerce | retail price, wholesale price, public/shop visibility, featured state | `sell` or `publish`, depending on action |

Because those fields share one update endpoint today, a single route-level bundle would either be too loose or too restrictive. The better refactor is a product command split:

| Proposed command route | Bundle | Scope |
|---|---|---|
| `PATCH /api/products/:id/catalog` | `catalog` | Identity, tasting, sourcing, canonical metadata |
| `PATCH /api/products/:id/stock` | `stock` | Quantities, stock thresholds, purchase/order state |
| `PATCH /api/products/:id/commercial` | `sell` | Prices and commerce terms |
| `PATCH /api/products/:id/publication` | `publish` | Shop/public/featured curation state |

Until that split exists, route hardening should be conservative and paired with UI audits so staff with legitimate stock duties do not lose operational access accidentally.

### 2. Customers

`customers` currently includes customers, vendors/suppliers, recipients, event attendees, and relationship notes. That makes it hard to map every customer route to one bundle.

Candidate split:

| Proposed surface | Bundle | Notes |
|---|---|---|
| Sales customers and invoices | `sell` | Buyer relationship, orders, RFM, revenue context |
| Vendors/suppliers | `catalog` or `stock` | Sourcing contact versus procurement contact needs a product call |
| Event participants | `gather` | Attendance, RSVP, tasting events |
| Editorial recipients | `publish` | Collection recipients, share lists |

The important design point: relationship data should stay rich, but access to it should follow why the person is being viewed.

### 3. MCP Tokens

Agent access is high leverage because it can operate inventory or admin flows outside the normal UI. The route inventory needs a specific pass that records:

| Question | Decision needed |
|---|---|
| Who can mint tokens? | Owner-tier, `members`, or domain bundle? |
| What can a token do? | Single-purpose tool scope versus broad account scope |
| How is token use audited? | Per-command audit logs, not just token creation/revocation |

## Highest-Value Next Pulls

1. Split the legacy product update surface into command routes aligned to `catalog`, `stock`, `sell`, and `publish`.
2. Add Worker tests for representative allow/deny cases: publish user can edit articles; non-publish member cannot; public article reads still work.
3. Add a generated route inventory script that extracts method/path/handler from the route table and joins it to a maintained access map.
4. Decide the customer relationship taxonomy before changing customer route authorization.
5. Inventory MCP token privileges and add audit expectations before extending agent control.

## Implementation Notes

- Keep public xref routes separate from authenticated xref routes. Public routes must continue returning `PUBLIC_FIELDS` only.
- Do not move navigation or route labels as part of auth hardening. Capability changes should be server-first, then UI affordances can be reviewed separately.
- Treat route-level auth as one layer. Account scoping in SQL remains mandatory even after bundle checks.

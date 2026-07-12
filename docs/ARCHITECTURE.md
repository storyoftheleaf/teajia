# Teajia Architecture

> Last reviewed: 2026-07-12 for documentation routing. Technical content originated 2026-04-27 and must be verified against current code before implementation. For current state see `STATE_OF_THE_SITE.md`; for active hardening see `tracks/08-platform-hardening.md`.

## 1. Tenancy & Account Model

### 1.1 Multi-Store Foundation (Phase 1A — shipped)

#### The Decision (Option C)

Teajia is a **network of independent tea houses**, not a unified catalog. Each store has its own shop URL, its own inventory, its own team, its own orders. Visitors arriving at one store never see another store's stock. A lightweight network home surfaces discovery without mixing catalogs.

This was chosen over:
- **Unified catalog with a filter** — risks showing tea a visitor can't buy, and reads as franchise-y (contradicts VISION.md's lineage principle).
- **Fully siloed with no discovery** — works, but loses the brand-as-network benefit.
- **Cross-store fulfillment** — correct eventually, but only after shipping is enabled. Phase 2.

#### Mental Model

- **Account** = a tea house / operator / location (e.g. `acc_teajia_bali`, `acc_teajia_australia`)
- **User** can belong to multiple accounts with different roles per account
- **Per-account**: stock, orders, customers, events, vendors, costs, stock ledger, tea compass entries, activity logs, teaware collection
- **Network-level**: magazine, learn hub, exchange rates, the `tea_reviews` cross-account table
- **User-scoped within account**: tea compass entries (same user has separate compass books per store)

#### How Visitors Experience It

| Arrival | URL | Sees |
|---|---|---|
| Direct share from Bali | `/store/teajia-bali` | Bali's shop only. Zero trace of Australia. |
| Direct share from Australia | `/store/teajia-australia` | Australia's shop only. |
| Google search "teajia" | `/` | Home + magazine + network directory strip |
| "Find a table" | `/find-a-table` | Grid of all public stores |
| Legacy `/shop` bookmark | `/shop` | Still works — aliased to Bali via `/api/products/public` |
| Sample QR | `/s/:sampleId` | Sample page (unchanged; that's why storefront lives at `/store/:slug`, not `/s/:slug`) |

A visitor on `/store/teajia-bali` will never see Australia stock. There is **no UI affordance** to switch stores from inside a shop. The data is row-scoped by `account_id` server-side and URL-scoped client-side.

#### Data Model

**New tables** (`worker/migrations/017_multi_account.sql`):

- **`accounts`** — id, slug, name, tagline, description, logo_url, cover_image_url, location_city, location_country, timezone, currency_default, whatsapp_number, contact_email, public_enabled, invoice_prefix, owner_user_id, status, trust_tier, is_platform_owner, ships_to_countries, created_at, updated_at
- **`account_members`** — (account_id, user_id, role, invited_by_user_id, invited_at, joined_at, status); UNIQUE(account_id, user_id); role ∈ `owner | manager | staff | viewer`
- **`tea_reviews`** — id, tea_key, product_id, product_account_id, author_user_id, author_account_id, visibility, session_date, rating, notes, tasting, brew_params

**Column added to every scoped table:** `account_id TEXT`. Tables: `products`, `invoices`, `invoice_line_items`, `customers`, `activity_logs`, `stock_ledger`, `teaware_collection`, `teaware_photos`, `tea_compass_entries`, `events`, `event_attendees`, `event_notifications`, `event_post_session`, `event_tea_menu`, `event_tasting_notes`, `guest_invites`, `interest_signups`, `saved_locations`, `tea_samples`, `tea_sample_sets`, `tea_sample_tastings`, `customer_tasting_journal`, `stock_holds`, `newsletter_subscribers`, `user_favorites`. Indexed on high-read tables.

**`products.tea_key`** — free-text normalized tea identity (e.g. `silver-needle-fuding-2024`). Both stores can tag their own Silver Needle row with the same `tea_key` to share reviews. In Phase 1B this becomes a proper `tea_profiles` FK.

**Seeded accounts**: `acc_teajia_bali` (Adrian, `is_platform_owner=1`, slug `teajia-bali`, invoice prefix `TJB`) and `acc_teajia_australia` (slug `teajia-australia`, currency `AUD`, invoice prefix `TJA`). All existing rows backfilled to Bali. Every existing user gets an `account_members` row in Bali (owner → `owner`, admin → `manager`, user → `staff`).

#### Roles (Phase 1A)

| Role | Inventory | Orders | Events | Customers | Team | Account settings |
|---|---|---|---|---|---|---|
| **owner** | full | full | full | full | full | full |
| **manager** | full | full | full | full | invite/remove staff | edit profile |
| **staff** | view + edit stock | create/fulfill | view + check-in | view + edit | — | — |
| **viewer** | view only | view only | view only | view only | — | — |

#### Auth Flow

1. `POST /api/auth/login` returns JWT with claims: `{ sub, email, name, memberships: [{account_id, role, slug, name}], active_account_id, iat, exp }`
2. Client persists token, reads `memberships` + `active_account_id` via `hydrateAccountStateFromToken()` into Zustand
3. Every authenticated request sends header **`X-Teajia-Account: <account_id>`**
4. Worker validates the user has an active membership in that account; 403 `{ error: 'Account access denied' }` on mismatch
5. Switch accounts via `POST /api/accounts/switch { account_id }` → returns new JWT
6. New signups start with empty memberships → frontend shows **"Waiting for invite"** (`NoMembershipGate`)
7. Invite flow (`POST /api/accounts/:id/members { email, role }`) creates an inactive user + long-lived reset token as the claim link

### 1.2 Network Authorization (Phase 1B — planned)

#### Mental Model

Three layers:
```
TEA PROFILE  (canonical content; originated_by + curated_by; usually Adrian-curated)
    ↓ referenced by
LISTING       (per-account: stock, price, currency, store note, listing photos, soft-deletable)
    ↓ tasted via
TASTING JOURNAL  (per-user-per-account; never crosses accounts)
```

Plus three cross-cutting flows:
- **Edit suggestions** — partners propose canonical changes; curator ratifies per-field
- **Wholesale orders** — supplier ships stock to buyer; real bilateral invoicing
- **Cross-pollination adoption** — partner flags a profile for network adoption; Adrian decides; on adoption, `curated_by` transfers to Teajia, `originated_by` stays permanent

#### Tier Model (5 tiers + Guest)

| Tier | Has location? | Scope |
|---|---|---|
| Platform Owner | Adrian | Everything, every account |
| Platform Admin | Optional | Everything except revoke Platform Owner |
| Location Owner | Yes | One account |
| Tea Master | Yes (their own home) | One account, no physical address required |
| Member | Inherits location | Subset of Location bundles |
| Guest | No | Read-only public + own orders/tastings |

#### Bundles (Six Capabilities)

Capabilities are granted via six named bundles. Bundles are the only authorization unit.

| Bundle | What it grants |
|---|---|
| **Catalog** | Browse network catalog; carry teas; edit canonical profiles (curator only); propose edit suggestions |
| **Stock** | Modify stock quantities, reserves, and ledger entries |
| **Publish** | Create and manage collections; manage tasting journal entries |
| **Gather** | Create and manage events; check-in guests; collect tasting data |
| **Sell** | Create and manage orders; place wholesale orders; set listing prices |
| **Members** | Invite team members; modify roles and bundles; remove members; transfer ownership |

#### Bundle Defaults by Tier

| Tier | Default Bundles |
|---|---|
| Platform Owner | All six + Platform meta-bundle |
| Platform Admin | All six + Platform meta-bundle |
| Location Owner | All six; Members locked-on |
| Tea Master | All six; Members locked-on |
| Member | Empty; Location/Master Owner grants per person |
| Guest | None |

#### Locked Decisions (22 decisions for Phase 1B)

| # | Decision | Rationale |
|---|---|---|
| 1 | Catalog browse shows retail + buyer's effective wholesale price; never sourcing/vendor/contacts | Transparency without leaking IP |
| 2 | Archiving a profile keeps partner listings working; partner gets a notification | Stock is real even if curator's is gone |
| 3 | Suggestions are bundles with per-field accept/reject | Coherent writing, surgical review |
| 4 | Carrying copies canonical photos to listing; partner adds her own (shown first), removes canonical individually | Real shops have their own packaging shots |
| 5 | Profiles are tea-only. Teaware/samples/events stay account-scoped. | Scope discipline |
| 6 | Partner creates own profiles for unique teas; cross-pollination adoption queue handles network promotion | Avoids ad-hoc "propose new profile" workflow |
| 7 | Wholesale pricing = percentages only. Resolution: per-partner override → per-profile margin → trust-tier default → global default. Profile-level can be overridden per-partner. | Pegging to retail means one re-price cascades; tier defaults make onboarding new partners zero-config |
| 8 | Jesse's onboarding waits until rollout ships | No throwaway data entry |
| 9 | URL structure stays `teajia.com/store/:slug` | `teajia.com/:slug` deferred (small follow-up, needs reserved-word list) |
| 10 | Profile ownership = `originated_by_account_id` (immutable lineage) + `curated_by_account_id` (transferable stewardship). Originator can resume curation at any time. | Matches VISION.md lineage principle; permanent IP attribution |
| 11 | Carry-from-network and add-own-tea are coequal entry points | Sourcing mix per partner is unknown; cross-pollination is bidirectional |
| 12 | Cross-pollination always routes through Teajia. Partner A → Teajia → Partner B, never A → B direct. | Adrian remains canonical gate; consistent editorial standards |
| 13 | Listings have soft-delete (stop carrying), independent of profile archive | Carrying is a relationship, not a permanent attachment |
| 14 | `tea_reviews.profile_id` migration is a named sub-step of Step 1 | Load-bearing for cross-store reviews |
| 15 | Tea Master = `accounts.kind`. Operationally identical to Location Owner (carry, sell, gather, hold stock, place wholesale orders). Differs only in: no physical address required, distinct trust-tier default margin, distinct storefront presentation (more practitioner, less commercial). | "Tea Master works like a Location" per Adrian. Avoids parallel code paths. |
| 16 | Tea Master defaults match Location Owner bundles (Catalog · Stock · Publish · Gather · Sell · Members on own account). Adrian can tighten per Tea Master. | Coequal capability with Location, gated by trust |
| 17 | Trust tier visible to its holder in their own settings (not just Adrian's view). E.g. "Trust tier: verified · 45% wholesale." | Honest pricing; avoids "why did my margin change" mystery |
| 18 | Member-tier authorization for new actions: carry / suggest = Catalog bundle; place wholesale order = Sell; configure margin override = Owner-only by default, Owner can grant a "Pricing" sub-permission to a Member if needed (deferred to Future Considerations) | Owner controls financial relationships; staff handle catalog mechanics |
| 19 | Tea Master economics = Scenario A (holds own stock, resells to followers, fulfills locally). Affiliate model (Scenario B) deferred to future phase. | A is supported by existing data model; B requires new fulfillment infra |
| 20 | Pricing-discipline UI: when a partner sets retail below Teajia canonical retail (after FX), admin shows a soft warning. Not blocked. | Mitigates double-listing customer confusion without removing partner autonomy |
| 21 | Two destinations, not one merged: `/admin/access` (Members & Access) and `/admin/network` (catalog, suggestions, wholesale, adoption) | Different mental models; merging into tabs would be worse |
| 22 | UI design pass front-loaded as Step 0.5, before any 1B build steps | Front-loads creative decisions; produces shared design vocabulary across all new screens |

#### Cross-Cutting Flows

##### Edit Suggestions

Partners propose canonical changes to tea profiles. Curator (Adrian or delegated owner) reviews field-by-field and accepts/rejects with per-field notes. Accepted changes update the canonical profile. Partners with store-note overrides on accepted fields receive notifications.

##### Wholesale Orders

Real cross-account transactions: supplier ships stock to buyer. On order completion:
- Stock decrements on supplier account's listing
- Stock increments on buyer account's listing
- Cost basis set automatically in buyer's currency
- Bilateral invoices generated (one per account)
- Pricing snapshot locked at order time

##### Cross-Pollination Adoption

When a Tea Master or Location discovers a tea worth network-wide distribution:
1. They flag the profile via `POST /api/network/profiles/:id/suggest-for-network`
2. Adrian (Platform Owner) reviews in adoption queue
3. If approved: transfers `curated_by_account_id` to `acc_teajia_bali`; `originated_by_account_id` stays immutable
4. Profile now appears in all partners' catalog browse

## 2. Authorization Model

### 2.1 Role × Bundle Matrix

| Member Role | Catalog | Stock | Publish | Gather | Sell | Members |
|---|---|---|---|---|---|
| Platform Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Location Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tea Master | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Staff (sample) | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Viewer (sample) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

Owners grant bundles on a per-member basis. Default grants vary by tier (see 1.2).

### 2.2 Authorization Layer Implementation

**Mechanism:** X-Teajia-Account header (optional) + active_account_id JWT claim + getActiveAccount() gatekeeper.

**requireBundle() middleware** (worker/src/index.ts lines 485–499):
```typescript
async function requireBundle(request, env, bundle: Bundle): 
  AccountCtx | { error: Response }
```

Checks `ctx.bundles.includes(bundle)`; returns 403 if missing. Platform tier short-circuits (all bundles granted).

**Usage Count:**
- **requireBundle() calls:** 26 in codebase
- **Legacy `role === 'owner'` checks:** 13 in codebase (mostly in owner-tier-only actions, not bundle-based)

**Multi-tenancy spot-checks (all scoped correctly):**
1. **GET /api/products** — Query filters by `account_id`; membership validated via requireAccount()
2. **GET /api/invoices** — Query filters by `account_id`; membership validated
3. **PUT /api/products/:id** — Verification query: `WHERE id = ? AND account_id = ?`
4. **GET /api/customers** — All queries bind `account_id` to caller's account
5. **POST /api/platform/applications/:id/decide** — Platform-tier-only endpoint; no per-account scoping needed

**X-Teajia-Account header:**
- Parsed in getActiveAccount() (line 367, 381)
- Falls back to JWT active_account_id if header missing
- CORS headers allow it: line 888 includes 'X-Teajia-Account'
- Every data-mutating endpoint filters by account_id

**Token trust model (residual risks):**
- JWT signature is HMAC-SHA256 verified on every request via `classifyToken`. Forging a token without `JWT_SECRET` is computationally infeasible.
- `platform_role`, account membership role, bundle assignments, and account suspension status are re-resolved from D1 on every request. Token claims for these fields are NOT consulted as fallbacks. Demotions, bundle revocations, and suspensions take effect on the next request, not at token expiry.
- DB read failures during auth resolution fail closed (503), not open. A D1 outage takes down auth rather than allowing requests through with stale embedded claims.
- `JWT_SECRET` rotation invalidates all live sessions immediately (no `kid` field). For partner onboarding rotate via `wrangler secret put JWT_SECRET` during low-traffic window; everyone signs back in.

### 2.3 Audit Logging

**Table:** platform_audit_log (created in migration 047_members_access.sql)

**Events logged:**
- `platform_role.changed` — When user granted/revoked Platform Admin
- `account.suspended` / `account.reactivated` — Account status changes
- `product.created`, `product.updated`, `product.deleted` — Product mutations
- `application.approved`, `application.declined` — Application decisions
- `tea_master.invited` — Tea Master invitations
- `account.transfer_ownership` — Ownership transfers (partial; see gaps below)
- `member.bundle_granted`, `member.bundle_revoked` — Bundle grants (not yet fully wired; see gaps below)

**Implementation:** logPlatformAction() helper (line 843–860) writes:
- action, actor_id, actor_email, target_type, target_id, details (JSON), account_id, created_at

**Querying:**
- `GET /api/platform/audit-log` (platform tier only) — cross-account audit with filters
- `GET /api/accounts/:id/activity` (per-account, membership-gated or platform-tier)

**High-Severity Gaps:**
- **Bundle grant audit trail missing** (worker/src/index.ts:8764) — PUT /api/accounts/:id/members/:userId/bundles does NOT call logPlatformAction
- **Ownership transfer not audited** (worker/src/index.ts:9373) — POST /api/accounts/:id/transfer-ownership does NOT call logPlatformAction
- **Account suspension enforcement weak** (worker/src/index.ts:9188) — Platform tier acting in a suspended account can still write; suspension should block all writes

## 3. Data Layer

### 3.1 Per-Account vs Network-Level Data

**Per-account** (row-scoped by `account_id`):
- stock, orders, customers, vendors, costs, stock ledger
- tea compass entries (same user has separate compass books per store)
- events, event attendees, tasting notes
- teaware collection, activity logs, invoices
- customer tasting journal, stock holds, newsletter subscribers, user favorites

**Network-level** (shared across all accounts):
- magazine, learn hub, glossary
- exchange rates
- tea_reviews (with `visibility` field: `private` | `account` | `network`)
- tea_profiles (canonical tea content with originator + curator tracking)

### 3.2 Visibility Flag Semantics

Four distinct flags with distinct intent. Do not consolidate:

| Flag | Meaning | Used For |
|---|---|---|
| `draft` | Work in progress | Products being edited; not shown on storefront |
| `is_public` | Visible to non-members | Shown in this account's storefront and public catalog |
| `is_personal` | Owner's private collection | Excluded from network catalog; kept private |
| `is_sample` | Sample item, not for sale | Marketing samples; inventory distinction |

**Computed flag: `network_visible`** = `is_public AND \!is_personal AND \!is_sample`. Used to gate network catalog visibility.

### 3.3 Tea Identity & Cross-Account Reviews

Phase 1A uses free-text `tea_key` (e.g. `silver-needle-fuding-2024`). Phase 1B promotes this to a proper `tea_profiles` table with immutable lineage:

- **`tea_profiles.id`** — unique identifier
- **`tea_profiles.originated_by_account_id`** — immutable; first account to create the profile
- **`tea_profiles.curated_by_account_id`** — transferable; who currently maintains the canonical content
- **`tea_reviews.profile_id`** — foreign key to profile (replaces `tea_key` in Phase 1B)

Seven people at Australia + Adrian's team in Bali can taste "the same tea" and contribute reviews visible across the network:

1. Adrian sets `products.tea_key = 'silver-needle-fuding-2024'` on his Bali product (Phase 1A) / `product_listings.profile_id` (Phase 1B)
2. Partner sets the same on their product
3. Adrian posts a `tea_reviews` row with `visibility='network'`
4. Partner posts theirs under their own name and account
5. Both reviews appear on both stores' product detail pages (filtered by `tea_key` / `profile_id`), each attributed to the individual reviewer and their store
6. Inventory (stock, cost, vendor) stays private — only reviews cross over

## 4. Frontend Invariants

### 4.1 InventoryView Height Chain

The inventory page (`src/admin/components/InventoryView.tsx`) scrolls via an internal `flex-1 overflow-auto` container, NOT via the document. That container only works if every ancestor passes a definite height down. The chain is:

1. `App.tsx` outer wrapper: `h-screen overflow-hidden flex flex-col lg:flex-row` (when `isAdminRoute`)
2. `App.tsx` main content area: `flex-1 min-w-0 flex flex-col`
3. `AdminApp.tsx` AdminContent root (line ~412): `flex flex-col flex-1 min-h-0 h-full`
4. `AdminApp.tsx` `<main>` (line ~415): `flex-1 relative flex flex-col min-w-0 overflow-hidden`
5. `AdminApp.tsx` routes wrapper (line ~530): `flex-1 relative min-h-0 overflow-hidden` (for inventory)
6. `PageTransition` motion.div (line ~94): `h-full`
7. `InventoryView.tsx` root (line ~2010): `h-full flex flex-col overflow-hidden`
8. Scroll container (`[data-testid="inventory-scroll"]`): `flex-1 overflow-auto`

**If you insert any wrapper into this chain** (a new provider, an `<AnimatePresence>`, a debug div, an auth gate, etc.) it MUST preserve the height contract: a flex item needs `flex-1 min-h-0` (or `h-full`), a non-flex wrapper needs `h-full`. Failing to do so silently collapses the scroll container to 0 — no error, page just stops scrolling on every device.

Guards in place:
- Dev-mode runtime check in `InventoryView` logs a `console.error` if the scroll container's `clientHeight < 100px`.
- `tests/inventory-scroll.spec.ts` runs on Desktop + Mobile Chrome and asserts the container is sized and scrollable.

### 4.2 Z-Index Conventions

- **`z-modal` (40)** — Full-screen admin overlays, panels, modals
- **`z-drawer` (backdrop)** — Backdrop behind panels (rendered later in DOM so appears on top at equal z-index)
- **Never use `z-50`** — Blocks AccountPanel from opening; AccountPanel uses `z-modal` and is rendered later in App.tsx

### 4.3 Bottom Nav Clearance

The mobile bottom nav (`flex lg:hidden`, `44px + safe-area-inset-bottom`) overlaps page content at every breakpoint below `lg`. Every layout MUST account for it.

Use the utility classes from `src/styles/card-utilities.css`:

| Class | When to use | Value |
|---|---|---|
| `pb-nav` | Scrollable page content — flush clearance | `pb-[calc(44px+env(safe-area-inset-bottom))]` |
| `pb-nav-gap` | Scrollable page content — 1rem gap above nav | `pb-[calc(44px+env(safe-area-inset-bottom)+1rem)]` |
| `pb-nav-gap-lg` | Scrollable page content — 2rem gap above nav | `pb-[calc(44px+env(safe-area-inset-bottom)+2rem)]` |
| `bottom-nav` | Fixed/absolute elements just above the nav | `bottom-[calc(44px+env(safe-area-inset-bottom))]` |
| `bottom-nav-gap` | Fixed/absolute elements 1rem above the nav | `bottom-[calc(44px+env(safe-area-inset-bottom)+1rem)]` |

On `lg`+, all of these automatically reset to 0/standard values — no extra `lg:` class needed.

## 5. Deferred / Future Architecture

### Unified Activity Stream

**Problem:** User activity is scattered across 6 unconnected stores (Favorites, Tasting journal, Recently viewed, Compass entries, Event attendance, Reading history).

**Solution:** Activity Log Table. One table, one API endpoint.
```sql
CREATE TABLE user_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,  -- 'purchase', 'tasting', 'event', 'favorite', 'compass', 'article_read'
  entity_type TEXT,              -- 'product', 'event', 'article', 'compass_entry'
  entity_id TEXT,
  metadata TEXT,                 -- JSON blob for type-specific data
  created_at TEXT DEFAULT (datetime('now'))
);
```

API: `GET /api/activity?user_id=X&type=tasting&limit=20&offset=0`. Frontend: `useActivity(filters)` hook.

### Offline-First / Service Worker

**Problem:** PWA manifest exists but no service worker. Offline sync is a localStorage queue with basic retry.

**Solution:** Workbox Service Worker + IndexedDB. Larger storage quota, structured queries, transaction support. Sync strategy:
1. All writes go to IndexedDB first (optimistic)
2. Background sync attempts to push to server
3. Conflict resolution: server wins for shared data, client wins for personal data

### GraphQL Federation

Deferred. Current REST + React Query architecture is sufficient for the network scale (5–15 Tea Masters, 1–50 Locations).

## 6. Locked Decisions Reference

See ARCHITECTURE.md §1.2 for the 22 Phase 1B decisions. Additional historical decisions:

- **Multi-currency support:** per-account currency, network exchange rates (stored in `exchange_rates` table)
- **Authentication:** JWT with active_account_id claim; 30-day TTL with 14-day refresh threshold
- **Frontend state:** Zustand for client state (src/lib/store.ts), React Query for server state
- **WhatsApp checkout:** Intentional — every order is a personal conversation, not an automated fulfillment
- **Invoice prefix:** Auto-prefixed per account (e.g., `TJB-00042` for Bali, `TJA-00001` for Australia)

---

**Source files:** 
- docs/MULTI_STORE_PLAN.md (Phase 1A)
- docs/NETWORK_ROLLOUT_PLAN.md (Phase 1B)
- docs/VISION_AUDIT_7_TECHNICAL.md (technical vision)
- docs/_audit/03_platform_crosscutting.md (authorization audit)
- CLAUDE.md (frontend invariants)

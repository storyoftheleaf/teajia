# Site Map — Routes & Actions by Tier

> Every route, organized by tier visibility. For end-to-end flows see FLOWS.md; for current priorities see CONSOLIDATED_DIRECTION.md.

**Last updated:** 2026-08-10

---

## Tier Visibility Matrix

| Route | Guest | Member | Owner | Master | Plat. Admin | Plat. Owner |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| / (home) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /shop | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /magazine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /craft (learn hub) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /advise (consult) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /events | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /find-a-table | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /about | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /people/* | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /wisdom/* | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /account/* | – | ✓ | ✓ | ✓ | ✓ | ✓ |
| /admin/* | – | bundle-gated | ✓ | ✓ | ✓ | ✓ |
| /admin/access/platform | – | – | – | – | ✓ | ✓ |
| /admin/activity | – | – | – | – | ✓ | ✓ |

---

## Public Routes (Guest + all tiers)

### / (Home)
- Hero section, magazine feed, network store strip, search
- **Status:** WIRED

### /magazine
- Article list (filter, tag, author)
- **Sub-routes:**
  - `/article/:slug` — Full-screen reader, 4:5 paginated layout (ARTICLE_UNIFICATION_PLAN)
  - Glossary, tea-inspire tabs
- **Status:** WIRED

### /craft (Learn Hub)
- Story browse, watch tracking, guided curricula (Beginner, Brewing Mastery, Community & Culture)
- Module completion tracking (future: localStorage progress)
- **Status:** WIRED (future: contextual content surfacing from knowledge graph)

### /advise (Consultation)
- Question form (Consult page)
- Path cards, consultation entry points, guides
- **Status:** WIRED

### /shop
- Tea + teaware grid, Flavor Map (coming), product filtering
- **Sub-routes:**
  - `/shop/product/:slug` opens AlcoveModal with full detail. The segment is the readable name from `products.slug`; the legacy UUID still resolves (see `worker/migrations/132_product_slugs.sql`)
  - Product detail: rich lore, tasting notes, origin, brewing parameters, taste-alike discovery
  - Teaware detail: specifications, usage guides
- **Status:** WIRED (Flavor Map coming)

### /events
- Event list, upcoming sessions, event cards
- **Sub-routes:**
  - `/event/:slug` — Event landing: description, attendee count, RSVP flow, tea menu preview
  - `/event/:slug/recap` — Post-event summary, photos, aggregated tasting notes
- **Status:** WIRED

### /find-a-table
- Network store grid, store detail, filter by region/type
- **Status:** WIRED (geo map UI coming)

### /store/:storeSlug
- Location/Tea Master public storefront
- Products by account, store profile, contact, WhatsApp order button
- **Status:** WIRED

### /about
- Adrian's story, sourcing philosophy, contact, press
- **Status:** WIRED

### /people and /people/:slug
- Published Tea Master directory and one global person profile
- A Tea Master's own tea selection comes from the active public `master` account they host; guest collaborations are shown separately
- **Sub-routes:**
  - `/people/:slug/favorites` — shareable Public favorites
  - `/people/:slug/pay` — external transfer destinations with optional account, amount, currency, and reference context
- **Status:** WIRED

### /wisdom and /wisdom/*
- Public Tea Wisdom Base for cultivars, regions, producers, marks, styles, and named teas
- Approved related teas and writing render on detail pages; explicitly hidden nodes fail closed on direct access
- **Status:** WIRED

### Marketing & Onboarding Routes

- `/for-your-space` — B2B marketing page (private events, ongoing supply, team experiences) with WhatsApp inquiry CTA
- `/spaces` — Network location showcase pulling from API with hardcoded fallback
- `/start` — "Start Here" path picker routing to /craft, /shop, /advise, /admin, /magazine

**Status:** WIRED. PREVIEW_MODE flag was removed 2026-04-27 (was permanently `false`).

---

## Member Routes (/account/*)

All require authentication (Guest cannot access).

### /account
- **Your Table** hub — AccountPanel main view
- Role-adaptive dashboard (Reader/Member/Operator/Owner views per project_account_panel_structure)
- Name, role badge, frontispiece quote, journey card
- Tabs: Journal, Events, Cart, Settings
- **Status:** WIRED

### /account/journal
- Tasting journal — list of tasting entries
- Click entry → detail view → edit personal note
- Add new tasting (start from product detail or here)
- Inventory deep links can focus the exact personal entry through `tea` and `entry` query parameters
- **Status:** WIRED (per project_tasting_model: one CustomerTasting per user × product)

### /account/profile
- Tea Master public-profile draft, readiness, portrait, Public favorites, and external payment destinations
- Draft publication remains owner/platform reviewed; Request changes carries a reviewer note
- Profile, favorites, and payment share links are directly copyable
- **Status:** WIRED

### /account/collection
- Favorites list backed by the member's saved teas
- Owned inventory lives in the API-backed Cellar surface; a routable `/account/cellar` page remains in Track 9
- **Status:** WIRED (favorites)

### /account/journey
- My Journey card expanded view
- Sessions attended, teas tasted, seals earned, milestones
- Passport stamps, event history
- **Status:** WIRED

### /account/orders
- Purchase history via WhatsApp orders
- Order status tracking by order ref
- **Status:** WIRED (order list); per-order detail page remains open in Track 6

### /account/samples
- Requested/received tasting samples
- Sample detail, request flow
- **Status:** WIRED (sample history)

### /account/settings
- Change password (old + new, validation)
- Edit profile (name, email, username)
- Upload avatar (canvas crop, localStorage persistence)
- Delete account
- **Status:** WIRED (profile edit: API handler in progress)

### /account/saved
- Saved articles (starred stories)
- Collected articles persisted to localStorage
- **Status:** WIRED

### /account/history
- Reading history — list of watched articles with timestamps
- **Status:** WIRED

---

## Admin Routes (/admin/*)

All behind JWT auth. Bundle-gated per NETWORK_ROLLOUT_PLAN Step 0.

### /admin (Dashboard)
- Overview for any admin
- Tool registry sidebar (location owner sees 43 tools, platform tier sees platform-specific tools)
- **Status:** WIRED

### Admin Tools — Bundle-Gated Access

Bundles (per NETWORK_ROLLOUT_PLAN): Catalog, Stock, Publish, Gather, Sell, Members

#### Catalog Bundle
- `/admin/inventory` — Stock view, product list (entry point for "Carry from network")
- `/admin/products` — Product edit/create (tea profiles)
- `/admin/network?tab=catalog` — Catalog browse (carry from network, step 2)
- `/admin/network?tab=suggestions` — Incoming edit suggestions (step 3)
- `/admin/compass` — Vendor/sourcing UI, tea preference profiling
- `/admin/capture` — Quick data entry for sourcing
- **Status:** Mostly WIRED (Catalog browse: STUB; Suggestions: STUB per UI brief)

#### Stock Bundle
- `/admin/inventory` (stock tab) — Quantity management
- `/admin/purchase-orders` — Purchase order creation/management
- RPC actions: reserve-stock, release-stock, increment-stock
- **Status:** PARTIAL (no bundle enforcement on some endpoints; HIGH RISK gaps on RPC)

#### Publish Bundle
- `/admin/magazine` — Article editor, layout (150+ variants)
- `/admin/collections` — Curate lists, add items, publish to shop or public
- `/admin/learn` (implied) — Learning content editor (future)
- **Status:** WIRED (owner-gated, no bundle fallback yet)

#### Gather Bundle
- `/admin/events` — Event CRUD, capacity, waitlist, RSVP approvals
- `/admin/events?tab=venues` — Venue/space management
- `/admin/events?tab=interest` — Interest signups/forms
- **Status:** WIRED (no explicit bundle gate yet; HIGH RISK gaps on event RPC)

#### Sell Bundle
- `/admin/activity` — Transaction log, activity dashboard
- `/admin/activity?qi=1` — Quick invoice creation
- `/admin/wholesale` — Wholesale order draft → submission → fulfillment (step 4; future UI per brief)
- Invoice management (create, update, delete, fulfill, void)
- **Status:** PARTIAL (bundle-gated on wholesale endpoints; HIGH RISK gaps on invoice RPC)

#### Members Bundle
- `/admin/access` — Location Owner view: roster, member invite, bundle grants
- Editor sheet: revoke/grant bundles per member (Catalog, Stock, Publish, Gather, Sell, Members)
- **Status:** WIRED (API done; UI drawer for mobile coming)

#### Owner-Only (No Bundle Shortcut)
- `/admin/settings` — Account settings, branding, profile
- `/admin/people?tab=team` — Staff roster (separate from Members/Access)
- **Status:** WIRED

---

## Platform Tier Routes

### /admin/access/platform
- Location Owner and Tea Master register (future: sub-counts: Locations, Masters, Pending)
- Roster by account kind; tap account → sub-frame with that account's roster
- Hidden Platform tab: application queue, trust tier management
- **Status:** WIRED (roster live; adoption queue surfaces in `/admin/network?tab=adoptions`)

### /admin/activity
- Cross-account audit log viewer (platform tier only)
- Filter by account_id, actor_id, action
- Diary-entry format logs
- **Status:** WIRED (some audit gaps: bundle grants, ownership transfer not logged yet)

### Account Switcher ("Acting As")
- AccountPanel context → setActiveAccountId dropdown
- X-Teajia-Account header + active_account_id JWT claim enforce scoping
- OperatingAsBanner shows: "Operating as [name] — every action is logged"
- Every cross-account write audited to platform_audit_log
- **Status:** WIRED (audit clarity: acting_as_account_id field TODO)

---

## Single-Use / Token-Based Routes

All public (no auth required).

| Route | Purpose | Status |
|---|---|---|
| `/m/:magicToken` | Event guest link (pre-auth) | WIRED |
| `/order/:ref` | Order status by reference | WIRED |
| `/reset-password` | Password reset via token | WIRED |
| `/passport/:token` | Event attendance proof | WIRED |
| `/invite/:token` | Guest invite claim | WIRED |
| `/s/:sampleId` | Sample detail | WIRED |
| `/share/:token` | Social proof / attestation card | WIRED |
| `/c/:slug` | Public collection by slug | WIRED |
| `/session/:id` | Gathering detail by ID | WIRED |
| `/t/:token` | Location/account card by token | WIRED |
| `/journey` | Public journey view (deprecated; see /account/journey) | WIRED |
| `/compass` | Tea preference quiz (member-gated) | WIRED (sync: PARTIAL) |
| `/me` | Personal dashboard (member-gated) | PARTIAL (content TBD) |

---

## Known Stubs & Orphans

| Route | Status | Notes |
|---|---|---|
| `/account/orders` | WIRED | Order list is live; per-order detail remains open in Track 6. |
| `/account/samples` | WIRED | Sample history is connected to the member API. |
| `/design/tabs` | ORPHAN | Internal design system demo page; not in navigation. |
| `/admin/network?tab=adoptions` | WIRED | Platform-tier adoption queue lives inside the Network hub (`AdoptionQueue` rendered embedded by `NetworkLanding` when `isPlatform`). Reads `GET /api/network/adoption-queue`; decisions go to `POST /api/network/profiles/:id/adopt`. |

---

## Authorization status

The April 31-gap bundle audit is closed; server-side enforcement and auth-boundary tests shipped. Current residual work is narrower: cross-account tenancy-isolation coverage and a few inconsistent route-specific bundle assignments. Track 8 and the maintained route/auth inventory are authoritative.

---

**Source files:** `src/App.tsx` (public/member routes), `src/admin/AdminApp.tsx` (admin routing), `worker/src/index.ts` (API routing), `plan/product-architecture-route-auth-inventory.md` (maintained auth inventory), and `tracks/08-platform-hardening.md` (open hardening work).

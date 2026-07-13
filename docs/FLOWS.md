# User Flows & Connective Journeys

> End-to-end journeys through the major Teajia surfaces, organized by user tier. For an exhaustive route list see SITE_MAP.md. For architectural decisions see ARCHITECTURE.md.

---

## 1. The Connective Thesis: "Tea Practice OS"

Teajia is a unified platform where a tea practitioner's entire relationship with tea lives. Three missing layers form the connective spine:

### The Personal Timeline (The Spine)
A chronological feed weaving together:
- Teas purchased
- Tasting notes logged in Tea Compass
- Events attended
- Articles read (reading history)
- Favorites saved
- Compass entries (before/during/after sessions)

Think of it like a GitHub contribution graph for tea practice. When someone opens their account, they should see the shape of their tea journey.

### The Knowledge Graph (The Brain)
Contextual intelligence surfaces the right knowledge at the right moment:
- Viewing a Sheng puerh → show relevant Learn module on puerh aging
- Logged a gongfu session → surface the brewing mastery track
- Tasting notes mention "mineral" → show other teas with similar profiles
- Content is already there; connections are the work

### The Social Layer (The Community)
Lightweight social features respecting the contemplative nature of tea:
- Shared tasting sessions (two people logging same tea simultaneously)
- Tea circles (small groups of friends sharing sessions)
- Event attendee connections
- Community tasting notes aggregated on product pages

Not a social network. A tea table with chairs for friends.

---

## 2. Guest & Member Buyer Journey

### 2.1 Shop Discovery
**Entry:** `/shop` → Browse by tea type OR use Flavor Map (coming: mood/flavor clusters)
- **Flavor Map** — "What are you in the mood for?" sensory entry (bright & floral, deep & earthy, etc.)
- **Product detail** — AlcoveModal: rich lore, tasting notes, origin, brewing parameters
- **Taste-alike discovery** — "If you like this, you'll also like..." (tasting vector similarity)
- **Guided entry (future)** — "Start Your Practice" flow: 3 questions → 3-5 recommendations with explanations

**Key affordance:** Product page as teacher, not just catalog. Brewing guide, terroir context, tasting note explainers.

### 2.2 Cart → WhatsApp Inquiry
**Entry:** AlcoveModal → "Add to Cart" → CartPanel (desktop drawer OR mobile slide-up)
- **Persistence:** Cart survives page reload via localStorage + Zustand
- **Quantity:** Adjust grams per item
- **Checkout (intentional flow)** → "Checkout" button → pre-filled WhatsApp message
  - Message includes specific products, quantities, store's whatsapp_number
  - Every order is a personal conversation (not automated checkout)
- **Order tracking** → Guest can view order status at `/order/:ref` with WhatsApp chat link

### 2.3 Content Reading
- **Magazine** → Article list with filters/tags/author → full-screen reader (4:5 paginated layout per ARTICLE_UNIFICATION_PLAN)
- **Learn Hub** → Story browse, watch tracking, guided curricula (Beginner, Brewing Mastery, Community & Culture)
- **Glossary** → Standalone page + contextual tooltips on terms throughout app (future: link from tasting notes)
- **Saved articles** → Member feature at `/account/saved`; localStorage-backed

---

## 3. Member Personal Practice

### 3.1 Tasting Journal Flow
**Model:** One `CustomerTasting` per user × product. Re-tasting deepens; fresh sessions nest with required reason.

**Entry:** 
- AlcoveModal "Taste" button → TastingSession overlay
- `/account/journal` → Browse past entries → Detail → Edit personal note

**Flow:**
1. Fill tasting sections (swipeable): Body (mouthfeel/finish), Effect (moon/energy/rating), Flavor (tag selection), Appearance (liquor color/clarity)
2. Save → written to Zustand store, synced to backend on auth
3. Edit past entry → update personal note, commit changes
4. View all tastings for a product → list with dates + ratings

**Connective intent (not yet wired):** Purchase should suggest tasting. "You bought this 3 days ago. Ready to log your first session?" Owned teas appear in Compass as first-class.

### 3.2 Favorites and Cellar
**Model:** Favorites and owned inventory are distinct. `/account/collection` is the live favorites view; the API-backed Cellar is the owned-stock surface.

**Current state:** Favorites are wired. Cellar works inside AccountPanel but still needs a routable `/account/cellar` page and quiet cross-links to Journal and Favorites; Track 9 owns that wiring.

### 3.3 Account Panel ("Your Table")
**Entry:** Bottom tab bar user icon (mobile) OR AccountPanel icon → Opens modal

**Adaptive role-based views:**
- **Reader (Guest/Member)** — Main dashboard: name, role badge, journey card
- **Member** — Frontispiece quote, sessions attended, teas, seals, milestones. Tabs: Journal, Events, Cart, Settings
- **Operator (Staff with bundles)** — OperatorView placeholder (future: public Account Panel bundle-gated features)
- **Owner/Admin** — Full admin panel access via long-press center logo

**Key flows:**
- Switch accounts (multi-membership) → Dropdown of memberships → API call to switch
- View My Journey → Sessions attended, teas, seals, milestones (via AccountJourneyPage)
- Settings → Change password, edit profile (name, email), upload avatar, delete account
- Sign out → auth.logout()

---

## 4. Owner & Tea Master Operator Journey

### 4.1 Sourcing → Inventory → Storefront
**Bundle:** Catalog

- **Tea Compass** — Vendor/sourcing UI; capture field notes ("Quick Capture")
- **Inventory view** → Stock view per product; RPC stock adjustments (increment, reserve, release)
- **Product creation** — Create own teas; attach vendor, cost, stock
- **Listing management** → Edit price, stock, store note, carry/archive status (per tea)
- **Publish to shop** → Mark public, set retail price, currency per store

**Intent (per NETWORK_ROLLOUT_PLAN):** Owner sources teas → logs via Compass → creates product listing → sets stock + price → appears on storefront at `/store/:storeSlug`

### 4.2 Publishing (Magazine, Collections)
**Bundle:** Publish

- **Magazine admin** at `/admin/magazine` — Create articles, edit layout (150+ variants), publish
- **Collections** at `/admin/collections` — Curate themed lists, add items, publish to shop or as public `/c/:slug`
- **Inbound collections** — Import from partners (future: network cross-pollination)
- **Needs attention** — Flag items requiring review

### 4.3 Events & Gatherings
**Bundle:** Gather

- **Events admin** at `/admin/events` — Create event, set date/time/capacity, RSVP approvals
- **Venues tab** at `/admin/events?tab=venues` — Venue/space management (add photos, create spaces)
- **Tea menu** → Add teas to event, set order, preview for attendees
- **Attendees** → RSVP roster, approve/deny/waitlist, batch attendance updates, notifications
- **Post-session** → Archive tasting notes, attendee feedback, photos
- **Event flow** → Public landing at `/event/:slug`, RSVP form, attendee link `/m/:magicToken`, recap at `/event/:slug/recap`

**Attendee journey (future per VISION_AUDIT_5):**
- Pre-event: Tea menu preview → education bridge (link to product pages + Learn modules)
- During: Live tasting mode (guided flow via admin, real-time prompts, quick capture for flavor notes)
- Post: Session summary email (24h), aggregated tasting data (anonymized), attendee connections

### 4.4 Selling & Fulfillment
**Bundle:** Sell

- **Activity log** at `/admin/activity` — Transaction history
- **Quick Invoice** — One-click invoice creation from order
- **Orders** → Customer orders via WhatsApp → Admin marks in system → generates invoice
- **Invoicing** → Create, update, delete invoices; invoice items; fulfill (stock deduction); void
- **Customers** → Customer/contact list; view orders by customer; RFM analytics
- **Wholesale orders (future)** — Buyer creates order draft, supplier confirms/ships, cost basis set on receipt

### 4.5 Team Management (Members & Access)
**Bundle:** Members

- **Team & Access** at `/admin/access` — Location Owner view
  - Roster grouped by member tier
  - Editor sheet per member (desktop right-side drawer, mobile full sheet)
  - Grant/revoke bundles: Catalog, Stock, Publish, Gather, Sell, Members
  - Invite member (email link)
  - Remove member

- **Platform & Access** at `/admin/access/platform` (Platform tier only)
  - All accounts dashboard
  - Locations + Tea Masters + Pending applications
  - Account roster; tap account → sub-frame with that account's roster
  - Platform tab for tier/status management

---

## 5. Network Operator Flows (Phase 1B, Steps 1-6 of NETWORK_ROLLOUT_PLAN)

### 5.1 Carry From Network (Step 2)
**Bundle:** Catalog

Partner browses Adrian's network-visible profiles and creates own listings.

- **Entry:** `/admin` → "Carry from network" button in Inventory toolbar
- **Catalog browse** → Grid of canonical profiles (name, origin, brewing preview, retail, buyer's effective wholesale %, "Carry this tea" CTA)
- **Carry action** → POST /api/listings/carry creates listing, copies canonical photos to listing_photos
- **Edit listing** → Set own stock, price, currency, store note, hide/show canonical photos

**Pricing resolution:** effectiveMargin = per-partner override ?? profile-level margin ?? trust-tier default ?? 50%

### 5.2 Edit Suggestions (Step 3)
**Bundle:** Catalog

Partner proposes canonical changes; curator ratifies per-field.

- **Entry:** Profile detail → "Suggest an edit"
- **Compose suggestion** → Rationale field + field-picker showing current vs. proposed value
- **Submit** → Creates suggestion bundle per field (accept/reject/review note per field)
- **Curator side** → `/admin/network?tab=suggestions` → Review queue, accept/reject per-field, commit accepted fields
- **Notification** → Partners with stale store_note overrides on accepted canonical fields get notified

### 5.3 Wholesale Orders (Step 4)
**Bundle:** Sell

Supplier ships stock to buyer; real bilateral invoicing.

- **Entry:** Buyer (Location/Tea Master) at `/admin` → Creates order draft
- **Draft phase** → Cart-style builder: add profile from supplier's catalog, grams, unit price snapshot
- **Submit** → Locks pricing snapshot
- **Supplier confirms** → Confirms, ships with tracking number, carrier
- **Buyer receives** → Marks received, stock increments, cost basis set in buyer's currency, invoices generated on both accounts
- **Pricing-discipline** → Soft warning (not blocked) if listing price set below canonical after FX

### 5.4 Cross-Pollination Adoption (Step 6)
**Bundle:** Catalog (flag) + Platform tier (adopt)

Partner finds a tea worth network-wide; Adrian decides adoption.

- **Entry:** Partner flags own profile via `/api/network/profiles/:id/suggest-for-network`
- **Adrian's queue** → `/admin/network?tab=adoptions` (future UI per design brief)
- **Adoption action** → Transfers `curated_by` to Teajia account; `originated_by` immutable (permanent IP attribution)
- **Network result** → Profile appears in all partners' catalog browse; originator credited; canonical curation by Adrian

---

## 6. Platform Tier Flows (Platform Owner + Platform Admin)

### 6.1 Acting As (Cross-Account Operations)
Adrian can switch into any account; cross-account writes auto-log to `/admin/activity`.

- **Account switcher** → AccountPanel context → setActiveAccountId
- **OperatingAsBanner** → Shows "Operating as [name] — every action is logged"
- **Dual scoping** → X-Teajia-Account header + active_account_id JWT claim
- **Audit trail** → platform_audit_log captures actor_id, actor_email, target_account_id

### 6.2 Application Queue
From NETWORK_ROLLOUT_PLAN Step 0 — review pending account applications.

- **Entry:** `/admin/access/platform` → "Pending applications" (future UI tab)
- **Review** → Applicant email, proposed account kind (location/master), applicant note, decision status
- **Approve/decline** → Sets trust_tier (basic/verified/partner), writes audit log, updates account_applications

### 6.3 Tea Master Invites
From NETWORK_ROLLOUT_PLAN Step 0.

- **Entry:** `/admin/access/platform` → "Team & Access" tab → Invite Tea Master
- **Flow** → POST /api/platform/tea-masters/invite with email + name + note
- **Result** → Creates account (kind = 'master') + sends email invite (if RESEND_API_KEY set)
- **Claim** → Tea Master claims invite, lands on AccountPanel with empty inventory
- **Onboarding** → Update profile, carry from network, add own teas, place first order, etc.

### 6.4 Account Suspend / Reactivate
From NETWORK_ROLLOUT_PLAN Step 0.

- **Entry:** `/admin/access/platform` → Account detail → Suspend/Reactivate
- **Suspend** → POST /api/platform/accounts/:id/suspend blocks writes from suspended account members
- **Reactivate** → POST /api/platform/accounts/:id/reactivate reverses status
- **Audit trail** → Every suspension/reactivation logged with reason

### 6.5 Trust Tier & Wholesale Margins
Adrian manages tier defaults and per-partner overrides.

- **Tier defaults** → PUT /api/platform/accounts/:id/trust-tier sets wholesale_margin_defaults per tier
- **Per-partner override** → Owner-only; sets profile-specific margin for a buyer (future: Member-level "Pricing" sub-permission)
- **Trust tier display** → Partner settings show their tier + effective margin discreetly

---

## 7. Cross-Cutting Concerns

### 7.1 Authentication & Session
- **Sign-in** → POST /api/auth/signin, JWT creation (30-day TTL)
- **Sign-up** → POST /api/auth/signup, user + account creation, email confirmation
- **JWT claims** → platform_role, memberships[], active_account_id
- **Session refresh** → GET /api/auth/refresh, conditional reissue if expiry < 14 days
- **Password reset** → POST /api/auth/reset-password, email-based (RESEND_API_KEY optional)
- **Session expiry notice** → Global SessionExpiredNotice on 401 response

### 7.2 Multi-Tenancy Enforcement
- **X-Teajia-Account header** (optional) + active_account_id JWT claim
- **getActiveAccount() gatekeeper** → validates membership via header or JWT
- **All queries scoped** → WHERE account_id = ?; every data-mutating endpoint filters by account_id
- **Platform tier bypass** → isPlatform flag in requireAccount() bypasses membership check

### 7.3 Audit Trail
**Table:** platform_audit_log (created in migration 047)

**Logged actions:**
- platform_role.changed
- account.suspended, account.reactivated, account.transfer_ownership (future: wired)
- product.created, product.updated, product.deleted
- member.bundle_granted, member.bundle_revoked (future: wired)
- application.approved, application.declined
- tea_master.invited

**Gaps:** Bundle grant audit missing (HIGH), ownership transfer not audited (HIGH), adoption decision UI unfinished (LOW)

### 7.4 Authorization Layer (requireBundle Middleware)
- **Pattern:** Checks ctx.bundles.includes(bundle); returns 403 if missing
- **Platform tier short-circuits** → All bundles granted automatically
- **Bundles:** Catalog, Stock, Publish, Gather, Sell, Members + Platform (platform tier only)
- **Legacy checks:** 13 role === 'owner' checks remain (intentional for owner-tier safeguards; should consolidate via requireOwnerTier())

### 7.5 Multi-Currency Support
- **Per-account currency** → Dropdown in AccountPanel (USD, NT, Yuan, JPY, MYR, IDR, AUD)
- **Exchange rates** → exchange_rates table (currency, rate_to_usd)
- **Per-product currencies** → price_currency, cost_currency stored; wholesale snapshots capture unit_price_currency
- **Network exchange** → Effective wholesale computed in buyer's currency

---

**Last updated:** 2026-04-27

**Source basis:** current routes and APIs, VISION.md, ARCHITECTURE.md, and the shipped network/event/editorial contracts. Historical audit provenance remains in Git.

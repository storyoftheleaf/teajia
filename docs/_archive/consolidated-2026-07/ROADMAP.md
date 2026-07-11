# Teajia — Roadmap (April 2026)

*Derived from VISION.md. Read that first.*

---

## Phase 0: Make It Work for Adrian (Now)

**Status:** Pre-launch. Adrian is the sole user. App has not been publicly launched. People in Australia are interested but not yet onboarded. Several tea friends would use Compass. Existing interviews and imagery ready for magazine once templates reach quality.

Adrian is the proof that the tools work. Every rough edge he hits, future operators will hit harder. Fix what's broken, polish what's rough, get to the point where Adrian says "I don't need anything else for my daily work."

**Key blocker identified by Adrian:** Magazine templates are not at the quality level he expects. This is the editorial face of the brand and must be fixed before launch.

### 0.1 Critical Fixes (bugs that break trust) — ✅ COMPLETE (verified 2026-04-28)

All six items shipped in earlier work. Status verified by code recon:

- [x] **Dead share button on AlcoveCard** — `handleShare` in `AlcoveCard.tsx:258` uses Web Share API with clipboard fallback, links to `/shop/product/:id`. Wired through `AlcoveCommerceFooter.tsx:287`.
- [x] **Newsletter signup → backend** — `EmailCapture.tsx:29` calls `api.newsletter.subscribe(email, 'website')` which hits the backend at `/api/newsletter/subscribe`.
- [x] **JWT expiration handling** — `SESSION_EXPIRED_EVENT` dispatched from `api.ts`; consumed by `SessionExpiredNotice.tsx`, `useAuth.ts`, and `AdminApp.tsx`.
- [x] **Product modal URL routing** — Replaced modal architecture entirely with route `/shop/product/:id` → `ProductPage.tsx`. Shareable, bookmarkable, browser-back works.
- [x] **Checkout as inquiry** — `PublicCart.tsx` uses `CheckoutStep = 'CART' | 'INQUIRY' | 'CONFIRM'`, persists as `type: 'inquiry'`, and displays "We confirm every order personally. Availability, pricing, and shipping are settled by message. This is a service, not a checkout." (line 605).
- [x] **Network error indicator** — `NETWORK_ERROR_EVENT` dispatched from `api.ts:236`; consumed by `NetworkErrorNotice.tsx`.

### 0.2 Magazine Quality

**Status:** Foundational pieces done; full template overhaul split out as a separate project track (see "Separate tracks" below).

- [x] **Fix font loading** — `index.html` already loads 3 stylesheets with `&display=swap` on all of them. Noto Serif SC is subsetted via `&text=` parameter. Ma Shan Zheng deferred to async load after page paint.
- [x] **Establish consistent type scale** — `TYPOGRAPHY_CLASSES` from `designTokens.ts` covers editorial typography. Phase C1 added the 13-stop UI text scale (`text-ui-N`).
- [→] **Audit and improve magazine templates** — Moved to a dedicated parallel track (Magazine Design project). 95+ `LayoutVariant` cases need design curation and per-template polish; not Phase 0 work because it needs Adrian's design pass and doesn't block daily workflow. See "Separate tracks → Magazine Design" below.

### 0.3 Design System Cleanup — ✅ COMPLETE (shipped 2026-04-27 → 2026-04-28)

Closed via the design-system phasing arc (Phases A → D2 + C1/C1b/D1). See `docs/DESIGN_SYSTEM_PHASING.md` for the full path.

- [x] **Eliminate hardcoded rgba()** — Phase B1 migrated actionable sites onto semantic tokens. Remaining rgba uses are legitimate Rule 2 exceptions (decorative grain, multi-stop gradients, fixed-export imagery).
- [x] **Remove banned legacy tokens** — Phase B0/B1: zero references to `tea-ink`/`tea-paper`/`tea-seal`/`tea-charcoal`/`tea-muted`/`tea-beige` in `src/`. The aliases were also removed from `tailwind.config.ts`.
- [x] **Clean up hardcoded hex colors** — Phase B1 + B2: hex-bracket check is now blocking in `lint:colors` Rule 6. Only documented brand literals (WhatsApp `#25D366`) remain by path-allowlist.

Beyond the original scope, the same arc also shipped:

- Phase A: missing scales (`lineHeight`, `letterSpacing`, `transitionDuration`, `backdropBlur`) wired into Tailwind.
- Phase C: z-index named scale + `z-[9999]` collision resolved + small shadow/transition cleanups.
- Phase C1: 2,658 `text-[Npx]` sites mechanically renamed onto a 13-stop UI text scale; lint Rule 7 blocks regressions.
- Phase D1: `tap-target` utility class + 13 small interactive sites bumped to 44×44 floor.
- Phase D2: 25 contrast violations fixed (`text-tea-text/15-20` → `text-tea-text-{sec,dim}`).

### 0.4 Adrian's Daily Workflow Polish

- [x] **Post-event → purchase bridge** — `EventRecapPage.tsx` is mounted at the public route `/event/:slug/recap` (`App.tsx:735`), uses the `event-recap-public` query, no auth gate.
- [x] **Price-per-gram display on product cards** — `AlcoveCard.tsx:155` calculates and surfaces `perGramDisplay` alongside the total price.
- [x] **Stock level indicators on shop** — `AlcoveCard.tsx` + `AlcoveCommerceFooter.tsx` show stock-level dots and colored labels (Low Stock, Limited, Sold Out). `ProductPage.tsx:149` also displays stock status.
- [x] **Brewing guide per product** — Shipped 2026-04-28 (commit 24cc64f). `getBrewingProfile(item.type)` lookup wired into `ProductPage.tsx`; renders an inset "Brewing Guide" panel with water temp, steep time, leaf ratio, vessel, infusions, and the poetic note. Section is gated on `item.category === 'tea'` so teaware silently renders nothing.

### 0.5 Events Simplification

- [x] **Create a "simple mode" for event creation** — Shipped 2026-04-28 (commit 99450d7). The Create Event form now defaults to 6 always-visible fields (Title, Date & Time, Gathering Type, Venue/Location, Capacity, Flyer) and hides everything else behind an "Add Details" disclosure (Subtitle, Description, Duration, Repeats, Timezone, Claim Window, Format, Area Hint, Mood Hints, Map Link, Guidelines). Capacity auto-sums from selected venue spaces with manual-override preserved; defaults to 12 when no venue. The edit form remains untouched — power-user features (briefing cards, session flow, tea menu, venue guide) stay one click deep on existing events.
- [x] **Gathering type indicator** — `GatheringType` defined in `types/events.ts:3` (private/semi-private/open/bespoke), surfaced on `EventLanding.tsx:368` via `GATHERING_TYPE_LABELS`.
- [x] **Guest list visibility** — End-to-end already shipped. Schema: `event_attendees.show_in_guest_list` column. Worker: public endpoint `/api/events/:slug/public` returns capped `confirmed_names` (first names of opted-in confirmed attendees, max 20, ordered by `updated_at`). Form: `RSVPFormSheet` opt-in checkbox. Self-management: `GuestManagement.tsx` toggle. Display: `EventLanding.tsx:392-409` renders names alongside the seat count. Cleanup pass on 2026-04-28 added proper types to `TeaEvent.confirmed_names`/`confirmedNames` and `RSVPFormData.show_in_guest_list`, removing 3 `as any` casts.

### 0.6 Onboard First Trusted Users

Once Adrian's workflow is solid, bring in a small group of trusted tea friends and the Australia contacts.

- [ ] **Compass access for tea friends** — Compass is already user-scoped. Ensure sign-up flow works, entries are isolated, and the experience is solid for someone who isn't Adrian.
- [ ] **Share events with real guests** — Use the events system with real attendees. Identify friction in the RSVP and guest experience flow.
- [ ] **Populate magazine with existing content** — Adrian has interviews and imagery. Once templates are at quality, load real content. This is the moment the public-facing site becomes real.
- [ ] **Collect feedback** — What works, what's confusing, what's missing. This informs Phase 1 priorities.

---

## Phase 1: Data Foundation for Multi-Account (Next)

Nothing in Phases 2-4 works without this. This is the unsexy foundation.

### 1.1 Account Model

- [ ] **Create `accounts` table** — id, name, slug, owner_user_id, description, logo_url, location_city, location_country, public_url, created_at. Adrian's current data becomes Account #1.
- [ ] **Add `account_id` FK to all entity tables** — products, invoices, invoice_line_items, customers, events, event_attendees, teaware_collection, teaware_photos, activity_logs, stock_ledger. Backfill Adrian's existing data with account_id = 1.
- [ ] **Scope all API queries by account_id** — Every read and write must filter by the authenticated user's account. This is the single most important security boundary.
- [ ] **Add account_id to JWT claims** — Token includes which account(s) the user belongs to.

### 1.2 Role Expansion

- [ ] **Expand role model** — Current: owner/admin/user. New: platform_owner (Adrian), account_owner (location operator), staff (tea worker at a location), member (authenticated guest/practitioner).
- [ ] **Account-scoped roles** — A user can be staff at Account A and member at Account B. Role is per-account, not global.
- [ ] **Staff invitation flow** — Account owner invites staff by email. Staff gets scoped access to that account's inventory, events, and customers.

### 1.3 Migration Safety

- [ ] **Write reversible migration scripts** — All schema changes must be rollback-safe. Test against production data snapshot.
- [ ] **Maintain backwards compatibility** — The existing app must continue to work during migration. Feature-flag the multi-account code paths.

---

## Phase 2: Wholesale & Sourcing Network (The Business Model)

The first external operator won't sign up for software. They'll sign up for access to tea they can't get elsewhere. The tools become necessary to manage what they bought.

### 2.1 Wholesale Catalog

- [ ] **Create wholesale product view** — Adrian's products with wholesale pricing visible to approved accounts. Separate from public shop pricing.
- [ ] **Trust-gated access levels** — New accounts see a starter catalog. Access expands as the relationship develops. Platform owner controls access tiers.
- [ ] **Wholesale order flow** — Operator browses catalog → adds to wholesale cart → submits order (WhatsApp/email inquiry model, same as public shop). Adrian fulfills. Operator receives and imports into their local inventory.

### 2.2 Sourcing-to-Shelf Pipeline

- [ ] **Wholesale receipt → local inventory import** — When an operator receives a wholesale order, one-click import creates Draft products in their inventory with cost, origin, and product data pre-filled from the wholesale catalog.
- [ ] **Shared product metadata** — Lore, terroir, tasting notes, brewing guides from the wholesale catalog carry through to the operator's local products. Updates from Adrian propagate (with operator override).

### 2.3 Compass Network Intelligence (Later)

- [ ] **Anonymized sourcing data aggregation** — Tea masters using Compass generate pricing and availability intelligence. Aggregated at platform level, never exposing individual vendor relationships.
- [ ] **Vendor network visibility** — Platform owner sees sourcing patterns across the network. Helps negotiate better terms and identify demand.

---

## Phase 3: Operator Onboarding & Public Presence

### 3.1 Onboarding Flow

- [ ] **Self-serve account creation** — Sign up → create account (name, location, description, logo) → guided setup wizard.
- [ ] **Inventory quick-start** — Choose: import CSV, browse wholesale catalog, or start empty. Operators who source through Adrian should be buying tea within their first session.
- [ ] **First event creation** — Guided prompt to create their first event. Uses the simple mode from Phase 0.5.
- [ ] **Public page goes live** — Operator's public presence is available at their URL after setup.

### 3.2 Operator Public Page

- [ ] **Simple location template** — Not a magazine homepage. Each operator needs: upcoming events, featured teas, about us, how to find us, contact. Customizable identity (name, colors, logo, story) within the Teajia scaffolding.
- [ ] **Operator shop** — Their curated selection from their own inventory. Same AlcoveCard/WhatsApp inquiry model. Scoped to their account's products.

### 3.3 Education Embedding

- [ ] **Embeddable education content** — Operators can link to or embed Learn Hub modules, brewing guides, and glossary content within their own touchpoints. QR codes on tea packages linking to the relevant article or brew guide.
- [ ] **Co-branding options** — "Powered by Teajia" or fully integrated. Operator chooses their level of brand visibility.

---

## Phase 4: Network & Community

### 4.1 Network Directory

- [ ] **Teajia network map** — Discover Teajia-connected tea spaces and sessions worldwide. Not a store locator — a lineage map. Beautiful, minimal, trust-signaling.
- [ ] **Event discovery across network** — A guest traveling from Taipei to Melbourne can find upcoming sessions at both locations.

### 4.2 Guest Portability

- [ ] **Cross-account guest identity** — One account, welcomed at any table. Tasting history, event attendance, favorites persist across locations.
- [ ] **Personal tea journey** — Teas purchased, events attended, articles read — a quiet personal archive that follows the guest across the network.

### 4.3 Contributor Workflow

- [ ] **Magazine contribution pipeline** — Community members and tea masters submit content through a structured process. Editorial approval ensures quality and prevents commercial selling. The magazine is an offering to the community, not a sales channel.
- [ ] **Contributor profiles** — Writers, photographers, tea masters credited and linked. Some are the experts that articles are written about.

### 4.4 Verification & Trust

- [ ] **Host verification badges** — Hosts earn trust markers after proving themselves (events hosted, community feedback, training completed). The platform can't control consistency — each session is the host's expression — but it can signal trustworthiness.
- [ ] **Training pathway** — Consulting/workshop completion can lead to verified status. Connects the consulting revenue stream to the platform trust system.

---

## Phase 5: Sustainability & Growth

### 5.1 Revenue Streams

- [ ] **Wholesale tea sales** — Primary. The sourcing network IS the business model.
- [ ] **Tool subscriptions** — For operators using the full platform (inventory, events, shop, CRM). Free tier for basic use, paid for full operational suite.
- [ ] **Consulting & training** — Tea house design, in-person workshops, sourcing journeys. Already exists. Scales through the network.
- [ ] **Subscription box** — If the magazine audience and customer base grow large enough. Curated monthly tea + editorial content.
- [ ] **Community monetization** — As the network grows: sponsored content (with editorial standards), premium education tracks, certification programs.

### 5.2 Foundation Preparation

- [ ] **Land preservation framework** — Define how the community gives back to tea-producing regions. Integrate into the purchasing flow (optional contribution per order, transparency reporting).
- [ ] **Announce when ready** — The foundation is the north star. It gets formalized and announced when the community, revenue, and legal structure support it.

---

## Separate tracks (not Phase 0)

These run in parallel to the main phase progression. They have their own pace and don't block Phase 1+ work.

### Magazine Design (parallel, Adrian-led)

The magazine template overhaul moved here from Phase 0.2 because it's a sustained design effort, not a single mechanical pass. 95+ `LayoutVariant` cases in `src/types.ts` rendered by `SinglePageRenderer.tsx` (2,312 lines) — quality bar varies and the work is judgment, not migration.

**Approach (3 stages, Adrian-led with agent assistance where mechanical):**

1. **Curate to a print-quality core (~20 templates).** Adrian reviews each template against MAGAZINE_PLAN.md's locked decisions (4:5 ratio, gallery frame, tap zones, share placement) and produces a keeper list. Existing articles using non-keeper templates still render — they just aren't offered in the magazine editor's template dropdown.

2. **Polish each keeper.** For each kept template, walk against the design checklist: typography uses TYPOGRAPHY_CLASSES, colors use safe tokens, spacing follows the 4:5 grid, no horizontal overflow, share/counter chrome correct, print CSS clean. Once the keeper list is locked, an agent can do this mechanically per template — Adrian reviews each visually.

3. **Wire to the editor.** Curated subset becomes the dropdown in the magazine editor. Mechanical UI work after stage 2.

Source of truth: `docs/MAGAZINE_PLAN.md` for design decisions. `docs/plan/magazine-editor-spec.md` for the editor UX. The "70-point template overhaul plan" referenced in earlier roadmap drafts doesn't exist as a single doc and was aspirational scaffolding.

**Status:** Stage 0 — awaiting Adrian's keeper list to begin Stage 1.

---

## What NOT to Build

These items appeared in previous audits and should not be prioritized. They contradict the vision or solve problems that don't exist at current scale.

| Item | Why Not |
|---|---|
| Knowledge graph / AI contextual surfacing | Hand-curation is the value at this scale. Build when humans can't keep up. |
| Tasting note similarity engine | 139 products. Adrian can curate "if you like this" in an afternoon. |
| Community tasting aggregation on product pages | Too few users for meaningful data. Adrian's descriptions ARE the reviews. |
| Adaptive learning paths | Curate 3 paths manually. Link to practitioner stage. Done. |
| Subscription / auto-replenish | Artisan sourcing, seasonal stock, personal relationships. Not a commodity subscription. |
| Streak trackers / gamification | Presence, not performance. Tea isn't Duolingo. |
| Live tasting mode (phones during events) | Directly contradicts the core principle. Phones stay in pockets. |
| Full analytics pipeline | Adrian knows what's selling because he packs every order. Revisit at 10+ locations. |
| Apple Watch integration | Peak "measuring the unmeasurable." |
| Vendor reviews / ratings | Trust-based sourcing network. Not a marketplace with reviews. |

---

## Decision Log

| Decision | Rationale |
|---|---|
| WhatsApp checkout stays | Every order is a relationship. Personal service is the brand. |
| Compass is for sourcing professionals only | Tea house operators who source through the network don't need field sourcing tools. |
| Events default to simple mode | Function first. "How many seats, which friends, what kind of gathering." Advanced features are opt-in layers. |
| Education is mostly free | Free at foundational level. Deeper training may carry fees. The content is the draw that builds the community. |
| No franchise model | Each space has its own identity. Teajia provides infrastructure and sourcing, not a brand template. |
| Magazine contributors need editorial approval | The magazine is an offering to the community. No commercial selling. Quality and consistency matter. |
| Account isolation via row-level scoping (not separate DBs) | Enables cross-network features (discovery, guest portability, sourcing intelligence) while maintaining data boundaries. |
| Foundation announced later | The driving mission. Shapes decisions now. Gets formalized when the community and structure support it. |

---

*This document is the source of truth for product decisions. When in doubt, refer to the "Who Uses Teajia" section and the Design Principles in VISION.md. Build for Adrian first, then open it up.*

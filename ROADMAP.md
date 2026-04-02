# Teajia — Roadmap (April 2026)

*Derived from VISION.md. Read that first.*

---

## Phase 0: Make It Work for Adrian (Now)

Adrian is the proof that the tools work. Every rough edge he hits, future operators will hit harder. Fix what's broken, polish what's rough, get to the point where Adrian says "I don't need anything else for my daily work."

### 0.1 Critical Fixes (bugs that break trust)

- [ ] **Fix dead share button on AlcoveCard** — Either connect to ShareModal or remove. A non-functional button destroys trust in the interface.
- [ ] **Connect newsletter signup to backend** — Currently stores email in localStorage and logs to console. Users think they subscribed. They didn't.
- [ ] **Handle JWT expiration gracefully** — Show "Session expired" notification and re-auth prompt instead of silent failure on next API call.
- [ ] **Make product modals URL-backed** — Add URL params (e.g., `/shop?product=tie-guan-yin`). Enables sharing, bookmarking, browser back-button. Without this, no one can share a link to a specific tea.
- [ ] **Frame checkout as inquiry** — Rename "Checkout" to "Send Inquiry" or "Request Order." Add visible note: "We confirm every order personally." Show this early, not after filling the form.
- [ ] **Add network/offline error indicator** — Show toast or banner when API calls fail. Currently fails silently.

### 0.2 Magazine Quality (Adrian's stated priority)

- [ ] **Audit and improve magazine templates** — The 150+ layout variants are not at the level of quality Adrian expects. This is the editorial face of the brand. Reference PLAN.md (70-point template overhaul) for the detailed spec.
- [ ] **Fix font loading** — 8 Google Fonts loaded in a single blocking request. Implement `font-display: swap`, subset Chinese fonts with `unicode-range`, remove unused fonts.
- [ ] **Establish consistent type scale** — Per PLAN.md: Display, Headline, Subhead, Body, Caption, Micro sizes with proper leading and tracking.

### 0.3 Design System Cleanup

- [ ] **Eliminate hardcoded rgba()** — 328 instances violating COLOR_RULES.md. These don't adapt to theme changes. Migrate to semantic tokens.
- [ ] **Remove banned legacy tokens** — 49 files still using tea-ink, tea-paper, tea-seal, tea-charcoal. Replace with approved tokens per COLOR_RULES.md.
- [ ] **Clean up hardcoded hex colors** — 65 instances of bracket-notation hex colors that should use semantic tokens.

### 0.4 Adrian's Daily Workflow Polish

- [ ] **Post-event → purchase bridge** — After a session, guests should get a recap page: teas served, their notes (if submitted), purchase links, one prompt ("what stayed with you?"). The PostSessionArchive component exists — enhance it to be guest-facing, not just admin archival.
- [ ] **Price-per-gram display on product cards** — Specialty tea buyers compare value. Show $/g alongside total price.
- [ ] **Stock level indicators on shop** — "In Stock," "Low Stock," "Limited" badges. Adrian already tracks thresholds in admin.
- [ ] **Brewing guide per product** — Lookup table by tea type + form. ~20 profiles cover the catalog. Water temp, steep time, leaf ratio, vessel, infusion count.

### 0.5 Events Simplification

- [ ] **Create a "simple mode" for event creation** — Default: title, date, seat count, gathering type (tea session / meditation / shopping / casual), share link. That's it. The full approval workflow, briefing cards, tea menu, etc. remain available as optional layers.
- [ ] **Gathering type indicator** — Guests need to know if it's a silent meditation or a tea shopping event. Simple tag/label on the event page.

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

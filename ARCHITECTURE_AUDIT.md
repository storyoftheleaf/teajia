# Architecture Audit — Teajia

**Date:** 2026-04-04
**Scope:** Full-stack audit of public site, admin app, data layer, API, and UX flows

---

## Executive Summary

Teajia has five beautifully crafted pillars — Magazine, Learn, Shop, Consult, Events — each working well internally. The core issue is that **they operate as silos**. A customer reading about a Wuyi oolong in Magazine has no idea it's available in Shop, taught in Learn, or was served at a recent event. The data exists; the connections don't.

This audit maps every gap, with prioritized recommendations for building the connective tissue that transforms Teajia from a content portal into an **integrated tea experience**.

---

## Design Philosophy: Service, Not Salesmanship

**This is the governing principle for all cross-linking work.**

Teajia is not a shop with a blog attached. It's a place for communication, community, interconnection, and real offering. Cross-links between sections exist out of **responsibility**, not commerce:

- If we write about a specific tea, people will want to know where to find it. We owe them that answer.
- If we teach about a tea type, showing where to explore it is part of the education — not a sales funnel.
- If a consult project features certain vessels, naming them is editorial integrity.
- The link is always **"if this moved you, here's where to find it"** — never **"buy this now."**

**Implementation rules:**

1. **Contextual, not promotional.** Links appear where they serve the reader's curiosity, not where they maximize conversion. A "Source this tea" note at the end of an article — not a product card interrupting the reading flow.
2. **Quiet presence.** Product references are subtle — a line of text, a small notation, a "Find in Shop" link in the article footer. Never hero banners, carousels, or "You might also like" grids inside editorial content.
3. **Bidirectional but asymmetric.** Shop products can link richly to articles/lessons (that's expected in a product page). But articles/lessons link to products with restraint — a footnote, not a feature.
4. **Absence is fine.** Not every article needs a product link. Not every lesson needs a "shop the essentials" section. If the connection isn't natural, don't force it.
5. **The reader decides.** Cross-links are discoverable, not pushed. No modals, no interstitials, no "before you go" prompts.

---

## Part 1: Public Site — Section Silos

### Current State

| Section | Data Source | Links To Other Sections |
|---------|-----------|------------------------|
| **Home** | Static + scroll animation | Navigation buttons only — no live content previews |
| **Magazine** | Stories (code/localStorage) | None — articles exist in a vacuum |
| **Learn** | Curriculum, Glossary, Collections (code constants) | "Book a Consult" CTA in Tea Spaces — nothing else |
| **Shop** | InventoryContext (API → D1) | None — products have no editorial context |
| **Consult** | Projects, Services (code constants) | None — projects don't reference products or lessons |
| **About** | Static text | Pillar descriptions but no live content |

### Gap 1: Magazine ↔ Shop (Articles don't acknowledge products)

**Problem:** An article about Wuyi rock oolong doesn't tell the reader that Teajia carries Da Hong Pao from that region.

**Philosophy-aligned fix:**
- Stories already have an optional `teaId` field — extend to `productReferences: string[]`
- In the Reader component, add a quiet **footer section** after the article: *"Teas mentioned in this piece"* with minimal product cards (name, origin, type — no price, no "add to cart")
- Clicking takes you to the product page, where full shop context lives
- In Shop product pages, add *"Read about this tea"* as a text link to related articles — this direction can be richer since people expect product pages to have context

**What NOT to do:**
- No inline product cards breaking article flow
- No "Shop Now" CTAs inside editorial content
- No algorithmic "related products" — only explicit, human-curated references

### Gap 2: Learn ↔ Shop (Education without access)

**Problem:** Module 05 "Vessel Selection & Design" teaches about gaiwans but doesn't tell you Teajia carries them.

**Philosophy-aligned fix:**
- Add `relatedProducts: string[]` to `LearnModule` type
- At the **end** of a completed module (not during), show: *"Explore these in the collection"* — a simple list of linked products
- In Shop, product pages can link to Learn modules: *"Learn about oolong processing"* — this is expected and helpful on product pages
- Glossary terms that describe specific tea types can note *"We carry [N] teas of this type"* with a quiet link to a filtered Shop view

**What NOT to do:**
- No "Shop the Essentials" sections interrupting lessons
- No product recommendations mid-curriculum
- No purchase suggestions based on course progress

### Gap 3: Learn ↔ Consult (Natural progression without pressure)

**Problem:** Tea Spaces gallery in Learn has a "Book a Consult" CTA but no connection to actual Consult portfolio projects.

**Philosophy-aligned fix:**
- Tea Spaces images that correspond to Consult projects should link to the project detail — editorial connection, not sales
- At the end of "Space Design" modules, a single line: *"See spaces Adrian has designed →"* linking to Consult portfolio

### Gap 4: Consult ↔ Shop (Projects without provenance)

**Problem:** Portfolio projects show beautiful spaces but don't name the vessels, teas, or tools used.

**Philosophy-aligned fix:**
- Add `featuredProducts: string[]` to `ConsultProject` type
- In project detail view, list items used: *"Vessels and teas featured in this space"* — editorial provenance
- This feels like a design magazine crediting furniture makers — natural, expected, generous

### Gap 5: Home (Decorative, not alive)

**Problem:** HomePage is a beautiful entry but shows no actual content from any section.

**Fix:**
- Replace static section buttons with **living previews**: latest article headline, a featured product name, next event date
- These are teasers, not ads — one line each, text-only, linking to the section
- The home page should feel like opening a letter, not a storefront

### Gap 6: Events ↔ Magazine (No post-event storytelling)

**Problem:** Events happen, tastings occur, but no content flows back to Magazine.

**Fix:**
- Event post-session data (`gallery_images`, `host_notes`, `energy`) should feed into Magazine photo essays
- A natural editorial cycle: event → photo essay → readers discover event series → attend next one

### Gap 7: Global Search (Siloed results)

**Problem:** `GlobalSearch` / `CommandPalette` returns results but doesn't show connections across sections.

**Fix:**
- Group search results by section: Products, Articles, Glossary Terms, Events
- When showing a product result, note if there's a related article (*"Featured in: [Article Title]"*)
- When showing an article, note related products — same quiet cross-referencing

---

## Part 2: Admin App — Workflow Disconnects

### Current State: 9 Modules, Loosely Connected

```
INVENTORY ──(vendor text field, not linked)──→ CUSTOMERS
    │                                              │
    │ (sourceCompassEntryId exists                  │ (getOrders exists
    │  but not navigable)                           │  but no drill-down)
    ↓                                              ↓
COMPASS                                        ORDERS
    │                                              │
    │ (no UI for PO creation)                      │ (no payment status)
    ↓                                              ↓
PURCHASE ORDERS ← API exists, NO UI          STOCK LEDGER ← view-only
    
EVENTS ──(attendee.customerId optional)──→ CUSTOMERS
    │
    │ (event tasting ≠ product tasting)
    ↓
TASTING NOTES ← two separate systems

DASHBOARD ← charts without drill-down
```

### Admin Gap 1: Vendor Linking is Broken (HIGH PRIORITY)

**Current:** `Product.vendor` is a text field. `Product.vendorId` exists in schema but inconsistently populated. `customers.linkProduct()` / `unlinkProduct()` API exists but SourcesView doesn't auto-link.

**Fix:**
- Always resolve `Product.vendor` text → Customer lookup via `resolveVendorId()`
- Show bidirectional links: Product detail → vendor customer; Vendor detail → supplied products
- SourcesView should auto-match vendors by name

**Files:** `worker/src/index.ts` (resolveVendorId), `src/admin/SourcesView.tsx`, `src/admin/AddProductModal.tsx`

### Admin Gap 2: Sourcing → Inventory Pipeline Break (HIGH PRIORITY)

**Current:** `Product.sourceCompassEntryId` links to Compass entry but isn't navigable. Can't click through.

**Fix:**
- InventoryView product detail: clickable "Source" badge → navigates to Compass entry
- Compass entry: "Created Product" link when `draft_product_id` exists
- Full pipeline visibility: Compass → Product → Events → Sales

**Files:** `src/admin/InventoryView.tsx`, `src/admin/TeaCompass` (embedded view)

### Admin Gap 3: Customer → Orders Not Drillable (HIGH PRIORITY)

**Current:** CustomersView shows order count but can't click to see order details. OrdersView has no customer context filter.

**Fix:**
- Customer detail panel: clickable order rows → navigate to OrdersView filtered by customer
- OrdersView: customer filter dropdown, customer name clickable → CustomersView detail

**Files:** `src/admin/CustomersView.tsx`, `src/admin/OrdersView.tsx`

### Admin Gap 4: Product → Events Invisible

**Current:** `products.getEvents(productId)` API exists but is never called in UI.

**Fix:**
- Product detail panel: "Events" section showing which events featured this product
- EventDetail tea menu: product cards clickable → product detail in InventoryView

**Files:** `src/admin/InventoryView.tsx`, `src/admin/EventDetail.tsx`

### Admin Gap 5: Event Attendee → Customer Gap

**Current:** `EventAttendee.customerId` is optional. No way to convert an event attendee into a customer record.

**Fix:**
- AttendeeTable: "Create Customer" button for attendees without `customerId`
- Auto-populate customer from attendee data (name, phone, email)
- Customer journey view: show all events attended

**Files:** `src/admin/AttendeeTable.tsx`, `src/admin/CustomersView.tsx`

### Admin Gap 6: Two Separate Tasting Note Systems

**Current:** `TastingNotesView` edits product tasting data. `event_tasting_notes` captures attendee feedback. They never meet.

**Fix:**
- Product detail: show aggregate event tasting data (*"Served at 3 events, avg rating 4.2"*)
- Event post-session: link tasting notes to product record as supplementary data

**Files:** `src/admin/TastingNotesView.tsx`, `src/admin/EventDetail.tsx`

### Admin Gap 7: Purchase Orders — API Without UI

**Current:** `purchaseOrders.create`, `.list`, `.updateStatus` endpoints exist. Zero UI.

**Fix:**
- Create `PurchaseOrderView` component
- Link to sourcing workflow: Compass entry → create PO → receive → update inventory

**Files:** New `src/admin/PurchaseOrderView.tsx`, `src/admin/Sidebar.tsx`

### Admin Gap 8: Dashboard Charts Without Drill-Down

**Current:** DashboardView shows cost/retail analysis, currency exposure, region value. Charts aren't clickable.

**Fix:**
- Chart segments clickable → filter InventoryView by that dimension
- Add customer metrics: order count distribution, spending tiers, event attendance

**Files:** `src/admin/DashboardView.tsx`

### Admin Gap 9: Cross-Module Search Missing

**Current:** CommandPalette searches products only. Each module has its own separate search.

**Fix:**
- Unified admin search across products, customers, events, orders
- Recent searches, type-ahead with entity type badges

**Files:** `src/admin/CommandPalette.tsx`

---

## Part 3: Data Layer — Structural Gaps

### 3.1 No Database Table for Articles/Magazine Content

**Current:** All stories/articles live in code constants and localStorage. No D1 persistence.

**Impact:** Can't create article ↔ product relationships in the database. Can't track reads/engagement. Can't build a CMS.

**Fix:** Create `articles` table in D1. Add `article_products` junction table for cross-references. Build admin article management.

### 3.2 Tasting Journal is localStorage-Only

**Current:** `CustomerTasting` entries in Zustand store, persisted to localStorage. Never synced to server.

**Impact:** Data loss on browser clear. Can't aggregate across users. Can't show community tasting data.

**Fix:** Create `customer_tasting_journal` table. Sync from localStorage on login. Server-authoritative with offline fallback.

### 3.3 Invoice Payment Status Missing

**Current:** Invoices track fulfillment (Draft → Pending → Filled → Void) but no concept of paid/unpaid.

**Fix:** Add `payment_status` (unpaid/partial/paid), `payment_date`, `payment_method` to invoices table.

### 3.4 Event Attendee Status Enum Mismatch

**Current:** DB CHECK allows `confirmed/waitlist/cancelled`. App V2 code uses `requested/approved/denied`. SQLite silently allows mismatch.

**Fix:** Migrate CHECK constraint to match V2 status flow: `requested → approved/denied/waitlist → confirmed/cancelled`.

### 3.5 Missing Cross-Reference Tables

**Needed:**
- `article_products` (article_id, product_id) — for Magazine ↔ Shop links
- `module_products` (module_id, product_id) — for Learn ↔ Shop links
- `project_products` (project_id, product_id) — for Consult ↔ Shop links

These enable the quiet, responsible cross-linking described in the philosophy section.

### 3.6 No Stock Holds for Pending Orders

**Current:** Stock only changes on fulfillment/void. Pending invoices don't reserve inventory.

**Fix:** Add `stock_holds` table (invoice_id, product_id, reserved_grams, created_at).

---

## Part 4: UX Flow — Friction Points

### 4.1 Cart Not Accessible from Non-Shop Sections

**Current:** CartPanel only available when in Shop context.

**Fix:** Floating cart indicator accessible from any section (bottom-right, subtle, shows count). Reader/Learn/Consult users who previously added items should always be able to reach their cart.

### 4.2 ProductPage Isolation

**Current:** `/shop/product/:id` is a full-page view with no breadcrumb back to shop grid.

**Fix:** Add "← Back to Shop" breadcrumb. Essential for users arriving from external links or cross-references.

### 4.3 Consult Inquiry Has No Confirmation Tracking

**Current:** Shop checkout generates order ref (TJ-YYYYMMDD-XXX) with status page. Consult inquiry has no equivalent.

**Fix:** Generate inquiry ref, show confirmation with tracking link.

### 4.4 Account Sub-Views Lack Explicit Navigation

**Current:** Tasting Journal, Tea Compass, My Collection rely on ESC to return.

**Fix:** Add explicit "← Back" buttons in each sub-view header.

---

## Implementation Priority

### Phase 1: Admin Connective Tissue (Immediate Value)
1. Vendor bidirectional linking
2. Customer → Orders drill-down
3. Sourcing → Inventory navigation
4. Product → Events visibility
5. Event attendee → Customer conversion

### Phase 2: Public Cross-Linking (Service-Oriented)
6. Article footer product references (quiet, editorial)
7. Product page article/lesson links
8. Learn module end-of-module product exploration
9. Home living previews
10. Global cart accessibility

### Phase 3: Data Layer Foundation
11. Articles table + admin CMS
12. Cross-reference junction tables
13. Tasting journal server persistence
14. Invoice payment status
15. Stock holds

### Phase 4: Analytics & Polish
16. Dashboard drill-down
17. Unified admin search
18. Purchase order UI
19. Event tasting aggregation on products
20. Customer journey dashboard

---

## Files Reference

| Area | Key Files |
|------|-----------|
| Public routing | `src/App.tsx` |
| Admin routing | `src/admin/AdminApp.tsx` |
| Types (shared) | `src/types.ts` |
| Types (admin) | `src/admin/types.ts` |
| API client | `src/lib/api.ts` |
| Zustand store | `src/lib/store.ts` |
| Worker API | `worker/src/index.ts` |
| Shop | `src/components/Shop.tsx`, `src/components/TeaInventory.tsx` |
| Magazine | `src/components/MagazineTabbed.tsx`, `src/components/Reader.tsx` |
| Learn | `src/components/LearnHub.tsx`, `src/components/LearnOverview.tsx` |
| Consult | `src/components/ConsultPage.tsx` |
| Home | `src/components/HomePage.tsx` |
| Inventory (admin) | `src/admin/InventoryView.tsx` |
| Orders (admin) | `src/admin/OrdersView.tsx` |
| Customers (admin) | `src/admin/CustomersView.tsx` |
| Sources (admin) | `src/admin/SourcesView.tsx` |
| Events (admin) | `src/admin/EventsManager.tsx`, `src/admin/EventDetail.tsx` |
| Dashboard (admin) | `src/admin/DashboardView.tsx` |
| Compass (admin) | `src/admin/TeaCompass/` |
| Card styles | `src/styles/card-utilities.css` |
| Design tokens | `src/designTokens.ts` |
| Tailwind config | `tailwind.config.ts` |

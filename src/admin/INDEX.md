# src/admin — Index

> Admin views for Owner / Tea Master / Platform tiers. Routing in AdminApp.tsx (~25 routes). Each route gates on tier or bundle. For tier model see `/docs/ARCHITECTURE.md` §1.2. For full action inventory with status/file:line see `/docs/_audit/02_owner_master.md`.

## Where things live

- **AdminApp.tsx** — main route table, layout shell, tier gates, OperatingAsBanner for platform ops
- **components/** — shared admin building blocks (forms, panels, modals, drawers)
- **views/** — top-level admin pages (one file per route, mostly)
- **types.ts** — admin-specific types (separate from src/types.ts which is global)

## Routes by bundle

| Route | View component | Bundle required | Status | Notes |
|-------|----------------|-----------------|--------|-------|
| /admin | DashboardView | — | WIRED | Home admin screen; no gate |
| /admin/activity | ActivityView | Sell | WIRED | Transaction log; activity ledger |
| /admin/inventory | InventoryView | Stock | STUB | Stock view; no owner gate applied |
| /admin/compass | TeaCompass | Catalog | WIRED | Tea sourcing UI; vendor/sourcing |
| /admin/capture | QuickCapture | Catalog | STUB | Data entry for vendors; catalog intent |
| /admin/events | EventsManager | Gather | WIRED | Event manager; also hosts venues/interest tabs |
| /admin/events?tab=venues | VenueManager | Gather | WIRED | Venue and space manager |
| /admin/people | PeopleView | Sell | WIRED | Customer/contact list and profiles |
| /admin/catalog | CatalogBrowse | Catalog | WIRED | Network catalog browser (Step 1) |
| /admin/catalog/edit/:id | PartnerListingEdit | Catalog | WIRED | Partner listing editor |
| /admin/suggestions | SuggestionsInbox | Catalog | WIRED | Incoming profile suggestions (Step 3) |
| /admin/wholesale | WholesaleOrdersList | Sell | WIRED | Buyer/supplier order list (Step 4) |
| /admin/wholesale/draft | WholesaleOrderDraft | Sell | WIRED | Draft order editor |
| /admin/wholesale/:id | WholesaleOrderTimeline | Sell | WIRED | Order timeline + state machine |
| /admin/network | NetworkLanding | Catalog | WIRED | Network adoption landing (Steps 1–4) |
| /admin/purchase-orders | PurchaseOrdersPage | Owner-tier | WIRED | PO list; owner-only gate (toolRegistry:26) |

## Owner-only (tier-gated, not bundle)

| Route | View component | Tier | Status | Notes |
|-------|----------------|------|--------|-------|
| /admin/magazine | MagazineView | Owner | WIRED | Editorial UI; owner-gated (toolRegistry:36) |
| /admin/collections | CollectionsView | Owner | WIRED | Collection list; owner-gated (toolRegistry:37) |
| /admin/collections/:id/edit | CollectionEditView | Owner | WIRED | Collection editor |
| /admin/collections/:id/inbound | InboundCollectionView | Owner | WIRED | Inbound (published-to-me) items |
| /admin/people?tab=team | TeamView | Owner | WIRED | Staff roster; owner-only (toolRegistry:39) |
| /admin/access | AccessView | Owner | WIRED | Member bundles assignment (toolRegistry:40) |
| /admin/contact-tags | ContactTagsView | Owner | WIRED | Custom customer tags |
| /admin/settings | AccountSettingsView | Owner | WIRED | Account profile/config (toolRegistry:41) |

## Platform Admin only

| Route | View component | Tier | Status | Notes |
|------|----------------|------|--------|-------|
| /admin/access/platform | PlatformAccessView | Platform | WIRED | Platform tier assignment; canonical members-and-access destination per NETWORK_ROLLOUT_PLAN Step 0 |
| /admin/activity?platform=1 | ActivityView (mode) | Platform | WIRED | Platform activity log (all accounts) |
| /admin/platform | PlatformAdminView | Platform | WIRED | Platform owner dashboard |
| /admin/adoptions | AdoptionQueue | Platform | WIRED | Network catalog adoption queue (Step 5) |
| /admin/audit-log | PlatformAuditLogPage | Platform | WIRED | Platform audit trail |

## Cross-cutting components

**Most-used shared admin UI building blocks:**

| Component | Location | Purpose |
|-----------|----------|---------|
| ProductEditPanel | components/ | Product (tea/teaware) editor modal; save → api.products.update |
| ProductStoryView | views/ | Product detail, sourcing, story editor |
| QuickInvoiceModal | components/ | One-click invoice creation popup |
| QuickCapture | components/ | Data entry form for sourcing/tasting |
| EventForm | components/ | Event creation/edit form (shared with EventDetail) |
| AttendeeTable | components/ | Attendee roster with approval workflow |
| PostSessionEditor | components/ | Tasting notes and recap data form |
| TeaMenuEditor | components/ | Event tea menu builder |
| TastingEditorModal | components/ | Tasting feedback collection |
| VenueManager | components/ | Venue and event space CRUD |
| CustomerProfilePage | components/ | Customer detail, order history, tags |
| InvoicePdf | components/ | Invoice PDF renderer (uses PurchaseOrderPdf) |
| PurchaseOrderPdf | components/ | PO PDF renderer |
| EditOrderModal | components/ | Order editor (invoice/PO line items) |
| SplitOrderModal | components/ | Order split tool |
| CsvImportModal | components/ | Bulk product/customer CSV upload |
| StockLedgerPanel | components/ | Stock transaction history viewer |
| CommandPalette | components/ | Quick-command launcher (39+ actions) |
| ErrorBoundary | components/ | Fallback UI on render crash |
| TeaTable | components/ | Product list table with sort/filter |
| TeaIllustration | components/ | Visual product card renderer |

## Key invariants

- **AdminApp.tsx tier gate at lines ~143–149** — ProtectedRoute wrapper checks tier/bundle per-route. See `/CLAUDE.md` "InventoryView height chain" before adding wrappers.
- **toolRegistry.ts (51 tools)** — `/src/components/AccountPanel/toolRegistry.ts` drives what shows in Operator launchpad. All tools require `isOwner=true` EXCEPT: activity, quick-invoice, people, inventory, compass, capture, vendors, events, venues, interest-signups (6 non-owner tools).
- **/admin/access is canonical members-and-access destination** — per `/docs/NETWORK_ROLLOUT_PLAN.md` Step 0. PlatformAccessView is platform-tier-only variant.
- **/admin/access/platform gates to platform tier only** — no fallback for Owner/Master tiers.

## Common pitfalls

1. **Tier-gated routes show tools whose handlers are bundle-gated** → Tea Masters see network tools they can't use. See `_audit/02` organizational concern #1.
2. **Many admin actions check bundles client-side but not server-side** → 31 enforcement gaps total. Examples: GET /api/admin/events, PUT /api/collections/:id (implicit account scope, no requireBundle).
3. **ProductEditPanel save → api.products.update has no requireBundle('stock') check** — any member can edit product metadata regardless of bundle.
4. **Stock RPC handlers lack any authorization** — POST /api/rpc/increment-stock, /fulfill-invoice, /void-invoice have zero checks (HIGH RISK).
5. **Owner-gated tools (toolRegistry requires:'owner') bypass bundle system** — Magazine, Collections, Team, Access, Settings use tier-level gate instead of requireBundle.

## When adding a new admin view

1. **Add route to AdminApp.tsx** — import view component at top, add Route in the main Routes block
2. **Decide: bundle-gated or owner-only?** — check _audit/02 section B–G for bundle definitions
3. **Add server-side requireBundle() to the worker handler** — do NOT rely on client gate alone. High-risk endpoints (stock, invoice, event) must enforce.
4. **Add row to docs/SITE_MAP.md "Admin Routes" section** — keep tier visibility matrix in sync
5. **If it's a tool in the Operator launchpad, register in toolRegistry.ts** — add entry to tools array with {id, label, group, requires, icon}
6. **Test tier gates** — use test tokens: Location Owner, Tea Master, Staff, Platform Admin, Platform Owner
7. **Update this INDEX.md** — add route + component + bundle + status to the appropriate section

## See also

- `/docs/ARCHITECTURE.md` §1–2 — authorization model, tier definitions, account tenancy
- `/docs/_audit/02_owner_master.md` — full admin action inventory (127 entries); status, file:line, enforcement gaps
- `/docs/SITE_MAP.md` — all routes by tier visibility (public, member, owner, platform)
- `/worker/INDEX.md` — API routes by bundle; enforcement status
- `/CLAUDE.md` — system-level invariants, high-level flows

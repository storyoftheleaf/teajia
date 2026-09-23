# Site Map: Routes & Actions by Tier

> Every route, organized by tier visibility. For end-to-end flows see FLOWS.md; for current priorities see CONSOLIDATED_DIRECTION.md.

**Last updated:** 2026-09-23 (route tables regenerated from `src/App.tsx` and `src/admin/AdminApp.tsx`)

---

## The Manage column

The Manage rooms come from one list, `src/components/manageNav.ts`, read by the desktop column, the phone's site panel and the Manage door in Your Table. Each room shows only to someone the route behind it admits (`getVisibleAdminItemIds` in `src/components/navigationConnections.ts`). One word per route: `src/components/manageNav.oneWord.test.ts` fails if a route carries two words or a word leads to two routes, across this list and the phone's admin bar.

| Room | Route | Shows for | Children |
|---|---|---|---|
| Dashboard | `/admin/dashboard` | owner tier | |
| Stock | `/admin/stock` | catalog or stock | Tea Glossary, Capture, Curate, Carry from network (catalog) |
| Collections | `/admin/collections` | publish | |
| Orders | `/admin/activity` | sell | |
| People | `/admin/people` | any bundle | Tea Masters (owner tier, `/admin/contributors`) |
| Events | `/admin/events` | gather | |
| Magazine | `/admin/magazine` | publish | Tasting Notes |
| Wisdom | `/admin/wisdom` | publish | |
| Network | `/admin/network` | catalog or sell | |
| Members | `/admin/access` | members, or owner tier | |
| Settings | `/admin/settings` | owner tier | |

The phone's admin bar carries four of these words per role (`src/components/adminBarTabs.ts`): curate, stock, orders, events for someone who runs a shop; curate, orders, events, people for staff; curate, samples, capture, events otherwise.

---

## Every route

### Public and member routes (`src/App.tsx`)

| Route | Opens | Notes |
|---|---|---|
| `/admin/*` | AdminApp |  |
| `/` | Storefront |  |
| `/article/:slug` | ArticleRouteSwitch |  |
| `/read` | ReadIndex |  |
| `/read/leaf-to-liquor` | LeafToLiquor |  |
| `/read/leaf-to-liquor/:template` | LeafToLiquor |  |
| `/read/rock-remembers` | RockRemembers |  |
| `/read/earth-water-fire` | EarthWaterFire |  |
| `/read/before-the-mist` | BeforeTheMist |  |
| `/read/atlas` | AtlasMapOfMountains |  |
| `/read/craft` | CraftPotThatRemembers |  |
| `/read/porcelain-and-tea` | CraftRenewalPorcelain |  |
| `/read/essay` | EssayLongWayToCup |  |
| `/read/field-notes` | FieldNotesTwoRoomsBali |  |
| `/read/field-study` | FieldStudyWaterBeforeLeaf |  |
| `/read/history` | HistoryTenThousandMornings |  |
| `/read/legend` | LegendImmortalsCliff |  |
| `/read/ritual` | RitualSevenSteeps |  |
| `/read/tasting` | TastingVocabularyOfTaste |  |
| `/read/tea-house` | TeaHouseQuietHours |  |
| `/craft` | LearnHub |  |
| `/learn` |  | redirect to `/craft` |
| `/shop` | Shop |  |
| `/shop/product/:id` | ProductPage |  |
| `/advise` | AdvisePage |  |
| `/consult` |  | redirect to `/advise` |
| `/for-your-space` | ForYourSpacePage |  |
| `/spaces` | SpacesPage |  |
| `/start` | StartHerePage |  |
| `/discover` | DiscoverPage |  |
| `/store-launch-playbook` | StoreLaunchPlaybookPage |  |
| `/collection` | SharedCollection |  |
| `/wisdom` | WisdomFallback |  |
| `/wisdom/cultivars` | WisdomFallback |  |
| `/wisdom/cultivar/:id` | WisdomFallback |  |
| `/wisdom/regions` | WisdomFallback |  |
| `/wisdom/region/:id` | WisdomFallback |  |
| `/wisdom/producers` | WisdomFallback |  |
| `/wisdom/producer/:id` | WisdomFallback |  |
| `/wisdom/marks` | WisdomFallback |  |
| `/wisdom/mark/:id` | WisdomFallback |  |
| `/wisdom/styles` | WisdomFallback |  |
| `/wisdom/style/:id` | WisdomFallback |  |
| `/wisdom/named` | WisdomFallback |  |
| `/wisdom/named/:id` | WisdomFallback |  |
| `/about` | AboutPage |  |
| `/mcp` | McpPage |  |
| `/account` | AccountRouteBridge |  |
| `/account/journal` | JournalPage |  |
| `/account/collection` | CollectionPage |  |
| `/account/cellar` | CellarPage |  |
| `/account/collections` | SharedCollectionsPage |  |
| `/account/journey` | AccountJourneyPage |  |
| `/signin` | SignInPage |  |
| `/signup` | SignUpPage |  |
| `/account/settings` | AccountSettingsPage |  |
| `/account/profile` | AccountProfilePage |  |
| `/account/orders` | OrderHistoryPage |  |
| `/account/orders/:id` | OrderDetailPage |  |
| `/account/samples` | SampleHistoryPage |  |
| `/account/docs` | DeveloperDocsPage |  |
| `/account/briefing` | BriefingPage |  |
| `/design/tabs` | TabStyleDemo | development only |
| `/design/palette-preview` | PalettePreviewPage | development only |
| `/design/article-editor` | ArticleEditorHarness | development only |
| `/design/system` | DesignSystemShowcase | development only |
| `/events` | EventsPage |  |
| `/event/:slug` | EventLanding |  |
| `/event/:slug/recap` | EventRecapPage |  |
| `/m/:magicToken` | GuestManagement |  |
| `/order/:ref` | OrderStatusPage |  |
| `/reset-password` | ResetPasswordPage |  |
| `/journey` | JourneyPage |  |
| `/passport/:token` | PassportPage |  |
| `/invite/:token` | GuestInviteClaimPage |  |
| `/s/:sampleId` | SamplePage |  |
| `/share/:token` | ShareCardPage |  |
| `/c/:slug` | PublicCollectionPage |  |
| `/me` | CenterPage |  |
| `/session/:id` | SessionPage |  |
| `/join` | JoinPage |  |
| `/join/:code` | JoinPage |  |
| `/t/:token` | TableCardPage |  |
| `/u/:slug` | ShelfPage |  |
| `/find-a-table` | FindATable |  |
| `/community` |  | redirect to `/find-a-table` |
| `/store/:slug` | Storefront |  |
| `/people/:slug` | ContributorProfilePage |  |
| `/people/:slug/favorites` | ProfileFavoritesPage |  |
| `/people/:slug/pay` | ProfilePaymentPage |  |
| `/people` | ContributorsIndexPage |  |
| `*` |  |  |

### Manage routes (`src/admin/AdminApp.tsx`)

| Route | Opens | Gate |
|---|---|---|
| `/admin` |  | redirect to `/admin/compass` |
| `/admin/home` |  | redirect to `/admin/compass` |
| `/admin/compass` | CompassWithMode | catalog |
| `/admin/compass-playbook` | CompassWithMode | catalog |
| `/admin/compass-current` | CompassWithMode | catalog |
| `/admin/capture` | DraftsView | catalog |
| `/admin/events` | EventsManager | gather |
| `/admin/events/:id` | EventDetail | gather |
| `/admin/tasting-events` | TastingEventsList | gather |
| `/admin/tasting-events/new` | TastingEventForm | gather |
| `/admin/tasting-events/:sessionId` | TastingControlRoom | gather |
| `/admin/tasting-events/:sessionId/live` | TastingControlRoom | gather |
| `/admin/venues` | VenueManager | gather |
| `/admin/samples` |  | redirect to `/admin/compass?sampleOrder=manage` |
| `/admin/activity` | ActivityView | sell |
| `/admin/activity-logs` |  | redirect to `/admin/activity?tab=log` |
| `/admin/people` | PeopleView | any bundle |
| `/admin/people/:customerId` | CustomerProfilePage | any bundle |
| `/admin/contact-tags` | ContactTagsView | any bundle |
| `/admin/stock` | InventoryView | catalog or stock |
| `/admin/inventory` |  | redirect to `/admin/stock` |
| `/admin/intake` | IntakeWorkspace | catalog or stock |
| `/admin/dashboard` | DashboardView | owner tier |
| `/admin/vendors/:vendorId` | VendorProfileView | catalog or stock |
| `/admin/products/:id/story` | ProductStoryView | catalog |
| `/admin/purchase-orders` |  | redirect to `/admin/people?tab=purchase-orders` |
| `/admin/team` |  | redirect to `/admin/access` |
| `/admin/launch-playbook` |  | redirect to `/admin/account-settings` |
| `/admin/access` | AccessView | members |
| `/admin/access/platform` | PlatformAccessView | platform staff |
| `/admin/currency` | CurrencyRatesView | platform staff |
| `/admin/mcp-tokens` | MCPTokensView | owner tier |
| `/admin/oauth-consent` | OAuthConsentView | owner tier |
| `/admin/oauth-consent/:requestId` | OAuthConsentView | owner tier |
| `/admin/tasting-notes` | CustomerNotesView | publish |
| `/admin/wisdom` | WisdomView | publish |
| `/admin/network` | NetworkLanding | catalog, sell or platform staff |
| `/admin/network/catalog` |  | redirect to `/admin/network?tab=catalog` |
| `/admin/network/suggestions` |  | redirect to `/admin/network?tab=suggestions` |
| `/admin/network/wholesale` |  | redirect to `/admin/network?tab=wholesale` |
| `/admin/network/adoptions` |  | redirect to `/admin/network?tab=adoptions` |
| `/admin/network/listings/:listingId` | PartnerListingEdit | catalog, sell or platform staff |
| `/admin/network/wholesale/new` | WholesaleOrderDraft | sell |
| `/admin/network/wholesale/:orderId` | WholesaleOrderDraft | sell |
| `/admin/network/wholesale/:orderId/timeline` | WholesaleOrderTimeline | sell |
| `/admin/account-settings` | AccountSettingsView | owner tier |
| `/admin/platform` | PlatformAdminView | platform staff |
| `/admin/platform/audit-log` | PlatformAuditLogPage | platform staff |
| `/admin/platform/all-stock` | MovementStockView | platform staff |
| `/admin/magazine` | MagazineView | publish |
| `/admin/contributors` | ContributorsView | owner tier |
| `/admin/collections` | CollectionsView | publish |
| `/admin/collections/inbound/:pubId` | InboundCollectionView | publish |
| `/admin/collections/:id` | CollectionEditView | publish |
| `/admin/catalog` | CatalogView | catalog (a platform account goes to `/admin/stock`) |
| `/admin/teaware` |  | redirect to `/admin/stock` |
| `/admin/personal` |  | redirect to `/admin/stock` |
| `/admin/customers` |  | redirect to `/admin/people` |
| `/admin/sources` |  | redirect to `/admin/people` |
| `/admin/orders` |  | redirect to `/admin/activity?tab=orders` |
| `/admin/records` |  | redirect to `/admin/activity?tab=log` |
| `/admin/settings` |  | redirect to `/admin/account-settings` |
| `/admin/*` (anything else) |  | redirect to `/admin/home` |

---

## Public Routes (Guest + all tiers)

### / (Home)
- Hero section, magazine feed, network store strip, search
- **Status:** WIRED

### /read
- The Read index: the interactive issue, conversations, field notes and long reads, each gated until published (`src/pages/read/articleLive.ts`)
- **Sub-routes:**
  - `/read/leaf-to-liquor` (and `/read/leaf-to-liquor/:template`): From Leaf to Liquor, public at its URL but kept off the index (`tests/read-index-articles.spec.ts`)
  - `/read/<article>`: one route per immersive article
  - `/article/:slug`: the editor's articles, full-screen reader
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
  - `/event/:slug`: Event landing: description, attendee count, RSVP flow, tea menu preview
  - `/event/:slug/recap`: Post-event summary, photos, aggregated tasting notes
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
  - `/people/:slug/favorites`: shareable Public favorites
  - `/people/:slug/pay`: external transfer destinations with optional account, amount, currency, and reference context
- **Status:** WIRED

### /wisdom and /wisdom/*
- Public Tea Wisdom Base for cultivars, regions, producers, marks, styles, and named teas
- Approved related teas and writing render on detail pages; explicitly hidden nodes fail closed on direct access
- **Status:** WIRED

### Marketing & Onboarding Routes

- `/for-your-space`: B2B marketing page (private events, ongoing supply, team experiences) with WhatsApp inquiry CTA
- `/spaces`: Network location showcase pulling from API with hardcoded fallback
- `/start`: "Start Here" path picker routing to /craft, /shop, /advise, /admin, /read

**Status:** WIRED. PREVIEW_MODE flag was removed 2026-04-27 (was permanently `false`).

---

## Member Routes (/account/*)

All require authentication (Guest cannot access).

### /account
- **Your Table** hub: AccountPanel main view
- Role-adaptive dashboard (Reader/Member/Operator/Owner views per project_account_panel_structure)
- Name, role badge, frontispiece quote, journey card
- Tabs: Journal, Events, Cart, Settings
- **Status:** WIRED

### /account/journal
- Tasting journal: list of tasting entries
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

---

## Admin Routes (/admin/*)

All behind JWT auth. Bundle-gated per NETWORK_ROLLOUT_PLAN Step 0.

### /admin (Dashboard)
- Overview for any admin
- The Manage column beside the rail lists the rooms this person may open (see "The Manage column" above)
- **Status:** WIRED

### Admin Tools: Bundle-Gated Access

Bundles (per NETWORK_ROLLOUT_PLAN): Catalog, Stock, Publish, Gather, Sell, Members

#### Catalog Bundle
- `/admin/inventory`: Stock view, product list (entry point for "Carry from network")
- `/admin/products`: Product edit/create (tea profiles)
- `/admin/network?tab=catalog`: Catalog browse (carry from network, step 2)
- `/admin/network?tab=suggestions`: Incoming edit suggestions (step 3)
- `/admin/compass`: Vendor/sourcing UI, tea preference profiling
- `/admin/capture`: Quick data entry for sourcing
- **Status:** Mostly WIRED (Catalog browse: STUB; Suggestions: STUB per UI brief)

#### Stock Bundle
- `/admin/inventory` (stock tab): Quantity management
- `/admin/purchase-orders`: Purchase order creation/management
- RPC actions: reserve-stock, release-stock, increment-stock
- **Status:** PARTIAL (no bundle enforcement on some endpoints; HIGH RISK gaps on RPC)

#### Publish Bundle
- `/admin/magazine`: Article editor, layout (150+ variants)
- `/admin/collections`: Curate lists, add items, publish to shop or public
- `/admin/tasting-notes`: Tasting notes, under Magazine in the column
- **Status:** WIRED (owner-gated, no bundle fallback yet)

#### Gather Bundle
- `/admin/events`: Event CRUD, capacity, waitlist, RSVP approvals
- `/admin/events?tab=venues`: Venue/space management
- `/admin/events?tab=interest`: Interest signups/forms
- **Status:** WIRED (no explicit bundle gate yet; HIGH RISK gaps on event RPC)

#### Sell Bundle
- `/admin/activity`: Orders: invoices, transaction log, activity
- `/admin/activity?qi=1`: Quick invoice creation
- `/admin/wholesale`: Wholesale order draft → submission → fulfillment (step 4; future UI per brief)
- Invoice management (create, update, delete, fulfill, void)
- **Status:** PARTIAL (bundle-gated on wholesale endpoints; HIGH RISK gaps on invoice RPC)

#### Members Bundle
- `/admin/access`: Location Owner view: roster, member invite, bundle grants
- Editor sheet: revoke/grant bundles per member (Catalog, Stock, Publish, Gather, Sell, Members)
- **Status:** WIRED (API done; UI drawer for mobile coming)

#### Owner-Only (No Bundle Shortcut)
- `/admin/settings`: Settings (redirects to `/admin/account-settings`): branding, profile
- `/admin/people?tab=team`: Staff roster (separate from Members/Access)
- **Status:** WIRED

---

## Platform Tier Routes

### /admin/access/platform
- Location Owner and Tea Master register (future: sub-counts: Locations, Masters, Pending)
- Roster by account kind; tap account → sub-frame with that account's roster
- Hidden Platform tab: application queue, trust tier management
- **Status:** WIRED (roster live; adoption queue surfaces in `/admin/network?tab=adoptions`)

### Account Switcher ("Acting As")
- AccountPanel context → setActiveAccountId dropdown
- X-Teajia-Account header + active_account_id JWT claim enforce scoping
- OperatingAsBanner shows: "Operating as [name]: every action is logged"
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
| `/design/*` | DEV ONLY | Design harnesses (tabs, palette preview, article editor, system); registered only in development. |
| `/admin/network?tab=adoptions` | WIRED | Platform-tier adoption queue lives inside the Network hub (`AdoptionQueue` rendered embedded by `NetworkLanding` when `isPlatform`). Reads `GET /api/network/adoption-queue`; decisions go to `POST /api/network/profiles/:id/adopt`. |

---

## Authorization status

The April 31-gap bundle audit is closed; server-side enforcement and auth-boundary tests shipped. Current residual work is narrower: cross-account tenancy-isolation coverage and a few inconsistent route-specific bundle assignments. Track 8 and the maintained route/auth inventory are authoritative.

---

**Source files:** `src/App.tsx` (public/member routes), `src/admin/AdminApp.tsx` (admin routing), `worker/src/index.ts` (API routing), `plan/product-architecture-route-auth-inventory.md` (maintained auth inventory), and `tracks/08-platform-hardening.md` (open hardening work).

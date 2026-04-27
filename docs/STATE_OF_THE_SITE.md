# State of the Site

> Comprehensive snapshot of the Teajia platform: what works, what doesn't, where the gaps are. Merges March 2026 audit shards with April 2026 Layer 1/2 audit synthesis. For technical architecture see ARCHITECTURE.md. For what's next see POST_AUDIT_ROADMAP.md.

**Audit period:** March–April 2026
**Last updated:** 2026-04-27 (post-audit close)

---

## 1. Executive Summary

### What Works

**Editorial & Content Excellence:**
- Magazine with 150+ layout variants and immersive Reader component (1,126 lines, magazine-quality experience)
- Photo essay system with cinematic viewer, grid layouts, zoom, sequential mode, and mini-map navigation
- Learn Hub with 6 modules across 3 learning tracks; well-structured curriculum
- Premium AlcoveCard product presentation with lore, tasting notes, mood, terroir storytelling
- Tea Compass: sticky daily-use logging tool (27 files, 10K+ lines) with photo capture, voice recording, natural language input, session history, PDF export, cloud sync

**Commerce & Admin Infrastructure:**
- Full admin inventory system (940+ lines): 8+ views, inline editing, bulk operations, fuzzy search, QR codes, import/export
- Product management with conditional fields, vendor picker, cost calculation engine, pricing automation
- Order pipeline: status tracking (Pending → Filled → Void) with fulfillment preview and activity timeline
- Records & analytics: archive, activity logs, stock ledger, CSV export
- Dashboard with real-time financial intelligence (cost, retail, profit margin, currency exposure, regional distribution)
- People/CRM: customer tags, purchase history, vendor cost analysis, role-based access (1,465 lines)
- Quick Capture: camera/file upload with AI data extraction, two-stage pipeline, bulk approve
- Events Manager: full CRUD, capacity/waitlist, attendee tracking, tea menu editor, post-session editor
- Tasting Notes System: guided form, batch mode, auto-save, structured taxonomy
- CSV Import: three-stage pipeline with smart header matching, validation, progress tracking
- Zustand state management with multi-currency cart and draft product auto-save
- API layer: full REST with JWT auth, 30s timeout, Gemini AI integration for wisdom generation

**Navigation & UX Foundations:**
- Bottom tab bar (mobile) and left sidebar (desktop) with clean navigation
- Global search with Fuse.js fuzzy matching (admin only)
- Theme toggle (light/dark) with semantic color system
- PWA with Workbox, code splitting, NetworkFirst for API, CacheFirst for media
- Service worker with network-aware image preloading

### What Doesn't Work

**Audit findings:** As of 2026-04-27 the audit is closed. 36 of 37 findings shipped or verified. The one remaining (#36, design system) is scoped into 4 phases in `DESIGN_SYSTEM_PHASING.md`. Track the close-out in `_audit/FINDINGS.md` and the commit history (`1c57099`, `c653dde`, `39d730e`, `da98cd6`, `3433059`, `3d6507c`, `78d5f44`, `6961b34`).

**Design system debt (the one open audit finding, #36):**
- **Triple-config drift:** designTokens.ts / tailwind.config.ts / inline index.html script all carry overlapping definitions; CDN Tailwind makes the inline config win at runtime
- **Tailwind CDN in production** (~500KB JS) blocks rendering and prevents tree-shaking
- **328 hardcoded rgba()** + 65 hex bracket instances + 49 files using banned legacy tokens (tea-ink, tea-paper, tea-seal, tea-charcoal)
- **Triple gold drift:** #b8882d, #C9943A, #a07830 used interchangeably
- **8 Google Fonts** loaded in one blocking request, 3–4 used per page
- **Missing scales:** lineHeight, transitionDuration, letterSpacing, zIndex, backdropBlur
- **648 padding instances** across 124 files with no enforced spacing scale
- See `DESIGN_SYSTEM_PHASING.md` for the 6–10 day phased fix plan.

**Conversion gaps (deliberately deferred — out of audit scope):**
- **No on-site checkout** — purchase flow exits to WhatsApp/email by design (per VISION.md, "WhatsApp checkout is intentional"). Not a gap to close; a design choice to keep.
- **Product detail pages exist as overlays/modals**, not URL-addressable. Worth revisiting if SEO + deep-link sharing become priorities.
- **Newsletter signup stores locally only** — backend delivery is a Body C item in `POST_AUDIT_ROADMAP.md`.

**Architecture silos (the next big project, Body B in POST_AUDIT_ROADMAP.md):**
- **Magazine ↔ Shop, Learn ↔ Shop, Consult ↔ Shop:** sections don't link to each other's content. Highest-leverage change post-audit.
- **No personal timeline:** member's tasting / favorites / Compass / orders / reading scattered across six places. No unified "My Tea Life" view.
- **Events ↔ Magazine:** events generate photos but no content production loop into the magazine.

**Mobile & accessibility issues fixable by the design system pass (#36, Phase D):**
- 5–6 touch targets below the 44px floor (PageHeader Back, ChevronRight, cart stepper, Reader progress handle)
- Color contrast failures on `text-tea-ink/40` on `tea-paper` (2.8:1, fails WCAG AA)
- 25+ `text-white` instances that don't adapt to light mode
- Asymmetric backdrop opacities (light vs dark)
- Inconsistent focus rings across buttons
- These don't require their own project — they're Phase D of #36.

**Documentation debt:** Closed in commit `46aa5ee`. 46-file docs folder consolidated into a navigable structure. 8 overlapping audit shards archived. 2 superseded briefs archived. 2 duplicate strategy docs archived.

### Bottom Line

**Post-audit (2026-04-27):** Authorization is consistent and DB-verified. Bundle enforcement is uniform. Audit logging is complete. Wiring gaps are closed. Documentation matches reality. The site can be confidently handed to another developer or partner today.

**The next 6–10 days of work** is design system phasing (#36) — quality debt that doesn't add features but makes everything built on top of it stable. After that, the next strategic project is "coherence" (cross-section linking + personal timeline), the body of work that turns six well-built tools into one Tea Practice OS. See `POST_AUDIT_ROADMAP.md` for the three-body forward plan.

---

## 2. Functional Inventory

### 2.1 Public Features

**Homepage**
- Hero section with seasonal/editorial content and character reveal animation
- Four action buttons routing to Shop, Magazine, Learn, Consult
- Email capture integration (stores locally, no backend delivery)
- Rotating tea insight text (5 categories, one random per visit)
- Latest Stories grid with category filtering, infinite scroll
- Learn teaser with sample question
- Seasonal tea pick with image + pricing
- Pull quote from editorial content
- Newsletter capture form

**Shop (Shop.tsx + shop/ directory — revenue engine)**
- Full product catalog from Cloudflare D1 via `/api/products/public`
- Tea type filtering (12 categories: Green, White, Yellow, Oolong, Red, Sheng, Shou, Dark, Herbal, Matcha, Flower, All)
- Feeling filter (10 mood-based: Ancient, Balanced, Energetic, Grounding, Meditative, Romantic, Soft, Strong, Vibrant, Wild)
- AlcoveCard — premium product cards with lore, tasting notes, mood, terroir; full detail overlay with swipe carousel
- Teaware AlcoveCard/Modal — separate presentation system
- CompareView — side-by-side comparison of up to 4 products
- QuickPeekDrawer — fast product preview without modal load
- ShopSearch — fuzzy search via Fuse.js
- CollectionTab — curated product groupings (curated viewing, no URL-backed, not in main nav)
- ForYourPractice — starter sets and bundles (4 tabs: Collection/Tea/Teaware/Sets)
- ProductInquiry — inquiry form for custom/wholesale orders
- WhatsAppOrder — direct WhatsApp ordering integration with fallback number
- ShippingBadge — shipping info display
- Cart with multi-currency support, recently viewed tracking, compare items
- **Gaps:** No product detail pages with shareable URLs; no pricing per-gram display; no stock level indicators; no reviews/ratings

**Magazine (MagazineTabbed.tsx — content marketing)**
- Tabbed editorial content browser (Articles, Visual)
- 150+ layout variants (cover, text columns, full-bleed images, poems, etc.)
- Story cards with category filtering, infinite scroll
- Links into full Reader experience
- **Gaps:** No date-based archives; no tag-based browsing; content types not visually distinguished (article vs. video vs. photo essay vs. audio)

**Reader (1,126 lines — magazine-quality reading)**
- Full-screen immersive article reader with scaled page layout (3:4 aspect ratio)
- Multi-layout rendering engine (SinglePageRenderer)
- Photo essay integration, media embedding (video, audio, galleries)
- Reading progress bar, keyboard/touch/shake navigation
- Reading position persistence (localStorage)
- Horizontal page-turn navigation with progress scrubber
- Three media modes: Reel (vertical video), Film (landscape), Audio (listening room)
- **Gaps:** No pinch-to-zoom; doesn't block iOS back-swipe; no accessible page announcement for screen readers

**Photo Essays (PhotoEssay/ directory — visual storytelling)**
- VisualFeatureViewer — cinematic photo story viewer
- OverviewGrid — gallery grid with zoom
- GridZoomViewer — lightbox-style detail view
- SequentialMode — scroll-through narrative
- MiniMap — navigation overlay for long essays

**Learn Hub (6 modules, 3 learning tracks — education authority)**
- LearnOverview, LearnCurriculum, LearnExplore, LearnLibrary, LearnReadingLists
- Structured curriculum: Foundation, Brewing, Flavor, Mindfulness, Vessels, Community
- Learning tracks: Beginner, Brewing Mastery, Community & Culture
- Glossary with 50+ terms mapped to icons
- Reading lists and playlists
- Tea Spaces gallery with curated examples
- **Gaps:** No breadcrumb navigation; 10 sub-sections with only back button; reading progress not tracked; no link to products mentioned in modules

**Consult Page (B2B lead generation)**
- Three tiered service offerings ($265 — $100K+)
- Project portfolio with case study deep dives
- InquiryForm for lead capture (7+ fields, high friction)
- Floating CTA button
- Adrian bio section with placeholder image (unfinished)
- Testimonial carousel (static data, 6-second rotation, no pause control)

**Events System (events/ — 11 components; community building)**
- EventLanding, RSVPFormSheet, FindRSVPSheet
- EventCountdown, AvailabilityBadge, CalendarDownload
- TeaMenuPreview, VenueGuide, PostSessionArchive
- TastingNotesForm, GuestManagement
- Full capacity/waitlist management
- Tea menu editor with product selection

**Tea Compass (27 files, 10K+ lines — daily-use practice tool)**
- Mobile-first tea logging/tracking tool
- Photo capture, voice recording, natural language input
- Session history, vendor tracking, personal ledger with PDF export
- Cloud sync (partially wired)
- Offline scaffolding
- **Gaps:** Sync on auth ready only; guest tastes lost on reload; session templates missing; voice transcription incomplete

**Account Panel (personalization layer)**
- MyCollection — saved/favorited teas with server sync
- TastingJournal — personal tasting note history (max 100 entries, localStorage-only)
- Recently viewed tracking, compare items management
- **Gaps:** Tasting journal sync incomplete; reading progress not synced to account; no order history

**Navigation & Shell**
- BottomTabBar (mobile, 5 tabs), LeftSidebar (desktop), TopRightUtilities
- Global search (Cmd+K, admin only) with Fuse.js
- Theme toggle (light/dark, hidden on mobile: long-press center logo)
- Multi-currency selector (exists in cart, not in shop view)
- **Gaps:** Global search not on public site; theme toggle undiscoverable; no "View Cart" persistent indicator

### 2.2 Account & Member Features

**Sign-In/Sign-Up**
- Email + password authentication (min 6 chars)
- JWT token-based auth
- Account creation saves name, email, password

**Account Sub-Views**
- Profile view with name, email, preferences
- Reading history browser
- Saved collection (favorites) with shareable URL encoding
- Currency preference (persisted)
- Theme preference (light/dark)
- Account switcher for multi-location operators
- **Status:** 65 wired, 18 partial, 12 stub, 3 orphan flows

**Tasting Journal**
- Max 100 entries
- localStorage-only persistence (lost on browser clear)
- Sync on auth ready (incomplete)
- **Gaps:** No server persistence; no date-based viewing; no aggregation/analytics

**Tea Compass Personal Practice**
- Session logging with photo/voice/text
- Vendor tracking
- PDF ledger export
- **Gaps:** Sync incomplete; guest sessions lost; templates missing

### 2.3 Admin Features

**Inventory Management (940 lines)**
- Dual-mode: Tea and Teaware tabs
- 8+ views: All, For Sale, Drafts, Alerts, Unpublished, Unverified, Samples, Personal, Archived
- Column customization, grouping, multi-level sorting
- Inline ghost-input editing, bulk operations
- Fuzzy search, stock verification, QR codes, import/export
- Stock ledger (view-only)
- **Status:** 127 actions total; 35 wired, 52 partial, 18 stub, 15 orphan

**Product Management (AddProductModal)**
- Full product creation/editing with conditional fields
- Vendor picker with auto-create, cost calculation engine (multi-currency)
- Image management, tasting note editor, extended fields (lore, terroir, mood)
- Smart pricing (auto-calculates retail from cost + markup)
- Seasonal/featured/isFeatured flags (flags exist, not used in public UI)

**Order Pipeline (OrdersView)**
- Status tracking: Pending → Filled → Void
- Pipeline summary, fulfillment preview, order splitting/editing/voiding
- Activity timeline per order
- **Gaps:** No payment status tracking; no estimated total with shipping shown to customer

**Records & Analytics (SoldItemsView — 616 lines)**
- Archive tab, Activity Log, Stock Ledger
- CSV export for all views
- **Gaps:** Activity log unsecured (any authenticated member can read all accounts' history)

**Dashboard**
- KPI cards: total cost, retail value, profit margin
- Currency exposure chart, regional distribution, type distribution
- Real-time recalculation with live exchange rates
- **Gaps:** Chart segments not clickable; no drill-down; no customer metrics

**People/CRM (CustomersView, SourcesView — 1,465 lines)**
- Customer database with tags
- Purchase history, vendor cost analysis
- Order count tracking (not drillable; OrdersView doesn't filter by customer)
- Role-based access
- **Gaps:** Customer → Orders link missing; vendor linking broken (text field, no bidirectional nav)

**Quick Capture (569 lines)**
- Camera/file upload with AI-powered data extraction
- Two-stage review pipeline, bulk approve, inline editing

**Events Manager (Admin)**
- Full event CRUD, capacity/waitlist, attendee tracking
- Tea menu editor, notification system, post-session editor
- Attendee table (customerId optional; no "create customer" from attendee)

**Tasting Notes System (TastingNotesView)**
- Interactive guided tasting form, batch mode, auto-save
- Structured taxonomy (aroma, flavor, mouthfeel, body, aftertaste)

**CSV Import (CsvImportModal)**
- Three-stage pipeline: Upload → Staging/Validation → Batch Upload
- Smart header matching, draft detection, progress tracking

**Additional Admin Tools**
- Command Palette (Cmd+K) — admin-only
- Invoice PDF with QR codes
- Stock ledger panel
- Toast notifications, error boundaries, dev admin bypass
- Settings panel

### 2.4 Platform Tier Features

**From VISION_AUDIT_3_COMPASS analysis:**
- 15 platform-only actions identified
- 13 wired (member invites, bundle grants, adoption review, suspensions, ownership transfer, audit logging)
- 2 partial (email notifications, currency management)
- **Gaps:** Currency/exchange rate admin UI missing; password reset email optional; audit trail ambiguous ("acting as" not clearly distinguished)

---

## 3. Design System & UI

### 3.1 Typography Issues

**8 Google Fonts Loaded (Critical Performance Impact)**
- Lora, Inter, Noto Serif SC, Playfair Display, JetBrains Mono, Fraunces, Bricolage Grotesque, Ma Shan Zheng
- Single blocking request; no `font-display: swap`
- Only 3–4 fonts used per page; rest are dead weight
- Chinese text (Noto Serif SC) lacks `unicode-range` subsetting
- **Fix priority:** Keep Lora (body serif), Inter (UI), Vollkorn (display). Lazy-load others.

**Inconsistent Font Sizes & Scales**
- 14 different text sizes for similar elements
- `text-[10px]` and `text-[9px]` used extensively (below 12px minimum)
- Lines like: `text-2xl md:text-4xl lg:text-4xl` where `lg` = `md` (redundant)
- Typography presets defined in designTokens but never imported (dead code)
- Form inputs use serif font (should be sans-serif for legibility)

**Font Weight & Line Height Inconsistency**
- Body line-height: 1.625 globally, 1.7 on `<p>`, plus Tailwind `leading-*` classes (3 systems)
- Card title line-height: 1.25; article body: 1.85 (no shared scale)
- Heading weights: mix of `font-light` (300) and `font-normal` (400) on same page
- Letter-spacing: mix of `em` units and pixel units (`0.2px` hardcoded)

**Rendering Issues**
- Reader renders at fixed 800×1067px then scales (wastes rendering, subpixel blurring)
- Inconsistent text truncation strategy (`line-clamp-2` vs `line-clamp-3` vs `truncate`)

### 3.2 Navigation & Layout

**Sidebar Width Jump (Abrupt Transition)**
- Desktop: `w-20 xl:w-56` — jumps 144px (80px → 224px) with no intermediate `lg:` state
- Content margin doesn't match: `lg:ml-20 xl:ml-56` but no `md:` state
- Admin sidebar: hardcoded `w-64` (32px wider than public max)

**Bottom Tab Bar Tight for Touch**
- 56px height too cramped for 5 targets + safe area
- Touch targets: varying 28px–44px (below WCAG 44px minimum)
- No padding for notched iPhones
- Theme toggle hidden: long-press center logo (undiscoverable)

**Page Content Overflow**
- Footer has `max-w-[1400px]`; main content has NO max-width constraint
- On ultra-wide displays: content expands infinitely while footer is capped

**Missing Breadcrumbs & Wayfinding**
- Learn Hub: 10 sub-sections, no persistent breadcrumbs
- No "Back to Shop" on standalone product views (if they existed)

### 3.3 Color & Token Drift

**Triple-Config Drift (Architectural Problem)**
- `src/designTokens.ts` — intended single source of truth
- `tailwind.config.ts` — extends from designTokens but incomplete
- `index.html` inline `<script>` — separate Tailwind config that overrides both (CDN loads last)
- **Result:** Changes to designTokens have NO effect in dev mode; index.html config is live

**328 Hardcoded rgba() Values (Theme System Unreliable)**
- Violate COLOR_RULES.md explicitly
- Don't adapt to light/dark mode
- Examples: HomePage.tsx line 303, BottomTabBar.tsx lines 122–123, LeftSidebar.tsx, PopupModal.tsx line 188
- **Impact:** Light/dark toggle produces visual artifacts on nearly every page

**49 Files Using Banned Legacy Tokens**
- `tea-ink` (dark color, but cream in dark mode)
- `tea-paper` (light background)
- `tea-seal` (gold)
- `tea-charcoal`
- These have misleading names and are inconsistently mapped

**Three Different Gold Colors**
- `#b8882d` (tea-seal in config)
- `#C9943A` (card-utilities.css)
- `#a07830` (tea-seal-dark)
- No rationalization across the codebase

**Color Inconsistencies by Component Type**
- Button text: `text-white` (not semantic, hard-coded)
- Toggle switches: hardcoded `#859F85` (not in palette)
- Some toggles use `blue-500/10` + `blue-400` (Tailwind blue, not tea colors)
- Tea type color mapping duplicated in 3 files (themeUtils.ts, TeaDetailsModal.tsx, PersonalCollectionView.tsx)
- Card title: `#E8DDCC` (not in config, not matching tea-paper #F3F0E7)
- Card focus shadow: uses wrong gold hex `#C9943A` instead of `#b8882d`

**Opacity Notation Chaos**
- Mix of `/10` slash notation, `[0.05]` bracket notation, inline styles `opacity: 0.9`
- 44+ files using inconsistent approach

### 3.4 Visual Hierarchy & Brand

**First Impression Verdict: B+**
- Editorially strong; commercially weak
- Landing reads like magazine masthead, not commerce site
- Warm aesthetic (espresso + gold + grain) is premium and consistent
- No single dominant CTA above fold
- Shop buried in sidebar, not surfaced on landing
- Seasonal tea pick appears below fold

**Brand Cohesion: A-**
- Logo system consistent (emblem, wordmark, text logo)
- Typography thoughtful (Vollkorn display, Lora body, Inter UI)
- Espresso-and-gold palette works
- **Break:** Admin panel uses different visual language; legacy token inconsistencies

**Trust Signals on Homepage: D**
- No customer count, no testimonials on landing
- No "as seen in" or press mentions
- No product count ("139+ teas") surfaced
- No shipping/returns policy visible
- Seasonal tea pick shows pricing but no reviews
- Email capture has no value proposition

**Imagery Issues**
- ConsultPage Adrian bio: placeholder grey box (unfinished)
- ProjectCard thumbnails: empty dark boxes (portfolio has no visuals)
- No fallback treatment when images fail to load
- Some use Unsplash placeholders (hardcoded URLs)

### 3.5 Micro-Interaction & Animation Issues

**169 Total Design System Inconsistencies Documented:**

**Spacing:**
- Card padding varies: `p-3`, `p-4`, `p-6` on similar components
- Section gaps: `gap-2` through `gap-5` without rule
- Metadata labels: alternate `text-[10px]` and `text-[11px]`
- Modal padding mismatches (8px horizontal difference between header and body)

**Border Radius:**
- Components use `rounded-[1px]` (arbitrary), others `rounded-sm`, `rounded-lg`, `rounded-2xl`, `rounded-full`
- Modal progression: `rounded-t-2xl` on mobile, `rounded-sm` on desktop (14px difference)
- No scale ends at `xl: 0.75rem`; components use `rounded-2xl`, `rounded-3xl`, `rounded-full` (outside defined scale)

**Shadows:**
- Card default: `0 1px 3px rgba(0,0,0,0.3)` hover: `0 12px 24px` (12x jump, very aggressive)
- Components mix Tailwind shadows with custom inline `boxShadow`
- Table wrapper: `shadow-2xl` (same as modals, no visual hierarchy)
- Inconsistent shadow coloring strategy

**Transitions & Animations:**
- Fade-in: `0.5s` in some components, `0.6s` in others
- Expansion: `300ms` vs `700ms` (same effect, wildly different timing)
- Card transform hover: `300ms cubic-bezier(0.4, 0, 0.2, 1)` but image hover: `700ms ease-out` (2.3x slower)
- **Animation drift:** slideUp defined as `0.3s` in designTokens, `0.4s` in index.html (33% difference)

**Z-Index Chaos (No Scale Defined)**
- Values: 10, 60, 65, 70, 80, 90, 100, 210, 250, 9999
- Theme radial overlay: `z-[9999]` (competes with browser devtools)
- Modals: mostly `z-[100]` (80+ instances fighting for same layer)
- Contact modal: `z-[210]` (arbitrary gap from others)

**Icon Size Inconsistencies**
- Back icon: `w-3.5 h-3.5` (14px)
- Cart icon: `w-[22px] h-[22px]` (hardcoded pixels, 8px difference)
- Audio icon: `w-5 h-5` (20px) but play button: `w-4 h-4` (16px)
- Admin nav icons: `size={16}` but TeaTable: `size={10}`, OrdersView: `size={14}`

**Button Inconsistencies**
- Padding varies: `px-4 py-3`, `px-6 py-3`, `px-6 py-2.5`, `p-1.5`, `p-2`
- Border-radius: `rounded-[1px]`, `rounded-sm`, `rounded-lg`, `rounded-xl`, `rounded-full`
- Focus styles: some have `focus-visible:outline-2`, others no focus ring at all
- Min-height enforcement: `min-h-[44px]` in some, missing in size variants

**Backdrop/Glass Effects Mismatch**
- Header: `backdrop-blur-xl backdrop-saturate-150` (saturate not used elsewhere)
- Bottom nav: `backdrop-blur-xl` only (no saturate)
- Cart drawer: `backdrop-blur-sm` (weakest blur)
- Light mode: `bg-white/70` vs Dark: `bg-[#1a1a1a]/80` (10% opacity difference)

---

## 4. Architecture Coherence

### 4.1 Section Silos (Missing Connective Tissue)

**Gap 1: Magazine ↔ Shop**
- Articles about specific teas don't tell readers Teajia carries them
- **Fix:** Add `productReferences: string[]` to Story type; footer section "Teas mentioned in this piece" with minimal cards
- **In-shop direction:** Rich context links expected; can be richer editorially

**Gap 2: Learn ↔ Shop**
- "Vessel Selection & Design" module teaches about gaiwans but doesn't surface available teaware
- **Fix:** Add `relatedProducts: string[]` to LearnModule; "Explore these in the collection" at module end
- **Glossary:** Terms describing tea types can note "We carry [N] of this type" with link to filtered Shop view

**Gap 3: Learn ↔ Consult**
- Tea Spaces gallery has "Book a Consult" CTA but no link to actual Consult portfolio projects
- **Fix:** Link Tea Spaces images to Consult projects; "See spaces Adrian has designed →" link at module end

**Gap 4: Consult ↔ Shop**
- Portfolio projects show beautiful spaces but don't name vessels, teas, tools used
- **Fix:** Add `featuredProducts: string[]` to ConsultProject; list "Vessels and teas featured in this space" editorially

**Gap 5: Home (Decorative, Not Alive)**
- HomePage shows no actual content from any section
- **Fix:** Replace static buttons with living previews: latest article headline, featured product name, next event date (text-only, teasers, not ads)

**Gap 6: Events ↔ Magazine**
- Events happen, tastings occur, but no content flows back to Magazine
- **Fix:** Post-session data (`gallery_images`, `host_notes`, `energy`) should feed into photo essays; editorial cycle: event → photo essay → readership → attendance

**Gap 7: Global Search (Siloed Results)**
- `GlobalSearch` / `CommandPalette` returns results but doesn't show connections
- **Fix:** Group by section (Products, Articles, Glossary, Events); show related content when displaying each result

### 4.2 Data Layer Structural Gaps

**No Database Table for Articles/Magazine**
- All stories in code constants and localStorage
- Can't create article ↔ product relationships in DB
- Can't track reads/engagement
- Can't build a CMS
- **Fix:** Create `articles` table; add `article_products` junction table

**Tasting Journal is localStorage-Only**
- `CustomerTasting` in Zustand, persisted to localStorage
- Never synced to server; data loss on browser clear
- Can't aggregate across users; can't show community data
- **Fix:** Create `customer_tasting_journal` table; sync on login

**Invoice Payment Status Missing**
- Invoices track fulfillment (Draft → Pending → Filled → Void)
- No concept of paid/unpaid
- **Fix:** Add `payment_status` (unpaid/partial/paid), `payment_date`, `payment_method`

**Event Attendee Status Enum Mismatch**
- DB allows `confirmed/waitlist/cancelled`
- App V2 code uses `requested/approved/denied`
- SQLite silently allows mismatch
- **Fix:** Migrate to V2 flow: `requested → approved/denied/waitlist → confirmed/cancelled`

**Missing Cross-Reference Tables**
- No `article_products` (article_id, product_id)
- No `module_products` (module_id, product_id)
- No `project_products` (project_id, product_id)
- **These enable the quiet, responsible cross-linking described in architecture philosophy**

**No Stock Holds for Pending Orders**
- Stock only changes on fulfillment/void
- Pending invoices don't reserve inventory
- **Fix:** Add `stock_holds` table (invoice_id, product_id, reserved_grams, created_at)

### 4.3 Authorization Gaps (April 2026 P0 Findings)

**Critical Security Gaps:**
- **Finding #1:** RPC handlers (fulfill-invoice, void-invoice, increment-stock) lack ANY authorization checks; any authenticated member can invoke
- **Finding #2:** 31 actions have client-side bundle gates but NO server-side `requireBundle()` enforcement; higher-tier JWT can bypass bundle restrictions
- **Finding #6:** Bulk product create (POST /api/products/bulk) has zero authorization checks; any authenticated member can bulk-import

**Bundle Enforcement Gaps (31 Total):**
- **Stock bundle:** No server implementation; Purchase orders, inventory reads, all RPC actions unprotected (6 gaps)
- **Gather bundle:** Events have NO `requireBundle('gather')` despite being primary feature (17 gaps)
- **Publish bundle:** Collections, magazine rely on owner-tier gate, not bundle gate (6 gaps)
- **Sell bundle:** Wholesale properly gated, but invoicing, customers, analytics account-scoped with no bundle check (2 gaps)

**Audit Logging Gaps:**
- **Finding #3:** Bundle grant changes NOT logged; audit blind spot for privilege escalation
- **Finding #4:** Ownership transfers NOT logged; critical privilege change invisible
- **Finding #31:** "Acting as" audit trail ambiguous; account_id doesn't distinguish "Adrian in account X" vs. "Adrian's platform-wide action"

**Other High-Risk Gaps:**
- Activity log + stock ledger unsecured: any authenticated member can read all accounts' history
- Account suspension enforcement weak: suspended account can still write
- Password reset email optional: depends on RESEND_API_KEY; user never notified if key missing
- Tea Master invite email optional: same env var dependency

---

## 5. Strategic Implications

### 5.1 The "Tea Practice OS" Thesis

From VISION_AUDIT_1_OVERVIEW: Teajia should be a **single integrated environment where a tea practitioner's entire relationship with tea lives**, not six siloed products sharing a navbar.

**Three Missing Layers:**

1. **The Personal Timeline (The Spine)**
   - Unified "My Tea Life" feed: purchases, sessions, events, articles, reading, favorites
   - Chronological story of tea journey
   - Tasting journal in localStorage; favorites in Zustand + server; purchases in orders; Compass entries separate; reading in localStorage
   - **Effort:** New `personal_timeline` table; unified query; frontpage widget

2. **The Knowledge Graph (The Brain)**
   - Contextual intelligence surfacing right knowledge at right moment
   - Viewing Sheng? Show puerh aging module
   - Logged gongfu session? Surface brewing mastery track
   - Bought yixing pot? Link to vessels curriculum
   - Tasting notes say "mineral"? Show similar teas
   - **Effort:** Product ↔ content linking; algos for flavor similarity

3. **The Social Layer (The Community)**
   - Lightweight social respecting contemplative nature of tea
   - Shared tasting sessions (two users logging same tea simultaneously)
   - "Tea circle" — small group seeing recent sessions
   - Event attendee connections
   - Community tasting aggregation on products
   - **Effort:** 1–2 weeks for tea circles; easier for community aggregation

### 5.2 What the Audits Validated

**What's Working Editorially & Operationally:**
- 139+ products in rich D1 inventory
- Magazine-quality Reader with 50+ layout variants
- Full admin system (inventory, events, orders, people)
- Tea Compass daily-use tool (27 files, mature)
- Events with RSVP, capacity, attendee tracking
- Multi-currency support, offline scaffolding
- Editorial voice unmatched in tea space
- **Breadth is best-in-class**

**What Needs Work Technically:**
- P0: Server-side authorization (31 gaps)
- P1: Wiring completeness (12 gaps)
- Design system: 169 inconsistencies, triple-config drift
- Performance: CDN Tailwind, 8 fonts, texture overlays
- Commerce coherence: no product URLs, no on-site checkout, no cross-linking
- Documentation: 8 overlapping audit shards
- **Coherence is the active work**

**Priority Roadmap from VISION_AUDIT_0:**

*Tier 1: High Impact, Low Effort (2–4 hours each):*
- "Continue Where You Left Off" on shop
- Brewing guide per product
- Reading progress tracking on Learn
- Today dashboard for admin
- Glossary tooltips on product pages
- Quick stock adjustment in inventory
- New arrivals badge
- Post-event purchase link emails
- Related articles on product pages
- Autocomplete tea names in Compass

*Tier 2: High Impact, Medium Effort (1–2 days each):*
- Tasting note similarity engine
- Flavor Map discovery UI
- Session templates in Tea Compass
- Unified activity stream
- Service worker with Workbox
- Voice-to-structured-notes pipeline
- Receipt → Quick Capture → Shelf pipeline
- Community tasting aggregation
- Sample size option in shop
- Shareable tasting cards

*Tier 3: Transformative, Higher Effort (3 days–2 weeks each):*
- "Start Your Practice" guided flow
- Tea Circles (social layer)
- Adaptive learning paths
- Live tasting mode for events
- Content CMS migration to D1
- Full analytics pipeline
- Practice dashboard
- Mobile admin view
- Unified search (D1 FTS5)
- Personal collection tracker

---

## 6. Ranked Findings (April 2026)

### P0 — Security & Data Integrity (6 findings)

| # | Finding | Effort | Action |
|---|---------|--------|--------|
| 1 | RPC handlers lack ANY authorization checks; any authenticated member can invoke | 1hr | |
| 2 | 31 actions with client-side gates but NO server-side `requireBundle()` enforcement | half-day | |
| 3 | Bundle grant changes NOT logged; audit blind spot | 10min | |
| 4 | Ownership transfers NOT logged; critical privilege change invisible | 10min | |
| 5 | Account suspension enforcement weak; suspended account can still write | 20min | |
| 6 | Bulk product create has zero authorization checks; any member can bulk-import | 1hr | |

### P1 — Wiring Gaps (12 findings)

| # | Finding | Effort | Action |
|---|---------|--------|--------|
| 7 | Gather bundle inconsistently enforced; wholesale requires gate but events don't | half-day | |
| 8 | Publish bundle invisible at server; all endpoints rely on implicit account scope | half-day | |
| 9 | Stock bundle has no server implementation; zero authorization on RPC actions | day | |
| 10 | Member bundle-gated flows NOT in public Account Panel; only partial admin UI | multi-day | |
| 11 | Personal Collection & Compass sync incomplete; member changes not persisted | half-day | |
| 12 | Pull-to-refresh visual but logic incomplete; no actual data re-fetch | 2hr | |
| 13 | Global search partially implemented; results may be empty | half-day | |
| 14 | Cart checkout relies on per-store WhatsApp without validation; silently breaks if missing | 30min | |
| 15 | Share modal & social sharing incomplete; Copy-link works, Twitter/Facebook stubs | 2hr | |
| 16 | Tasting journal sync only on auth ready; guest entry lost on reload | 1hr | |
| 17 | Tea Master invite email optional; user never notified if RESEND_API_KEY missing | 30min | |
| 18 | Adoption decision UI unfinished; API exists but no review UI tab | 3hr | |

### P2 — Organization & Redundancy (12 findings)

| # | Finding | Effort | Action |
|---|---------|--------|--------|
| 19 | Owner-gated tools bypass bundle system; should use `requireBundle` | 3hr | |
| 20 | Sourcing (Tea Compass, Vendors, Quick Capture) not bundled; unclear scope | 2hr | |
| 21 | Purchase Orders outside Stock bundle; no enforcement | 1hr | |
| 22 | Legacy role==='owner' checks (13 instances) not consolidated; hard to audit | 2hr | |
| 23 | Cross-tier data model assumes tokens correct; forged JWT fails silently | — | |
| 24 | Activity log & audit trail unsecured; any member can read other accounts' history | 1hr | |
| 25 | "Start Here", "For Your Space", "Spaces" in PREVIEW_MODE; ship date unclear | half-day | |
| 26 | Community page STUB only; no content, feeds, or discovery | 2–3hr | |
| 27 | Account Panel "Operator" view not fully tested in multi-store; edge cases unclear | 1hr | |
| 28 | 8 audit shards from March 2026 heavily overlapping; consolidate into STATE_OF_THE_SITE | — | |
| 29 | 2 superseded briefs in docs (merged into NETWORK_ROLLOUT_PLAN); archive needed | 30min | |
| 30 | 2 duplicate strategy docs (pre-VISION era); archive candidates | 1hr | |

### P3 — Polish & Copy (7 findings)

| # | Finding | Effort | Action |
|---|---------|--------|--------|
| 31 | "Acting as" audit trail ambiguous; account_id doesn't distinguish actor context | 1hr | |
| 32 | Currency/exchange rate admin UI missing; rates exist, no panel | 3hr | |
| 33 | Password reset email optional; depends on RESEND_API_KEY; user never notified | 30min | |
| 34 | AccessView.tsx (bundle editor) stub/incomplete; no "editor sheet" UI yet | 2–3hr | |
| 35 | Location/Account switcher in AccountPanel not fully tested; edge cases unclear | 2hr | |
| 36 | Design system disorganized; 169 inconsistencies across 5 audit files; consolidation plan exists but not executed | — | |
| 37 | Adoption decision audit incomplete; missing applicant_email correlation | 30min | |

### Cross-Cutting Themes

**Theme 1: Client-Side Gates Without Server-Side Enforcement (BIGGEST SECURITY GAP)**
- 31 actions have client-side `requireBundle` but NO server-side guard
- Authenticated member with higher-tier JWT can bypass
- RPC handlers (fulfill-invoice, increment-stock, release-stock) have ZERO authorization

**Theme 2: Bundle System Incomplete at Multiple Tiers**
- Catalog: properly gated
- Gather: NO `requireBundle('gather')` on events
- Publish: relies on owner-tier gate, not bundle
- Stock: no server implementation
- Sell: properly gated wholesale, but rest account-scoped

**Theme 3: Tier vs. Bundle Mismatch in Account Panel**
- 43 tools shown; inconsistent gating
- Some use requires:'owner' (tier-level)
- Some use no gate at all
- Only 6 have explicit bundle enforcement
- Public Account Panel doesn't surface bundle-gated features

**Theme 4: Multi-Tenancy Wiring Complete But Audit Blind Spots**
- X-Teajia-Account header + getActiveAccount() correctly scoped
- "Acting as" properly logged
- BUT: bundle grants NOT logged, ownership transfers NOT logged
- Ambiguity in audit trail context

**Theme 5: Documentation Folder Heavily Overlapping**
- 46 markdown files; 8 audit shards overlap heavily
- 2 superseded briefs; 2 duplicate strategies
- 12 redundant files total
- Consolidation plan exists but not executed

---

## Summary Scorecard

| Category | Status | Top Issue |
|----------|--------|-----------|
| Editorial/Content | Excellent | Magazine/Reader/Learn are best-in-class |
| Commerce Infrastructure | Strong | Full admin + events system working |
| Authorization | Broken | 31 client-side gaps, no server enforcement |
| Design System | Fragmented | 169 inconsistencies, triple-config drift |
| Performance | Poor | CDN Tailwind, 8 fonts, textures bloat |
| Architecture Coherence | Siloed | Sections don't link; no connective tissue |
| Mobile UX | Needs Work | Touch targets, accessibility gaps |
| Conversion Path | Unclear | No product URLs, checkout exits site |
| Documentation | Confusing | 8 overlapping audits, no single source of truth |

---

**Source files:** AUDIT.md, FUNCTIONAL_AUDIT.md, ARCHITECTURE_AUDIT.md, UI_UX_AUDIT.md, DESIGN_SYSTEM_AUDIT.md, WEBSITE_TEARDOWN.md, VISION_AUDIT_0–3, plus April 2026 Layer 1/2 audit (_audit/01–04, FINDINGS.md). Originals archived in docs/_archive/.

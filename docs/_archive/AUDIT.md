> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md.

# Teajia Platform Audit — March 2026

## Part 1: Public-Facing Features

### 1. Homepage
- Hero section with seasonal/editorial content and character reveal animation
- Four action buttons routing to Shop, Magazine, Learn, Consult
- Email capture integration
- **Value:** First impression & brand storytelling. Drives traffic to revenue pages.

### 2. Shop (Shop.tsx + shop/ directory)
- Full product catalog from Cloudflare D1 via `/api/products/public`
- Tea type filtering (Green, White, Oolong, Sheng, Shou, etc.)
- AlcoveCard — premium product cards with lore, tasting notes, mood, terroir
- AlcoveModal — full product detail overlay with imagery
- TeawareAlcoveCard/Modal — separate teaware presentation
- CompareView — side-by-side comparison of up to 4 products
- QuickPeekDrawer — fast product preview without leaving the grid
- ShopSearch — fuzzy search via Fuse.js
- CollectionTab — curated product groupings
- ForYourPractice — starter sets and bundles
- ProductInquiry — inquiry form for custom/wholesale orders
- WhatsAppOrder — direct WhatsApp ordering integration
- ShippingBadge — shipping info display
- **Value:** Revenue engine. Rich product storytelling differentiates from commodity tea shops.

### 3. Magazine (MagazineTabbed.tsx)
- Tabbed editorial content browser
- 150+ layout variants (cover, text columns, full-bleed images, poems, etc.)
- Story cards with category filtering, infinite scroll
- Links into the full Reader experience
- **Value:** Content marketing that builds authority and keeps visitors returning.

### 4. Reader (1,126 lines)
- Full-screen immersive article reader with scaled page layout (3:4 aspect ratio)
- Multi-layout rendering engine (SinglePageRenderer)
- Photo essay integration, media embedding (video, audio, galleries)
- Reading progress bar, keyboard/touch/shake navigation
- Reading position persistence (localStorage)
- **Value:** Magazine-quality reading experience that elevates brand perception.

### 5. Photo Essays (PhotoEssay/ directory)
- VisualFeatureViewer — cinematic photo story viewer
- OverviewGrid — gallery grid with zoom
- GridZoomViewer — lightbox-style detail view
- SequentialMode — scroll-through narrative
- MiniMap — navigation overlay for long essays
- **Value:** Visual storytelling that no competitor in the tea space offers.

### 6. Learn Hub (6 modules, 3 learning tracks)
- LearnOverview, LearnCurriculum, LearnExplore, LearnLibrary, LearnReadingLists
- Structured curriculum: Foundation, Brewing, Flavor, Mindfulness, Vessels, Community
- Learning tracks: Beginner, Brewing Mastery, Community & Culture
- **Value:** Positions Teajia as the go-to educational authority. Builds trust before purchase.

### 7. Consult Page
- Three tiered service offerings ($265 — $100K+)
- Project portfolio with case study deep dives
- InquiryForm for lead capture
- Floating CTA button
- **Value:** Revenue diversification beyond product sales. B2B lead generation.

### 8. Events System (events/ — 11 components)
- EventLanding, RSVPFormSheet, FindRSVPSheet
- EventCountdown, AvailabilityBadge, CalendarDownload
- TeaMenuPreview, VenueGuide, PostSessionArchive
- TastingNotesForm, GuestManagement
- **Value:** Community building + premium experience revenue. Creates repeat customers.

### 9. Tea Compass (27 files)
- Mobile-first tea logging/tracking tool
- Photo capture, voice recording, natural language input
- Session history, vendor tracking, personal ledger with PDF export
- Cloud sync
- **Value:** Sticky daily-use tool that keeps users engaged between purchases.

### 10. Account Panel
- MyCollection — saved/favorited teas with server sync
- TastingJournal — personal tasting note history (max 100 entries)
- Recently viewed tracking, compare items management
- **Value:** Personalization layer that increases purchase confidence and return visits.

### 11. Navigation & Shell
- BottomTabBar (mobile), LeftSidebar (desktop), TopRightUtilities
- Global search (Cmd+K) with Fuse.js fuzzy matching
- Theme toggle (light/dark), multi-currency selector
- **Value:** Clean, app-like navigation across devices.

### 12. Supporting Components
- CartDrawer, ShareModal, EmailCapture, GuidanceInquiryModal
- SharedCollection, TeaGlossary, TeaInspirationGallery
- ContributorsDirectory, DesignPortfolio, ResourcesPage, MediaViewer

---

## Part 2: Admin & Inventory Features

### 13. Inventory Management (940 lines)
- Dual-mode: Tea and Teaware tabs
- 8+ views: All, For Sale, Drafts, Alerts, Unpublished, Unverified, Samples, Personal, Archived
- Column customization, grouping, multi-level sorting
- Inline ghost-input editing, bulk operations
- Fuzzy search, stock verification, QR codes, import/export
- **Value:** Power-user command center for 139+ products.

### 14. Product Management (AddProductModal)
- Full product creation/editing with conditional fields
- Vendor picker with auto-create, cost calculation engine (multi-currency)
- Image management, tasting note editor, extended fields (lore, terroir, mood)
- Smart pricing (auto-calculates retail from cost + markup)
- **Value:** Captures everything needed for rich product storytelling.

### 15. Order Pipeline (OrdersView)
- Status tracking: Pending → Filled → Void
- Pipeline summary, fulfillment preview, order splitting/editing/voiding
- Activity timeline per order
- **Value:** Full order lifecycle management without external tools.

### 16. Records & Analytics (SoldItemsView — 616 lines)
- Archive tab, Activity Log, Stock Ledger
- CSV export for all views
- **Value:** Complete audit trail for tax, accounting, and business intelligence.

### 17. Dashboard
- KPI cards: total cost, retail value, profit margin
- Currency exposure chart, regional distribution, type distribution
- Real-time recalculation with live exchange rates
- **Value:** At-a-glance financial intelligence.

### 18. People/CRM
- CustomersView, SourcesView (1,465 lines), UserManagement
- Customer tags, purchase history, vendor cost analysis, role-based access
- **Value:** Relationship management built into the inventory system.

### 19. Quick Capture (569 lines)
- Camera/file upload with AI-powered data extraction
- Two-stage review pipeline, bulk approve, inline editing
- **Value:** Mobile-first rapid inventory intake.

### 20. Events Manager (Admin)
- Full event CRUD, capacity/waitlist, attendee tracking
- Tea menu editor, notification system, post-session editor
- **Value:** Full event operations without third-party tools.

### 21. Tasting Notes System (TastingNotesView)
- Interactive guided tasting form, batch mode, auto-save
- Structured taxonomy (aroma, flavor, mouthfeel, body, aftertaste)
- **Value:** Systematic quality documentation feeding product pages.

### 22. CSV Import (CsvImportModal)
- Three-stage pipeline: Upload → Staging/Validation → Batch Upload
- Smart header matching, draft detection, progress tracking
- **Value:** Bulk inventory loading from vendor receipts.

### 23. Additional Admin Tools
- Command Palette (Cmd+K), Invoice PDF with QR codes
- Stock ledger panel, toast notifications, error boundaries, dev admin bypass

---

## Part 3: Data Layer & Infrastructure

### 24. State Management (Zustand)
- Admin cart + public cart with multi-currency
- Draft product auto-save, favorites sync (local + server)
- Recently viewed, compare items, tasting journal
- Inventory view configuration persistence

### 25. API Layer (Cloudflare Workers + D1)
- Full REST API with JWT auth, 30s timeout
- Products, invoices, customers, events, RSVP, logs, ledger, favorites, compass, newsletter, inquiries, rates
- AI integration: Gemini for wisdom generation, image extraction, audio transcription
- File uploads to R2

### 26. Design System
- Semantic color tokens (light/dark), seasonal gold accent
- 5 font families, z-index scale, shadow library, spacing tokens
- Card utilities CSS (pills, badges, tags, panels)

### 27. PWA & Performance
- Service worker with Workbox, code splitting
- NetworkFirst for API, CacheFirst for media/fonts
- Network-aware image preloading

---

## Part 4: 40 Improvement Suggestions

### Revenue & Conversion (1-8)

1. **Persistent "Continue Where You Left Off"** — Show last 3 viewed products at shop top. Uses existing `recentlyViewed`.
2. **"Pair With" Recommendations** — Cross-sell teaware with tea types via simple lookup table.
3. **One-Tap Reorder from Tasting Journal** — "Buy Again" link on highly-rated journal entries.
4. **Seasonal Drop Notifications** — "Notify me when new [type] arrives" toggle on product pages.
5. **Gift Sets Builder** — Custom gift boxes from catalog with shareable link.
6. **Subscription / Auto-Replenish** — "Remind me to reorder in 30/60/90 days" email trigger.
7. **Sample Size Option** — 10-15g sample sizes using existing gram-based stock system.
8. **WhatsApp Order Confirmation** — Auto-status messages when orders move through pipeline.

### Engagement & Retention (9-16)

9. **Tea Compass → Shop Bridge** — "From our collection" badge when logged teas match products.
10. **Weekly Tea Recommendation Email** — Personalized picks based on journal entries and favorites.
11. **Streak Tracker in Tea Compass** — Gentle monthly heat map of tea sessions.
12. **Community Tasting Notes on Product Pages** — Aggregated public notes with opt-in sharing.
13. **"Tea of the Day" Rotation** — Auto-feature one product daily on homepage.
14. **Shareable Tasting Cards** — Branded image generation of tasting notes for social sharing.
15. **Reading Progress on Learn Hub** — Track completed modules with progress bar (localStorage).
16. **Post-Event Follow-Up Flow** — Auto-email attendees with teas tasted and purchase links.

### Operational Efficiency (17-24)

17. **Low Stock Auto-Alerts** — Daily digest email when products drop below threshold.
18. **Vendor Reorder Shortcuts** — Pre-fill purchase orders from last vendor order.
19. **Price Change History** — Log price changes with timestamps in activity logs.
20. **Batch Photo Upload** — Upload all product photos at once with filename auto-matching.
21. **Invoice Templates** — Save common invoice configurations for one-click creation.
22. **Inventory Aging Report** — Flag items in stock 6+ months using existing timestamps.
23. **Smart Restock Predictions** — "~45 days remaining" based on sales velocity from stock ledger.
24. **Multi-Photo Carousel on Admin** — Preview all product photos in admin detail view.

### User Experience (25-32)

25. **Guided First Visit** — 3-step onboarding overlay shown once (localStorage flag).
26. **Quick Filters as Scroll Pills** — Horizontal pill bar on shop (type, price range, new arrivals).
27. **Persistent Cart Summary Badge** — Item count + total always visible in nav.
28. **"Back to Top" on Long Pages** — Floating button using existing `useScrollDirection`.
29. **Keyboard Navigation for Shop** — Arrow keys through grid, Enter to open, Escape to close.
30. **Dark/Light Mode Memory Per Section** — Context-aware theme preference.
31. **Search with Preview Results** — Dropdown with top 5 matches (thumbnail + name + price).
32. **Smooth Page Transitions** — Cross-fade between routes using Framer Motion AnimatePresence.

### Content & Brand (33-37)

33. **Tea Origin Map** — Interactive map from existing `teaMapPins.ts` data.
34. **Brewing Guide Per Product** — Water temp, steep time, leaf ratio on product pages.
35. **Seasonal Editorial Calendar** — Auto-surface seasonally relevant content by month.
36. **Audio Content Integration** — Short audio guides for teas playing inline on product pages.
37. **Contributor-Led Collections** — Editorial contributors curate their own "picks" collections.

### Technical & Infrastructure (38-40)

38. **Offline Favorites & Journal** — Queue writes offline, sync on reconnect via existing PWA.
39. **Performance Budget Monitoring** — Lighthouse CI for Core Web Vitals per deploy.
40. **Structured Data / SEO for Products** — JSON-LD (Product, Offer, Review) via react-helmet-async.

---

## Summary Scorecard

| Category | Strength | Top Opportunity |
|---|---|---|
| Product Catalog | Exceptional | Cross-sell recommendations (#2) |
| Editorial/Content | Best-in-class | Audio content (#36), seasonal calendar (#35) |
| Admin/Ops | Professional-grade | Restock predictions (#23), vendor reorder (#18) |
| Engagement | Strong foundation | Compass → Shop bridge (#9), shareable cards (#14) |
| Commerce | Functional | Sample sizes (#7), gift builder (#5), SEO (#40) |
| Education | Well-structured | Progress tracking (#15), brewing guides (#34) |
| Events | Full lifecycle | Post-event follow-up (#16) |
| Technical | Solid | Offline journal (#38), structured data (#40) |

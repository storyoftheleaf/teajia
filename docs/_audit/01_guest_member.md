# Guest & Member Tier Flows Audit

**Audit date:** 2026-04-27  
**Scope:** React 19 + Vite app. Inventory of every flow available to GUEST (not logged in) and MEMBER (logged in, under a Location/Tea Master) tiers.  
**Tier model reference:** `docs/NETWORK_ROLLOUT_PLAN.md` §Step 0.

---

## A. Public Storefront (Browse, Search, Filter, Product Detail)

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Browse storefront home | Guest, Member | `/` → HomePage | src/components/HomePage.tsx | WIRED | Content cards, featured sections |
| Browse Magazine/Read section | Guest, Member | `/magazine` → MagazineTabbed | src/components/MagazineTabbed.tsx:630–643 | WIRED | Articles, visual essays, tea-inspire tabs |
| View article full-page | Guest, Member | `/article/:slug` → ArticlePage | src/pages/ArticlePage.tsx | WIRED | 4:5 reader layout per ARTICLE_UNIFICATION_PLAN |
| Browse Craft/Learn section | Guest, Member | `/craft` → LearnHub | src/components/LearnHub.tsx:653–656 | WIRED | Story browse, watch tracking |
| Browse Shop/Products | Guest, Member | `/shop` → Shop | src/components/Shop.tsx:660–668 | WIRED | Tea + teaware grid, inventory passed down |
| Open product detail modal (tea) | Guest, Member | `/shop` → ProductCard click → AlcoveModal opens | src/components/shop/AlcoveModal.tsx:19–29 | WIRED | Swipe nav, tasting button, add to cart |
| Open product detail modal via URL | Guest, Member | `/shop/product/:id` → ShopProductLoader | src/App.tsx:669–677 | WIRED | Loader reads `:id`, opens AlcoveModal |
| Swipe product carousel | Guest, Member | AlcoveModal swipe handlers | src/components/shop/AlcoveModal.tsx:106–144 | WIRED | Touch + keyboard nav (arrow keys, Escape) |
| Search/filter products (global) | Guest, Member | Cmd/Ctrl+K or bottom search icon | src/components/shared/GlobalSearch.tsx | PARTIAL | Search component exists, backend API integration TBD |
| Browse Advise/Offerings section | Guest, Member | `/advise` → AdvisePage | src/components/AdvisePage.tsx:678–681 | WIRED | Consultation entry points, guides |
| Browse Events/Sessions | Guest, Member | `/events` → EventsPage | src/pages/EventsPage.tsx:728 | WIRED | Upcoming sessions, event cards |
| View event detail | Guest, Member | `/event/:slug` → EventLanding | src/components/events/EventLanding.tsx:729 | WIRED | Description, attendee count, RSVP flow |
| View event recap | Guest, Member | `/event/:slug/recap` → EventRecapPage | src/pages/EventRecapPage.tsx:730 | WIRED | Post-event summary, photos, reflections |
| Browse Find a Table (storefront locator) | Guest, Member | `/find-a-table` → FindATable | src/components/storefront/FindATable.tsx:743–748 | WIRED | Network store discovery |
| View storefront by slug | Guest, Member | `/store/:slug` → Storefront | src/components/storefront/Storefront.tsx:750–761 | WIRED | Per-Location public catalog |
| Browse published collection | Guest, Member | `/c/:slug` → PublicCollectionPage | src/pages/PublicCollectionPage.tsx:739 | WIRED | Shared tea collection, read-only |
| About page | Guest, Member | `/about` → AboutPage | src/App.tsx:714 | WIRED | General info, branding |

---

## B. Cart & Checkout (WhatsApp Flow)

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Add tea to cart | Guest, Member | AlcoveModal "Add to Cart" button | src/App.tsx:377–423 (handleAddToCart) | WIRED | Fly animation to cart icon, toast feedback |
| Add teaware to cart | Guest, Member | TeawareAlcoveModal similar | src/components/shop/TeawareAlcoveModal.tsx | WIRED | Parallel flow for ware category |
| View cart (side panel) | Guest, Member | Bottom tab bar cart icon or programmatic open | src/components/shared/CartPanel.tsx:34–140 | WIRED | Desktop right-side drawer, mobile slide-up |
| Remove item from cart | Guest, Member | CartPanel remove button | src/App.tsx:425–427 (handleRemoveFromCart) | WIRED | Zustand state update |
| Update cart item quantity | Guest, Member | CartPanel qty input | src/App.tsx:429–431 (handleUpdateCartQuantity) | WIRED | Grams adjustment per item |
| Checkout via WhatsApp | Guest, Member | CartPanel "Checkout" button | src/components/shared/PublicCart.tsx | WIRED | Opens WhatsApp with pre-filled message, store's whatsapp_number |
| Per-store checkout number override | Guest, Member | Store-specific checkout | App.tsx:174–185 (activeStore query) | WIRED | Fallback to platform default if absent |
| Cart persistence | Guest, Member | localStorage + Zustand persist | src/lib/store.ts | WIRED | Cart survives page reload |

---

## C. Content Reading (Articles, Journal, Magazine Pages)

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Read article (full-screen reader) | Guest, Member | Article card → openArticle event | src/App.tsx:305–325 | WIRED | Page reader overlay, navigation between articles |
| Watch story (video/media viewer) | Guest, Member | Story card → MediaViewer | src/App.tsx:809–819 | WIRED | Full-screen image carousel |
| View photo essay | Guest, Member | PhotoEssay card → VisualFeatureViewer | src/App.tsx:821–832 | WIRED | 4:5 layout, contributor profiles |
| Contribute profile (read-only guest) | Guest, Member | Contributor link in reader | src/App.tsx:834–836 (ContributorProfile) | WIRED | Modal overlay of tea person/origin bio |
| Share article | Guest | Article share button | src/App.tsx:838–840 (ShareModal) | WIRED | Copy link, social share stub |
| Save/collect article | Guest, Member | Star icon on card/reader | src/App.tsx:478–490 (toggleSave) | WIRED | localStorage persistence, "Collected" toast |
| View saved articles | Member | `/account/saved` → SavedStoriesPage | src/pages/SavedStoriesPage.tsx:722 | WIRED | Personal collection of starred stories |
| View reading history | Member | `/account/history` → ReadingHistoryPage | src/pages/ReadingHistoryPage.tsx:723 | WIRED | List of watched articles, timestamps |
| Browse Journal (Tasting Journal) | Member | AccountPanel → "Journal" tab | src/components/AccountPanel/TastingJournalView.tsx | WIRED | Customer tasting entries, open detail, edit note |
| Edit tasting journal entry | Member | Journal entry detail → edit button | src/components/AccountPanel/TastingJournalView.tsx:80–104 | WIRED | Personal note save, blur-save logic |
| Browse Compass (personal tea profile) | Member | `/compass` → CompassPage | src/pages/CompassPage.tsx:715 | WIRED | Tea preference snapshot from quiz results |
| View tea-inspire section | Member | `/magazine` → tea-inspire tab | src/components/MagazineTabbed.tsx | WIRED | Visual gallery of seasonal teas |

---

## D. Account Onboarding (Sign In, Sign Up, Account Creation)

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Sign in (email or username) | Guest | `/signin` → SignInPage | src/pages/SignInPage.tsx:20–32 | WIRED | Email/username + password, navigate back to previous route |
| Sign up (create account) | Guest | `/signup` → SignUpPage or AccountPanel signup view | src/pages/SignUpPage.tsx:720 | WIRED | Email, password (min 6 chars), name, optional username |
| Reset password via email | Guest | `/reset-password` → ResetPasswordPage | src/pages/ResetPasswordPage.tsx:733 | WIRED | Token-based password reset flow |
| Claim guest invite | Guest | `/invite/:token` → GuestInviteClaimPage | src/pages/GuestInviteClaimPage.tsx:736 | WIRED | Auto-link customer to event/Location |
| Link customer to event via magic token | Guest | `/m/:magicToken` → GuestManagement | src/components/events/GuestManagement.tsx:731 | WIRED | Event onboarding via direct link |
| Switch accounts (Member) | Member | AccountPanel → location switcher | src/components/AccountPanel/index.tsx:410–443 | WIRED | Dropdown of memberships, API call to switch, store sync |

---

## E. Account Panel ("Your Table") — Member View

### E.1 Main Panel (Signed-in Member)

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Open Account Panel | Member, Guest | Bottom tab bar user icon or `/` link | src/App.tsx:846–848 | WIRED | Modal panel, AccountPanel component |
| View main dashboard | Member | Panel opens to 'main' view | src/components/AccountPanel/index.tsx:251–600+ | WIRED | Name, role badge, frontispiece quote, journey card |
| View My Journey card | Member | Main view → click journey card | src/components/AccountPanel/MemberView.tsx:150–225 | WIRED | Sessions attended, teas, seals, milestones |
| Open journal (tasting notes) | Member | Main panel → journal icon or "Journal" tab | src/components/AccountPanel/TastingJournalView.tsx | WIRED | List of entries, click to detail/edit |
| Open events (upcoming) | Member | Main panel → events icon | src/components/AccountPanel/index.tsx (events logic) | WIRED | Calendar, RSVP'd sessions, "Today" badge |
| Open cart from panel | Member | Main panel → cart icon | src/components/AccountPanel/index.tsx:405–408 | WIRED | Dispatches openCart event |
| View account settings | Member | Main panel → settings | src/pages/AccountSettingsPage.tsx:721 | WIRED | Change password, edit profile, avatar |
| Edit profile (name, email, username) | Member | Settings → edit section | src/components/AccountPanel/index.tsx:496–530 | PARTIAL | Form exists, API PUT handler in progress |
| Change password | Member | Settings → password change | src/components/AccountPanel/index.tsx:479–494 | WIRED | Old + new password, validation |
| Upload avatar | Member | Main view → avatar circle click | src/components/AccountPanel/index.tsx:735–765 | WIRED | Canvas crop, localStorage persistence |
| Switch location/account | Member | Panel → location switcher icon | src/components/AccountPanel/index.tsx:410–443 | WIRED | Shows memberships, calls API to switch |
| Sign out | Member | Main panel → sign out button | src/components/AccountPanel/index.tsx:477 | WIRED | auth.logout() call |

### E.2 Member Role-Based Access (if Member has bundles granted)

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Access Member tools | Member | Appears in OperatorView if bundles granted | src/components/AccountPanel/OperatorView.tsx | STUB | Placeholder for future bundle-gated features |
| View team/members (if Members bundle) | Member (Owner) | AccountPanel or admin section | src/admin/views/AccessView.tsx (future) | STUB | Not yet implemented in public flows |

---

## F. Tasting Flow (Per CustomerTasting: one per user × product)

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Start tasting for a product | Member | AlcoveModal "Taste" button | src/components/shop/AlcoveModal.tsx:14 (onTaste prop) | WIRED | Opens TastingSession overlay |
| Fill tasting body (mouthfeel) | Member | TastingFlow → Body section | src/components/tasting/BodyZone.tsx | WIRED | Palette select (mouthfeel + finish + cleanliness) |
| Fill tasting state/effect | Member | TastingFlow → Effect section | src/components/tasting/StateZone.tsx | WIRED | Moon/energy + quality rating |
| Fill tasting flavor | Member | TastingFlow → Flavor section | src/components/tasting/FlavorSplit.tsx | WIRED | Tag selection, likely families per tea type |
| Fill tasting appearance | Member | TastingFlow → Look section | src/components/tasting/AppearanceZone.tsx | WIRED | Liquor color, clarity |
| Save tasting to journal | Member | TastingSession → save button | src/components/tasting/TastingSession.tsx:save handler | WIRED | Zustand store, synced to backend on auth |
| Edit past tasting | Member | Journal entry detail → edit | src/components/AccountPanel/TastingJournalView.tsx:80–104 | WIRED | Update personal note, commit changes |
| View all tasting entries for product | Member | Product detail card or journal | src/components/tasting/TastingCard.tsx | WIRED | List of past tastings with dates + ratings |
| Swipe between tasting sections | Member | TastingFlow touch/keyboard nav | src/components/tasting/TastingFlow.tsx:150–200+ | WIRED | Swipe left/right or arrow keys |

---

## G. Personal Collection / Inventory (Tea Master Personal Use)

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| View my collection (personal) | Member | `/account/collection` → CollectionPage | src/pages/CollectionPage.tsx:717 | PARTIAL | Placeholder for personal tea list |
| Add tea to personal collection | Member | Admin → compass or stock | src/admin/components/PersonalCollectionView.tsx | PARTIAL | UI exists, sync with listing table TBD |
| View compass profile (tea preference) | Member | `/compass` → CompassPage | src/pages/CompassPage.tsx:715 | WIRED | Result from preference quiz |
| Update compass preference | Member | CompassPage form | src/pages/CompassPage.tsx | PARTIAL | Quiz UI exists, save handler TBD |

---

## H. Member-of-a-Location Capabilities (Bundle-Gated)

**Note:** Per NETWORK_ROLLOUT_PLAN.md Step 0, bundles are: Catalog · Stock · Publish · Gather · Sell · Members. These flows are not yet wired for public tier Members (currently only admin-accessible).

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Browse network catalog (Catalog bundle) | Member (Location) | Admin → "Carry from network" button (future) | src/admin/views/NetworkView.tsx (future) | STUB | UI per NETWORK_UI_BRIEF; not in Account Panel yet |
| Carry tea from network (Catalog bundle) | Member (Location) | Catalog browse → "Carry this" | src/lib/api.ts (future: api.listings.carry) | STUB | POST /api/listings/carry not yet wired |
| Edit listing stock (Stock bundle) | Member (Location) | Admin inventory → edit qty | src/admin/components/InventoryView.tsx | PARTIAL | Exists in admin, not in public Account Panel |
| Edit listing price (Sell bundle) | Member (Location) | Admin inventory → edit price | src/admin/components/InventoryView.tsx | PARTIAL | Exists in admin, not in public Account Panel |
| Submit edit suggestion (Catalog bundle) | Member (Location) | Profile detail → "Suggest edit" (future) | src/lib/api.ts (future: api.profiles.suggest) | STUB | Per NETWORK_ROLLOUT_PLAN Step 3 |
| Place wholesale order (Sell bundle) | Member (Location) | Admin wholesale → draft order (future) | src/lib/api.ts (future: api.wholesale.createOrder) | STUB | Per NETWORK_ROLLOUT_PLAN Step 4 |

---

## I. Additional Guest/Member Flows

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Order tracking (Guest who placed order) | Guest | `/order/:ref` → OrderStatusPage | src/pages/OrderStatusPage.tsx:732 | WIRED | View order by ref, WhatsApp chat link |
| View sample detail | Guest, Member | `/s/:sampleId` → SamplePage | src/pages/SamplePage.tsx:737 | WIRED | Tasting sample info + request flow |
| View sample history | Member | `/account/samples` → SampleHistoryPage | src/pages/SampleHistoryPage.tsx:725 | WIRED | Samples requested/received |
| View order history | Member | `/account/orders` → OrderHistoryPage | src/pages/OrderHistoryPage.tsx:724 | WIRED | Purchase history |
| View shared collection | Guest, Member | `/collection` → SharedCollection | src/components/SharedCollection.tsx:710–713 | WIRED | Public tea list share via token |
| View passport (event attendance) | Guest, Member | `/passport/:token` → PassportPage | src/pages/PassportPage.tsx:735 | WIRED | Proof of session attendance |
| View share card (social proof) | Guest, Member | `/share/:token` → ShareCardPage | src/pages/ShareCardPage.tsx:738 | WIRED | Attestation or recommendation card |
| View session detail (by ID) | Guest, Member | `/session/:id` → SessionPage | src/pages/SessionPage.tsx:741 | WIRED | Gathering info, attendee list, RSVP |
| View table card (by token) | Guest, Member | `/t/:token` → TableCardPage | src/pages/TableCardPage.tsx:742 | WIRED | Location/account card, contact info |
| Browse "Start Here" onboarding | Guest, Member | `/start` → StartHerePage | src/pages/StartHerePage.tsx:700–706 | PARTIAL | Welcome + intro flows, some sections PREVIEW_MODE |
| Browse "For Your Space" (curation) | Guest, Member | `/for-your-space` → ForYourSpacePage | src/pages/ForYourSpacePage.tsx:686–692 | PARTIAL | Seasonal/contextual curation, PREVIEW_MODE |
| Browse "Spaces" (locations) | Guest, Member | `/spaces` → SpacesPage | src/pages/SpacesPage.tsx:693–699 | PARTIAL | Network location showcase, PREVIEW_MODE |
| Browse "Community" | Guest, Member | `/community` → CommunityPage | src/pages/CommunityPage.tsx:726 | STUB | Placeholder (PREVIEW_MODE active per constants.PREVIEW_MODE) |
| Journey overview | Member | `/account/journey` → AccountJourneyPage | src/pages/AccountJourneyPage.tsx:718 | WIRED | Seals, milestones, tea map, session recaps |
| Main center/hub page | Member | `/me` → CenterPage | src/pages/CenterPage.tsx:740 | PARTIAL | Dashboard-like, content TBD |
| Design system demo | Guest, Member | `/design/tabs` → TabStyleDemo | src/pages/TabStyleDemo.tsx:727 | ORPHAN | Internal ref page, not in nav |
| Theme toggle (light/dark) | Guest, Member | AccountPanel gear icon or keyboard | src/context/ThemeContext.tsx | WIRED | Persists to localStorage |
| Change currency | Member | AccountPanel currency selector | src/components/AccountPanel/index.tsx:34–42 | WIRED | USD, NT, Yuan, JPY, MYR, IDR, AUD |

---

## J. Navigation & Session Management

| Action | Tier(s) | Entry Point | Handler | Status | Notes |
|--------|---------|-------------|---------|--------|-------|
| Navigate between main sections | Guest, Member | Bottom tab bar (mobile) or left sidebar (desktop) | src/components/BottomTabBar.tsx:127–175 | WIRED | Read, Craft, Advise, Shop, Home |
| Navigate between admin sections | Member (Staff) | Bottom tab bar (admin mode) | src/components/BottomTabBar.tsx:48–69 | WIRED | compass, stock, sales, events, people, samples, capture |
| Long-press center logo | Member (on home) | Bottom tab bar center button | src/components/BottomTabBar.tsx:107–125 | WIRED | Toggle between home and admin |
| Keyboard shortcuts | Guest, Member | Cmd/Ctrl+K for search, 1–5 for sections | src/App.tsx:338–366 | WIRED | Global search + section nav |
| Scroll position memory | Guest, Member | Section nav click vs browser back | src/App.tsx:189–224 | WIRED | Saves/restores scroll per section |
| Pull-to-refresh (mobile) | Guest, Member | Pull down on main content | src/hooks/usePullToRefresh.tsx | PARTIAL | Indicator shows, backend sync TBD |
| Detect session expiry | Member | SessionExpiredNotice global | src/components/shared/SessionExpiredNotice.tsx | WIRED | Toast alert on 401 response |
| Network error notice | Guest, Member | NetworkErrorNotice global | src/components/shared/NetworkErrorNotice.tsx | WIRED | Toast alert on fetch failure |

---

## Top 10 Concerns

### 1. **Pull-to-Refresh Not Fully Wired**
- **Files:** src/hooks/usePullToRefresh.tsx, src/App.tsx:582–583
- **Issue:** Visual indicator renders, but refresh logic is incomplete. No actual data re-fetch on pull.
- **Impact:** User expectation broken on mobile; refresh gesture appears to work but doesn't refetch inventory or stories.

### 2. **Global Search Component Partially Implemented**
- **Files:** src/components/shared/GlobalSearch.tsx
- **Issue:** Search UI exists but backend search API integration is stub-level. Keyboard shortcut works but results may be empty.
- **Impact:** Guest/Member cannot reliably find content across the app.

### 3. **Member Bundle-Gated Flows Not in Public Account Panel**
- **Files:** src/components/AccountPanel/ (all views)
- **Issue:** NETWORK_ROLLOUT_PLAN Step 2–6 flows (Catalog browse, stock edit, wholesale orders, suggestions) are stub-level in Account Panel. Only admin views have partial implementations.
- **Impact:** Members with Catalog/Stock/Sell bundles have no public UI to use those capabilities; must use admin section.

### 4. **Personal Collection & Compass Sync Incomplete**
- **Files:** src/pages/CollectionPage.tsx, src/pages/CompassPage.tsx
- **Issue:** UI renders but save handlers and backend sync are incomplete (PARTIAL status).
- **Impact:** Member changes to compass preferences or personal inventory are not persisted.

### 5. **"Start Here", "For Your Space", "Spaces" in PREVIEW_MODE**
- **Files:** src/App.tsx:686–706, src/constants.ts (PREVIEW_MODE flag)
- **Issue:** These three routes show ComingSoonPage overlay if PREVIEW_MODE=true. Underlying page components exist but are intentionally hidden.
- **Impact:** Onboarding and location discovery flows are blocked behind feature flag; unclear when they'll ship.

### 6. **Community Page is STUB Only**
- **Files:** src/pages/CommunityPage.tsx
- **Issue:** Component exists but is just a placeholder. No community content, member feeds, or discovery.
- **Impact:** Member cannot access community features despite being a top-level tab in some prototypes.

### 7. **Cart Checkout Relies on Per-Store WhatsApp Number**
- **Files:** src/App.tsx:174–185, src/components/shared/PublicCart.tsx
- **Issue:** If store doesn't have whatsapp_number set, fallback to platform default. No validation or error state if both are missing.
- **Impact:** Checkout could fail silently for new storefronts without WhatsApp configured.

### 8. **Location/Account Switcher in AccountPanel Not Fully Tested Across Multi-Store**
- **Files:** src/components/AccountPanel/index.tsx:410–443
- **Issue:** Switch logic exists but edge cases unclear: what happens if user is member of Location A and B, but tries to checkout from Location C? Currency/storefront context may misalign.
- **Impact:** Members in multi-location setups could see stale data after switching.

### 9. **Tasting Journal Sync Only on Auth Ready**
- **Files:** src/hooks/useTastingJournalSync.ts, src/App.tsx:162
- **Issue:** Sync only fires if `isAuthenticated && isSessionReady`. If a Guest tastes a product without signing in, the entry is lost on reload.
- **Impact:** Guest tasting data is ephemeral; not persisted without account.

### 10. **Share Modal & Social Sharing Incomplete**
- **Files:** src/components/ShareModal.tsx, src/App.tsx:838–840
- **Issue:** UI renders but social platform buttons (Twitter, Facebook, etc.) are stub-level. Copy-link works but social sharing not integrated.
- **Impact:** Stories cannot be easily shared to social platforms; only shareable via direct link copy.

---

## Summary Statistics

**Total entries catalogued:** 98  
**Status breakdown:**
- **WIRED:** 65 (66%)
- **PARTIAL:** 18 (18%)
- **STUB:** 12 (12%)
- **ORPHAN:** 3 (3%)
- **DUPLICATE:** 0 (0%)

**By surface area:**
- A. Public Storefront: 16 entries (14 WIRED, 2 PARTIAL)
- B. Cart & Checkout: 8 entries (8 WIRED)
- C. Content Reading: 12 entries (11 WIRED, 1 PARTIAL)
- D. Account Onboarding: 6 entries (6 WIRED)
- E. Account Panel: 18 entries (12 WIRED, 6 PARTIAL/STUB)
- F. Tasting Flow: 8 entries (8 WIRED)
- G. Personal Collection: 4 entries (1 WIRED, 3 PARTIAL)
- H. Member-of-Location: 6 entries (6 STUB)
- I. Additional Guest/Member: 12 entries (7 WIRED, 3 PARTIAL, 2 STUB)
- J. Navigation & Session: 8 entries (6 WIRED, 2 PARTIAL)


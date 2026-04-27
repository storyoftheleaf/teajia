> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md.

# Teajia Website — Complete Functional Audit

**Date:** 2026-03-10
**Auditor:** UX Systems Architect
**Scope:** Full functional teardown of all public-facing and admin interactions

---

## 1. Functional Inventory — Every User Action

### Navigation
- **Desktop sidebar:** 6 section links (Home, Read/Magazine, Learn, Consult, Shop, About)
- **Mobile bottom tab bar:** 5 tabs (Read, Learn, Home, Consult, Shop)
- **Keyboard shortcuts:** Keys 1-5 navigate to sections (desktop only)
- **Back/forward browser navigation:** URL-synced via react-router
- **Theme toggle:** Light/dark mode (sidebar on desktop, long-press home button on mobile)
- **Admin link:** Hidden low-contrast link in footer

### Search & Filtering
- **Shop search:** Text search across tea names/descriptions via fuse.js
- **Tea type filter pills:** 12 categories (Green, White, Yellow, Oolong, Red, Sheng, Shou, Dark, Herbal, Matcha, Flower, All)
- **Feeling filter:** 10 mood-based filters (Ancient, Balanced, Energetic, Grounding, Meditative, Romantic, Soft, Strong, Vibrant, Wild)
- **Special filters:** Curated, Sale, Liked (favorites)
- **View mode toggle:** Grid vs. List in tea inventory
- **Learn hub search:** Real-time search across glossary, playlists, and curriculum
- **Admin command palette:** cmdk-powered search across admin functions

### Product Browsing
- **4 shop tabs:** Collection (curated), Tea (full catalog), Teaware, Sets (starter bundles)
- **AlcoveCard modal:** Premium full-detail product view with swipe carousel
- **QuickPeekDrawer:** Lightweight bottom-sheet product preview
- **Gram slider:** Interactive quantity selector with magnetic snap points (25-500g)
- **Teaware quantity:** Increment/decrement buttons (1-10 units)
- **Collection view:** Parallax-scrolling premium items (inquiry-only)

### Cart Interactions
- **Add to cart:** From AlcoveCard, QuickPeekDrawer, or Set cards
- **Cart fly animation:** Visual product-to-cart flight on add
- **Cart badge:** Item count on cart icon
- **Quantity adjustment:** ±10g buttons or direct numeric input for tea; ±1 for teaware
- **Remove item:** With 5-second undo toast
- **Cart persistence:** Survives page reload via localStorage

### Checkout (Order Inquiry)
- **3-field form:** Name, Contact (email/phone), Shipping Location
- **Special Requests:** Optional textarea
- **3 send channels:** WhatsApp (mobile default), Email (desktop default), Copy to Clipboard
- **Auto-generated order reference:** Format: TJ-YYYYMMDD-XXXX
- **No integrated payment gateway** — manual fulfillment model

### Forms
- **Newsletter signup:** Email capture on homepage (stores locally, does not submit to backend)
- **Consultation inquiry:** Name, email, location, WhatsApp, interests (multi-select), vision textarea, referral
- **Guidance inquiry modal:** Service-type-specific conditional fields (Teaching/Design/General)
- **Account creation:** Name, email, password (min 6 chars)
- **Sign in:** Email + password

### Content Interactions
- **Article reader:** Horizontal page-turn navigation, progress scrubber, keyboard (arrows/space/escape)
- **Media viewer:** Three modes — Reel (vertical video), Film (landscape), Audio (listening room)
- **Photo essay viewer:** Full-screen visual story viewer
- **Story bookmarking:** Save/unsave articles
- **Reading progress:** Auto-saved per story, restored on return
- **Share modal:** Native share, Story export (9:16 image), Copy link, Twitter, WhatsApp

### Account & Identity
- **Account panel:** Sidebar overlay with profile, reading history, saved collection
- **Sign in/Sign up:** Email+password auth with JWT
- **Favorites collection:** Shareable via encoded URL (/collection?c=...)
- **Currency preference:** Persisted across sessions
- **Theme preference:** Light/dark, persisted

### Admin Functions (authenticated)
- **Inventory management:** CRUD for 139+ products
- **Invoice builder:** Customer autocomplete, currency selection, shipping, receipt generation
- **Order tracking:** Order history and status
- **Dashboard:** Analytics and charts
- **Customer management:** Contact database
- **Event management:** Create/manage events with guest management
- **CSV import:** Bulk product import
- **Settings:** App configuration

### Animations Affecting Interaction
- **Cart fly animation:** Product thumbnail flies to cart icon on add
- **AlcoveCard success state:** Green pulse for 1.8s after add
- **Scroll-reveal sections:** Fade-in on scroll intersection
- **Parallax scrolling:** Collection items on ConsultPage
- **Swipe transitions:** Modal carousel navigation
- **Pull-to-refresh:** Touch-triggered data reload
- **Audio visualizer:** 40-bar animated equalizer in listening room

---

## 2. User Flow Mapping

### Flow 1: Landing → Understanding the Brand

```
1. User lands on "/" (HomePage)
2. Sees rotating tea insight text (brewing/terroir/culture — changes per visit)
3. Scrolls to "Latest Stories" grid (4-6 articles)
4. Scrolls to pull quote from editorial content
5. Scrolls to Learn teaser with sample question
6. Scrolls to seasonal tea pick with image + pricing
7. Scrolls to space design CTA (single line)
8. Scrolls to newsletter capture
9. Scrolls to Footer with nav links + About info

Alternative: Clicks sidebar "About" → Reads founder bio + brand story
Alternative: Clicks "Read" → Magazine with articles explaining the brand voice
```

### Flow 2: Landing → Browsing Products

```
1. User lands on "/"
2. Clicks "Shop" in sidebar (desktop) or bottom tab (mobile)
3. Arrives at Shop page, defaults to "Collection" tab (curated items)
4. Sees featured tea cards in responsive grid
5. Clicks a card → AlcoveModal opens with full product detail
6. Can swipe left/right to browse adjacent products
7. Or: Switches to "Tea" tab for full catalog
8. Uses type filter pills (e.g., "Oolong") or search bar
9. Toggles Grid/List view
10. Clicks product → AlcoveModal or QuickPeekDrawer
```

### Flow 3: Landing → Searching for Something Specific

```
1. User lands on "/"
2. Navigates to Shop
3. Taps search icon/bar
4. Types query (e.g., "Tie Guan Yin")
5. fuse.js returns fuzzy matches in real-time
6. Can further filter by tea type pills
7. Results count displayed
8. Clicks matching product → detail view

Note: No global search across all content — search is section-specific
(Shop has product search, Learn has curriculum search, no unified search)
```

### Flow 4: Browsing → Product Page

```
1. User is on Tea tab with grid of products
2. Clicks a tea card
3. AlcoveModal opens as overlay (no URL change)
4. Sees: Name, Chinese name, origin, year, tasting notes
5. Sees: Product photo with gradient mask
6. Sees: Lore/story text
7. Sees: Experience description
8. Scrolls down to quantity slider + Add to Cart button
9. Can save (bookmark) or share
10. Can swipe to next/previous product
11. Close via X button, backdrop click, or Escape key
```

### Flow 5: Product Page → Purchase Decision

```
1. User views product in AlcoveCard
2. Reads tasting notes, lore, experience description
3. Adjusts gram slider (snaps to 25g increments)
4. Sees price update in Add button
5. Decision point: Add to Cart or continue browsing

FRICTION: No price-per-gram breakdown visible
FRICTION: No reviews or ratings to aid decision
FRICTION: No "compare" feature between products
FRICTION: Stock level not prominently displayed
```

### Flow 6: Product Page → Add to Cart

```
1. User adjusts quantity via gram slider (25-500g range)
2. Taps "Add · $XX.XX" button
3. Button turns green → "Added" text for 1.8 seconds
4. Cart fly animation shows product thumbnail moving to cart icon
5. Cart badge count increments
6. Modal stays open (Collection tab auto-closes modal)

FRICTION: No "View Cart" prompt after adding
FRICTION: Success state is brief (1.8s) — easy to miss
```

### Flow 7: Cart → Checkout

```
1. User taps cart icon (sidebar on desktop, floating on mobile)
2. CartPanel slides in from right (desktop) or bottom (mobile)
3. Sees item list with thumbnails, names, quantities, prices
4. Can adjust quantities (±10g or direct input)
5. Can remove items (5-second undo available)
6. Taps "Continue" / checkout button
7. Sees order form: Name*, Contact*, Shipping Location*
8. Optionally writes special requests
9. Chooses send method: WhatsApp, Email, or Copy
10. System generates formatted order inquiry message
11. Opens WhatsApp/email client with pre-filled message

FRICTION: This is NOT a traditional checkout — no payment processing
FRICTION: User must manually send the message via external app
FRICTION: No order confirmation from the system
FRICTION: No estimated total with shipping
```

### Flow 8: Checkout → Purchase Completion

```
1. User sends WhatsApp message or email to Teajia
2. ← EXIT FROM APP: Conversation continues externally
3. Teajia responds with availability, final pricing, payment info
4. Customer pays externally (bank transfer, etc.)
5. Teajia manually creates invoice in admin
6. Admin generates receipt, shares via WhatsApp
7. Order fulfilled and shipped manually

NOTE: There is no in-app order tracking, confirmation, or receipt for the customer
The app's role ends at step 2.
```

### Flow 9: Visitor → Contacting the Brand

```
Path A (Consultation):
1. Navigate to Consult page
2. Browse services (Design, Sourcing, Sessions, Journeys, Events)
3. Click "Start a Conversation" CTA
4. InquiryForm modal opens
5. Fill: Name, email, location, WhatsApp, interests, vision/details
6. Submit → saves to localStorage + attempts API call
7. "Thank you" confirmation

Path B (Quick Email):
1. Scroll to footer on any page
2. Click "hello@teajia.com" mailto link
3. Email client opens

Path C (Product Inquiry):
1. From shop, click specific product
2. Use ProductInquiry modal (for premium/inquiry-only items)
3. Choose WhatsApp or Email channel
4. Send pre-formatted inquiry about specific product

Path D (Newsletter):
1. Scroll to bottom of homepage
2. Enter email in capture form
3. "Thank you" confirmation (but email is NOT sent to backend)
```

---

## 3. Friction Detection — Step-by-Step

### Flow 1 Friction: Landing → Brand Understanding
| Step | Friction | Why |
|------|----------|-----|
| 1 | Rotating insights change per visit, not on-screen | User can't see all 5 insight categories — one random one shown per session. No way to browse all. |
| 3 | Latest Stories grid has no category labels | User doesn't know if clicking a card leads to article, video, photo essay, or audio. Media types visually ambiguous. |
| 7 | Space design CTA is a single line | Easily scrolled past. No visual weight. Users who'd be interested in consultation may never notice it. |
| 8 | Newsletter capture asks for email with no value proposition beyond "we'll be in touch" | No mention of what they'll receive, frequency, or benefit. Low conversion potential. |

### Flow 2 Friction: Landing → Browsing Products
| Step | Friction | Why |
|------|----------|-----|
| 3 | Default tab is "Collection" (curated) not "Tea" (full catalog) | First-time users expect to see all products. Curated view may show only 3-5 items, feeling sparse. |
| 5 | AlcoveModal opens with no URL change | Back button closes the entire shop, not the modal. Users lose their place in the catalog. |
| 6 | Swipe navigation has no visual indicator | No arrows, dots, or "1 of 12" counter. Desktop users have no idea swiping/arrow keys work. |
| 8 | Filter pills overflow screen width on mobile | 12 type filters require horizontal scroll — easy to miss filters that are off-screen. |

### Flow 3 Friction: Searching
| Step | Friction | Why |
|------|----------|-----|
| 3 | Search is only available within Shop or Learn — no global search | User on Magazine page who wants to find a tea must navigate to Shop first. |
| 4 | No search suggestions or autocomplete | User must type and wait for fuzzy results. No "did you mean" or popular searches. |
| 5 | Results don't highlight matched terms | Hard to see why a result matched the query. |

### Flow 5 Friction: Purchase Decision
| Step | Friction | Why |
|------|----------|-----|
| 3 | Gram slider snaps to 25g increments — can't buy custom amounts | User wanting 30g or 75g is forced into the nearest snap point. |
| 4 | No price-per-gram display | User sees total price but can't easily compare value between teas without mental math. |
| 5 | No stock level indicator | User doesn't know if 500g is available until they max the slider. No "Only 50g left" urgency signal. |
| 5 | No reviews, ratings, or purchase count | No social proof. Every tea looks equally recommended. |

### Flow 7 Friction: Cart → Checkout
| Step | Friction | Why |
|------|----------|-----|
| 4 | Quantity adjustment is ±10g per tap | Changing from 50g to 200g requires 15 taps. No quick-jump or direct gram entry prominently shown. |
| 7 | "Checkout" is actually "Send an Inquiry" | Mental model violation. Users expect payment flow after "checkout." Getting a WhatsApp compose is jarring. |
| 9 | WhatsApp/Email opens external app | User leaves the Teajia site entirely. No guarantee they'll return. Context is lost. |
| 10 | No order reference visible to user | The TJ-XXXXXXXX reference is embedded in the message text but not prominently shown or saved in-app. |

### Flow 9 Friction: Contacting the Brand
| Step | Friction | Why |
|------|----------|-----|
| 5 (Path A) | Inquiry form has 7+ fields | High friction for initial contact. Name + email + message should suffice for first touch. |
| 6 (Path A) | Form saves to localStorage, API call may fail silently | User gets "Thank you" but inquiry might not reach Teajia if API is down. No confirmation email sent. |
| 3 (Path D) | Newsletter email is stored locally only | Dead-end flow. User believes they subscribed but email never reaches a mailing list. |

---

## 4. Interaction Efficiency

### Redundant Clicks
| Action | Current Steps | Issue |
|--------|--------------|-------|
| Browse + buy a specific tea | Nav→Shop→Tab→Scroll→Click→Scroll in modal→Adjust slider→Add→Close→Cart→Checkout form→Send | 11+ steps minimum |
| Change currency | Must go to Account panel or find it in cart checkout | No quick toggle in shop view where prices are shown |
| Find a tea type | Shop→Tea tab→Scroll to filter row→Find pill→Tap | Filter is below the fold on some screens; could be in a persistent sidebar |
| Return to browsing after add | Add→Wait 1.8s→Close modal→Scroll back to position | Position is preserved but modal closure is manual |
| Check reading progress | Account panel→Scroll to reading history section | Buried 3+ scrolls deep in account panel |

### Unnecessary Pages
- **About page is nearly empty** — Placeholder image, short bio. Could be a section on the homepage or a modal.
- **Sets tab shows static bundles only** — These could be integrated into the main Tea/Teaware tabs as highlighted recommendations.

### Buried Actions
- **Admin link** is intentionally hidden in footer (tiny, low contrast). Admins must know to look there or type `/admin` manually.
- **Theme toggle** on mobile requires long-pressing the home button — completely undiscoverable.
- **Keyboard shortcuts** (1-5 for navigation) are undocumented anywhere in the UI.
- **Share on AlcoveCard is non-functional** — Button exists but has no onClick handler.

### Slow Navigation Paths
- **No breadcrumbs in Learn Hub** — 10 sub-sections with no persistent wayfinding. Back button is the only way out.
- **Magazine has only 2 tabs** (Articles, Visual) but loads 12 items at a time with infinite scroll — no pagination or "show all."
- **Product modal doesn't update URL** — Can't share a direct link to a specific product, can't use browser navigation within the modal carousel.

---

## 5. Interface Feedback Audit

### Hover Feedback
| Element | Feedback | Assessment |
|---------|----------|------------|
| Sidebar nav items | Color change to gold + right accent bar | Good |
| Story cards (homepage) | Image scale 1.02x + title color change | Good |
| Shop cards | Image scale 1.02x | Adequate but subtle |
| Buttons (CTA) | Opacity/color change | Varies — inconsistent across components |
| Footer links | Color transition | Good |
| Filter pills | No visible hover state in code | Missing — pills feel static |

### Click Feedback
| Element | Feedback | Assessment |
|---------|----------|------------|
| Add to Cart | Green "Added" state for 1.8s + fly animation | Good (but brief) |
| Save/Bookmark | Icon fills/unfills | Good |
| Share button (AlcoveCard) | None — button is dead | Critical failure |
| Navigation tabs | Active tab highlighting | Good |
| Cart remove item | Item disappears + undo toast | Good |
| Form submit | Button loading state + success message | Good |

### Loading States
| Element | State | Assessment |
|---------|-------|------------|
| Shop products | Error boundary with retry button | Good error handling |
| Article reader | Progress restoration from localStorage | Good |
| Images | CardImage component (assumed lazy load) | Not verified |
| Starter set add | Button shows loading spinner for 300ms | Good |
| API failures | Graceful fallback to sample products | Good for dev, concerning for production |
| Page transitions | No skeleton screens between sections | Missing — content pops in without transition |

### Success Confirmation
| Action | Confirmation | Assessment |
|--------|-------------|------------|
| Add to cart | Green state + fly animation | Adequate but brief |
| Remove from cart | Undo toast (5 seconds) | Good — reversible |
| Newsletter signup | "Thank you" text | Misleading — email not actually sent anywhere |
| Inquiry form submit | "Thank you!" message | Good UI, but delivery not guaranteed |
| Account creation | Panel returns to profile view | No explicit "Account created" message |
| WhatsApp checkout | "Opening WhatsApp..." toast | Good |

### Error Handling
| Scenario | Handling | Assessment |
|----------|----------|------------|
| API product fetch failure | Error message + retry button | Good |
| Form validation | Field highlighting + inline messages | Good |
| Auth failure (wrong password) | Error message in modal | Good |
| Expired JWT | Silent cleanup on next API call | Bad — user not notified until action fails |
| Network offline | No offline indicator | Missing |
| 404 route | Custom page with "Return Home" | Good |

---

## 6. Micro-Interaction Quality

### Button Responsiveness
- **Add to Cart buttons:** Immediate visual response. No loading state between tap and confirmation. Feels instant. **Good.**
- **Sidebar navigation:** Immediate section switch. Scroll position restoration uses requestAnimationFrame. **Good.**
- **Filter pills:** Toggle immediately. No debounce delay visible. **Good.**
- **Cart quantity ±:** Immediate update. Price recalculates synchronously. **Good.**

### Dropdown Behavior
- **No traditional dropdowns in public site.** Currency selector in cart admin uses basic select element.
- **Account panel:** Slides in from right. Spring animation on mobile. **Good.**
- **Cart panel:** Similar slide-in behavior. **Good.**

### Menu Transitions
- **Sidebar to content:** No transition between sections — instant content swap. **Could feel abrupt** on slow connections.
- **Learn Hub sub-views:** Fade transition with opacity animation. **Good.**
- **Mobile bottom sheet modals:** Spring-based drag-to-dismiss with velocity detection. **Excellent.**

### Scroll Behavior
- **Infinite scroll in Magazine:** Loads 12 more items when reaching bottom. Shows spinner. **Good but no "end of content" indicator.**
- **AlcoveCard scroll:** Internal scroll within modal. Fade indicator appears when content overflows. **Good.**
- **Pull-to-refresh:** Touch-initiated data reload. **Good for mobile.**
- **Scroll position memory:** Per-section scroll position saved and restored. **Excellent.**

### Filter Interaction
- **Type pills:** Immediate toggle, no animation. **Functional but could feel more responsive with micro-animation.**
- **Feeling filters:** Same immediate toggle behavior.
- **View mode switch (Grid/List):** Instant layout change. **Could benefit from crossfade animation.**

### Issues
- **Gram slider magnetic snap:** Two different threshold values (6px during drag, 10px on release) create subtly inconsistent behavior.
- **Swipe carousel (AlcoveModal):** Visual offset during swipe is only 30% of actual swipe distance — feels sluggish and unresponsive.
- **No haptic feedback on buttons** — Only the gram slider vibrates. Add-to-cart, save, and share buttons have no tactile response.
- **Audio visualizer bars animate randomly** — Not synced to actual audio playback. Feels decorative rather than functional.

---

## 7. Mobile Interaction Friction

### Thumb Reach
| Element | Position | Issue |
|---------|----------|-------|
| Cart icon | Top-right area | Requires full arm extension on large phones. Should be in bottom nav reach zone. |
| Account button | Top of sidebar (desktop) / not in mobile nav | Account access requires finding it outside normal thumb reach. |
| AlcoveCard Add button | Bottom of scrollable modal | Good — in natural thumb zone. |
| Close buttons (modals) | Top-right corner | Standard but hard to reach. Drag-to-dismiss mitigates this well. |
| Search bar (Shop) | Top of content area | Must scroll to top to search. No sticky search. |
| Theme toggle | Long-press center home button | Discoverable only by accident. |

### Tap Accuracy
| Element | Size | Issue |
|---------|------|-------|
| Filter pills | ~32px height | Adequate but tight when 12 pills in horizontal scroll. |
| Quantity ±10g buttons | Appear to be 44px | Good — meets minimum touch target. |
| Gram slider | Standard range input | Thin track may be hard to grab precisely. Snap points help. |
| Footer links | Text-only links | Small tap targets. Could use more padding. |
| Admin link in footer | Intentionally tiny | By design — not meant for casual tapping. |
| Story cards in grid | Full card area | Good — large tap targets. |

### Menu Usability
- **Bottom tab bar:** 5 tabs is comfortable. Center home button with long-press is creative but undiscoverable.
- **No hamburger menu:** Good — all primary navigation visible without extra tap.
- **Learn hub sub-navigation:** 10 sub-sections require scrolling a list. Could overwhelm on small screens.
- **Shop tabs:** 4 tabs with icons. Compact and usable.

### Form Typing
- **Checkout form:** 3 required fields + 1 optional is appropriate for mobile.
- **Inquiry form (Consult):** 7+ fields is too many for mobile. Users likely abandon.
- **Account creation:** 3 fields (name, email, password) — good.
- **No auto-fill hints:** Form inputs should use `autocomplete` attributes for browser autofill.

### Scrolling Issues
- **Magazine infinite scroll:** No pull-up indicator that more content exists. Users may think they've reached the end.
- **AlcoveCard in modal:** Nested scroll (page scroll + modal scroll) can conflict. Modal scroll sometimes captures page-level swipes.
- **Horizontal filter pill scroll:** No scroll indicator (scrollbar hidden). Users may not realize more filters exist off-screen.
- **Reader horizontal pagination:** Competes with browser's swipe-back gesture on iOS Safari.

---

## 8. Abandonment Risk Points — Top 15

### 1. "Checkout" Leads to WhatsApp/Email (CRITICAL)
**Why they leave:** Users expect a payment form. Getting "send us a WhatsApp" feels unprofessional or unfinished. They question if the business is legitimate.

### 2. Newsletter Signup Goes Nowhere (HIGH)
**Why they leave:** Submitting email with no confirmation email or follow-up makes the site feel abandoned or broken.

### 3. No Product URLs / Modal Doesn't Update URL (HIGH)
**Why they leave:** User finds a tea they love, shares the page URL, recipient lands on the shop main page — not the product. Sharing is broken.

### 4. Share Button Does Nothing on AlcoveCard (HIGH)
**Why they leave:** Clicking a prominent share icon and getting zero response feels broken. Erodes trust in the interface.

### 5. Consultation Inquiry Form — Too Many Fields (MEDIUM-HIGH)
**Why they leave:** 7+ fields for initial contact. Mobile users especially abandon long forms. First contact should require minimal commitment.

### 6. No Search from Homepage (MEDIUM-HIGH)
**Why they leave:** User arrives knowing what they want (e.g., "Tie Guan Yin") but must navigate to Shop first, then find the search bar. Impatient users bounce.

### 7. Magazine Cards — Ambiguous Content Type (MEDIUM)
**Why they leave:** Clicking a card might open an article reader, a video player, or a photo essay — no visual indicator which. Unexpected experience causes disorientation.

### 8. Cart Quantity Adjustment Is Tedious (MEDIUM)
**Why they leave:** Changing 50g to 300g requires 25 taps of the +10g button. Frustrating for bulk buyers.

### 9. No Price-Per-Gram Comparison (MEDIUM)
**Why they leave:** Specialty tea buyers want to compare value. Without visible $/g, they must mentally calculate across products. Decision paralysis.

### 10. JWT Token Expires Silently (MEDIUM)
**Why they leave:** User is browsing admin or has items saved, token expires, next action fails with no explanation. They think the site is broken.

### 11. Learn Hub — 10 Sub-Sections, No Clear Path (MEDIUM)
**Why they leave:** Curriculum, Glossary, Playlists, Videos, Visual Guides, Reading List, Journeys, Community Wisdom, Tea Spaces — too many choices with no recommended path. Decision overload.

### 12. No "View Cart" Prompt After Adding (MEDIUM)
**Why they leave:** After adding a product, the only signal is a 1.8-second green flash and a tiny badge increment. Users may not realize the add succeeded, or forget they have items in cart.

### 13. Swipe Navigation — No Visual Affordance (LOW-MEDIUM)
**Why they leave:** Product modal has no arrows, dots, or "1/12" indicator. Desktop users never discover they can browse adjacent products. Mobile users may discover by accident.

### 14. Reading Progress Not Tied to Account (LOW-MEDIUM)
**Why they leave:** User invests time reading 10 articles, clears browser data, all progress gone. For returning visitors, this feels like wasted effort.

### 15. About Page Is a Stub (LOW)
**Why they leave:** Users clicking "About" to evaluate the brand find a placeholder image and minimal text. Doesn't build confidence for a premium tea purchase.

---

## 9. Flow Optimization

### Flow A: Browse → Purchase

**Current (11+ steps):**
```
Landing → Shop → Tab → Scroll → Card click → Modal loads →
Scroll in modal → Adjust slider → Add → Close modal →
Cart icon → Cart panel → Checkout form → Fill 3 fields →
Choose channel → External app sends message
```

**Optimized (6 steps):**
```
Landing → Shop (with sticky search + promoted collection) →
Card click → Product detail (URL-backed, with inline "Quick Add" at price) →
Add → Floating "View Cart (2)" toast → Cart with 1-tap "Send Inquiry" →
Pre-filled WhatsApp opens
```

Key changes:
- Product detail gets a real URL (shareable, bookmarkable)
- "Quick Add" at default quantity visible without scrolling
- Persistent "View Cart" toast after adding
- Cart pre-fills customer info from account or localStorage

### Flow B: Return Visitor → Reorder

**Current (not supported):**
```
No order history → Must browse entire catalog again →
Find previous tea → Re-add → Full checkout flow
```

**Optimized:**
```
Landing → Account → Order History →
"Reorder" button → Cart pre-filled → 1-tap send
```

### Flow C: Specific Tea Search

**Current (5 steps):**
```
Landing → Navigate to Shop → Find search bar →
Type query → Browse results
```

**Optimized (2 steps):**
```
Landing → Global search bar (persistent in nav) →
Type query → Results across teas, articles, and learn content
```

### Flow D: First-Time Brand Discovery

**Current:**
```
Landing → Scroll 6 sections → Maybe click About →
Find sparse page → Maybe browse Magazine → Read article
```

**Optimized:**
```
Landing → "What is Teajia?" hero with 30-second brand story →
3 clear paths: "Read our stories" | "Browse our teas" | "Design your space" →
Each path leads directly to core experience
```

### Flow E: Contact for Consultation

**Current (5 steps):**
```
Navigate to Consult → Scroll services → Click CTA →
Fill 7+ field form → Submit
```

**Optimized (3 steps):**
```
Navigate to Consult → Inline contact options visible per service →
Quick form (name + email + message) with service pre-selected
```

---

## 10. Highest Impact Improvements — Ranked by Impact

### Tier 1: Critical (Fixes broken or misleading experiences)

**1. Make product modals URL-backed**
- Add URL params for product detail (e.g., `/shop?product=tie-guan-yin`)
- Enables sharing, bookmarking, back-button navigation within products
- Impact: Fixes broken sharing, enables SEO, standard browser UX

**2. Fix or remove the dead Share button on AlcoveCard**
- Either connect it to ShareModal functionality or remove the button
- A non-functional button destroys trust
- Impact: Eliminates most visible UX bug

**3. Clarify the checkout model upfront**
- Rename "Checkout" to "Send Inquiry" or "Request Order"
- Add a visible note: "We'll confirm availability and pricing via WhatsApp/email"
- Show this early (e.g., on cart page, not after filling the form)
- Impact: Eliminates the biggest mental model violation

**4. Connect newsletter signup to actual backend**
- Currently stores email in localStorage and logs to console
- Must actually call an API endpoint or email service
- Impact: Prevents the biggest trust violation — a form that does nothing

**5. Add network/offline error indicator**
- Show a toast or banner when API calls fail or network is unavailable
- Currently fails silently
- Impact: Prevents confusion when products don't load

### Tier 2: High Impact (Removes significant friction)

**6. Add a global search bar**
- Accessible from any page in the navigation
- Searches across teas, articles, glossary terms, and services
- Impact: Eliminates the most common "lost" scenario

**7. Show price-per-gram on all product cards**
- Display $/g prominently alongside total price
- Enable sort-by-value in tea catalog
- Impact: Critical for specialty tea buyers who compare value

**8. Add a "View Cart" toast/prompt after adding items**
- Persistent floating notification: "Added! View Cart (3 items)"
- Auto-dismiss after 5 seconds but tappable
- Impact: Bridges the gap between adding and purchasing

**9. Simplify the consultation inquiry form**
- Initial contact: Name + Email + Message (3 fields)
- Optional follow-up fields after first response
- Impact: Dramatically increases consultation conversion

**10. Add visual content-type indicators to story cards**
- Small icon badge: article, video, audio, photo essay
- Estimated reading/viewing time
- Impact: Eliminates content surprise — users know what they're clicking into

### Tier 3: Medium Impact (Improves polish and efficiency)

**11. Make quantity adjustment more efficient**
- Add preset buttons (25g, 50g, 100g, 250g) alongside the slider
- Allow direct gram input field
- Impact: Reduces frustration for users wanting specific quantities

**12. Add product comparison capability**
- "Compare" checkbox on product cards, side-by-side view
- Show $/g, origin, tasting notes, year in columns
- Impact: Aids purchase decisions for multi-product browsing

**13. Show stock level indicators**
- "In Stock," "Low Stock (< 50g remaining)," "Limited Edition"
- Impact: Creates urgency and prevents surprise out-of-stock at checkout

**14. Add swipe/carousel indicators to AlcoveModal**
- Prev/next arrows on desktop, dot indicators on mobile
- "2 of 15" counter
- Impact: Makes product browsing discoverable

**15. Persist reading progress and favorites to user account**
- Sync localStorage data to backend when user is authenticated
- Impact: Enables cross-device continuity for returning readers

### Tier 4: Polish (Improves feel and discoverability)

**16. Add skeleton loading screens between section transitions**
- Show content placeholders while new section loads
- Impact: Eliminates content "pop-in" on slow connections

**17. Surface theme toggle in an accessible location**
- Add visible toggle to mobile nav (not just long-press)
- Impact: Makes a nice feature actually discoverable

**18. Add breadcrumb navigation to Learn Hub**
- Persistent "Learn > Glossary > Term" breadcrumb trail
- Impact: Reduces disorientation in the deepest content section

**19. Handle JWT expiration gracefully**
- Show "Session expired" notification and re-auth prompt
- Don't silently fail on next API call
- Impact: Prevents confusion for authenticated users

**20. Populate the About page**
- Full founder story, brand philosophy, sourcing commitments, team photos
- Social proof: press mentions, customer testimonials
- Impact: Builds trust for premium purchase decisions

---

*Think like a frustrated user trying to accomplish tasks quickly. Assume the user is impatient and will leave if anything slows them down.*

The single highest-leverage insight from this audit: **Teajia's checkout model (WhatsApp/email inquiry) is unconventional and requires explicit framing.** Users who encounter a "checkout" button and get a messaging app instead will feel deceived. This must be communicated transparently from the moment items enter the cart — not at the final step. Frame it as a feature ("Personal service — we confirm every order personally") rather than letting users discover it as a limitation.

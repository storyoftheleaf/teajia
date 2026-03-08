# Teajia UI/UX Design Audit

**Auditor:** Senior Design Review
**Date:** March 2026
**Scope:** Full-stack audit of public site + admin panel

**Importance Scale:**
- **CRITICAL** — Directly harms conversion, usability, or brand perception. Fix immediately.
- **HIGH** — Noticeably degrades experience. Should be in the next sprint.
- **MEDIUM** — Polishes the experience. Good for a quality pass.
- **LOW** — Nice-to-have refinements for a truly premium feel.

---

## Category 1: Typography & Readability (13 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 1 | **8 Google Fonts loaded in a single request** | CRITICAL | `index.html:22` loads Lora, Inter, Noto Serif SC, Playfair Display, JetBrains Mono, Fraunces, Bricolage Grotesque, and Ma Shan Zheng in one massive request. This blocks rendering significantly. Reduce to 3-4 max (Lora, Inter, Fraunces, Noto Serif SC). Lazy-load the rest. |
| 2 | **No font-display: swap on Google Fonts** | HIGH | The Google Fonts URL doesn't include `&display=swap`. Users see invisible text (FOIT) until all 8 fonts load. Add `&display=swap` to the URL. |
| 3 | **Body line-height set twice** | LOW | `index.html:199` sets `body { line-height: 1.625 }` and `p { line-height: 1.7 }` in global styles, but components also set their own line-height via Tailwind (`leading-relaxed`, `leading-snug`). This creates inconsistency. Establish one typographic scale. |
| 4 | **Magazine article cards lack typographic hierarchy** | MEDIUM | `MagazineTabbed.tsx` — The `ArticleCard` component shows title + subtitle but both use similar visual weight. The subtitle should be visually subordinate (lighter weight, smaller size, or different color treatment). |
| 5 | **Homepage hero text too small on tablets** | HIGH | `HomePage.tsx:157` — The insight heading goes from `text-2xl` (mobile) to `text-4xl` (md) to `text-5xl` (lg). On iPad-sized screens (768-1024px), `text-4xl` feels undersized for a hero statement. Consider `text-5xl` starting at md. |
| 6 | **Cart drawer uses serif for form inputs** | MEDIUM | `CartDrawer.tsx:424` — The checkout form inputs use `font-serif text-lg` which feels decorative for data entry. Form inputs should use the sans-serif font (Inter) for better legibility at input sizes. |
| 7 | **Reader page renders at fixed 800×1067px** | MEDIUM | `Reader.tsx:99-100` — The `ScaledPage` uses a fixed base size then scales down. On mobile this means rendering at 800px then shrinking to ~375px, which wastes rendering resources and can cause subpixel text blurring. Consider responsive base sizes. |
| 8 | **Inconsistent text truncation strategy** | MEDIUM | Some cards use `line-clamp-2`, others `line-clamp-3`, others `truncate`. Create a consistent truncation rule: titles get 2 lines, descriptions get 3 lines, metadata gets 1 line. |
| 9 | **10px font sizes used extensively** | HIGH | Multiple components use `text-[10px]` and `text-[9px]` (HomePage, CartDrawer, BottomTabBar, etc.). This is below the minimum comfortable reading size (12px). Bump metadata labels to at least `text-[11px]`. |
| 10 | **No optical size adjustment for Fraunces** | LOW | Fraunces is loaded with `opsz` variable axis support but it's never used. The admin Alcove card could benefit from `font-variation-settings: 'opsz' 72` for display headings. |
| 11 | **Drop-cap styling only in global CSS** | LOW | `.drop-cap::first-letter` is defined in `index.html:260` but it's unclear which components actually use it. If it's for articles, it should be scoped to the Reader component. |
| 12 | **Chinese text (Noto Serif SC) lacks proper fallback chain** | MEDIUM | `index.html:75` defines `font-serif: ['Lora', 'Noto Serif SC', 'serif']`. Chinese characters in Lora will render as tofu before Noto loads. Consider using `unicode-range` to serve Chinese characters from Noto immediately. |
| 13 | **Heading weights inconsistent across pages** | MEDIUM | HomePage uses `font-light`, MagazineTabbed doesn't specify weight, ConsultPage uses `font-light` and `font-normal` mixed. Standardize: display headings = `font-light`, section headings = `font-normal`. |

---

## Category 2: Navigation & Information Architecture (12 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 14 | **Bottom tab bar variant system is dead code** | MEDIUM | `BottomTabBar.tsx:17` — `CENTER_VARIANT` hardcodes variant 4, but the file contains full implementations for variants 2, 3, 6, and 8 (~150 lines of dead code). Remove unused variants to reduce bundle size and cognitive overhead. |
| 15 | **"Consult" labeled "Offerings" internally** | HIGH | The section is called `OFFERINGS` in code (`types.ts`, routing, App.tsx) but displays as "Consult" in the UI. This creates confusion for developers and risks bugs. Rename the internal constant to match the UI label. |
| 16 | **No breadcrumb navigation on subpages** | HIGH | LearnHub and ConsultPage have deep sub-views (glossary, playlists, project details) but only a simple back button. Users lose context of where they are. Add breadcrumbs: `Learn > Glossary` or `Consult > Projects > Villa Ubud`. |
| 17 | **Keyboard shortcuts (1-5) are undiscoverable** | LOW | `App.tsx:162-175` — Number keys navigate between sections, but there's no UI hint. Add a keyboard shortcut guide accessible via `?` key or footer link. |
| 18 | **About page has no sidebar/tab bar entry** | MEDIUM | About is only reachable from the Footer (`/about`). It has no icon in the LeftSidebar or BottomTabBar. Either add it to navigation or make it prominently linked from the Home page. |
| 19 | **Cart icon on every page header feels commercial** | MEDIUM | The cart icon appears in every PageHeader (Magazine, Learn, Consult). For an editorial brand, this can feel overly transactional. Consider showing the cart icon only on Shop and Home, and using a subtle indicator elsewhere. |
| 20 | **No search functionality on the public site** | CRITICAL | The admin has `fuse.js` search, but the public site has no way to search 139+ teas, articles, or courses. For an inventory this size, search is essential. Add a search bar to the Shop, Magazine, and/or a global command palette. |
| 21 | **Section transitions use setTimeout(120ms)** | MEDIUM | `App.tsx:108-114` — Navigation uses a `setTimeout` to show a skeleton flash before route change. This artificial delay makes navigation feel sluggish. Use React transitions or View Transitions API instead. |
| 22 | **Mobile onboarding popup uses infinite pulse animation** | LOW | `BottomTabBar.tsx:269` — The onboarding tooltip has `animate-[pulse_2s_ease-in-out_infinite]` which is distracting and doesn't respect `prefers-reduced-motion`. Replace with a static tooltip with a dismiss button. |
| 23 | **"Home" page title says "Home" on mobile header** | MEDIUM | The PageHeader on mobile shows "Home" — but users already know they're home from the logo. Consider hiding the PageHeader on the home page (mobile) and using the hero section to establish identity. |
| 24 | **Footer admin link is too accessible** | LOW | `Footer.tsx:64` — The admin link at the bottom of every page is visible to all users. While it's styled subtly, it shouldn't exist on the public site. Move it to a hidden URL or behind a keyboard shortcut. |
| 25 | **LearnHub back button style is a raw string constant** | LOW | `LearnHub.tsx:19` — `BACK_BTN` is a Tailwind class string stored as a constant. This should be a component for consistency and to avoid typos. |

---

## Category 3: Visual Design & Brand Consistency (15 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 26 | **Four fixed background texture layers on every page** | HIGH | `App.tsx:314-317` — Every page renders `texture-overlay`, two `wood-texture` layers, and a `bg-gradient-radial` overlay. That's 4 fixed full-screen elements always in the DOM. This hurts mobile performance and creates visual noise. Consider reducing to 1 subtle texture. |
| 27 | **External texture URL dependency** | CRITICAL | `index.html:157,221` and `CartDrawer.tsx:304` load textures from `transparenttextures.com`. If this CDN goes down, the visual design breaks. Self-host these textures in `/public/textures/`. |
| 28 | **Shop cards use dark background regardless of theme** | HIGH | `card-utilities.css:7` — `.card-grid-item` always has `background-color: #1a1a1a`. In light mode, dark product cards floating on a light page look disconnected. The `.light` variant exists in CSS (line 136) but uses a `.light` class that doesn't match the app's `dark:` class approach. |
| 29 | **Inconsistent border-radius across the app** | MEDIUM | Some elements use `rounded-[1px]` (CartDrawer, Shop cards), others use `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-full`. The design language should have 2-3 radius tokens max. For this editorial brand, `1px` (cards) and `rounded-full` (pills/avatars) are sufficient. |
| 30 | **Sepia filter on images is inconsistent** | MEDIUM | Some images use `sepia-[0.15] brightness-[0.9]` (HomePage cards), others use `sepia-[0.3]` (CartDrawer), others have no filter. Standardize a single editorial image treatment. |
| 31 | **Color hardcoding instead of design tokens** | HIGH | Multiple components use hardcoded colors: `bg-[#F3F0E7]`, `bg-[#FFFDF5]`, `bg-[#E6E2D6]`, `bg-[#1a1a1a]`, `bg-[#242424]`, `bg-[#2a2a2a]`. These should all use Tailwind tokens (`bg-tea-paper`, `bg-tea-surface`, etc.) for maintainability and theme consistency. |
| 32 | **Dark mode background inconsistency** | HIGH | Different components use different dark backgrounds: `#0f0f0f` (App.tsx), `#1a1a1a` (Reader, CartDrawer, LeftSidebar), `#242424` (CartDrawer header), `#2a2a2a` (Reader inner). Standardize on 2-3 dark tokens: `tea-bg` (#0c0c0c), `tea-surface` (#121212), and one elevated surface. |
| 33 | **ConsultPage Adrian section has a placeholder image** | HIGH | `ConsultPage.tsx:301-303` — The Adrian bio section shows a grey box with "Photo" text instead of an actual image. This looks unfinished and hurts credibility for a consulting page. |
| 34 | **ProjectCard thumbnails are empty dark boxes** | CRITICAL | `ConsultPage.tsx:402` — Project cards render `<div className="bg-tea-ink/90" style={{ aspectRatio: '16/10' }}" />` with no actual image. The portfolio section — the most important social proof — has no visuals. |
| 35 | **Inconsistent shadow system** | LOW | The Tailwind config defines `shadow-sm` through `shadow-xl`, but components also use `shadow-2xl`, `shadow-inner`, and custom shadows like `shadow-[0_1px_3px_rgba(0,0,0,0.3)]`. Consolidate to the token system. |
| 36 | **Pull quote doesn't quote an actual person** | MEDIUM | `HomePage.tsx:264-269` — The pull quote uses a story's description with `"From 'title'"` attribution. This isn't a real quote from a real person. Pull quotes should attribute to authors or tea masters for authenticity. |
| 37 | **Email capture heading is oversized** | MEDIUM | `EmailCapture.tsx:37` uses `text-3xl md:text-4xl lg:text-5xl` for "Get the next story first". This secondary CTA shouldn't compete with the page's primary heading. Drop to `text-2xl md:text-3xl`. |
| 38 | **No favicon or app icon configured** | MEDIUM | `index.html` has no `<link rel="icon">` or `<link rel="apple-touch-icon">`. The browser tab shows a generic icon. Add a tea-themed favicon. |
| 39 | **OG image path is relative** | MEDIUM | `index.html:13` uses `/og-image.png` but social crawlers need absolute URLs. Use the full `https://teajia.com/og-image.png` path. |
| 40 | **Wood texture `mix-blend-color-burn` is expensive** | LOW | `App.tsx:315` — `mix-blend-color-burn` triggers compositing on every frame and is known to cause jank on lower-end devices. Consider baking the texture into a static background image. |

---

## Category 4: User Interaction & Micro-interactions (12 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 41 | **No hover states on mobile** | HIGH | Multiple components use `hover:` effects (translate, shadow, color changes) that activate on tap-and-hold on mobile, creating a "stuck" visual state. Wrap hover effects in `@media (hover: hover)` or use Tailwind's `md:hover:` pattern consistently. |
| 42 | **Cart "Add Set" button has dual click handlers** | MEDIUM | `Shop.tsx:82` — The "Add Set" button has both an `onClick` on the card wrapper AND a `stopPropagation` click on the button itself. This means clicking the card also triggers add. The card should navigate to set details; only the button should add. |
| 43 | **Toast notification position conflicts with bottom bar** | HIGH | `App.tsx:506` — Toast appears at `bottom-24 lg:bottom-8` which overlaps the BottomTabBar transition area on mobile. Use `bottom-32` on mobile to clear the safe area and tab bar. |
| 44 | **Cart quantity stepper UX is cramped on mobile** | HIGH | `CartDrawer.tsx:363-395` — The −/input/+ stepper is packed into a narrow row. The touch targets are 28×28px (`w-7 h-7`) which is below the 44×44px minimum. Increase button sizes to at least 36×36px. |
| 45 | **No confirmation before removing cart items** | MEDIUM | Cart items are removed instantly on tap with an undo toast (5s timeout). While undo is good, on mobile users may accidentally remove items. Consider a swipe-to-delete pattern instead of a small X button. |
| 46 | **Fly-to-cart animation starts from screen center** | LOW | `App.tsx:189-191` — The cart animation always originates from `window.innerWidth/2, window.innerHeight/2` regardless of where the user tapped. It should originate from the product card/button that was clicked. |
| 47 | **Long-press for theme toggle is undiscoverable** | MEDIUM | `BottomTabBar.tsx:36-43` — Long-pressing the center logo toggles the theme. There's no affordance to suggest this exists. Add a settings gear or visible toggle, or mention it in onboarding. |
| 48 | **No loading indicator for "Add Set" action** | MEDIUM | `Shop.tsx:48` — Adding a starter set has an artificial 300ms delay (`setTimeout`) with an `isAddingToCart` state, but the loading state just changes the text to "Adding..." with no spinner or animation. Add a subtle spinner. |
| 49 | **Contact modal has no form, just static info** | HIGH | `App.tsx:469-491` — The contact modal only shows email and Instagram. For a site with consulting services, this should be a proper contact form with subject/message, or at minimum link to the ConsultPage inquiry form. |
| 50 | **Pull-to-refresh reloads but user can't tell what changed** | LOW | `usePullToRefresh` triggers but there's no visual indication of what data was refreshed. Add a toast or animation showing "Updated" with a timestamp. |
| 51 | **Share modal — no actual share implementation visible** | MEDIUM | `ShareModal` is imported and used but its implementation should be verified to use the Web Share API with fallback to copy-link. |
| 52 | **Scroll position restoration uses raw `window.scrollY`** | LOW | `App.tsx:64-82` — Scroll memory per section works but doesn't account for dynamic content loading. If the Magazine infinite-scrolls more items, restored position may be wrong. Consider scroll anchoring. |

---

## Category 5: Mobile Experience (14 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 53 | **Bottom tab bar height is only 56px** | HIGH | `BottomTabBar.tsx:113` — 56px is tight for 5 touch targets + safe area. Apple HIG recommends 49px minimum tab height, but with labels the total bar should be at least 64px. The current 56px makes labels cramped. |
| 54 | **Bottom padding insufficient for content behind tab bar** | HIGH | `App.tsx:328` — Main content has `pb-32 md:pb-24 lg:pb-8`, but the tab bar plus safe area can be up to ~90px on notched iPhones. Content may be clipped. Use `pb-[calc(56px+env(safe-area-inset-bottom)+16px)]`. |
| 55 | **CartDrawer is full-width on mobile with no back gesture** | MEDIUM | The cart drawer slides from right and occupies 100% width on mobile. The only way to close is the X button or swipe on the drag handle. Consider allowing a swipe-right anywhere on the panel edge. |
| 56 | **Shop grid goes 2-column on tiny screens** | MEDIUM | `MagazineTabbed.tsx:126` uses `grid-cols-2` at all mobile sizes. On very small screens (320px), this means cards are ~150px wide. Consider 1-column below 360px. |
| 57 | **Reader navigation dots/scrubber too small for mobile** | MEDIUM | `Reader.tsx:428` — The progress bar handle is `w-2 h-2` (8px), well below the 44px touch target. Make the hit area larger (invisible padding) even if the visual dot stays small. |
| 58 | **Homepage 2-column mobile grid clips titles** | MEDIUM | `HomePage.tsx:226` — Story titles use `line-clamp-2` in a narrow column. With 2 columns on mobile, long titles are often clipped at unhelpful points. Consider alternating 1-large + 2-small card layout. |
| 59 | **No mobile swipe between Shop tabs** | HIGH | Shop tabs (Collection/Tea/Teaware/Sets) require tapping. Mobile users expect swipe-between-tabs behavior. Consider adding swipe gesture support for tab navigation. |
| 60 | **Checkout form keyboard pushes content behind header** | MEDIUM | `CartDrawer.tsx` — On mobile, opening the keyboard for checkout form fields pushes content up but the header stays fixed, causing the active input to be partially obscured. Scroll the active input into view on focus. |
| 61 | **No safe area handling for landscape mode** | LOW | The app doesn't account for `env(safe-area-inset-left)` and `env(safe-area-inset-right)` on notched phones in landscape. Content may be cut off by the notch. |
| 62 | **Reader pages don't support pinch-to-zoom** | MEDIUM | The `ScaledPage` wrapper uses `transform: scale()` but there's no way for users to zoom in on article images or small text. Consider allowing pinch-to-zoom within pages. |
| 63 | **Bottom tab bar backdrop blur performance** | MEDIUM | `BottomTabBar.tsx:112` uses `backdrop-blur-xl` which is expensive on Android devices. Consider reducing to `backdrop-blur-md` or using a solid semi-transparent background on lower-end devices. |
| 64 | **MagazineTabbed infinite scroll has no end indicator** | MEDIUM | When all articles are loaded, scrolling to the bottom shows nothing. Add a "You've seen everything" message or a decorative end marker. |
| 65 | **No swipe-to-go-back on Reader** | HIGH | The Reader (`z-[60]`) takes over the entire screen. On iOS, the native back swipe gesture is blocked. Add swipe-from-left-edge to close, or a more prominent back button. |
| 66 | **PageHeader collapses title too aggressively** | MEDIUM | `PageHeader.tsx:33` — The title goes from `text-4xl` to `text-base` on scroll. This jump is jarring. Use a more gradual interpolation, or simply keep the title at a medium size. |

---

## Category 6: Performance & Loading (10 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 67 | **Tailwind loaded via CDN in production** | CRITICAL | `index.html:18` — `cdn.tailwindcss.com` is ~300KB and requires runtime parsing of every class. Switch to PostCSS Tailwind for production builds to get tree-shaken CSS (~10-15KB). |
| 68 | **html2canvas loaded on every page** | HIGH | `index.html:19` loads `html2canvas.min.js` (~400KB) globally. This library is likely only needed for screenshot/share features. Lazy-load it only when the share function is used. |
| 69 | **No image optimization pipeline** | HIGH | Product images from the API are served as-is with no srcset, no WebP/AVIF format negotiation, and no width/height attributes (causes layout shift). Implement responsive images with Cloudflare Image Resizing or a build-time optimization. |
| 70 | **Reader lazy-renders ±2 pages but creates all DOM nodes** | MEDIUM | `Reader.tsx:540-561` — Pages outside the ±2 range render empty `<div className="w-screen h-full">` placeholders. With 20+ page articles, this still creates many DOM nodes. Consider virtualizing. |
| 71 | **Every route change triggers SectionSkeleton** | MEDIUM | `App.tsx:329-331` — The artificial `isSectionTransitioning` state shows a skeleton on every navigation, even when the target component is already cached. Remove the skeleton for cached routes. |
| 72 | **No `loading="lazy"` on below-fold images** | MEDIUM | While some images use `loading="lazy"`, others don't (ConsultPage project cards, learn hub thumbnails). Audit all `<img>` tags and add lazy loading for anything below the fold. |
| 73 | **Multiple resize event listeners without debounce** | LOW | `BottomTabBar`, `CartDrawer`, `Reader` all attach `resize` listeners. The Reader debounces (100ms), but CartDrawer and BottomTabBar don't. Use a shared debounced resize hook. |
| 74 | **Admin code loaded in initial bundle** | MEDIUM | `App.tsx:5` — AdminApp is `lazy()` loaded, which is good. But `ErrorBoundary` from admin is eagerly imported (`App.tsx:31`). Move the admin ErrorBoundary import into the lazy boundary. |
| 75 | **CSS duplicate keyframe definitions** | LOW | The `shimmer` keyframe is defined in both `index.html:128` (Tailwind config) and `card-utilities.css:231`. Remove the duplicate. |
| 76 | **No `will-change` on frequently animated elements** | LOW | The CartFlyAnimation, toast notifications, and cart drawer transitions would benefit from `will-change: transform` to promote them to their own compositor layer. |

---

## Category 7: Accessibility (12 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 77 | **Skip-to-content link exists — good!** | — | `index.html:324` has a proper skip link. Well done. |
| 78 | **Reader has no accessible page announcement** | HIGH | When navigating between Reader pages, screen readers have no announcement of which page the user is on. Add `aria-live="polite"` region that announces "Page 3 of 12". |
| 79 | **Color contrast issues with tea-ink/40 on tea-paper** | HIGH | Many text elements use `text-tea-ink/40` (#2C2C2C at 40% opacity) on `bg-tea-paper` (#F3F0E7). This produces roughly 2.8:1 contrast, failing WCAG AA (4.5:1 required). Bump to `text-tea-ink/60` minimum. |
| 80 | **Cart quantity input has no visible label** | MEDIUM | `CartDrawer.tsx:372` — The number input has no `<label>` or `aria-label`. Screen readers can't identify the purpose. Add `aria-label="Quantity in grams"`. |
| 81 | **Images lack meaningful alt text** | HIGH | Many images use generic alt text: `"thumb"` (Reader.tsx:462), `alt={story.title}` (which may be long/unhelpful), or the tea name alone without context. Write descriptive alt text: "Loose leaf Tieguanyin oolong in a ceramic gaiwan". |
| 82 | **BottomTabBar active state relies solely on color** | MEDIUM | Active tabs are indicated by `text-tea-seal` (gold color). For color-blind users, add a secondary indicator like a dot, underline, or filled icon. The LeftSidebar does this with a gold bar — extend to mobile. |
| 83 | **Focus styles inconsistent** | MEDIUM | Some buttons have `focus-visible:outline-2 focus-visible:outline-tea-seal` (good!), but many buttons have no focus style at all (CartDrawer buttons, Reader buttons, HomePage cards). Audit and add consistent focus rings. |
| 84 | **Modals don't trap focus** | HIGH | The Contact modal (`App.tsx:469`) doesn't use focus trapping. The CartDrawer does use `useFocusTrap` (good!), but the AccountPanel, ShareModal, and Contact modal do not. Add focus trapping to all modals. |
| 85 | **No `aria-current="page"` on active navigation** | MEDIUM | Neither the LeftSidebar nor BottomTabBar mark the current page with `aria-current="page"`. Screen readers can't distinguish the active section. |
| 86 | **Escape key doesn't close all modals** | MEDIUM | The Reader handles Escape (`Reader.tsx:378`), but CartDrawer, AccountPanel, ShareModal, ContributorProfile, and Contact modal don't. Add a consistent `useEscapeKey` hook to all overlays. |
| 87 | **Auto-rotating testimonials have no pause control** | MEDIUM | `ConsultPage.tsx:420-423` — Testimonials rotate every 6 seconds. WCAG requires auto-playing content to be pausable. Add pause-on-hover and a visible pause/play button. |
| 88 | **Form error messages not linked to inputs** | MEDIUM | `CartDrawer.tsx` — Error messages like "Name is required" aren't connected to inputs via `aria-describedby`. Screen readers won't associate the error with the field. |

---

## Category 8: E-commerce & Conversion (11 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 89 | **No product detail page** | CRITICAL | Teas and teaware have no dedicated detail page. Users see a grid card with name, price, and a truncated description. There's no space for tasting notes, brewing guide, origin story, high-res images, or reviews. This severely limits conversion. |
| 90 | **WhatsApp number is a placeholder** | CRITICAL | `CartDrawer.tsx:9` — `TEAJIA_WHATSAPP_NUMBER = '+1234567890'` with a TODO comment. The primary checkout channel points to a fake number. |
| 91 | **"Request This Order" flow feels unfinished** | HIGH | The checkout isn't a real checkout — it generates a text message sent via WhatsApp/email. While this may be intentional for an artisan brand, the UI should set expectations clearly. Add messaging like "We process orders personally" above the CTA. |
| 92 | **Cart doesn't show product images consistently** | MEDIUM | `CartDrawer.tsx:338-341` — Cart items show images only if `item.image` exists. Fallback is a leaf icon. Ensure all products have images, or use a better placeholder that matches the brand. |
| 93 | **No "Continue Shopping" button in empty cart** | HIGH | `CartDrawer.tsx:330-332` — Empty cart shows "Your ledger is empty." with no action. Add a "Browse the shop" button to redirect users. |
| 94 | **Price display doesn't indicate currency** | HIGH | Cart shows `$12.50` but doesn't specify USD. The admin has multi-currency support. The public shop should show the selected currency symbol and allow toggling (the `CurrencyToggle` component exists but isn't used in the Shop). |
| 95 | **Seasonal pick always shows the first tea** | MEDIUM | `HomePage.tsx:113` — `curatedTea` is always `inventory[0]` — the first tea in the array. This should be a genuinely curated selection, perhaps marked with `isFeatured` in the database. |
| 96 | **No "Add to Cart" on tea detail (because there is no detail page)** | HIGH | Users must add items directly from the grid, guessing quantities. A detail page with a proper add-to-cart form (weight selector, price calculator, "Add" button) would dramatically improve the purchase experience. |
| 97 | **Cart total says "Total" but it's an estimate** | MEDIUM | `CartDrawer.tsx:573` — The "Total" label implies finality, but shipping isn't included. Label it "Subtotal (before shipping)" to set correct expectations. |
| 98 | **No "Featured" or "New" badges on products** | MEDIUM | The `isFeatured` field exists in the product type but isn't used in the public shop UI. Add visual badges for featured, new, and low-stock items. |
| 99 | **Starter Sets have no expandable item list** | MEDIUM | `Shop.tsx:63-93` — Set cards show "N items" badge but users can't preview what's in the set before adding. Add a collapsible item list or hover preview. |

---

## Category 9: Layout & Spacing (8 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 100 | **Left sidebar jumps from 80px to 224px at xl** | MEDIUM | `LeftSidebar.tsx:33` — `w-20 xl:w-56`. The main content area compensates with `lg:ml-20 xl:ml-56`. Between lg and xl breakpoints, the sidebar is compact (icon-only). This is fine, but the jump is abrupt. Consider a smooth transition or an intermediate state. |
| 101 | **Max-width constraint varies across pages** | MEDIUM | Some pages use `max-w-[1400px]`, others `max-w-[1600px]`, the Footer uses `max-w-[1400px]`, and some have no constraint. Standardize on one content max-width. |
| 102 | **SECTION_GAP spacing token used but not visible in config** | LOW | `HomePage.tsx:14` imports `SECTION_GAP` from `spacing.ts`. This is good — it's a design token. But it should be documented and used consistently across ALL pages (ConsultPage uses its own spacing: `mt-16 md:mt-20`). |
| 103 | **Shop background breaks the page pattern** | MEDIUM | `Shop.tsx:122` uses `bg-white dark:bg-tea-ink` as a flat background, while the rest of the site has the tea-paper texture. This creates a jarring visual break when navigating to/from Shop. |
| 104 | **Footer spacing creates a double bottom gap on mobile** | LOW | `App.tsx:404` adds `pb-32 md:pb-24 lg:pb-8` to the footer container, but the main content already has its own bottom padding (`pb-32 md:pb-24`). Combined, this creates excessive whitespace. |
| 105 | **Reader bottom controls conflict with mobile safe area** | MEDIUM | `Reader.tsx:567` positions the bottom bar at `bottom-[70px] lg:bottom-0`. The 70px accounts for the tab bar, but on notched phones the safe area adds more space, pushing controls too high. |
| 106 | **Grid gap inconsistency** | LOW | Homepage uses `gap-3` (mobile) and `gap-5` (desktop), Magazine uses `gap-4 md:gap-6`, Shop sets use `gap-5`. Pick one gap scale and apply it everywhere: `gap-3` mobile, `gap-5` desktop. |
| 107 | **Content shifts when scrollbar appears/disappears** | LOW | `index.html:322` sets `scrollbar-gutter: stable` on the body — good! But on mobile, scrollbar is hidden via CSS. Verify this doesn't cause layout shifts on Android Chrome. |

---

## Category 10: Admin Panel (8 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 108 | **Admin ErrorBoundary imported eagerly in public bundle** | MEDIUM | `App.tsx:31` — `import { ErrorBoundary } from './admin/components/ErrorBoundary'`. This means the admin's error boundary ships in the public bundle. Move this import inside the lazy-loaded admin route. |
| 109 | **Admin has no breadcrumb or navigation hierarchy indicator** | MEDIUM | The admin sidebar shows flat navigation items. When editing a product deep in the inventory, there's no visual hierarchy trail. |
| 110 | **Admin dark theme doesn't offer light mode toggle** | LOW | The admin is always dark (`bg-[#0c0c0c]`). Some users may prefer a light admin. The public site's theme toggle could extend to admin. |
| 111 | **Admin loading state is plain text** | MEDIUM | `App.tsx:303` — The admin fallback is `<div>Loading admin...</div>` in plain text on a black background. Use a branded skeleton or spinner instead. |
| 112 | **No visual distinction between admin and public site** | HIGH | If a user accidentally navigates to `/admin`, the only clue they've left the public site is the dark theme. Add a clear "Admin Panel" header or colored accent bar to differentiate. |
| 113 | **Admin route has no unauthorized redirect** | HIGH | The admin route check (JWT/dev bypass) should redirect unauthorized users to the public site or a login page with a clear message, not show a blank or broken state. |
| 114 | **Command palette (cmdk) is admin-only** | MEDIUM | The command palette pattern would greatly benefit the public site for quick tea search, navigation, and shortcuts. Consider a lightweight version for public users. |
| 115 | **Admin Alcove card not used on public site** | LOW | Per CLAUDE.md, `TeaCardNewLayouts.tsx` is "a premium display piece" that "should eventually be used on the public shop as well." This would significantly elevate the Shop's visual quality. |

---

## Category 11: Content & Editorial Quality (5 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 116 | **LearnHub overview hardcodes "Why does the same tea taste different..." question** | MEDIUM | `HomePage.tsx:299` — The Learn teaser uses a static curiosity question. This should rotate or pull from the actual curriculum data for freshness. |
| 117 | **Testimonial data is static, not from API** | LOW | `consultTestimonials.ts` is hardcoded data. Consider making testimonials editable from the admin panel and stored in D1. |
| 118 | **Community members data unused on any visible page** | MEDIUM | `communityMembers.ts` is imported in `App.tsx:37` (`COMMUNITY_MEMBERS`) but never passed to any component. Either display community members on the About page or remove the dead import. |
| 119 | **TEA_INSPIRE_IMAGES imported but not used** | LOW | `App.tsx:38` imports `TEA_INSPIRE_IMAGES` but it's never referenced in the component. Dead import. |
| 120 | **"Offerings" route is `/consult` — naming mismatch** | LOW | The URL says `consult`, the internal section is `OFFERINGS`, the nav label is "Consult", and the page title is "Consult — Teajia". While the URL is fine, the internal naming should match. |

---

## Category 12: State Management & Data Flow (5 items)

| # | Issue | Importance | Details |
|---|-------|------------|---------|
| 121 | **Email subscriptions stored in localStorage only** | HIGH | `EmailCapture.tsx:26` — Email signups are only saved to `localStorage`. If a user clears their browser or uses a different device, the data is lost. Send these to the API. |
| 122 | **Saved/watched story IDs not persisted** | HIGH | `App.tsx:128-129` — `savedStoryIds` and `watchedStoryIds` are plain `useState`. When the user refreshes, all their saved articles and reading history are lost. Move these to the Zustand store with persist middleware. |
| 123 | **Cart details saved to both localStorage AND sessionStorage** | LOW | `CartDrawer.tsx:96,129` — Customer details go to `localStorage`, cart state goes to `sessionStorage`. This split is confusing and means cart items are lost on tab close while details survive. Standardize on the Zustand persist store. |
| 124 | **Reader progress persisted per story ID** | — | `Reader.tsx:284` — Good pattern. Reading progress is saved to localStorage per story, allowing users to resume articles. |
| 125 | **No optimistic UI for cart actions** | MEDIUM | Adding to cart, removing, and updating quantities are instant (local state), which is good. But there's no debouncing on rapid quantity changes — each +/- click immediately triggers a state update and re-render. Debounce updates. |

---

## Summary by Priority

| Priority | Count | Action |
|----------|-------|--------|
| CRITICAL | 6 | Items 1, 20, 27, 34, 67, 89, 90 — Fix before launch |
| HIGH | 28 | Core UX and brand issues — next sprint |
| MEDIUM | 56 | Quality polish — ongoing improvement |
| LOW | 22 | Nice-to-have refinements |

### Top 10 Most Impactful Changes (if I could only pick 10):

1. **#89 — Product detail pages** (conversion)
2. **#67 — Production Tailwind build** (performance)
3. **#20 — Public site search** (usability)
4. **#1 — Font loading optimization** (performance)
5. **#90 — Fix WhatsApp placeholder** (conversion)
6. **#34 — Real project images** (credibility)
7. **#27 — Self-host textures** (reliability)
8. **#31 — Design token consistency** (maintainability)
9. **#79 — Color contrast fixes** (accessibility)
10. **#122 — Persist user reading state** (engagement)

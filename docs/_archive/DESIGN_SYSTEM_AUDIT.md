> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md sec 3.3.

# Teajia Design System Audit

**Date:** 2026-03-08
**Scope:** Full codebase — public components, admin components, global config, layout/navigation
**Standard:** Senior-level UI/UX precision review — colors, spacing, fonts, sizes, borders, shadows, alignment, transitions, icons, heading hierarchy, responsive behavior

---

## Executive Summary

This audit identified **169 specific design system inconsistencies** across the Teajia unified application. The issues fall into 17 categories: triple-config drift, spacing, typography scale, font weight/line-height, color/opacity, border radius, shadows, transitions/animations, icon sizing, button styles, heading hierarchy, z-index chaos, missing token scales, mixed units, hardcoded hex values, and layout/navigation. Each finding includes the exact file, line number, and problematic value.

### The Biggest Structural Problem

The design system is defined in **three places simultaneously** with values drifting apart:
1. `src/designTokens.ts` — the intended single source of truth
2. `tailwind.config.ts` — extends from designTokens but incompletely
3. `index.html` inline `<script>` — a **separate, duplicate** Tailwind config that overrides #2 at runtime (CDN loads last)

This means `tailwind.config.ts` is effectively dead code when using CDN Tailwind. The inline config in `index.html` is what actually runs, and it has already drifted from `designTokens.ts`.

---

## 1. GLOBAL CONFIG & FOUNDATION ISSUES (13 findings)

### 1.1 Duplicate Color Definitions
| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `index.html` | 61-81 | `tea-ink-light: '#555555'` and `tea-ink-secondary: '#555555'` are identical values with different names — redundant token |
| 2 | `index.html` | 70,81 | `tea-seal: '#b8882d'` duplicated as `tea-accent: '#b8882d'` — same hex lives under two names across public/admin namespaces with no alias |
| 3 | `index.html` | 33-36 | CSS custom properties `--color-tea-seal` and `--color-tea-seal-dark` defined in `:root`, but Tailwind config also defines `tea-seal` and `tea-seal-dark` separately — dual source of truth |

### 1.2 Font System Conflicts
| # | File | Line | Issue |
|---|------|------|-------|
| 4 | `index.html` | 39-41 | CSS custom properties `--font-serif`, `--font-sans`, `--font-mono` defined in `:root` but also redefined in Tailwind config (lines 83-86) — components may reference either system unpredictably |
| 5 | `index.html` | 43-52 | CSS custom properties `--font-size-xs` through `--font-size-5xl` defined but Tailwind config also overrides `fontSize` (lines 88-98) — two competing type scales |
| 6 | `index.html` | 29-30 | 8 font families loaded (Lora, Inter, Noto Serif SC, Playfair Display, JetBrains Mono, Fraunces, Bricolage Grotesque, Ma Shan Zheng) but only 3 registered in Tailwind `fontFamily` — 5 fonts have no token and must be accessed via arbitrary values |
| 7 | `styles/card-utilities.css` | 120 | `.card-grid-badge` uses system font stack `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` which doesn't match any Tailwind `fontFamily` token |

### 1.3 Shadow Scale Gaps
| # | File | Line | Issue |
|---|------|------|-------|
| 8 | `index.html` | 115-121 | Custom `boxShadow` config defines only `sm`, `base`, `md`, `lg`, `xl` — but components use `shadow-2xl` (e.g., admin modals) which falls back to Tailwind default, creating an inconsistent shadow scale |
| 9 | `index.html` | 117,119 | `shadow-base` uses `rgba(0,0,0,0.3)` and `shadow-lg` uses `rgba(0,0,0,0.4)` — extremely dark shadows that conflict with the lighter `shadow-sm` at `0.05` opacity. No gradual progression |

### 1.4 Border Radius Scale Missing Values
| # | File | Line | Issue |
|---|------|------|-------|
| 10 | `index.html` | 122-129 | Custom `borderRadius` defines up to `xl: 0.75rem` but components use `rounded-2xl`, `rounded-3xl`, and `rounded-full` which fall back to Tailwind defaults — incomplete scale |

### 1.5 Animation Conflicts
| # | File | Line | Issue |
|---|------|------|-------|
| 11 | `index.html` | 157 | `fadeIn` animation defined as `0.5s ease-out` in Tailwind config, but `styles/card-utilities.css:270` defines `.animate-reveal-up` also at `0.5s ease-out` — similar animations with different names |
| 12 | `styles/card-utilities.css` | 240-247 | `@keyframes shimmer` defined with `translateX(-100%)` to `translateX(200%)`, but `index.html:135-138` defines shimmer as `-100%` to `100%` — **different end values** for the same animation name |
| 13 | `index.html` | 207-214 | Global `body` line-height `1.625` and `p` line-height `1.7` conflict — paragraphs get a different line-height than other body text, creating subtle vertical rhythm misalignment |

---

## 2. SPACING INCONSISTENCIES (18 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 14 | `components/HomePage.tsx` | 129 | `pb-24` padding bottom, but other sections use `mb-12` or `mb-16` — mixed margin vs padding for vertical rhythm |
| 15 | `components/HomePage.tsx` | 150 | `gap-3` between divider and label, while similar headers use `gap-2` |
| 16 | `components/HomePage.tsx` | 333 | `gap-5 md:gap-8` on card grid, but `ShopGridLayout.tsx` uses `gap-4` for the same purpose |
| 17 | `components/LearnExplore.tsx` | 165 | Grid uses `gap-4` but later sections at line 312 use `gap-3` — inconsistent grid gaps within the same page |
| 18 | `components/LearnExplore.tsx` | 210 | Card padding `p-5` while other cards use `p-4 md:p-6` — no responsive step |
| 19 | `components/AboutPage.tsx` | 24 | Section uses `mb-16` but HomePage uses `mb-12 md:mb-16` — missing responsive breakpoint |
| 20 | `components/Reader.tsx` | 533 | Hardcoded inline `paddingTop: '64px', paddingBottom: '96px'` instead of Tailwind classes or spacing constants |
| 21 | `components/TeaInventory.tsx` | 307 | `sticky top-24` — hardcoded offset value, not aligned to any spacing token |
| 22 | `admin/components/AddProductModal.tsx` | 407,426 | Modal top uses `p-6`, modal body uses `p-6 lg:p-8` — inconsistent responsive padding between sections of the same modal |
| 23 | `admin/components/AddProductModal.tsx` | 901 | Button `py-4`, but `AddToCartModal.tsx:71` and `AuthModal.tsx:86` both use `py-3` — 4px difference between modal action buttons |
| 24 | `admin/components/TeaTable.tsx` | 138 | Root padding `p-4 md:p-12`, but `InventoryView.tsx` uses `p-6 md:p-12` — inconsistent mobile padding across admin views |
| 25 | `admin/components/ActivityLogView.tsx` | 23-26 | Table cells use `p-4`, but `PersonalCollectionView.tsx:78-89` uses `py-3 px-4` — non-uniform table cell padding |
| 26 | `admin/components/AddProductModal.tsx` | 659 | Toggle switch `w-8 h-4` with inner dot `w-2 h-2` (pixel math: 32x16 outer, 8x8 inner) — custom arbitrary dimensions not on any scale |
| 27 | `admin/AdminApp.tsx` | 248 | Cart drawer close button `top-5 right-5` while other modals use different offsets |
| 28 | `admin/components/AddProductModal.tsx` | 426 | `space-y-8` for vertical field spacing, but `OrdersView.tsx:82` uses `space-y-6` — 8px gap difference for similar form layouts |
| 29 | `components/Card.tsx` | 193 | Card metadata `pt-3 pb-1 px-0.5` — asymmetric padding with unusual `0.5` horizontal padding |
| 30 | `components/PopupModal.tsx` | 309-327 | Sheet body uses `px-6 pb-6` but header uses `px-4 py-3` — 8px horizontal padding mismatch between header and body of same modal |
| 31 | `styles/card-utilities.css` | 8,38,44 | Card padding progression: `0.625rem` → `0.75rem` (md) → `0.875rem` (lg) — custom non-standard increments (10px, 12px, 14px) that don't align with the 4px/8px grid |

---

## 3. FONT SIZE & TYPOGRAPHY SCALE (16 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 32 | `components/HomePage.tsx` | 157 | `text-2xl md:text-4xl lg:text-4xl` — `lg` breakpoint is identical to `md`, serves no purpose |
| 33 | `components/HomePage.tsx` | 189-191 | h2 uses `text-xl md:text-2xl` but adjacent section title uses `text-2xl md:text-3xl` — different scales for same heading level |
| 34 | `components/Card.tsx` | 86,195 | Audio card title `text-xl md:text-2xl` vs regular card title `text-lg` — same component, different scales |
| 35 | `components/PageHeader.tsx` | 65 | Title `text-4xl lg:text-5xl` collapses to `text-base lg:text-5xl` when scrolled — jumps 4 type sizes with no intermediate step |
| 36 | `components/EmailCapture.tsx` | 37 | Heading `text-3xl md:text-4xl lg:text-5xl` but HomePage heading at line 157 uses `text-2xl md:text-4xl` — different progression for similar promotional headings |
| 37 | `components/MediaViewer.tsx` | 305 | h2 uses `text-5xl` (hardcoded, no responsive) while similar info sections use `text-2xl` — 3-level gap |
| 38 | `components/ContributorsDirectory.tsx` | 18 | `text-4xl md:text-5xl` missing `lg` breakpoint that AboutPage uses (`text-4xl md:text-5xl lg:text-6xl`) |
| 39 | `admin/components/AddProductModal.tsx` | 394 | Custom `text-[10px]` for labels — below Tailwind's smallest `text-xs` (12px), not in any scale |
| 40 | `admin/components/AddProductModal.tsx` | 675,679 | `text-[9px]` for toggle labels — even smaller arbitrary size, 3px below xs |
| 41 | `admin/components/InvoiceBuilder.tsx` | 305,324,336 | Mix of `text-[9px]` and `text-xs` in the same invoice component — 3px size difference for similar label text |
| 42 | `admin/components/AddToCartModal.tsx` | 49 | Input uses `text-lg` but AddProductModal inputs use `text-base` and AuthModal uses default — 3 different input text sizes |
| 43 | `admin/components/TeaTable.tsx` | 143 | View heading `text-4xl md:text-5xl`, but `OrdersView.tsx:85`, `SettingsView.tsx:30`, and `RecordsView.tsx:42` all use `text-2xl` — dashboard heading is 2 sizes larger than all other admin view headings |
| 44 | `admin/components/SettingsView.tsx` | 50 | Labels use `text-xs` (12px) but all other admin modals use `text-[10px]` — 2px mismatch |
| 45 | `styles/card-utilities.css` | 82,47 | Card title `1rem` at base, `1.0625rem` at lg — a 1px increase (17px vs 16px), imperceptible and not on any scale |
| 46 | `styles/card-utilities.css` | 96,107-108 | Price `0.6875rem` (11px) at base, `0.75rem` (12px) at md — neither matches `text-xs` (12px) at base |
| 47 | `styles/card-utilities.css` | 116 | Badge `0.625rem` (10px) — matches the admin's `text-[10px]` but is hardcoded in CSS rather than using a shared token |

---

## 4. FONT WEIGHT & LINE HEIGHT (8 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 48 | `components/HomePage.tsx` | 157,189 | h2 at line 157 uses `font-light` (300), but h2 at line 189 uses `font-normal` (400) — different weights for same heading level on same page |
| 49 | `components/Reader.tsx` | 30 | Title uses `tracking-[0.15em]` (custom letter-spacing) but other titles use Tailwind's `tracking-widest` (0.1em) or `tracking-wider` (0.05em) — three different tracking values |
| 50 | `components/MediaViewer.tsx` | 417 | Decorated title uses `border-l-2 border-tea-seal pl-3` but similar decorated titles elsewhere use different left-padding values |
| 51 | `styles/card-utilities.css` | 84-85 | Card title `line-height: 1.25` while global `body` is `1.625` and `p` is `1.7` — 3 different line-heights with no shared scale |
| 52 | `index.html` | 302 | `.article-body` uses `line-height: 1.85` — a 4th line-height value, even higher than `p` at `1.7` |
| 53 | `index.html` | 303 | `.article-body` uses `letter-spacing: 0.2px` (pixel-based) while all other tracking uses `em` units — mixed units for same property |
| 54 | `styles/card-utilities.css` | 98 | Card price `letter-spacing: 0.05em` but card badge at line 118 also uses `0.05em` — consistent here, but card title has no letter-spacing at all |
| 55 | `components/LearnExplore.tsx` | 216 | Journey title uses `text-xl` with no `font-serif` declaration, but the next section explicitly specifies `font-serif` — inconsistent font family inheritance |

---

## 5. COLOR & OPACITY INCONSISTENCIES (15 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 56 | `components/HomePage.tsx` | 152 | Label uses `text-tea-seal/70`, but section labels elsewhere use `text-tea-seal-dark dark:text-tea-seal` — opacity modifier vs dark variant token |
| 57 | `components/HomePage.tsx` | 161 | Description `text-tea-ink/60` but `EmailCapture.tsx:41` uses `text-tea-ink/70` — 10% opacity difference for similar muted text |
| 58 | `components/PopupModal.tsx` | 186 | Background `bg-white/5` but other glass-morphism sections use `bg-white/[0.05]` — different notation for same value |
| 59 | `components/PageHeader.tsx` | 42 | Border `border-tea-ink/10 dark:border-white/10`, but other components use `border-tea-ink/5` or `border-tea-ink/15` — no consistent border opacity |
| 60 | `components/SearchInput.tsx` | 25 | `border-tea-ink/15 dark:border-white/10` — asymmetric opacity between light (15%) and dark (10%) modes |
| 61 | `components/TeaInventory.tsx` | 416 | Hover state `bg-tea-ink/[0.02]` uses bracket notation, while most others use slash notation like `bg-tea-ink/5` — notation inconsistency |
| 62 | `components/CategoryPills.tsx` | 30 | Active button `bg-tea-seal text-white dark:text-tea-ink` — dark mode applies `tea-ink` (dark color) on `tea-seal` (gold) background, creating low contrast |
| 63 | `components/LearnExplore.tsx` | 127-128 | Card uses `border-l-green-400/40` — hardcoded Tailwind green instead of `tea-green` token |
| 64 | `admin/components/AddProductModal.tsx` | 554 | Hardcoded `#859F85` for canReorder toggle — not from any palette, no token |
| 65 | `admin/components/AddProductModal.tsx` | 558 | Uses `blue-500/10` and `blue-400` for isPublic toggle — Tailwind blue is not in the tea color system at all |
| 66 | `admin/components/TeaDetailsModal.tsx` | 117-131 | Redefines all tea type colors as a local switch statement instead of importing from `themeUtils.ts` — duplicate color map |
| 67 | `admin/components/PersonalCollectionView.tsx` | 10-25 | Defines `getThemeColor()` locally — third copy of tea type color mapping (also in `themeUtils.ts` and `TeaDetailsModal.tsx`) |
| 68 | `styles/card-utilities.css` | 84 | Title color `#E8DDCC` — not a Tailwind token, not `tea-paper`, not in any config (tea-paper is `#F3F0E7`) |
| 69 | `styles/card-utilities.css` | 100 | Price background `rgba(201, 148, 58, 0.05)` — the RGB values (201,148,58) correspond to `#C9943A`, not `#b8882d` (tea-seal). Different gold. |
| 70 | `index.html` | 283,293 | `.pull-quote` and `.side-note` use hardcoded `color: #555555` instead of `tea-ink-light` or `tea-ink-secondary` token |

---

## 6. BORDER RADIUS INCONSISTENCIES (12 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 71 | `components/CardContainer.tsx` | 19 | Card uses `rounded-[1px]` — arbitrary 1px radius, not in the `borderRadius` config |
| 72 | `components/PopupModal.tsx` | 303 | Modal uses `rounded-t-2xl md:rounded-sm` — mobile gets 16px top radius, desktop gets 2px. Extreme 14px difference between breakpoints |
| 73 | `components/TeaInspireGallery.tsx` | 121 | Featured image `rounded-xl` but grid items have no explicit rounding |
| 74 | `components/GalleryImage.tsx` | 60 | Gallery `rounded-sm` (2px) but featured moments use `rounded-xl` (12px) — 6x difference for images |
| 75 | `components/SearchInput.tsx` | 25 | Input `rounded-[1px]` but toggle button uses `rounded-sm` (2px) — 1px mismatch in adjacent elements |
| 76 | `admin/components/AddProductModal.tsx` | 402 | Modal `rounded-2xl` (16px), but `AddToCartModal.tsx:39` and `AuthModal.tsx:62` use `rounded-xl` (12px) — 4px difference between admin modals |
| 77 | `admin/components/AddProductModal.tsx` | 417 | Close button `rounded-full`, but line 610 uses bare `rounded` (4px) for similar interactive elements |
| 78 | `admin/components/AddProductModal.tsx` | 393,438 | Form inputs use `rounded-none` (underline style), but `AuthModal.tsx:74,79,83` uses `rounded-lg` (8px) — two completely different input paradigms in admin |
| 79 | `admin/components/AddProductModal.tsx` | 550-562 | Option pills use `rounded-lg` but `DashboardView.tsx:169` uses `rounded-full` for similar badge elements |
| 80 | `components/PopupModal.tsx` | 204 | Add-to-cart button `rounded-[1px]` but the shared `Button.tsx` component uses `rounded-sm` (2px) |
| 81 | `styles/card-utilities.css` | 10,56,102,123 | Card, image container, price, and badge all use `border-radius: 1px` — consistent within CSS but conflicts with Tailwind `rounded-sm: 0.125rem` (2px) |
| 82 | `components/CurrencyToggle.tsx` | 37 | Dropdown `rounded-sm` but inner button has no explicit rounding — mismatched container vs content |

---

## 7. SHADOW INCONSISTENCIES (9 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 83 | `styles/card-utilities.css` | 9,26 | Card default shadow `0 1px 3px rgba(0,0,0,0.3)`, hover shadow `0 12px 24px rgba(0,0,0,0.4)` — 12x vertical offset jump, very aggressive hover effect |
| 84 | `components/Card.tsx` | 69 | Uses `md:hover:shadow-xl` (Tailwind preset) but PopupModal uses `shadow-2xl` — referencing different shadow systems |
| 85 | `components/PopupModal.tsx` | 255 | Image `shadow-2xl` but other modals use `shadow-lg` — image element has heavier shadow than its container |
| 86 | `components/GalleryImage.tsx` | 77 | Text overlay uses inline `shadow-[4px_0_15px_rgba(0,0,0,0.5)]` — custom shadow not in any config |
| 87 | `components/LearnExplore.tsx` | 207 | Card hover `shadow-lg` but `FeaturedCard` uses `shadow-md` — featured card has *lighter* shadow than regular card |
| 88 | `admin/components/InvoiceBuilder.tsx` | 227 | Uses `shadow-2xl` without color modifier, but `AuthModal.tsx:86` uses `shadow-lg shadow-tea-accent/10` — inconsistent shadow coloring strategy |
| 89 | `admin/components/TeaTable.tsx` | 205 | Table wrapper `shadow-2xl` — same shadow weight as modals, no visual hierarchy differentiation |
| 90 | `styles/card-utilities.css` | 33 | Focus shadow `0 0 0 4px rgba(201, 148, 58, 0.2)` uses the wrong gold hex (201,148,58 = `#C9943A` not `#b8882d`) — inconsistent with `tea-seal` |
| 91 | `index.html` | 115-121 | Shadow config overrides Tailwind defaults but only partially — components using `shadow`, `shadow-2xl`, `shadow-inner` get unpredictable results |

---

## 8. TRANSITION & ANIMATION INCONSISTENCIES (10 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 92 | `components/HomePage.tsx` | 129 | `animate-[fadeIn_0.6s_ease-out]` — 0.6s duration |
| 93 | `components/Shop.tsx` | 97 | `animate-[fadeIn_0.5s_ease-out]` — 0.5s duration. Same animation, different timing than HomePage |
| 94 | `components/PageHeader.tsx` | 62 | `transition-all duration-500 ease-out` |
| 95 | `components/Reader.tsx` | 428 | Progress bar `transition-all duration-300 ease-out` |
| 96 | `components/LearnExplore.tsx` | 244 | Expansion `transition-all duration-700 ease-in-out` — 700ms is exceptionally long, and uses `ease-in-out` while everything else uses `ease-out` |
| 97 | `admin/AdminApp.tsx` | 35 | Framer Motion `duration: 0.3` (300ms) |
| 98 | `admin/AdminApp.tsx` | 242 | Cart drawer `duration-500` — 200ms slower than other admin transitions |
| 99 | `admin/components/AddProductModal.tsx` | 398 | `animate-in fade-in duration-200` — fastest modal animation in the app |
| 100 | `admin/components/RecordsView.tsx` | 71 | `animate-in fade-in duration-300` — 100ms slower than AddProductModal for same effect |
| 101 | `styles/card-utilities.css` | 18,66 | Card transform `300ms cubic-bezier(0.4, 0, 0.2, 1)` but image uses `700ms ease-out` — image animates 2.3x slower than its container on hover |

---

## 9. ICON SIZE INCONSISTENCIES (8 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 102 | `components/PageHeader.tsx` | 52,84 | Back icon `w-3.5 h-3.5` (14px) but cart icon `w-[22px] h-[22px]` — 8px difference, cart icon uses hardcoded pixels |
| 103 | `components/Card.tsx` | 81,166 | Audio icon `w-5 h-5` (20px) but play button `w-4 h-4` (16px) — different sizes for related audio controls |
| 104 | `components/MediaViewer.tsx` | 373 | Navigation icon `w-8 h-8` (32px) but similar buttons elsewhere use `w-6 h-6` (24px) |
| 105 | `components/Reader.tsx` | 492 | Close icon `w-5 h-5` but other toolbar icons vary between `w-3.5`, `w-4`, `w-5` on the same bar |
| 106 | `admin/components/Sidebar.tsx` | 102-112 | All nav icons `size={16}`, but `TeaTable.tsx:99-101` uses `size={10}` and `OrdersView.tsx:145` uses `size={14}` |
| 107 | `admin/components/SettingsView.tsx` | 31 | Header icon `size={24}` but `PersonalCollectionView.tsx:104` uses `size={20}` for equivalent header icons |
| 108 | `admin/AdminApp.tsx` | 189 | Cart badge uses `text-[10px]` for the count number — inconsistent with icon sizing approach |
| 109 | `components/HomePage.tsx` | 201 | ChevronRight `w-3.5 h-3.5` (14px) — smallest interactive icon, may fail touch target guidelines |

---

## 10. BUTTON & INTERACTIVE ELEMENT INCONSISTENCIES (8 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 110 | `components/Button.tsx` | 27 | Base button has `min-w-[44px] min-h-[44px]` touch target, but size variants (`sm`/`md`/`lg`) at lines 36-40 don't enforce minimum height |
| 111 | `components/Card.tsx` | 47 | Card link `text-sm font-sans` but HomePage buttons use `text-xs uppercase tracking-widest` — two CTA patterns |
| 112 | `components/PopupModal.tsx` | 204 | Add-to-cart `py-3 rounded-[1px]` but Button component default is `rounded-sm` — modal bypasses shared component |
| 113 | `components/TeaInventory.tsx` | 499 | Add button `py-2 px-4` but other CTAs use `py-3` — 4px vertical padding difference |
| 114 | `admin/components/AddProductModal.tsx` | 907 | Primary button `disabled:opacity-50`, but `SettingsView.tsx:74` adds `disabled:cursor-not-allowed` — inconsistent disabled state feedback |
| 115 | `admin/components/AuthModal.tsx` | 86 | `py-3 text-xs` button, but AddProductModal primary is `py-4 text-xs` — different heights for same importance level |
| 116 | `admin/components/AddProductModal.tsx` | 901 | Cancel button `text-tea-muted hover:text-tea-text` — some secondary buttons add `hover:border-tea-border`, others don't |
| 117 | `components/SearchInput.tsx` | 25 | Focus ring `focus:ring-1` — but no other input uses `ring-1`. Some use `focus:border-tea-seal` only, others use `focus:outline-none` |

---

## 11. HEADING HIERARCHY ISSUES (5 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 118 | `components/HomePage.tsx` | 157 | Section uses `<h2>` but the page has no `<h1>` — skipped heading level |
| 119 | `components/Reader.tsx` | 30 | Sidebar uses `font-serif text-2xl` in a non-semantic div — no heading tag |
| 120 | `components/MediaViewer.tsx` | 305 | Film section uses `text-5xl` without clear semantic heading tag |
| 121 | `components/LearnExplore.tsx` | 152 | Sub-page header `text-xl` for h2, but main section uses `text-3xl md:text-4xl` — h2 size varies by 2 scale steps on same page |
| 122 | `admin/components/AddProductModal.tsx` | 414 | Section title `text-[10px]` — functionally a heading but uses label size |

---

## 12. MIXED UNITS & RESPONSIVE ISSUES (5 findings)

| # | File | Line | Issue |
|---|------|------|-------|
| 123 | `components/Reader.tsx` | 533 | Hardcoded `paddingTop: '64px'` — should use rem or Tailwind class for scalability |
| 124 | `components/PopupModal.tsx` | 341 | `w-[70vw] max-w-[300px]` — mixing viewport and pixel units for same dimension |
| 125 | `styles/card-utilities.css` | 8 | Padding `0.625rem` (10px) — not a multiple of 4px or 8px grid, breaks alignment with Tailwind spacing |
| 126 | `components/Reader.tsx` | 30 | Uses `xl` breakpoint (`text-2xl xl:text-4xl`) while most components use `lg` as the largest breakpoint — inconsistent responsive strategy |
| 127 | `admin/components/AddProductModal.tsx` | 393 | `inputStyle` object defines `fontSize`, `padding` in JS while surrounding elements use Tailwind classes — two styling paradigms in one component |

---

## 13. TRIPLE-CONFIG DRIFT (9 findings)

These are the most architecturally damaging issues — values defined in `designTokens.ts` that have drifted from the inline config in `index.html` (which is what actually runs via CDN Tailwind).

| # | Files | Issue |
|---|-------|-------|
| 128 | `designTokens.ts:123` vs `index.html:160` | **slideUp animation**: designTokens says `0.3s`, index.html says `0.4s` — 33% timing difference |
| 129 | `designTokens.ts:124` vs `index.html:161` | **scaleIn animation**: designTokens says `0.15s`, index.html says `0.2s` — 33% timing difference |
| 130 | `tailwind.config.ts:12` vs `index.html:60-82` | **Colors**: tailwind.config extends `DESIGN_TOKENS.colors` (no admin tokens), but index.html inline config adds `tea-bg`, `tea-surface`, `tea-border`, `tea-text`, `tea-muted`, `tea-accent` — 6 admin colors exist ONLY in index.html |
| 131 | `tailwind.config.ts:14-15` vs `index.html:83-86` | **fontFamily.mono**: tailwind.config only extends `serif` and `sans`, SKIPS `mono` — but index.html includes all three |
| 132 | `designTokens.ts:39-45` vs `tailwind.config.ts:11-25` | **lineHeight**: defined in designTokens (`tight`, `snug`, `normal`, `relaxed`, `loose`) but **NOT extended** in tailwind.config.ts — tokens exist but are never consumed |
| 133 | `designTokens.ts:57-61` vs `tailwind.config.ts:11-25` | **timing**: defined in designTokens (`micro: 150ms`, `standard: 300ms`, `emphasis: 500ms`) but **NOT extended** in tailwind.config — transition durations remain arbitrary |
| 134 | `designTokens.ts:47-54` | **typography presets**: `h1`, `h2`, `h3`, `body`, `bodySmall` class strings defined but **never imported or used** by any component — dead code |
| 135 | `index.html:33-52` vs `designTokens.ts` | **CSS custom properties** (`--font-size-xs` through `--font-size-5xl`, `--font-serif`, `--font-sans`, `--font-mono`) are a third copy of the same values — never referenced by any component |
| 136 | `index.html:56-170` vs `tailwind.config.ts:1-30` | **Two Tailwind configs**: the CDN `tailwind.config` in index.html completely shadows the file-based config when running in dev (CDN mode). The file-based config only applies during `npm run build`. Different behavior in dev vs prod. |

---

## 14. Z-INDEX CHAOS (5 findings)

No z-index scale is defined anywhere — not in designTokens, not in Tailwind config. Components use arbitrary values creating an undocumented stacking context.

| # | File/Pattern | Value | Issue |
|---|-------------|-------|-------|
| 137 | `ThemeContext.tsx` | `z-[9999]` | Radial reveal overlay uses maximum z-index — will overlay everything including browser devtools overlays |
| 138 | `App.tsx` | `z-[250]` | Toast messages at 250, but modals are at `z-[100]` — toast can appear over modals but gap between 100-250 is undocumented |
| 139 | `App.tsx` | `z-[210]` | Contact modal at 210 vs other modals at `z-[100]` — same-type elements at different z-indices |
| 140 | Multiple admin components | `z-[100]` | 80+ instances use `z-[100]` for modals, drawers, overlays — everything fights for the same layer |
| 141 | Alcove modal buttons | `z-[70]`, `z-[61]`, `z-[60]` | Three adjacent z-values for related elements — fragile stacking that will break with any additions |

---

## 15. MISSING TOKEN SCALES (7 findings)

| # | Token Type | Issue |
|---|-----------|-------|
| 142 | `letterSpacing` | Not defined anywhere. Components use `tracking-wider`, `tracking-widest`, `tracking-[0.2em]`, `tracking-[0.15em]`, inline `0.01em`, inline `0.2px` — 6+ arbitrary values |
| 143 | `zIndex` | Not defined. 10+ arbitrary values from `z-10` to `z-[9999]` |
| 144 | `transitionDuration` | `timing` defined in designTokens but not wired to Tailwind. Components use `duration-200`, `duration-300`, `duration-500`, `duration-700` arbitrarily |
| 145 | `backdropBlur` | Not defined. Components use `backdrop-blur-sm`, `backdrop-blur-md`, `backdrop-blur-2xl` |
| 146 | `borderRadius` scale stops at `xl: 0.75rem` | Components use `rounded-2xl` (55 instances), `rounded-3xl`, `rounded-full`, `rounded-t-[2000px]` — all outside the defined scale |
| 147 | `boxShadow` scale stops at `xl` | Components use `shadow-2xl` extensively (admin modals, tables) — falls back to Tailwind default, not the custom scale |
| 148 | Admin dark theme colors | `tea-bg`, `tea-surface`, `tea-border`, `tea-text`, `tea-muted`, `tea-accent` only in `index.html` inline config, not in `designTokens.ts` — admin has no typed color tokens |

---

## 16. HARDCODED HEX VALUES IN COMPONENTS (6 findings)

Colors used in components that exist in no config or token file.

| # | File | Line(s) | Hex Value | What It Should Be |
|---|------|---------|-----------|-------------------|
| 149 | `admin/components/TeaDetailsModal.tsx` | 167 | `#0e0d0c` | Near `tea-bg` (#0c0c0c) but 2 shades off — use token |
| 150 | `admin/components/TeaDetailsModal.tsx` | 199 | `#1c1b19` | Warm near-black not in any palette |
| 151 | `admin/components/TeaDetailsModal.tsx` | 199 | `#8a7e6a` | Muted gold — should be `tea-beige-dark` (#8A8070) or a new token |
| 152 | `admin/components/TeaDetailsModal.tsx` | 199 | `#c0b49a` | Light gold — between `tea-beige` and `tea-paper-secondary`, no match |
| 153 | `admin/components/TeaDetailsModal.tsx` | 243-244 | `rgba(180,120,40,...)` | Warm amber gradient — not `tea-seal` (184,136,45), close but off |
| 154 | `styles/card-utilities.css` | 84 | `#E8DDCC` | Card title color — not `tea-paper` (#F3F0E7), not `tea-beige` (#D8D0C0), a unique warm cream |

---

## 17. LAYOUT & NAVIGATION INCONSISTENCIES (15 findings)

### 17.1 Sidebar Width / Content Margin Mismatch
| # | File | Line | Issue |
|---|------|------|-------|
| 155 | `App.tsx` | 335 | Main content uses `lg:ml-20 xl:ml-56` — matches sidebar `w-20 xl:w-56`, but there's no `md:` state. At `md` breakpoint, content has no left margin but sidebar may be partially visible |
| 156 | `components/LeftSidebar.tsx` | 44 | Sidebar `w-20 xl:w-56` jumps from 80px to 224px with no intermediate `lg:` width — jarring 144px jump |
| 157 | `admin/components/Sidebar.tsx` | 120 | Admin sidebar hardcoded `w-64` (256px) — 32px wider than public sidebar's max (`xl:w-56` = 224px), no responsive scaling |

### 17.2 Touch Target Violations
| # | File | Line | Issue |
|---|------|------|-------|
| 158 | `components/shared/PageHeader.tsx` | 48-50 | Back button `min-h-[36px]` — 8px below the 44px WCAG touch target minimum |
| 159 | `components/LeftSidebar.tsx` | 78,125 | Nav items `min-h-[56px]` but admin nav items `min-h-[48px]` — 8px difference for same-type elements |
| 160 | `components/LeftSidebar.tsx` | 78,125 | No `min-width` set on icon-only nav buttons — could shrink below touch target |

### 17.3 Backdrop/Glass Effect Mismatch
| # | File | Line | Issue |
|---|------|------|-------|
| 161 | `components/shared/PageHeader.tsx` | 42 | Header: `backdrop-blur-xl backdrop-saturate-150` — saturate effect not used anywhere else |
| 162 | `components/BottomTabBar.tsx` | 109 | Bottom nav: `backdrop-blur-xl` only (no saturate) — different glass effect than header |
| 163 | `components/CartDrawer.tsx` | 247 | Cart backdrop: `backdrop-blur-sm` — weakest blur, visually inconsistent with header/nav `blur-xl` |

### 17.4 Background Opacity Asymmetry
| # | File | Line | Issue |
|---|------|------|-------|
| 164 | `components/shared/PageHeader.tsx` | 42 | Light: `bg-white/70`, Dark: `bg-[#1a1a1a]/80` — 10% opacity difference between modes |
| 165 | `components/BottomTabBar.tsx` | 109 | Light: `bg-[#FFFDF5]/80` — hardcoded off-white hex not in tokens (not `tea-paper`), Dark: `bg-tea-ink/80` |

### 17.5 Focus State Gaps
| # | File | Line | Issue |
|---|------|------|-------|
| 166 | `components/shared/PageHeader.tsx` | 48-51 | Back button has **no** `focus-visible` styling at all — keyboard users get no visual feedback |
| 167 | `components/shared/CategoryPills.tsx` | 27 | Uses `focus-visible:ring-2 ring-tea-seal/50` — different pattern from Button.tsx which uses `outline-2 + ring-4 ring-tea-seal/20` |

### 17.6 Scrollbar Class Duplication
| # | File | Line | Issue |
|---|------|------|-------|
| 168 | `components/LeftSidebar.tsx` vs `components/shared/CategoryPills.tsx` | Various | Two different classes for same effect: `no-scrollbar` (from index.html) vs `hide-scrollbar` (from card-utilities.css) — should use one |
| 169 | `App.tsx` | 420 | Footer has `max-w-[1400px]` but main content at line 337 has **no** max-width constraint — on ultra-wide displays, content expands infinitely while footer is capped |

---

## Priority Recommendations

### P0 — Architectural (fix first, everything else depends on this)
1. **Resolve the triple-config problem** — Remove the inline `tailwind.config` from `index.html` and switch from CDN to build-time Tailwind. This is the root cause of config drift. Until this is fixed, changes to `designTokens.ts` have no effect in dev mode.
2. **Add admin colors to `designTokens.ts`** — `tea-bg`, `tea-surface`, `tea-border`, `tea-text`, `tea-muted`, `tea-accent` must live in the single source of truth, not only in `index.html`
3. **Wire missing token scales to Tailwind** — `lineHeight`, `timing` (as `transitionDuration`), and `letterSpacing` are defined or needed but not extended in `tailwind.config.ts`
4. **Fix animation timing drift** — `slideUp` (0.3s vs 0.4s) and `scaleIn` (0.15s vs 0.2s) between designTokens and index.html

### P1 — Critical (design correctness)
5. **Unify the gold color** — `#b8882d` (tea-seal), `#C9943A` (card-utilities.css), `#a07830` (tea-seal-dark) are three different golds. Rationalize into one palette.
6. **Eliminate duplicate color maps** — `themeUtils.ts`, `TeaDetailsModal.tsx`, and `PersonalCollectionView.tsx` all independently define tea type colors
7. **Fix shimmer animation conflict** — two `@keyframes shimmer` with different `translateX` end values (100% vs 200%)
8. **Define z-index scale** — Add `zIndex` to designTokens: `sticky: 10`, `dropdown: 40`, `modal: 100`, `toast: 200`, `overlay: 1000`. Replace all `z-[9999]`, `z-[250]`, `z-[210]` with tokens
9. **Remove dead CSS custom properties** — `--font-size-*` and `--font-*` vars in `:root` are never referenced

### P2 — High (design consistency)
10. **Standardize modal border radius** — pick `rounded-xl` or `rounded-2xl` for all modals, not both
11. **Standardize button padding** — define sm (`py-2`), md (`py-3`), lg (`py-4`) and enforce across all modals
12. **Standardize transition timing** — use designTokens timing: `150ms` (micro), `300ms` (standard), `500ms` (emphasis) and one easing function
13. **Standardize heading scale** — use the typography presets in `designTokens.ts:47-54` that are already defined but never imported
14. **Standardize input styling** — pick one paradigm: underline (`rounded-none border-b`) OR boxed (`rounded-lg border`), not both in admin
15. **Complete the borderRadius scale** — add `2xl`, `3xl`, `full` to designTokens to cover the 55+ instances of `rounded-2xl`
16. **Complete the shadow scale** — add `2xl` to designTokens to cover admin modals and tables

### P3 — Medium (polish)
17. **Standardize icon sizes** — define 4 sizes (12, 16, 20, 24) and enforce. Remove hardcoded `w-[22px]`
18. **Fix card-utilities.css spacing** — replace `0.625rem`/`0.75rem`/`0.875rem` with 4px-grid-aligned values
19. **Replace all hardcoded hex colors** — `#555555` → `tea-ink-light`, `#E8DDCC` → new token, `#859F85` → new token, `blue-400` → remove
20. **Standardize opacity notation** — use `/10` everywhere, not `[0.05]` or `[0.02]`
21. **Register all loaded fonts** — add Playfair Display, Fraunces, Bricolage Grotesque, JetBrains Mono, Ma Shan Zheng to fontFamily config
22. **Add letterSpacing tokens** — define `tight`, `normal`, `wide`, `wider`, `widest` and convert the 6+ arbitrary values

### P3.5 — Medium-High (accessibility & layout)
23. **Fix touch target violations** — Back button at 36px is below WCAG 44px minimum. Nav items vary 48-56px for same element type.
24. **Unify backdrop/glass effects** — Header uses `saturate-150` that nothing else does. CartDrawer uses `blur-sm` while header/nav use `blur-xl`. Pick one standard.
25. **Add missing focus-visible styles** — PageHeader back button has zero keyboard focus styling. CategoryPills uses a different focus pattern than Button.tsx.
26. **Fix sidebar width jump** — LeftSidebar jumps 144px (80px → 224px) between `lg` and `xl` with no intermediate step.
27. **Add max-width to main content** — Footer has `max-w-[1400px]` but main content has none — they diverge on ultra-wide displays.
28. **Consolidate scrollbar-hiding classes** — `no-scrollbar` and `hide-scrollbar` do the same thing. Pick one.
29. **Fix background opacity asymmetry** — PageHeader light mode 70% vs dark mode 80%; BottomTabBar uses hardcoded `#FFFDF5` not in tokens.

### P4 — Low (refinement)
30. **Rationalize `tea-ink-light` and `tea-ink-secondary`** — both are `#555555`, pick one name
31. **Delete unused `typography` presets** or actually wire them into a utility — currently dead code in designTokens
32. **Fix line-height inconsistency** — body `1.625`, p `1.7`, card title `1.25`, article `1.85` — map to the lineHeight tokens already defined
33. **Convert inline `letter-spacing: 0.2px`** to `em` to match rest of system

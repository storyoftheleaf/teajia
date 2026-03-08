# Teajia Palettes — Site-Wide Design Overhaul Plan

A comprehensive plan for unifying all fonts, colors, logos, SVGs, text sizing, and visual identity across the entire Teajia application. The goal: every pixel resonates with a single, intentional palette system.

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Color Palette Redesign](#2-color-palette-redesign)
3. [Typography System](#3-typography-system)
4. [Logo & SVG Unification](#4-logo--svg-unification)
5. [Component-by-Component Plan](#5-component-by-component-plan)
6. [Admin Theme Alignment](#6-admin-theme-alignment)
7. [CSS & Card Styles](#7-css--card-styles)
8. [Texture & Atmosphere](#8-texture--atmosphere)
9. [Implementation Phases](#9-implementation-phases)
10. [Files to Touch](#10-files-to-touch)

---

## 1. Current State Audit

### Problems Found

**Hardcoded hex colors scattered across 20+ components:**

| Hex Value | Used In | Should Be |
|-----------|---------|-----------|
| `#FFFDF5` | LeftSidebar, BottomTabBar, CartDrawer, ContributorBioPage | New token `tea-cream` |
| `#E8DDCC` | LogoText default, card-utilities.css title color | New token `tea-warm` |
| `#E6E2D6` | TeaInventory, CartDrawer, AccountPanel headers | Token `tea-paper-dark` (already exists, not used) |
| `#242424` | CartDrawer, AccountPanel dark backgrounds | New token `tea-surface-alt` |
| `#2a2a2a` | CartDrawer, Reader, QuickPeekDrawer dark bg | New token `tea-surface-raised` |
| `#0a0a0a` | ProductInquiry input | Existing `tea-bg` |
| `#0e0d0c` | TeaDetailsModal overlay | New token `tea-overlay` |
| `#1c1b19` | TeaDetailsModal buttons | New token `tea-surface-deep` |
| `#8a7e6a` | TeaDetailsModal muted text | Map to `tea-muted` or new `tea-warm-muted` |
| `#c0b49a` | TeaDetailsModal hover text | Map to `tea-beige` |
| `#859F85` | AddProductModal reorder badge | Map to `tea-green` |
| `#7A2E2E` | BottomTabBar logo active color | New token `tea-ember` |
| `#8B7D6B` | BottomTabBar logo inactive color | New token `tea-drift` |
| `#e8e4d9` | SinglePageRenderer background | Map to `tea-paper-dark` |
| `#111827` | card-utilities light mode title | Tailwind `gray-900` — use `tea-ink` |
| `#2563eb` | card-utilities light mode price | Misaligned — should be `tea-seal` |
| `#e5e7eb` | card-utilities light mode border | Use `tea-beige` |
| `#f3f4f6` | card-utilities light mode image bg | Use `tea-paper-dark` |
| `rgba(201,148,58,*)` | card-utilities focus ring, price bg | Should reference `tea-seal` via token |

**Font inconsistencies:**
- `card-grid-badge` uses system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`) instead of `Inter`
- `card-grid-price` hardcodes `'Menlo', 'Courier New', monospace` instead of token `font-mono`
- Body `line-height: 1.625` in index.html but `1.85` in `.article-body` — intentional but undocumented
- Fraunces + Bricolage Grotesque loaded but only used in Alcove cards, not documented in token system

**Logo color mismatches:**
- `LogoEmblem` defaults to `#010101` (near-black) — wrong on dark backgrounds
- `LogoText` defaults to `#E8DDCC` — a color not in the token system
- `favicon.svg` uses `#2A3430` bg (tea-moss) + `#c9943a` text (close to tea-seal but not exact — should be `#b8882d`)
- BottomTabBar logo uses unique colors `#7A2E2E` / `#8B7D6B` not in any palette

**CSS variable vs Tailwind token drift:**
- `:root` defines `--color-tea-seal` and `--color-tea-seal-dark`
- Tailwind config defines the same colors differently via `extend.colors`
- `card-utilities.css` references `var(--color-tea-seal)` but also hardcodes the same color as `rgba(201,148,58,...)`
- No CSS variables for most colors — only seal and seal-dark have them

---

## 2. Color Palette Redesign

### Expanded Token System

Add missing intermediate colors and eliminate all hardcoded hex values.

#### Light Theme (Public Site)

```
tea-cream:        #FFFDF5    — Lightest background (sidebar, tab bar, panels)
tea-paper:        #F3F0E7    — Primary light background (pages)
tea-paper-dark:   #E6E2D6    — Secondary light background (headers, footers)
tea-warm:         #E8DDCC    — Warm text on dark backgrounds, logo text
tea-beige:        #D8D0C0    — Tertiary, decorative borders
tea-beige-dark:   #8A8070    — Accessible muted text (dark mode)
tea-drift:        #8B7D6B    — Warm muted (inactive icons, subtle labels)
tea-ink-light:    #555555    — Secondary text
tea-ink:          #2C2C2C    — Primary text
tea-charcoal:     #1a1a1a    — Dark background
```

#### Accent Colors

```
tea-seal:         #b8882d    — Primary accent (gold), buttons, active states
tea-seal-dark:    #a07830    — Darker gold for text-on-light (WCAG AA)
tea-ember:        #7A2E2E    — Active logo tint, warm emphasis
tea-green:        #5A6E5A    — Nature accent, success states
tea-moss:         #2A3430    — Deep green-grey, favicon bg
```

#### Dark Theme (Admin + Public Dark Mode)

```
tea-bg:           #0c0c0c    — Deepest background
tea-surface:      #121212    — Card/panel surface
tea-surface-deep: #1c1b19   — Button backgrounds, deep UI
tea-surface-alt:  #242424    — Alternate surface (headers in dark)
tea-surface-raised: #2a2a2a — Raised elements (code blocks, modals)
tea-overlay:      #0e0d0c    — Modal overlays (with /90 opacity)
tea-border:       #262626    — Default borders
tea-text:         #e5e5e5    — Primary text
tea-muted:        #737373    — Muted text, labels
tea-warm-muted:   #8a7e6a    — Warm-toned muted text
tea-accent:       #b8882d    — Same as tea-seal (gold accent)
```

#### Utility

```
tea-shadow:       rgba(0,0,0,0.15) — Subtle shadows
```

### CSS Variables (add to `:root`)

Every token gets a CSS variable so `card-utilities.css` and other raw CSS can reference them:

```css
:root {
  --color-tea-cream: #FFFDF5;
  --color-tea-paper: #F3F0E7;
  --color-tea-paper-dark: #E6E2D6;
  --color-tea-warm: #E8DDCC;
  --color-tea-beige: #D8D0C0;
  --color-tea-drift: #8B7D6B;
  --color-tea-ink-light: #555555;
  --color-tea-ink: #2C2C2C;
  --color-tea-charcoal: #1a1a1a;
  --color-tea-seal: #b8882d;
  --color-tea-seal-dark: #a07830;
  --color-tea-ember: #7A2E2E;
  --color-tea-green: #5A6E5A;
  --color-tea-moss: #2A3430;
  --color-tea-bg: #0c0c0c;
  --color-tea-surface: #121212;
  --color-tea-surface-deep: #1c1b19;
  --color-tea-surface-alt: #242424;
  --color-tea-surface-raised: #2a2a2a;
  --color-tea-border: #262626;
  --color-tea-text: #e5e5e5;
  --color-tea-muted: #737373;
  --color-tea-warm-muted: #8a7e6a;
}
```

---

## 3. Typography System

### Font Stack (No Changes Needed — Just Enforce Consistency)

| Role | Stack | Usage |
|------|-------|-------|
| **Serif** | `Lora`, `Noto Serif SC`, `serif` | Headlines, editorial body, brand text |
| **Sans** | `Inter`, `sans-serif` | UI labels, badges, metadata, navigation |
| **Mono** | `Menlo`, `Courier New`, `monospace` | Prices, code, technical data |
| **Display** | `Fraunces` (variable) | Alcove card headlines only |
| **Display Sans** | `Bricolage Grotesque` | Alcove card labels/metadata only |
| **Chinese** | `Ma Shan Zheng`, `Noto Serif SC` | Chinese tea names, calligraphic display |

### Fixes Required

1. **`card-grid-badge`** in `card-utilities.css` — Replace `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` with `var(--font-sans)` or `font-family: inherit` + `font-sans` class
2. **`card-grid-price`** in `card-utilities.css` — Replace hardcoded `'Menlo', 'Courier New', monospace` with `var(--font-mono)`
3. **`LogoText`** — Consider loading at `font-serif` weight to match brand identity
4. **Admin sidebar** — Uses `font-serif` for "TEAJIA" header and `font-sans` for nav — correct, keep as-is

### Font Size Scale (Keep Current — It Works)

```
xs:   0.75rem  (12px) — badges, fine print, tracking labels
sm:   0.875rem (14px) — secondary text, meta, captions
base: 1rem     (16px) — body text, nav labels
lg:   1.125rem (18px) — emphasized body
xl:   1.25rem  (20px) — small headings
2xl:  1.5rem   (24px) — section headings
3xl:  1.875rem (30px) — page headings (mobile)
4xl:  2.25rem  (36px) — page headings (desktop)
5xl:  3rem     (48px) — hero headlines
```

### Text Sizing Patterns to Enforce

| Element | Class Pattern | Notes |
|---------|--------------|-------|
| Page titles | `text-4xl md:text-5xl font-serif font-light` | Collapsed: `text-base` on mobile |
| Section headers | `text-3xl md:text-4xl font-serif` | |
| Card titles | `text-base lg:text-[17px] font-medium` | `1rem` → `1.0625rem` on desktop |
| Nav labels | `text-[10px] uppercase tracking-widest font-sans` | Both sidebar & tab bar |
| Badges | `text-[10px] uppercase tracking-[0.05em-0.2em] font-sans` | |
| Prices | `text-xs font-mono tracking-wider` | `0.6875rem` mobile, `0.75rem` desktop |
| Body text | `text-base font-sans leading-relaxed` | |
| Article body | `text-base font-serif leading-[1.85]` | `.article-body` class |
| Chinese names | `font-serif` (Noto Serif SC auto-falls) | |
| Footer links | `text-sm font-sans` | |
| Admin labels | `text-[10px] uppercase tracking-[0.2em] font-sans` | |

---

## 4. Logo & SVG Unification

### Logo Components

#### `LogoEmblem.tsx`
- **Current default:** `color = '#010101'`
- **Fix:** Change default to `'currentColor'` so it inherits from parent text color
- Components using it already pass a color prop, so this is non-breaking

#### `LogoText.tsx`
- **Current default:** `color = '#E8DDCC'`
- **Fix:** Change default to `'currentColor'`, add `tea-warm` token for explicit use
- Update all call sites to pass the right color or rely on parent `text-tea-warm` / `text-tea-paper`

#### `favicon.svg`
- Background: `#2A3430` (tea-moss) — correct, keep
- Text color: `#c9943a` — **Fix to `#b8882d`** (tea-seal) for exact alignment

#### `public/logos/*.svg`
- Audit each file for color consistency
- All should use tea-seal or currentColor

#### BottomTabBar Logo Colors
- Active: `#7A2E2E` — register as `tea-ember` token
- Inactive: `#8B7D6B` — register as `tea-drift` token
- Emblem color `rgba(0,0,0,0.15)` / `rgba(0,0,0,0.22)` — keep (shadow effect)

### Custom Icons (`Icons.tsx`)
- `SealIcon` uses hardcoded `#F3F0E7` for stroke — change to `tea-paper` equivalent or keep as the icon is small/decorative
- All other custom icons use `currentColor` — correct
- Lucide icons: all use `currentColor` — correct, no changes needed

---

## 5. Component-by-Component Plan

### Navigation

#### `LeftSidebar.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#FFFDF5]` | `bg-tea-cream` |
| Hardcoded active indicator `w-1 h-8 bg-tea-seal` | Keep — correct |
| `text-tea-ink/40 dark:text-tea-paper/60` inactive | Keep |
| `text-tea-seal` active | Keep |

#### `BottomTabBar.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#FFFDF5]/80` | `bg-tea-cream/80` |
| `border-[#FFFDF5]` (cart badge) | `border-tea-cream` |
| Logo `color="#7A2E2E"` | `color="var(--color-tea-ember)"` or token reference |
| Logo `color="#8B7D6B"` | `color="var(--color-tea-drift)"` or token reference |
| `rgba(0,0,0,0.15)` emblem | Keep as-is (opacity shadow) |

### Panels & Drawers

#### `CartDrawer.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-tea-paper` |
| `bg-[#1a1a1a]` (dark) | `bg-tea-charcoal` or `dark:bg-tea-charcoal` |
| `bg-[#E6E2D6]` headers | `bg-tea-paper-dark` |
| `bg-[#242424]` dark headers | `dark:bg-tea-surface-alt` |
| `bg-[#FFFDF5]` code block | `bg-tea-cream` |
| `bg-[#2a2a2a]` dark code | `dark:bg-tea-surface-raised` |

#### `AccountPanel/index.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-tea-paper` |
| `bg-[#1a1a1a]` | `dark:bg-tea-charcoal` |
| `bg-[#E6E2D6]` | `bg-tea-paper-dark` |
| `bg-[#242424]` | `dark:bg-tea-surface-alt` |

#### `QuickPeekDrawer.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#1a1a1a]` (dark) | `dark:bg-tea-charcoal` |

#### `ContributorBioPage.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#FFFDF5]` | `bg-tea-cream` |

### Content Pages

#### `Reader.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-tea-paper` |
| `bg-[#2a2a2a]` (dark) | `dark:bg-tea-surface-raised` |
| `bg-[#1a1a1a]` fullscreen | `bg-tea-charcoal` |

#### `SinglePageRenderer.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` (6 instances) | `bg-tea-paper` |
| `bg-[#1a1a1a]` (2 instances) | `bg-tea-charcoal` |
| `border-[#E6E2D6]` | `border-tea-paper-dark` |
| `border-[#121212]` | `border-tea-surface` |
| `bg-[#e8e4d9]` | `bg-tea-paper-dark` (close enough) or new token |
| `text-[#F3F0E7]` | `text-tea-paper` |

#### `TeaInventory.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-tea-paper` |
| `bg-[#E6E2D6]` | `bg-tea-paper-dark` |

#### `DesignPortfolio.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-tea-paper` |
| `bg-[#1a1a1a]` | `dark:bg-tea-charcoal` |

#### `GalleryImage.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#1a1a1a]` | `bg-tea-charcoal` |

#### `InsightOverlay.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#242424]` (dark) | `dark:bg-tea-surface-alt` |

#### `ProductInquiry.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#0a0a0a]` (dark) | `dark:bg-tea-bg` |

### Admin Components

#### `TeaDetailsModal.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#0e0d0c]/90` overlay | `bg-tea-overlay/90` |
| `text-[#8a7e6a]` | `text-tea-warm-muted` |
| `hover:text-[#c0b49a]` | `hover:text-tea-beige` |
| `bg-[#1c1b19]/50` | `bg-tea-surface-deep/50` |
| `bg-[#1c1b19]` | `bg-tea-surface-deep` |
| `border-[rgba(200,170,120,0.2)]` | `border-tea-seal/20` |

#### `AddProductModal.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#859F85]/10` | `bg-tea-green/10` |
| `text-[#859F85]` | `text-tea-green` |
| `border-[#859F85]/30` | `border-tea-green/30` |

#### `LoginScreen.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#1a1a1a]` | `bg-tea-charcoal` |

#### `App.tsx` (admin fallback)
| Current | Change To |
|---------|-----------|
| `bg-[#0c0c0c]` | `bg-tea-bg` |

---

## 6. Admin Theme Alignment

The admin uses a dedicated dark palette. It's already well-defined but needs the new intermediate tokens:

**Keep existing:** `tea-bg`, `tea-surface`, `tea-border`, `tea-text`, `tea-muted`, `tea-accent`

**Add:**
- `tea-surface-deep: #1c1b19` — for button backgrounds in TeaDetailsModal
- `tea-surface-alt: #242424` — for secondary surfaces (headers in dark mode)
- `tea-surface-raised: #2a2a2a` — for elevated elements (code blocks, nested panels)
- `tea-overlay: #0e0d0c` — for modal backdrop overlays
- `tea-warm-muted: #8a7e6a` — warm-toned muted text (TeaDetailsModal nav buttons)

The admin gold accent `tea-accent: #b8882d` is already identical to `tea-seal`. Keep both aliases for semantic clarity (public uses "seal", admin uses "accent").

---

## 7. CSS & Card Styles

### `card-utilities.css` Changes

```css
/* Replace all hardcoded colors with CSS variables */

.card-grid-item {
  background-color: var(--color-tea-charcoal);  /* was #1a1a1a */
}

.card-grid-image-container {
  background-color: var(--color-tea-charcoal);  /* was #1a1a1a */
}

.card-grid-title {
  color: var(--color-tea-warm);  /* was #E8DDCC */
}

.card-grid-price {
  font-family: var(--font-mono);  /* was hardcoded Menlo stack */
  color: var(--color-tea-seal);
}

.card-grid-badge {
  color: rgba(232, 221, 204, 0.7);  /* keep — opacity on tea-warm */
  font-family: var(--font-sans);  /* was system font stack */
}

.card-grid-description {
  color: rgba(232, 221, 204, 0.8);  /* keep — opacity on tea-warm */
}

/* Light mode */
.light .card-grid-item {
  background-color: white;
  border: 1px solid var(--color-tea-beige);  /* was #e5e7eb */
}

.light .card-grid-image-container {
  background-color: var(--color-tea-paper-dark);  /* was #f3f4f6 */
  border: 1px solid var(--color-tea-beige);  /* was #d1d5db */
}

.light .card-grid-title {
  color: var(--color-tea-ink);  /* was #111827 */
}

.light .card-grid-price {
  color: var(--color-tea-seal);  /* was #2563eb (blue?!) */
}

/* Focus ring */
.card-grid-item:focus-visible {
  outline: 2px solid var(--color-tea-seal);
  box-shadow: 0 0 0 4px rgba(184, 136, 45, 0.2);  /* aligned to tea-seal */
}
```

---

## 8. Texture & Atmosphere

### Keep These (They Work Beautifully)

- `.texture-overlay` — SVG noise at 6% opacity
- `.grain-texture` — Fractal grain with multiply blend
- `.fabric-texture` — Subtle diagonal lines at 3% opacity
- `.paper-texture` — Repeating linear gradient simulating paper fiber
- Article image filters: `sepia-[0.15] brightness-[0.9] contrast-[1.05] saturate-[0.8]`

### Ensure Consistency

- The `tea-card-scroll` scrollbar thumb uses `rgba(200,170,120,0.15)` — this is tea-seal territory, keep
- Article `::after` underlines use `var(--color-tea-seal)` — correct
- Drop caps use `var(--color-tea-seal)` — correct
- Pull quotes border uses `var(--color-tea-seal)` — correct
- Pull quote text uses `#555555` — should use `var(--color-tea-ink-light)`
- Side note text uses `#555555` — should use `var(--color-tea-ink-light)`
- Side note bg `rgba(244, 240, 230, 0.5)` — close to tea-paper, keep
- Section break `rgba(44, 44, 44, 0.3)` — close to tea-ink/30, keep

---

## 9. Implementation Phases

### Phase 0: Cleanup — Remove Experimental Font Theme Infrastructure
1. Delete `src/components/FontThemeTester.tsx`
2. Remove `FONT_THEMES` and `FONT_SIZE_SCALES` exports from `designTokens.ts`
3. Remove `FontThemeTester` comments from `index.html` CSS variable section
4. The font stack is already locked in (`Lora`/`Inter`/`Menlo`) — no tester UI needed

### Phase 1: Token Foundation (Non-Breaking)
1. Add new color tokens to Tailwind config in `index.html`
2. Add corresponding CSS variables to `:root`
3. Add new tokens to `designTokens.ts`
4. Fix `favicon.svg` color to `#b8882d`

### Phase 2: Logo Components
1. Change `LogoEmblem` default color to `currentColor`
2. Change `LogoText` default color to `currentColor`
3. Update all call sites with explicit color props where needed
4. Audit `public/logos/*.svg` files for color alignment

### Phase 3: Navigation
1. Replace hardcoded hex in `LeftSidebar.tsx`
2. Replace hardcoded hex in `BottomTabBar.tsx`
3. Add `tea-ember` and `tea-drift` token usage for logo colors

### Phase 4: Panels & Drawers
1. `CartDrawer.tsx` — all 6 hex replacements
2. `AccountPanel/index.tsx` — all 5 hex replacements
3. `QuickPeekDrawer.tsx` — 1 replacement
4. `ContributorBioPage.tsx` — 2 replacements
5. `InsightOverlay.tsx` — 1 replacement

### Phase 5: Content Pages
1. `Reader.tsx` — 3 replacements
2. `SinglePageRenderer.tsx` — 8+ replacements
3. `TeaInventory.tsx` — 2 replacements
4. `DesignPortfolio.tsx` — 2 replacements
5. `GalleryImage.tsx` — 1 replacement
6. `ProductInquiry.tsx` — 1 replacement

### Phase 6: Admin Components
1. `TeaDetailsModal.tsx` — 10+ replacements (most complex)
2. `AddProductModal.tsx` — 3 replacements
3. `LoginScreen.tsx` — 1 replacement
4. `App.tsx` — 1 replacement

### Phase 7: CSS Files
1. `card-utilities.css` — replace all hardcoded colors with CSS variables
2. Fix font-family references in badges and prices
3. Update light mode colors to use tokens
4. `index.html` inline styles — replace hardcoded `#555555` in `.pull-quote` and `.side-note`

### Phase 8: Verification
1. Build check (`npm run build`)
2. Visual comparison: light mode
3. Visual comparison: dark mode
4. Visual comparison: admin
5. Check all breakpoints (mobile, tablet, desktop)
6. Verify WCAG AA contrast ratios for new tokens

---

## 10. Files to Touch

### Cleanup (1 file deleted, 2 files edited)
- `src/components/FontThemeTester.tsx` — **DELETE**
- `src/designTokens.ts` — Remove `FONT_THEMES` and `FONT_SIZE_SCALES`
- `index.html` — Remove FontThemeTester comments

### Core Config (3 files)
- `index.html` — Tailwind config + CSS variables + inline styles
- `src/designTokens.ts` — Token definitions
- `public/favicon.svg` — Color fix

### Logo Files (2+ files)
- `src/components/Logos/LogoEmblem.tsx`
- `src/components/Logos/LogoText.tsx`
- `public/logos/*.svg` (audit)

### Navigation (2 files)
- `src/components/LeftSidebar.tsx`
- `src/components/BottomTabBar.tsx`

### Panels & Drawers (4 files)
- `src/components/CartDrawer.tsx`
- `src/components/AccountPanel/index.tsx`
- `src/components/shop/QuickPeekDrawer.tsx`
- `src/components/ContributorBioPage.tsx`

### Content Pages (6 files)
- `src/components/Reader.tsx`
- `src/components/SinglePageRenderer.tsx`
- `src/components/TeaInventory.tsx`
- `src/components/DesignPortfolio.tsx`
- `src/components/GalleryImage.tsx`
- `src/components/InsightOverlay.tsx`

### Shop (1 file)
- `src/components/shop/ProductInquiry.tsx`

### Admin (4 files)
- `src/admin/components/TeaDetailsModal.tsx`
- `src/admin/components/AddProductModal.tsx`
- `src/components/admin-panel/LoginScreen.tsx`
- `src/App.tsx`

### CSS (1 file)
- `src/styles/card-utilities.css`

**Total: ~25 files modified, 1 file deleted, ~60+ individual color replacements**

---

## Summary

Teajia Palettes transforms the current design from "mostly consistent with scattered hardcoded values" to "a fully token-driven system where every color, font, and visual element traces back to a single source of truth." The palette itself doesn't change much — the existing aesthetic is strong. The work is primarily about **consolidation**: replacing ~60+ hardcoded hex values with named tokens, ensuring logos use `currentColor` or explicit tokens, and making the CSS files reference variables instead of raw values.

As part of this consolidation, the experimental `FontThemeTester` component and its `FONT_THEMES`/`FONT_SIZE_SCALES` infrastructure are removed. The font stack is settled (Lora/Inter/Menlo) — no runtime switching UI is needed. All design decisions live in the token files, not in a component.

The end result: change one value in the Tailwind config, and it propagates everywhere. No bloat, no tester UI, just clean tokens. That's what a palette system should be.

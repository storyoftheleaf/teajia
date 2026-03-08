# Teajia Palettes — "Espresso + Gold / The Whisper + Storyteller"

A complete design system overhaul: new color palette (warm espresso-and-gold), new typography (Vollkorn/Spectral/Jost/Space Mono), unified dark/light mode via CSS variables. Source of truth: `plan/teajia-palettes.html`. Textures and atmosphere effects are preserved.

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

**Font inconsistencies (all getting replaced with new stack):**
- `card-grid-badge` uses system font stack — will become Jost via `var(--font-sans)`
- `card-grid-price` hardcodes Menlo — will become Space Mono via `var(--font-mono)`
- Body `line-height: 1.625` in index.html but `1.85` in `.article-body` — Spectral body uses 1.85, UI text (Jost) uses ~1.5
- Fraunces + Bricolage Grotesque loaded for Alcove cards — evaluate if still needed alongside Vollkorn

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

## 2. Color Palette Redesign — "Espresso + Gold"

Source of truth: `plan/teajia-palettes.html`

The palette is a warm espresso-and-gold system with full dark/light mode support. Every token maps to a semantic role, not a raw color name.

### Dark Mode (Default — "Espresso")

```
tea-bg:          #18130e    — Page background (deep espresso)
tea-surface:     #28211a    — Card/panel surface
tea-elevated:    #3a3126    — Raised elements (modals, code blocks, hover states)
tea-text:        #ede4d4    — Primary text (warm cream)
tea-text-sec:    #b5a892    — Secondary text (body copy, descriptions)
tea-text-dim:    #80735f    — Dim text (labels, metadata, placeholders)
tea-gold:        #b8924e    — Primary accent (gold), buttons, active states
tea-gold-lt:     #d4ac66    — Light gold (hover states, highlights)
tea-border:      rgba(181,168,146,0.14) — Subtle borders
tea-accent-sub:  rgba(184,146,78,0.1)   — Gold tint backgrounds (email capture, badges)
```

### Light Mode — "Parchment"

```
tea-bg:          #f4ece0    — Page background (warm parchment)
tea-surface:     #e6dbcc    — Card/panel surface
tea-elevated:    #d5c8b4    — Raised elements
tea-text:        #18130e    — Primary text (espresso)
tea-text-sec:    #5e5342    — Secondary text
tea-text-dim:    #9a8c78    — Dim text
tea-gold:        #8e6d2e    — Primary accent (darker gold for WCAG AA on light bg)
tea-gold-lt:     #a88340    — Light gold accent
tea-border:      rgba(24,19,14,0.1)     — Subtle borders
tea-accent-sub:  rgba(142,109,46,0.07)  — Gold tint backgrounds
```

### Legacy Token Mapping

These old tokens map to the new system for backwards compatibility during migration:

```
OLD TOKEN            → NEW TOKEN (dark)        → NEW TOKEN (light)
tea-paper (#F3F0E7)  → tea-bg (#f4ece0)        → (light mode bg)
tea-charcoal (#1a1a1a) → tea-bg (#18130e)      → (dark mode bg)
tea-ink (#2C2C2C)    → tea-text (#18130e)       → (light mode text)
tea-seal (#b8882d)   → tea-gold (#b8924e dark / #8e6d2e light)
tea-beige (#D8D0C0)  → tea-elevated (#d5c8b4)  → (light mode elevated)
tea-ink-light (#555) → tea-text-sec (#5e5342)   → (light mode secondary)
```

### CSS Variables (add to `:root`)

```css
/* Dark mode (default) */
:root {
  --tea-bg: #18130e;
  --tea-surface: #28211a;
  --tea-elevated: #3a3126;
  --tea-text: #ede4d4;
  --tea-text-sec: #b5a892;
  --tea-text-dim: #80735f;
  --tea-gold: #b8924e;
  --tea-gold-lt: #d4ac66;
  --tea-border: rgba(181,168,146,0.14);
  --tea-accent-sub: rgba(184,146,78,0.1);
}

/* Light mode */
:root.light, .light {
  --tea-bg: #f4ece0;
  --tea-surface: #e6dbcc;
  --tea-elevated: #d5c8b4;
  --tea-text: #18130e;
  --tea-text-sec: #5e5342;
  --tea-text-dim: #9a8c78;
  --tea-gold: #8e6d2e;
  --tea-gold-lt: #a88340;
  --tea-border: rgba(24,19,14,0.1);
  --tea-accent-sub: rgba(142,109,46,0.07);
}
```

---

## 3. Typography System — "The Whisper + Storyteller"

Source of truth: `plan/teajia-palettes.html`

### Font Stack (NEW — Replacing Lora/Inter/Menlo)

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| **Display** | `Vollkorn`, serif | 400-600 | Article titles, page headings, hero text, card titles, brand wordmark |
| **Subtitle** | `Spectral`, serif | 300 italic | Descriptive subtitles, poetic text, place names, tea descriptions |
| **Body** | `Spectral`, serif | 400 | Article text, long-form reading (17px / 1.85 line-height) |
| **Body Light** | `Spectral`, serif | 300 | Captions, secondary text, descriptions (15px / 1.8 line-height) |
| **Label / Nav** | `Jost`, sans-serif | 300-400 | Tags, categories, metadata, navigation, buttons, CTAs |
| **Mono** | `Space Mono`, monospace | 400 | Hex codes, specs, technical metadata (internal/dev use) |
| **Chinese** | `Noto Serif SC`, serif | — | Chinese tea names (fallback from Vollkorn/Spectral) |

### Google Fonts Import

```
Vollkorn:ital,wght@0,400;0,500;0,600;1,400;1,500
Spectral:ital,wght@0,300;0,400;0,500;1,300;1,400
Jost:ital,wght@0,300;0,400;0,500;1,300;1,400
Space Mono (regular only)
```

### Tailwind Font Family Mapping

```js
fontFamily: {
  serif: ['Vollkorn', 'Noto Serif SC', 'serif'],       // Display / headings
  body: ['Spectral', 'Noto Serif SC', 'serif'],         // Body / reading
  sans: ['Jost', 'sans-serif'],                          // Labels / nav / UI
  mono: ['Space Mono', 'monospace'],                     // Technical
}
```

### Type Scale (from HTML reference)

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display (h1) | Vollkorn | clamp(32-48px) | 400 | 1.12 | 0.01em | Hero headlines, article titles |
| Heading 2 | Vollkorn | clamp(24-32px) | 400 | 1.2 | 0.01em | Section headings, card titles |
| Subtitle | Spectral italic | 17-18px | 300 | 1.4 | normal | Descriptive lines, tea origins |
| Body | Spectral | 17px | 400 | 1.85 | normal | Long-form article text (max-width 540px) |
| Body Light | Spectral | 15px | 300 | 1.8 | normal | Captions, secondary passages |
| Label | Jost | 10px | 400 | 1.4 | 2px | Tags, categories, eyebrows (UPPERCASE) |
| Navigation | Jost | 11px | 400 | 1.4 | 1.5px | Nav items, section headers (UPPERCASE) |
| Links / CTA | Jost | 13px | 400 | — | 0.3px | Interactive text, buttons, inline links |
| Mono | Space Mono | 9px | 400 | — | — | Hex codes, specs (internal use only) |

### Icon Guidance (from HTML reference)

Hairline to thin stroke weight (0.75-1px). Geometric and minimal. Avoid rounded, playful, or heavy icon styles. Icons should feel like they were drawn with a fine pen, matching the delicacy of Spectral at light weights. Phosphor Thin or custom SVG line icons are the best match. Icons at 18-22px in navigation and 14-16px inline with text.

### Fixes Required

1. **Replace Lora with Vollkorn** everywhere — `designTokens.ts`, `index.html` font imports, Tailwind config
2. **Replace Inter with Jost** everywhere — same files
3. **Replace Menlo with Space Mono** everywhere — same files
4. **Add Spectral** as new `font-body` family for reading/body text
5. **`card-grid-badge`** in `card-utilities.css` — Replace system font stack with `var(--font-sans)` (Jost)
6. **`card-grid-price`** in `card-utilities.css` — Replace hardcoded Menlo stack with `var(--font-mono)` (Space Mono)
7. **Body `line-height`** — Standardize on `1.85` for article body (Spectral), `1.625` for UI text (Jost)

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

All replacements use the new Espresso+Gold token system. Components use CSS variable-driven classes so dark/light mode is handled by switching `:root` variables, not by `dark:` prefixes on every element.

### Navigation

#### `LeftSidebar.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#FFFDF5]` | `bg-[var(--tea-surface)]` |
| `bg-tea-seal` active indicator | `bg-[var(--tea-gold)]` |
| `text-tea-ink/40` inactive | `text-[var(--tea-text-dim)]` |
| `text-tea-seal` active | `text-[var(--tea-gold)]` |
| `font-serif` (Lora) | `font-serif` (Vollkorn — changed at config level) |

#### `BottomTabBar.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#FFFDF5]/80` | `bg-[var(--tea-surface)]/80` |
| `border-[#FFFDF5]` (cart badge) | `border-[var(--tea-surface)]` |
| Logo `color="#7A2E2E"` active | `color="var(--tea-gold)"` |
| Logo `color="#8B7D6B"` inactive | `color="var(--tea-text-dim)"` |
| `rgba(0,0,0,0.15)` emblem shadow | Keep as-is |

### Panels & Drawers

#### `CartDrawer.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-[var(--tea-bg)]` |
| `bg-[#1a1a1a]` (dark) | `bg-[var(--tea-bg)]` (handled by CSS var) |
| `bg-[#E6E2D6]` headers | `bg-[var(--tea-surface)]` |
| `bg-[#242424]` dark headers | `bg-[var(--tea-surface)]` (handled by CSS var) |
| `bg-[#FFFDF5]` code block | `bg-[var(--tea-elevated)]` |
| `bg-[#2a2a2a]` dark code | `bg-[var(--tea-elevated)]` (handled by CSS var) |

#### `AccountPanel/index.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-[var(--tea-bg)]` |
| `bg-[#1a1a1a]` | `bg-[var(--tea-bg)]` |
| `bg-[#E6E2D6]` | `bg-[var(--tea-surface)]` |
| `bg-[#242424]` | `bg-[var(--tea-surface)]` |

#### `QuickPeekDrawer.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#1a1a1a]` (dark) | `bg-[var(--tea-bg)]` |

#### `ContributorBioPage.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#FFFDF5]` | `bg-[var(--tea-surface)]` |

### Content Pages

#### `Reader.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-[var(--tea-bg)]` |
| `bg-[#2a2a2a]` (dark) | `bg-[var(--tea-elevated)]` |
| `bg-[#1a1a1a]` fullscreen | `bg-[var(--tea-bg)]` |

#### `SinglePageRenderer.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` (6 instances) | `bg-[var(--tea-bg)]` |
| `bg-[#1a1a1a]` (2 instances) | `bg-[var(--tea-bg)]` |
| `border-[#E6E2D6]` | `border-[var(--tea-border)]` |
| `border-[#121212]` | `border-[var(--tea-border)]` |
| `bg-[#e8e4d9]` | `bg-[var(--tea-surface)]` |
| `text-[#F3F0E7]` | `text-[var(--tea-text)]` |

#### `TeaInventory.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-[var(--tea-bg)]` |
| `bg-[#E6E2D6]` | `bg-[var(--tea-surface)]` |

#### `DesignPortfolio.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#F3F0E7]` | `bg-[var(--tea-bg)]` |
| `bg-[#1a1a1a]` | `bg-[var(--tea-bg)]` |

#### `GalleryImage.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#1a1a1a]` | `bg-[var(--tea-bg)]` |

#### `InsightOverlay.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#242424]` (dark) | `bg-[var(--tea-elevated)]` |

#### `ProductInquiry.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#0a0a0a]` (dark) | `bg-[var(--tea-bg)]` |

### Admin Components

#### `TeaDetailsModal.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#0e0d0c]/90` overlay | `bg-[var(--tea-bg)]/90` |
| `text-[#8a7e6a]` | `text-[var(--tea-text-dim)]` |
| `hover:text-[#c0b49a]` | `hover:text-[var(--tea-text-sec)]` |
| `bg-[#1c1b19]/50` | `bg-[var(--tea-surface)]/50` |
| `bg-[#1c1b19]` | `bg-[var(--tea-surface)]` |
| `border-[rgba(200,170,120,0.2)]` | `border-[var(--tea-border)]` |

#### `AddProductModal.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#859F85]/10` | Keep (green is distinct from gold palette — semantic "reorder" color) |
| `text-[#859F85]` | Keep |
| `border-[#859F85]/30` | Keep |

#### `LoginScreen.tsx`
| Current | Change To |
|---------|-----------|
| `bg-[#1a1a1a]` | `bg-[var(--tea-bg)]` |

#### `App.tsx` (admin fallback)
| Current | Change To |
|---------|-----------|
| `bg-[#0c0c0c]` | `bg-[var(--tea-bg)]` |

---

## 6. Admin Theme Alignment

The admin now uses the same Espresso+Gold dark mode tokens as the public site. No separate admin palette needed — the dark mode IS the admin aesthetic.

**Admin maps directly to dark mode tokens:**
- `tea-bg (#18130e)` — admin page background
- `tea-surface (#28211a)` — admin card/panel surfaces
- `tea-elevated (#3a3126)` — admin modals, raised elements
- `tea-text (#ede4d4)` — admin primary text
- `tea-text-sec (#b5a892)` — admin secondary text
- `tea-text-dim (#80735f)` — admin muted labels
- `tea-gold (#b8924e)` — admin accent (was `tea-accent`)
- `tea-border (rgba(181,168,146,0.14))` — admin borders

**Old admin tokens that get retired:**
- `tea-bg: #0c0c0c` → now `#18130e` (warmer)
- `tea-surface: #121212` → now `#28211a` (warmer)
- `tea-border: #262626` → now `rgba(181,168,146,0.14)` (subtler)
- `tea-accent: #b8882d` → now `tea-gold: #b8924e` (unified name)

---

## 7. CSS & Card Styles

### `card-utilities.css` Changes

```css
/* All colors now reference CSS variables — dark/light mode handled at :root level */

.card-grid-item {
  background-color: var(--tea-surface);  /* was #1a1a1a */
}

.card-grid-image-container {
  background-color: var(--tea-surface);  /* was #1a1a1a */
}

.card-grid-title {
  font-family: var(--font-serif);  /* Vollkorn */
  color: var(--tea-text);  /* was #E8DDCC */
}

.card-grid-price {
  font-family: var(--font-mono);  /* Space Mono — was hardcoded Menlo stack */
  color: var(--tea-gold);  /* was hardcoded seal color */
}

.card-grid-badge {
  color: var(--tea-text-dim);  /* was rgba(232, 221, 204, 0.7) */
  font-family: var(--font-sans);  /* Jost — was system font stack */
}

.card-grid-description {
  font-family: var(--font-body);  /* Spectral */
  color: var(--tea-text-sec);  /* was rgba(232, 221, 204, 0.8) */
}

/* Light mode — handled automatically via CSS variable switching */
/* No more .light overrides needed for colors */

/* Focus ring */
.card-grid-item:focus-visible {
  outline: 2px solid var(--tea-gold);
  box-shadow: 0 0 0 4px var(--tea-accent-sub);
}
```

---

## 8. Texture & Atmosphere — DO NOT REMOVE

**Textures are a core part of the design. They stay.**

### Preserve These Exactly

- `.texture-overlay` — SVG noise at 6% opacity
- `.grain-texture` — Fractal grain with multiply blend
- `.fabric-texture` — Subtle diagonal lines at 3% opacity
- `.paper-texture` — Repeating linear gradient simulating paper fiber
- `backgroundImage['paper-texture']` in `designTokens.ts` — keep
- Article image filters: `sepia-[0.15] brightness-[0.9] contrast-[1.05] saturate-[0.8]`

### Color References in Textures — Update to New Tokens

- The `tea-card-scroll` scrollbar thumb `rgba(200,170,120,0.15)` — keep (warm gold territory, matches tea-gold)
- Article `::after` underlines — update from `var(--color-tea-seal)` to `var(--tea-gold)`
- Drop caps — update from `var(--color-tea-seal)` to `var(--tea-gold)`
- Pull quotes border — update to `var(--tea-gold)`
- Pull quote text `#555555` — update to `var(--tea-text-sec)` (which is `#5e5342` in light mode)
- Side note text `#555555` — update to `var(--tea-text-sec)`
- Side note bg `rgba(244, 240, 230, 0.5)` — update to use `var(--tea-surface)` with opacity
- Section break `rgba(44, 44, 44, 0.3)` — update to `var(--tea-border)`

---

## 9. Implementation Phases

### Phase 0: Cleanup + Font Foundation
1. Delete `src/components/FontThemeTester.tsx`
2. Remove `FONT_THEMES` and `FONT_SIZE_SCALES` exports from `designTokens.ts`
3. Remove `FontThemeTester` comments from `index.html` CSS variable section
4. Replace font imports: Lora → Vollkorn, Inter → Jost, add Spectral, Menlo → Space Mono
5. Update Tailwind fontFamily config in `index.html`
6. Update `designTokens.ts` with new font stacks and Espresso+Gold color palette

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

Teajia Palettes is a full design system overhaul — "Espresso + Gold / The Whisper + Storyteller."

**What changes:**
- **Colors**: The old scattered hex values (tea-paper, tea-ink, tea-seal) are replaced by a unified warm espresso-and-gold system with proper dark/light mode tokens, all derived from `plan/teajia-palettes.html`
- **Typography**: Lora/Inter/Menlo are replaced by Vollkorn (display), Spectral (body/reading), Jost (labels/UI), Space Mono (technical) — a more refined editorial stack
- **Cleanup**: The experimental `FontThemeTester` component and its `FONT_THEMES`/`FONT_SIZE_SCALES` infrastructure are deleted

**What stays:**
- **Textures are preserved**: `.texture-overlay` (SVG noise), `.grain-texture` (fractal grain), `.fabric-texture` (diagonal lines), `.paper-texture` (linear gradient fibers), article image filters (sepia/brightness/contrast/saturate) — these are core to the atmosphere and remain untouched
- **Layout/structure**: No component restructuring, routing changes, or feature additions
- **Admin functionality**: All admin features stay, just re-skinned with the unified palette

The end result: a cohesive, warm, editorial design system where every color and font traces back to a single source of truth (`designTokens.ts` + Tailwind config). Change one token value, it propagates everywhere.

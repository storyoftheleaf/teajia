# COLOR_RULES.md — Teajia Structural Color & Styling Rules

**Purpose:** Prevent theme-flip bugs, invisible text, hardcoded-rgba drift, and white-border-on-dark issues. These rules are mandatory for all component work.

---

## The 10 Safe Tokens

These are the ONLY color tokens that should be used in new code. They all use CSS custom properties that correctly adapt between light and dark mode.

| Token | Purpose | Dark Mode | Light Mode |
|---|---|---|---|
| `tea-bg` | Page background | `#22201c` espresso | `#f4ece0` parchment |
| `tea-surface` | Card/panel background | `#322e29` warm dark | `#e4ddd3` warm light |
| `tea-elevated` | Modal/popover background | `#423d36` | `#d5c8b4` |
| `tea-text` | Primary text | `#ede4d4` cream | `#18130e` espresso |
| `tea-text-sec` | Secondary/muted text | `#ddd2bd` | `#332b20` |
| `tea-text-dim` | Captions, labels, hints | `#b3a283` warm brown (outdoor-tuned) | `#564a37` (outdoor-tuned) |
| `tea-gold` | Accent, links, active states | `#a8874d` | `#8e6d2e` |
| `tea-gold-lt` | Hover/highlight gold | `#bfa06a` | `#a88340` |
| `tea-border` | All borders and dividers | `rgba(168,135,77,0.14)` warm gold | `rgba(142,109,46,0.16)` |
| `tea-accent-sub` | Subtle accent backgrounds | `rgba(184,146,78,0.1)` | `rgba(142,109,46,0.07)` |

### Fixed-value tokens (non-adaptive, use sparingly)
| Token | Value | When to use |
|---|---|---|
| `tea-green` | `#5A6E5A` | Tea type badge only |
| `tea-moss` | `#2A3430` | Tea type badge only |

---

## Rule 1: NEVER Use Legacy Aliases in New Code

The following tokens have **misleading names** and MUST NOT be used:

| Legacy Token | Why It's Dangerous | Use Instead |
|---|---|---|
| `tea-ink` | Maps to `var(--tea-text)` — is **cream** in dark mode, not "ink" | `tea-text` |
| `tea-paper` | Hardcoded `#ede4d4` — does **not** adapt to theme | `tea-text` (for readable text) or `tea-bg` |
| `tea-charcoal` | Maps to `var(--tea-bg)` — is **parchment** in light mode | `tea-bg` |
| `tea-seal` | Just an alias for `tea-gold` | `tea-gold` |
| `tea-muted` | Just an alias for `tea-text-dim` | `tea-text-dim` |
| `tea-beige` | Just an alias for `tea-elevated` | `tea-elevated` |

**Why this matters:** If you write `bg-tea-ink` expecting a dark background, it will be **cream** in dark mode because `tea-ink` = `var(--tea-text)` = cream. Your white text will be invisible.

---

## Rule 2: NEVER Use Hardcoded rgba() in Style Props

Hardcoded `rgba()` values do not respond to theme changes. They work in one mode and fail in the other.

### Bad (breaks in light/dark mode)
```tsx
// ❌ These are all bugs waiting to happen
style={{ background: 'rgba(0,0,0,0.25)' }}
style={{ border: '1px solid rgba(200,170,120,0.20)' }}
style={{ boxShadow: 'inset 0 1px 0 rgba(200,170,120,0.06)' }}
className="border-[rgba(184,146,78,0.08)]"
className="bg-[rgba(0,0,0,0.2)]"
```

### Good (adapts to theme)
```tsx
// ✅ Use Tailwind token classes
className="bg-tea-surface border border-tea-border"
className="bg-tea-accent-sub border border-tea-gold/20"

// ✅ If you MUST use inline styles, reference CSS variables
style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}
style={{ background: 'var(--tea-surface)' }}
```

### The One Exception
Grain texture SVGs and complex gradients that are purely decorative (opacity < 0.1) may use hardcoded rgba. But borders, backgrounds, and text MUST use tokens.

---

## Rule 3: NEVER Use `border-white` or `border-black`

These hardcoded colors create visible white lines on dark backgrounds or black lines on light backgrounds.

```tsx
// ❌ White border visible against dark theme
className="border border-white/[0.08]"

// ❌ Black border visible against light theme
className="border border-black/10"

// ✅ Always use the border token
className="border border-tea-border"

// ✅ For stronger borders, use gold with opacity
className="border border-tea-gold/20"
```

---

## Rule 4: NEVER Use `dark:` Prefix to Fix a Token Bug

If you find yourself writing `bg-tea-ink dark:bg-tea-ink` or `text-tea-paper dark:text-tea-paper`, the token is wrong. Switch to a semantic token instead of adding dark-mode overrides for tokens that should already work in both modes.

```tsx
// ❌ Patching a broken token with dark: prefix
className="bg-tea-ink dark:bg-tea-ink text-tea-paper dark:text-tea-paper"

// ✅ Using tokens that work in both modes
className="bg-tea-surface text-tea-text"
```

The `dark:` prefix is ONLY for genuine cases where light and dark modes need fundamentally different values — not for fixing tokens that should already adapt.

---

## Rule 5: Card/Panel Recipe

Every card or panel MUST follow this pattern:

```tsx
// Standard card
className="bg-tea-surface border border-tea-border rounded-md"

// Elevated card (modals, popovers)
className="bg-tea-elevated border border-tea-border rounded-md"

// Subtle accent card (admin nav items, highlighted rows)
className="bg-tea-accent-sub border border-tea-border"
```

**Never** use `bg-[rgba(0,0,0,...)]` for card backgrounds. **Never** use `border-tea-gold/15` or `border-white/[0.08]` for card borders.

---

## Rule 6: Text Contrast Pairing

Text must always contrast with its background. Here are the safe pairings:

| Background | Primary Text | Secondary Text | Dim/Label Text |
|---|---|---|---|
| `tea-bg` | `tea-text` | `tea-text-sec` | `tea-text-dim` |
| `tea-surface` | `tea-text` | `tea-text-sec` | `tea-text-dim` |
| `tea-elevated` | `tea-text` | `tea-text-sec` | `tea-text-dim` |
| any background | `tea-gold` | `tea-gold/70` | — |

**Never** pair `text-tea-paper` with `bg-tea-ink` — both resolve to cream in dark mode.

---

## Rule 7: Opacity Notation

Use Tailwind's slash notation consistently. Never use bracket notation for common opacities.

```tsx
// ❌ Inconsistent
className="bg-white/[0.05]"
className="text-tea-text/[0.7]"
className="border-tea-ink/[0.02]"

// ✅ Consistent
className="bg-tea-accent-sub"  // prefer the token if it fits
className="text-tea-text/70"
className="border-tea-border"  // prefer the token if it fits
```

---

## Rule 8: Interactive Hover/Focus States

```tsx
// ✅ Button hover — use gold for emphasis
className="hover:bg-tea-gold/10"
className="hover:border-tea-gold/30"

// ✅ Focus ring — always gold
className="focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2"

// ❌ Never hardcode hover colors
onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,146,78,0.18)' }}
```

---

## Quick Reference: Common Patterns

### Divider
```tsx
<div className="border-t border-tea-border" />
```

### Section label
```tsx
<span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Label</span>
```

### Gold accent line
```tsx
<div className="w-12 h-[1px] bg-tea-gold" />
```

### Inset panel (subtle depth)
```tsx
<div className="bg-tea-surface border border-tea-border rounded-md"
     style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
```

---

## Rule 9: UI Text Scale (`text-ui-N`)

For raw pixel font sizes, use the named UI text scale in `src/designTokens.ts` (`UI_TEXT_SCALE`):

| Class | Pixel size |
|---|---|
| `text-ui-8` | 8px |
| `text-ui-9` | 9px |
| `text-ui-10` | 10px |
| `text-ui-11` | 11px |
| `text-ui-12` | 12px |
| `text-ui-13` | 13px |
| `text-ui-14` | 14px |
| `text-ui-15` | 15px |
| `text-ui-16` | 16px |
| `text-ui-17` | 17px |
| `text-ui-20` | 20px |
| `text-ui-26` | 26px |
| `text-ui-28` | 28px |

```tsx
// ❌ Blocked by lint:colors Rule 7
<span className="text-[10px]">…</span>

// ✅ Use the named scale
<span className="text-ui-10">…</span>
```

Long-tail display sizes (one-off hero text at 48px / 69px / 140px / etc.) are allowed as `text-[Npx]` arbitrary classes — they don't have scale stops because they appear once or twice.

For full typography presets (font, weight, leading, tracking together), use `TYPOGRAPHY_CLASSES` from `designTokens.ts` (`h1`, `h2`, `h3`, `body`, `label`, `nav`, etc.).

---

## Rule 10: Tap Targets (`tap-target`)

Any interactive icon or button under 44×44 must add the `tap-target` utility class (defined in `card-utilities.css`). It enforces the WCAG 2.5.5 / Apple HIG / Material Design floor by adding invisible padding around the click area without changing the visible element size.

```tsx
// ❌ 36×36 button — fails WCAG 2.5.5
<button className="w-9 h-9 rounded-full">
  <ChevronLeft />
</button>

// ✅ Same visual size, 44×44 click area
<button className="tap-target w-9 h-9 rounded-full">
  <ChevronLeft />
</button>
```

**Don't add `tap-target` when:**
- The element is inside a larger interactive parent (e.g. a row button) where the parent IS the click target with ample padding.
- The element is purely decorative (no `onClick`).
- Inline icons inside a parent button (only the parent button needs `tap-target`).

---

## Rule 11: No Color Literals Inside Inline Styles

Rule 2 has always said this. What changed is that `lint:colors` can now *see* it: the check reads inside `style={{ … }}` objects, tracking brace depth, instead of only matching `className` strings. Two separate rounds each fixed one component by hand because the same defect passed the lint one attribute over.

```tsx
// ❌ Blocked: the lint reads inside the style object now
style={{ color: '#a65d4e' }}
style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.95)' }}

// ✅ Tokens resolve in both themes
style={{ color: 'var(--tea-text-sec)' }}
style={{ boxShadow: 'inset 0 0 0 2px rgb(var(--tea-gold-rgb) / 0.4)' }}
```

`var(--token)` and `rgb(var(--token-rgb) / a)` are never flagged.

### The two exceptions, and how to claim them

**1. The colour is data about the item, not styling applied to it.** The liquor colour of a tea is what the liquid looks like in the cup; it no more adapts to a theme than a photograph does. Mark the line with `color-data` in a comment, saying what the datum is:

```tsx
const hex = LIQUOR_COLORS[term.id];        // color-data: liquor colour from the taxonomy
style={{ background: hex }}                // color-data: liquor colour, see above
```

A term the taxonomy has no colour for gets no swatch. Never invent a grey to stand in for a measurement nobody made.

**2. The file renders an artifact that leaves the app.** A PNG export or a PDF has no theme to adapt to, and the rasteriser reads computed inline values, so a custom property would bake in whichever theme the sender happened to be using. Put `@color-literals` in the file's header comment with the reason. See `src/components/tasting/TastingCard.tsx`.

### Enforcement is a ratchet

The rule **blocks** on `src/components/shop/`, `src/components/tasting/`, `src/components/wisdom/`, `ProductPage.tsx`, `Shop.tsx`, `TeaInventory.tsx`. These are clean. Everywhere else it prints a **notice** with a count (505 lines across ~70 files at the time of writing, mostly decorative art direction in `src/pages/read/`). Extend `INLINE_STYLE_ENFORCED` in `scripts/lint-colors.sh` as each area is cleared. Do not widen it to a directory you have not cleared.

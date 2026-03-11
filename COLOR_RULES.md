# COLOR_RULES.md — Teajia Structural Color & Styling Rules

**Purpose:** Prevent theme-flip bugs, invisible text, hardcoded-rgba drift, and white-border-on-dark issues. These rules are mandatory for all component work.

---

## The 10 Safe Tokens

These are the ONLY color tokens that should be used in new code. They all use CSS custom properties that correctly adapt between light and dark mode.

| Token | Purpose | Dark Mode | Light Mode |
|---|---|---|---|
| `tea-bg` | Page background | `#18130e` espresso | `#f4ece0` parchment |
| `tea-surface` | Card/panel background | `#28211a` warm dark | `#e6dbcc` warm light |
| `tea-elevated` | Modal/popover background | `#3a3126` | `#d5c8b4` |
| `tea-text` | Primary text | `#ede4d4` cream | `#18130e` espresso |
| `tea-text-sec` | Secondary/muted text | `#b5a892` | `#5e5342` |
| `tea-text-dim` | Captions, labels, hints | `#917a55` warm brown | `#9a8c78` |
| `tea-gold` | Accent, links, active states | `#b8924e` | `#8e6d2e` |
| `tea-gold-lt` | Hover/highlight gold | `#d4ac66` | `#a88340` |
| `tea-border` | All borders and dividers | `rgba(160,130,70,0.18)` warm brown | `rgba(130,100,45,0.18)` |
| `tea-accent-sub` | Subtle accent backgrounds | `rgba(160,130,70,0.12)` | `rgba(130,100,45,0.10)` |

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

## Migration Checklist (215 legacy uses across 50 files)

When touching any file, convert legacy tokens to semantic ones:

- [ ] `tea-ink` → `tea-text`
- [ ] `tea-paper` → `tea-text` (if used for readable text) or `tea-bg` (if used for backgrounds)
- [ ] `tea-seal` → `tea-gold`
- [ ] `tea-charcoal` → `tea-bg`
- [ ] `tea-muted` → `tea-text-dim`
- [ ] `tea-beige` → `tea-elevated`
- [ ] `tea-ink-light` / `tea-ink-secondary` → `tea-text-sec`
- [ ] `tea-paper-secondary` → `tea-text-dim`
- [ ] `tea-beige-dark` → `tea-text-dim`
- [ ] `tea-seal-dark` → `tea-gold`
- [ ] `tea-accent` → `tea-gold`
- [ ] `tea-paper-dark` → `tea-surface`
- [ ] Any `rgba(0,0,0,...)` background → `tea-surface` or `tea-elevated`
- [ ] Any `rgba(184,146,78,...)` or `rgba(200,170,120,...)` border → `tea-border` or `tea-gold/N`
- [ ] Any `border-white/...` → `tea-border`
- [ ] Any `border-black/...` → `tea-border`

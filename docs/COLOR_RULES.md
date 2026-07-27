# COLOR_RULES.md: Teajia Structural Color & Styling Rules

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

### The format-badge hues

Nine hues exist outside the palette above, for the media-format badges in the reading and listening library (book, podcast, article, video, playlist, documentary) and the playlist platform tags. They live in `card-utilities.css` as `--badge-<name>-rgb`, one triplet per hue, and are only ever reached through the `.badge-format-<name>` classes. Do not write `text-[#fcd34d]`; there is no Tailwind token for these and there should not be.

Before round nine this block was a second colour system: ten hues, each spelled twice as a raw Tailwind-stock literal, none of them tokens and none of them measured. Six of the ten failed AA in light mode on the surface they actually sit on, at 11px, because every light ink was a Tailwind 700 shade picked to sit on white and never rechecked against parchment: green 3.50, orange 3.54, amber 3.63, teal 3.77, pink 4.04, red 4.30. All nine now measure between 4.98:1 and 5.99:1 in light mode and 6.14:1 to 7.40:1 in dark, against the composited tint over `--tea-surface`, and each number is written on the line that sets the colour. `tea-green` was deleted: declared, never referenced, and its dark ink was a copy of `green`'s.

Adding a hue means adding a triplet and measuring both inks.

---

## Rule 1: NEVER Use Legacy Aliases in New Code

The following tokens have **misleading names** and MUST NOT be used:

| Legacy Token | Why It's Dangerous | Use Instead |
|---|---|---|
| `tea-ink` | Maps to `var(--tea-text)`, is **cream** in dark mode, not "ink" | `tea-text` |
| `tea-paper` | Hardcoded `#ede4d4`, does **not** adapt to theme | `tea-text` (for readable text) or `tea-bg` |
| `tea-charcoal` | Maps to `var(--tea-bg)`, is **parchment** in light mode | `tea-bg` |
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

The `dark:` prefix is ONLY for genuine cases where light and dark modes need fundamentally different values, not for fixing tokens that should already adapt.

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
| any background | `tea-gold` | `tea-gold/70` |, |

**Never** pair `text-tea-paper` with `bg-tea-ink`, both resolve to cream in dark mode.

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
// ✅ Button hover, use gold for emphasis
className="hover:bg-tea-gold/10"
className="hover:border-tea-gold/30"

// ✅ Focus ring, always gold
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

Long-tail display sizes (one-off hero text at 48px / 69px / 140px / etc.) are allowed as `text-[Npx]` arbitrary classes, they don't have scale stops because they appear once or twice.

For full typography presets (font, weight, leading, tracking together), use `TYPOGRAPHY_CLASSES` from `designTokens.ts` (`h1`, `h2`, `h3`, `body`, `label`, `nav`, etc.).

---

## Rule 10: Tap Targets (`tap-target`)

Any interactive icon or button under 44×44 must add the `tap-target` utility class (defined in `card-utilities.css`). It enforces the WCAG 2.5.5 / Apple HIG / Material Design floor by adding invisible padding around the click area without changing the visible element size.

```tsx
// ❌ 36×36 button, fails WCAG 2.5.5
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

**3. The whole surface is theme-independent by design.** Added in round nine for the Read section, and narrower than it sounds: it is not "this page looks better dark". It means the surface does not participate in the site theme at all, has a declared palette of its own, and would be broken rather than restyled by taking `--tea-*`. See the decision recorded below.

### The Read section, decided

`src/pages/read/**` held 363 of the remaining literals. That is now a decision rather than a backlog item.

The Read section is a single always-dark editorial system, ported from mockups, that stays dark when the rest of the site is on parchment. `read/immersive.tsx` owns its palette in a `C` block, deliberately scoped rather than reaching for `--tea-*`, because `--tea-bg` on parchment turns a night read into a white page. Much of the colour there is also art direction in the strict sense: the oxidation gradient in `LeafToLiquor` runs from green leaf to black leaf, and the six dots beside the six colours of tea are what those teas look like. Those are the same kind of fact as a liquor colour.

Every file in that directory carries `@color-literals`, and `immersive.tsx` carries the full reasoning plus three conditions:

1. New colour goes in `C` or `ACCENTS`, once, not as a hex in a component.
2. Text pairs are still measured, against that palette's own background. `C.dim` on `C.bg` is 4.09:1 and is confined to non-essential marginalia; body and navigation take `C.taupe` at 10.6:1.
3. The marker exempts files that exist. The directory is in the blocking list, so a new file there fails until someone writes the marker and means it.

`ProductPage.tsx` is marked under exception 2 for the same round: its chrome is all tokens, its plate art is drawing on a fixed 1080x1350 frame built to be screenshotted.

### Enforcement is a ratchet

The rule **blocks** on `src/components/shop/`, `src/components/tasting/`, `src/components/wisdom/`, `src/components/shared/`, `src/components/reader/`, `src/pages/read/`, `ProductPage.tsx`, `Shop.tsx`, `TeaInventory.tsx`. Everywhere else it prints a **notice** with a count (505 at the start of round nine, 79 after it). Extend `INLINE_STYLE_ENFORCED` in `scripts/lint-colors.sh` as each area is cleared. Do not widen it to a directory you have not cleared or claimed.

One thing round nine found while clearing `src/components/reader/`, worth repeating because it is invisible: seven components wrote `var(--color-tea-gold, #c9a84c)`. There is no `--color-tea-gold`. The palette declares `--tea-gold`. Twelve declarations across eight files had therefore been painting their hex fallbacks in both themes since they were written. If you see a `var(--x, #hex)` pair, check that `--x` exists before assuming the fallback is a fallback.

---

## Rule 12: One Solid CTA Treatment

`bg-tea-gold` next to `text-tea-bg` is cream on bronze. Measure it:

| Mode | Pair | Ratio |
|---|---|---|
| Dark | `#ede4d4`-adjacent cream on `#a8874d` | 4.84:1, passes |
| Light | `#f4ece0` on `#8e6d2e` | **4.10:1, fails** |

Light mode is the mode a customer is most likely reading in outdoors, and this is the pairing on primary actions across the app.

The fix is one class, in `card-utilities.css`:

```tsx
// ❌ Blocked by lint:colors Rule 12
className="bg-tea-gold text-tea-bg hover:bg-tea-gold-lt"

// ✅ The measured treatment. Carries colour only; compose shape and type yourself.
className="cta-solid rounded-xl"

// ✅ Or just use the shared button, which points at it
<Button variant="primary">Add to basket</Button>
```

`.cta-solid` fills with `--tea-gold-solid`, which is identical to `--tea-gold` on espresso and darkens to `#806229` on parchment: **4.91:1** with the same cream, still visibly bronze rather than brown. Dark mode is untouched. The hover moves away from the page in both modes via `--tea-gold-solid-hover`, which is why it needs a token of its own: lightening a bronze fill is right on espresso (6.6:1) and wrong on parchment, where `--tea-gold-lt` under cream measures 3.0:1, so the button became unreadable exactly while the cursor was on it.

For an outline button that fills on hover, use `.cta-solid-hover` rather than writing `hover:bg-tea-gold hover:text-tea-bg`.

**Ratchet:** blocking on `src/components/**` and `ProductPage.tsx` (101 sites cleared in round nine). A notice with a count elsewhere, currently 171, nearly all `src/admin/` and `src/pages/`.

---

## Rule 13: No Em-Dashes, Including In Comments

The project bans the em-dash in all copy and all comments. Use a period, a comma, a colon, parentheses, or rephrase.

This had never been checked, which is how `card-utilities.css` accumulated 111 in its own comments and `lint-colors.sh` accumulated 20, eight of those inside the error strings it prints at whoever it is correcting.

**Ratchet:** blocking on `scripts/lint-colors.sh` and `src/styles/*.css`, which are clear. A notice with a count on `src/**`, currently around 2,100, the large majority in comments.

A note for whoever sweeps the rest: three uses are not prose and must not be replaced blindly.

- `'—'` as the empty-value glyph in a table cell (`value || '—'`). That is a typographic placeholder, not writing.
- `split('—')` / `join(' — ')` in `SinglePageRenderer` and `TeaCompass/import/importEvidence`. Those are parser tokens with tests pinned to them.
- Attribution dashes under a quote. Round nine removed these instead, since the gold rule above the attribution already carries the signal.

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

**3. The colour is art direction, not chrome.** Added in round nine for the Read section and narrowed on 2026-09-20. It covers a colour that is a fact about an object or a staged backdrop: the oxidation scale from green leaf to black leaf, the six dots that are the six colours of tea, a one-off hero gradient tuned to one article. Those have no light variant, any more than a photograph does. It does not cover page chrome that happens to sit in the same file. See the decision recorded below.

### The Read section, decided, and revised

`src/pages/read/**` held 363 of the remaining literals. Round nine made that a decision rather than a backlog item: the Read section was a single always-dark editorial system, ported from mockups, that stayed dark when the rest of the site was on parchment, because `--tea-bg` on parchment turned a night read into a white page.

**Revised 2026-09-20.** Adrian: "I think the read can be moved into light if someone switches into light mode." The reader now follows the site theme. `read/immersive.tsx` still owns its palette in the `C` block, and the seventeen article files still read `C.bg`, `C.gold`, `C.ink` and so on unchanged. What changed is what each entry resolves to: every field is a custom property (`--tj-read-*`, declared in `card-utilities.css`) whose dark value is pinned to the exact literal the reader always used and whose light value is drawn from the site's own light tokens: parchment ground, espresso ink, aged-bronze gold. Dark mode is pixel-identical to before. Light mode repaints instead of showing a night read on white. `tests/read-light-mode.spec.ts` holds both halves of that: the dark background must equal the old literal, the light one must equal the parchment token.

What stays literal, under exception 3, is the colour that is art direction in the strict sense. The oxidation gradient in `LeafToLiquor` runs from green leaf to black leaf, the six dots beside the six colours of tea are what those teas look like, and several articles open on a one-off atmospheric hero gradient tuned to that piece. Those are the same kind of fact as a liquor colour. The recurring structural gradients (the bordered inset card, the photo placeholder plate) are chrome, reused across a dozen files, and route through `--tj-read-card-*`, `--tj-read-plate-*` and `--tj-read-empty-from`.

Every file in that directory still carries `@color-literals`, for that narrower reason, and `immersive.tsx` carries the full reasoning plus three conditions:

1. New colour goes in `C` or `ACCENTS`, once, or in the `--tj-read-*` block in `card-utilities.css` when it needs a light and dark pair. Never a hex in a component.
2. Text pairs are measured against that palette's own background, in both modes. Dark: `C.dim` on `C.bg` is 4.09:1 and is confined to non-essential marginalia; body and navigation take `C.taupe` at 10.6:1. Light: the dim text token on parchment measures 7.4:1, so light mode clears the floor the dark end cannot.
3. The marker exempts files that exist. The directory is in the blocking list, so a new file there fails until someone writes the marker and means it, for a colour that is genuinely data about the object.

One trap that would have defeated the whole change: every article page used to write a fixed dark gold onto the page on load, left over from a retired accent picker. It now writes nothing unless an accent was actually chosen, which today is never.

`ProductPage.tsx` is marked under exception 2 for the same round: its chrome is all tokens, its plate art is drawing on a fixed 1080x1350 frame built to be screenshotted.

### Enforcement is a ratchet

The rule **blocks** on `src/components/shop/`, `src/components/tasting/`, `src/components/wisdom/`, `src/components/shared/`, `src/components/reader/`, `src/pages/read/`, `ProductPage.tsx`, `Shop.tsx`, `TeaInventory.tsx`. Everywhere else it prints a **notice** with a count (505 at the start of round nine, 79 after it). Extend `INLINE_STYLE_ENFORCED` in `scripts/lint-colors.sh` as each area is cleared. Do not widen it to a directory you have not cleared or claimed.

Round ten added `src/admin/`. Eighteen lines, and only two of them were fixed rather than converted:

- `InvoicePdf.tsx` and `PurchaseOrderPdf.tsx` earn exception 2 and now say so in their headers. `@react-pdf/renderer` is not a browser, so a `var(--tea-text)` there does not adapt badly, it does not resolve at all. Both carry a document palette (white stock, near-black body, grey meta) chosen to survive a monochrome printer at a supplier's office, and that is the right palette for a file that leaves the app.
- `SourcesView`'s vendor avatar was a three-stop radial gradient with the initials in `text-tea-bg/90` over it. The highlight stop was `#c6a473`, and parchment on that is **2.00:1**, so in light mode the initials were very nearly gone. It reads fine to whoever built it because the same stop is 6.94:1 on espresso. It is now the flat `--tea-gold-solid` at **4.85:1** light and **4.83:1** dark. A gradient means the worst stop sets the contrast, which is a reason to stop reaching for one on a 40px disc.
- The same file painted `LIQUOR_COLORS[c] || '#888'`. A term the taxonomy has no colour for now gets no swatch, per the rule above: never invent a grey to stand in for a measurement nobody made.
- `InventoryActionRail`'s left hairline was a hand-mixed gold at the border token's alpha but never the palette's gold in either mode. It is `var(--tea-border)` now.
- Two drop shadows moved from inline `style` objects to arbitrary `shadow-[...]` classes, which is the documented Rule 2 carve-out. A shadow is the absence of light; it does not invert with the theme, which is why every entry in `designTokens` `SHADOWS` is also black-based.

A false positive worth knowing about: the scanner reads `&#9679;`, the HTML entity for a bullet, as a hex literal, because `#9679` matches. Two admin tables tripped it, for a colour that was not in the style object at all. Writing the character as `{'●'}` is both clearer and quiet.

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

**Ratchet:** blocking on `src/components/**`, `src/admin/**`, `src/pages/**` and `src/App.tsx`. Round nine cleared 101 sites in `src/components`; round ten cleared the remaining 171, of which 44 were in `src/pages` across 22 files. Three sites are left, in `src/samples/**` and `src/AboutPage.tsx`, which nobody has owned yet; they are a notice with a count.

Four of the `src/pages` sites were not buttons at all but selected-state chips (`tasted ? 'bg-tea-gold text-tea-bg' : 'border border-tea-border'`). They take the same class: it carries colour only, so a chip composes it exactly as a button does.

Converting is mechanical but not blind. Delete any `hover:bg-tea-gold/90` or `active:bg-tea-gold/80` sitting alongside the pair rather than keeping it. `.cta-solid` already owns its hover through `--tea-gold-solid-hover`, and a leftover Tailwind hover puts the 4.10:1 pairing back at exactly the moment the pointer is on the button.

---

## Rule 13: No Em-Dashes, Including In Comments

The project bans the em-dash in all copy and all comments. Use a period, a comma, a colon, parentheses, or rephrase.

This had never been checked, which is how `card-utilities.css` accumulated 111 in its own comments and `lint-colors.sh` accumulated 20, eight of those inside the error strings it prints at whoever it is correcting.

**Ratchet:** blocking on `scripts/lint-colors.sh`, `src/styles/*.css`, and, from round ten, `src/admin/**`, `src/pages/**`, `src/components/**`, `src/lib/**`, `src/utils/**`, `src/hooks/**`, `src/designTokens.ts` and `src/App.tsx`. A notice with a count everywhere else, currently around 170, mostly `src/data/**`, `src/types.ts` and `src/AboutPage.tsx`.

`src/admin/**` was 563, of which 73 were the empty-value glyph and 490 were writing. It went in the same pass and by the same rule, with one addition worth stating, because the mechanical answer produced it 63 times: **when the gloss after the dash is itself a list, the separator has to be a colon, not a comma.** `{/* Operations — staff, admin, owner */}` becomes `Operations: staff, admin, owner`, never `Operations, staff, admin, owner`, where the separator and the list items read at the same rank and the label stops being a label. The same test settles the aligned key/value comment blocks, where the answer is neither: `//   /admin/network/wholesale/new — new draft` wants a run of spaces, since the column is already doing the separating.

Round ten swept 1,351 lines out of the public and shared tree: 1,326 by the rule below and 25 by hand where the mechanical answer read badly. The rule is:

- **A colon before a capital.** `MOVEMENT II — Slowness` becomes `MOVEMENT II: Slowness`. Almost every comment label and every `<title>` took this branch.
- **A comma otherwise.** `two leaves and a bud — the only part that is taken` becomes `…a bud, the only part that is taken`.
- **A pair of dashes becomes a pair of commas**, because a parenthetical is what it was: `and — when the browser reports itself offline — wait` becomes `and, when the browser reports itself offline, wait`.
- **Rewrite where the dash carried a real pause**, which in practice means a dash at the end of a wrapped comment line, where a comma leaves the next line starting mid-thought. Those took `, so` or `:` or a reflow.

### How the check knows what is not prose

Three uses are not writing, and the check recognises them by shape rather than waving whole directories through. A new exception costs a sentence in `lint-colors.sh`, which is the point.

- `'—'` as the empty-value glyph (`value || '—'`, `<span>—</span>`). Typography standing in for a missing datum. Matched as a quoted string or text node containing nothing else.
- The character inside a bracket expression, which is a regex class (`/[\s,.;:—-]+$/`, `split(/[-—]/)`), not a sentence.
- The two parsers whose tests pin the token: the timeline splitter in `SinglePageRenderer` and the Curate import evidence joiner with its spec. Named by path, and for `SinglePageRenderer` only on a `split(`/`join(` line, so prose elsewhere in that file is still caught.

A fourth use exists and is **not** exempt: attribution dashes under a quote. Round nine removed these rather than converting them, since the gold rule above the attribution already carries the signal, and round ten removed the last two: `ArticlePage`'s page attribution, and the quote-block preview in the admin `ArticleEditorModal`. The second was also a bug independent of the dash. `PullQuote` in `components/immersive/sections.tsx` renders the attribution with no dash, so the editor was previewing a mark the published page does not have.

When the glyph is real but the shape does not match, write it as a unicode escape rather than arguing with the rule. `StockMovementPanel` prints a resulting balance as `` `${current}${unit} → —` ``: the em-dash there is the empty-value glyph, but the string has other content in it, so it is not the exempt shape. `\u2014` in the source keeps the output identical and leaves nothing for a reader (or a sweeper) to misread as prose. This is the same trick `lint-colors.sh` uses on its own em-dash so it does not report its own source line.

### What to watch when sweeping a new area

The mechanical rule is safe on comments and reasonable on prose, but two things need eyes:

- **Tests that pin a token.** `importEvidence.test.ts` asserts on `'Moonlight White — 18 — 50g'`. A blind sweep rewrites the expectation and the test still passes, which is worse than a failure. Check test files by hand.
- **Wrapped JSX text.** A line that begins `{' '}—` or ends `—{' '}` is one sentence split across two lines; the separator has to move to whichever side reads.

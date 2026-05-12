# Teajia Design System

A portable, self-contained spec for the Teajia visual language. Paste this whole document into a design tool (Claude Design, Figma, v0, etc.) to generate or evaluate a canonical page. Different page types compose these rules differently — the **rules are universal, the layouts vary**.

---

## 0. Brand & voice

**Name:** Teajia — professional tea infrastructure.
**Feel:** Editorial calm. Bronze and espresso, parchment and gold. Nothing shouts. Everything hums.
**Reference points:** the typography of a well-designed independent magazine; the chrome of a tea ceremony tray; the discipline of a museum wall label.
**What it is not:** a wellness app, a social network, a SaaS dashboard, a B2B portal. No gamification, no streaks, no engagement nudges, no playful illustrations, no rounded "friendly" controls.
**Tone in copy:** Quiet, precise, expert. Title case in buttons. Sentence case in body. Uppercase only for eyebrow labels and section markers — never for emphasis.

If a control feels exciting or attention-grabbing, it's probably wrong.

---

## 1. Universal rules — every page obeys these

These hold whether the page is a settings form, a data table, a reader, or a hub.

1. **No horizontal scroll, ever.** Use `flex-wrap`. Mobile width is 390px and the page must function there.
2. **No white.** Borders, glows, focus rings, dividers — never `#fff` or `rgba(255,255,255,*)`. Always warm-bronze tones.
3. **No raw `text-[Npx]`** for sizes 8/9/10/11/12/13/14/15/16/17/20/26/28 — use the named UI scale (§3). Larger arbitrary display sizes are allowed.
4. **No raw `z-[N]`** and no inline `style={{ zIndex }}`. Use the documented z scale (§9).
5. **Inline `style={{ marginTop: N }}`, `style={{ paddingTop: N }}`** etc. are banned. Use the Tailwind spacing scale.
6. **Every interactive element ≥ 44×44 effective tap area** (use invisible padding via the `.tap-target` utility if the visible element is smaller).
7. **One typography system.** Headings use the display serif; body uses Lora; UI labels and metadata use Plus Jakarta Sans; numerics use IBM Plex Mono. No exceptions for "just this one component."
8. **Cancel-left, primary-right.** Every modal and form footer is `justify-between` with the escape action (Cancel/Back/Close) on the left and the commitment action (Save/Confirm/Publish) on the right.
9. **State colors are semantic, not decorative.** Gold = primary/active/accent. Leaf-green = success only. Muted oxblood = error only. Amber/orange/violet/etc. are not part of the palette.
10. **Light and dark mode are equal citizens.** Never hardcode a hex. Use CSS variables.

---

## 2. Color tokens

All colors are stored as CSS variables that switch with mode. Components reference the semantic name, not the hex.

### Dark mode (default)

| Token | Hex | Role |
|---|---|---|
| `--tea-bg` | `#1a1714` | Page background — cooler espresso (reduced yellow undertone) |
| `--tea-surface` | `#2a2622` | Primary surface — cards, panels, table backgrounds |
| `--tea-elevated` | `#3a3530` | Elevated surfaces — popovers, modal interiors, hover lifts |
| `--tea-text` | `#ede4d4` | Primary text — cream white |
| `--tea-text-sec` | `#cdc0a8` | Secondary text — **raised floor** for outdoor / low-light legibility (was `#b5a892`) |
| `--tea-text-dim` | `#80735f` | Dimmed text — eyebrow labels, helper text, meta |
| `--tea-gold` | `#a8874d` | **Structural** accent — primary buttons, active borders, focus rings, dots, button fills |
| `--tea-gold-lt` | `#bfa06a` | Light gold — hover states only |
| `--tea-readgold` | `#a8874d` | **Reading** gold — pinned for text. Type token names, eyebrow `§` markers, inline code, hover links |
| `--tea-border` | `rgb(var(--tea-gold-rgb) / 0.08)` ≈ `rgba(168,135,77,0.08)` | Subtle gold borders — derived from tea-gold so they shift with accent palette |
| `--tea-accent-sub` | `rgb(var(--tea-gold-rgb) / 0.10)` ≈ `rgba(168,135,77,0.10)` | Subtle gold backgrounds — pill backgrounds, focus glows |
| `--tea-leaf` | `#5A6E5A` | Success — never decorative |
| `--tea-error` | `#c46a5a` | Error — **warm terracotta**, reads on espresso (was `#8a3a32` oxblood — too dim on brown) |

### Light mode

Same token names, different values:

| Token | Hex |
|---|---|
| `--tea-bg` | `#f4ece0` (warm parchment) |
| `--tea-surface` | `#e6dbcc` |
| `--tea-elevated` | `#d5c8b4` |
| `--tea-text` | `#18130e` |
| `--tea-text-sec` | `#443a2c` (raised floor; was `#5e5342`) |
| `--tea-text-dim` | `#9a8c78` |
| `--tea-gold` | `#8e6d2e` |
| `--tea-gold-lt` | `#a88340` |
| `--tea-readgold` | `#8e6d2e` |
| `--tea-border` | `rgb(var(--tea-gold-rgb) / 0.10)` ≈ `rgba(142,109,46,0.10)` |
| `--tea-leaf` | `#4a5e4a` |
| `--tea-error` | `#732a23` |

### `tea-gold` vs `tea-readgold` — when to use which

The split exists so structural accent can shift toward aged brass (or another tone) without dragging readable text into illegibility. Today the values are aligned — but reference the *role*, not the hex.

| Use `tea-gold` for (structural) | Use `tea-readgold` for (text) |
|---|---|
| Primary button fills | Type token names in code blocks |
| Active borders / focus rings | Inline `<code>` accent |
| Status pill rings | Hover state on inline links |
| Sidebar gold left-bar | Eyebrow `§` markers |
| Dot accents on active rows | Anywhere gold is **read as text** |

### Allowed opacity modifiers

| Pattern | Permitted on |
|---|---|
| `bg-tea-gold/5`, `/6`, `/8`, `/10`, `/15` | Hover, active row backgrounds (see §10) |
| `text-tea-text-sec/...` | **Never** — use `tea-text-sec` or `tea-text-dim` directly |
| `border-tea-border/...` | **Never** — `border-tea-border` is already low-alpha; opacity makes it invisible |
| `border-tea-gold/40`, `/60` | Only for focus rings or active status pills |

---

## 3. Typography

### Fonts

| Role | Font | Weights | Use |
|---|---|---|---|
| Display | Cormorant Garamond | 300/400/500 | Page titles, hero, headings, large nav labels |
| Body | Lora | 300/400/500 + italic | Article prose, descriptions, subtitles |
| UI sans | Plus Jakarta Sans | 300/400/500/600 | Buttons, tags, metadata, dense UI |
| Mono | Plus Jakarta Sans 500 + `tabular-nums` | 500 | Prices, weights, codes, tabular numerics. **Rebound from IBM Plex Mono** — clean geometric numerals, no dotted zero, still column-aligns. |
| Chinese | Noto Serif SC | 200/400/700 | Chinese product names |

### Type scale

Use these named patterns directly, not arbitrary `text-Npx` combinations.

| Class name | Spec | Use |
|---|---|---|
| `h1` | Cormorant Garamond 300, `clamp(32px, 4.8vw, 48px)`, line-height 1.12, tracking 0.01em | Hero / landing only — one per page max |
| `h2` | Cormorant Garamond 500, `clamp(24px, 3.5vw, 32px)`, line-height 1.2, tracking 0.01em | **Page titles — canonical** |
| `h3` | Cormorant Garamond 400, 19px, line-height 1.3, tracking 0.01em | Section / card titles |
| `subtitle` | Lora 400 italic, 17px, line-height 1.4 | Page subtitles (when *descriptive*) |
| `body` | Lora 400, 17px, line-height 1.7 | Article prose |
| `bodyLight` | Lora 300, 15px, line-height 1.65 | Captions, secondary descriptions |
| `label` | Plus Jakarta Sans 400, 11px, uppercase, tracking 1.2px | **Eyebrow labels, status pills, metadata** |
| `nav` | Plus Jakarta Sans 400, 12px, uppercase, tracking 1px | Section markers |
| `link` | Plus Jakarta Sans 400, 14px, tracking 0.2px | Inline link/button text |
| `mono` | Plus Jakarta Sans 500 + `tabular-nums`, 11px | Prices, weights, ledger numbers — clean geometric numerals |
| `navSidebar` | Cormorant Garamond 500, 15px, tracking 0.04em | Sidebar primary nav |
| `navSidebarChild` | Cormorant Garamond 400, 13px, tracking 0.04em | Sidebar secondary nav |

### UI text scale (named pixel stops)

For UI text outside the type scale above (e.g. tiny labels in dense tables):

`text-ui-8` `text-ui-9` `text-ui-10` `text-ui-11` `text-ui-12` `text-ui-13` `text-ui-14` `text-ui-15` `text-ui-16` `text-ui-17` `text-ui-20` `text-ui-26` `text-ui-28`

Each maps to its pixel value. **Never write `text-[12px]`** — use `text-ui-12`.

### Letter-spacing scale

| Token | Value | Use |
|---|---|---|
| `tight` | -0.01em | Optical tightening on large display |
| `normal` | 0 | Body default |
| `wide` | 0.01em | Headings |
| `wider` | 0.04em | Sidebar nav |
| `widest` | 0.10em | Loose uppercase labels |
| `caps` | 0.15em | Eyebrow labels — canonical |
| `display` | 0.20em | Spaced caps for editorial display |

---

## 4. Spacing rhythm

### Page chrome (outer padding)

Two canonical patterns. Pick by page type:

| Use | Outer padding | Max width |
|---|---|---|
| **Wide working surfaces** (data tables, dashboards, inventories, hubs) | `px-4 md:px-6 lg:px-10` | `max-w-7xl mx-auto` (or none for tables that fill the area) |
| **Narrow forms** (settings, role editing, access, single-column reading) | `px-4 md:px-6` | `max-w-3xl mx-auto` |

Anything else is drift. Promote both to named utilities: `.admin-page` (wide) and `.admin-page-narrow` (narrow).

### Vertical rhythm

Use the Tailwind scale only. No inline pixels.

| Gap | Use |
|---|---|
| `gap-1` (4px) | Inside tight pill groups |
| `gap-2` (8px) | Icon + label inside buttons; chip rows |
| `gap-3` (12px) | Form rows; card internal sections |
| `gap-4` (16px) | Card → card in a stack |
| `gap-6` (24px) | Section → section |
| `gap-8` (32px) | Major section → major section |

| Vertical stack | Use |
|---|---|
| `space-y-3` | Form fields |
| `space-y-4` | List of cards |
| `space-y-6` | Page sections (narrow) |
| `space-y-6 md:space-y-8` | Page sections (wide) |

### Padding inside containers

| Surface | Padding |
|---|---|
| Card | `p-4` (default), `p-5` (feature card), `p-6` (modal interior) |
| List row (button row) | `py-4 px-4 md:px-6` |
| Table cell | `py-3 px-4` (data) — `py-2 px-3` only when forced by density |
| Form field group | `space-y-3` between fields, `space-y-6` between groups |

### Bottom-nav clearance (mobile)

The mobile bottom tab bar (52px + safe-area-inset-bottom) overlaps page content under the `lg` breakpoint. Every scrollable page or fixed-bottom bar must use one of:

| Class | Use |
|---|---|
| `pb-nav` | Flush clearance |
| `pb-nav-gap` | 1rem gap above nav |
| `pb-nav-gap-lg` | 2rem gap above nav |
| `bottom-nav` | Fixed/absolute element 0 above nav |
| `bottom-nav-gap` | Fixed/absolute element 1rem above nav |

On `lg+`, all of these reset to 0/standard — no `lg:` override needed.

---

## 5. Page chrome — header pattern

Every page starts with the same chrome shape; only the title and right-side actions vary.

### Canonical header

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  People                                            [⟳]  │  ← title row
│  ALL CONTACTS · 142 PEOPLE                              │  ← optional subtitle
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Container: `px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0` (wide) or `px-4 md:px-6 pt-6 pb-3` (narrow).
- **Title:** `h2` class (Cormorant Garamond 500, 24-32px clamped). Title case.
- **Subtitle (optional):** `text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim`. One line, descriptive ("ALL CONTACTS · 142 PEOPLE"), not a tagline.
- **Right-side actions:** icon buttons (refresh, settings) at `p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec`. Primary action button (see §7) goes furthest right.
- **No border-bottom on the title row itself.** The tab strip below provides the separation.
- **Sticky variant** (for heavy working tools like inventory): wrap in `sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border` and use `h-16` for the row.

**Anti-patterns**: `<h1 className="text-sm font-semibold">` toolbar-style titles, leading icons inside the title, `text-3xl` outliers, hand-rolled font-family inline styles.

---

## 6. Tab strips

Under the page header, when the page has sub-views:

### Canonical: bottom-border underline tabs

```
   All  ·  Drafts (3)  ·  Published  ·  Archived
   ────                                          ← 1px gold under active
```

- Container: `flex items-center gap-6 px-4 md:px-6 lg:px-10 border-b border-tea-border`
- Tab: `py-2.5 text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text border-b border-transparent`
- Active: `text-tea-text border-b border-tea-gold` (1px gold underline, no fill)
- Count badge (when used): inline `ml-1.5 text-tea-text-dim` — `(3)` parenthesized, not a pill
- Hover: color only — never a fill

### Banned

- **The macOS-style segmented pill** (`bg-tea-surface rounded-lg border p-0.5` with active `bg-tea-bg shadow-sm`). It looks like an OS control, fights the editorial typography, and the shadow conflicts with the elevation scale.
- **Gold-tinted pills** (`bg-tea-gold/15 text-tea-gold rounded-full`). Used in some admin sub-tabs; reads as a chip, not a tab.
- **Two-tier toggle rows** (an outer mode toggle then an inner tab strip) — collapse to one row.

---

## 7. Buttons

### Primary

```
[ + New Article ]
```

- `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors`
- **Title case**, no uppercase, no letter-spacing tracking.
- Icon (when present) sits left of the label at `size={13}`.
- Disabled: `disabled:opacity-40 disabled:cursor-not-allowed`.
- Loading: replace icon with `<Loader2 className="animate-spin" size={13} />`.

### Secondary

```
[ Cancel ]
```

- `px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors`
- Title case, normal weight.

### Ghost / text-only

```
   Cancel
```

- `px-2 py-1 text-tea-text-sec hover:text-tea-text transition-colors`
- Reserved for Cancel/Back inline, undo links, and "see more" affordances.
- **Minimum color is `text-tea-text-sec`.** Never `text-tea-text-dim` or `text-tea-text/50` — they vanish against most surfaces.

### Icon-only

```
[⟳]
```

- `p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec` (idle/refresh)
- `p-1.5 rounded-md text-tea-text-sec hover:text-tea-text` (settings/menu)
- Always paired with `aria-label` and `title`.
- Add `tap-target` class if the visible element is under 44×44.

### Destructive

```
[ Delete ]
```

- Primary shape but `bg-tea-error text-tea-bg hover:bg-tea-error/90`.
- Used only after a confirm dialog has loaded — never as a top-of-page action.

### Banned variants

- `uppercase tracking-[0.15em]` on any primary button. (Reserved for eyebrow *labels*, not actions.)
- `font-bold uppercase tracking-[0.2em]` ("approve all" style). Reads as a warning sign.
- `rounded-xl` / `rounded-lg` on dense toolbar buttons. (`rounded-md` is canonical for ≤ `py-2`.)
- `font-medium` on a primary button. `font-semibold` is the canonical weight.

---

## 8. Surfaces — cards, list rows, tables

### Card

```
┌─────────────────────────────────────┐
│  Card title                         │
│  Card body content                  │
└─────────────────────────────────────┘
```

- `bg-tea-surface border border-tea-border rounded-xl p-4`
- No shadow by default. Border carries the shape.
- Inside: `space-y-3` between body sections.
- Title: `h3` class.
- Hover (when clickable): `hover:bg-tea-elevated transition-colors`. No lift, no scale.

### List row (preferred over cards for ≥ 6 items)

```
┌─────────────────────────────────────┐
│  Item title                         │
│  Subtitle · status                  │
├─────────────────────────────────────┤
│  Item title                         │
│  Subtitle · status                  │
└─────────────────────────────────────┘
```

- `<ul className="divide-y divide-tea-border">`
- Each row is a full-width `<button>`: `w-full text-left px-4 md:px-6 py-4 hover:bg-tea-accent-sub transition-colors`
- Title: `font-display text-sm` (or use the `h3` class scaled down via `text-ui-15`)
- Meta line: `text-ui-12 text-tea-text-dim mt-1`

### Data table

```
┌──────────────────┬──────────────┬──────────┐
│ NAME             │ DATE         │ AMOUNT   │  ← sticky thead
├──────────────────┼──────────────┼──────────┤
│ Acme order       │ Mar 12       │ $124.00  │
├──────────────────┼──────────────┼──────────┤
│ ...                                       │
└──────────────────┴──────────────┴──────────┘
```

- Real `<table>` element. Not a CSS-grid hack.
- `<thead>` is `sticky top-0 z-sticky bg-tea-bg shadow-sm`
- Column header cell: `text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left px-4 py-3 border-b border-tea-border`
- Row: `border-b border-tea-border hover:bg-tea-accent-sub`
- Cell: `px-4 py-3 text-ui-14 text-tea-text`
- Numeric cell: `text-right font-mono tabular-nums`
- **No zebra striping.** Borders carry the rhythm.

### Status pill

```
  [ ACTIVE ]
```

- `inline-flex px-2 py-0.5 rounded-full text-ui-9 uppercase tracking-[1.2px]`
- Variants:
  - Draft / inactive: `bg-tea-elevated text-tea-text-sec`
  - Active / published: `bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40`
  - Archived: `bg-tea-elevated text-tea-text-dim`
  - Error: `bg-tea-error/10 text-tea-error ring-1 ring-inset ring-tea-error/40`
  - Success: `bg-tea-leaf/10 text-tea-leaf ring-1 ring-inset ring-tea-leaf/40`

---

## 9. Stacking — one z-index scale, no exceptions

| Token | Value | Use |
|---|---|---|
| `z-base` | 0 | Normal flow |
| `z-dropdown` | 10 | Section-level sticky headers, in-content dropdowns |
| `z-sticky` | 20 | Sticky page headers, sticky table heads, bottom tab bar, floating chips |
| `z-overlay` | 30 | Backdrop dim layers |
| `z-drawer` | 35 | Side drawers |
| `z-modal` | 40 | Modal dialogs |
| `z-popover` | 45 | Popover menus / dropdowns inside sticky chrome (above modals only when paired with their own backdrop) |
| `z-toast` | 50 | Toasts |
| `z-priority` | 60 | Skip links, critical accessibility UI |
| `z-panel-backdrop` | 65 | Account-style panel backdrop |
| `z-panel-modal` | 70 | Account-style panel content |
| `z-nav` | 75 | Reserved for absolute-must-be-top nav (skip nav) |

**Bans:**
- Raw `z-50` / `z-[100]` / `z-[9999]` classes
- Inline `style={{ zIndex: ... }}`
- Parallel z systems (delete any local `ADMIN_Z_INDEX` constants)

**Backdrop pattern (canonical):** backdrop and content render in the same DOM block, both at `z-modal` (or panel pair at `z-panel-backdrop` / `z-panel-modal`). Equal z + DOM order means content stacks above backdrop without inversion.

---

## 10. Interaction states

### Hover

| Surface | Hover background |
|---|---|
| Top-level nav item | `bg-tea-gold/6` |
| Child nav item | `bg-tea-gold/5` |
| Active row | `bg-tea-gold/8` |
| List row (default) | `bg-tea-accent-sub` |
| Table row | `bg-tea-accent-sub` |
| Button (primary) | `bg-tea-gold/90` |
| Button (secondary) | `bg-tea-accent-sub` |
| Icon button | text color shift only (`text-tea-text-dim → text-tea-text-sec`) |

**No** `hover:scale-105`, `hover:translate-y-[-2px]`, `hover:shadow-lg`. The interface holds still.

### Active / pressed

- Primary button: `active:bg-tea-gold/80`
- Other: same as hover (no extra state)

### Focus

- All focusable elements: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg`
- Form inputs: same, but ring on the input border instead of offset.

### Disabled

- `disabled:opacity-40 disabled:cursor-not-allowed`
- No alternate "disabled gray" surface. Opacity is the signal.

### Loading

- Replace icon with `<Loader2 className="animate-spin" />`.
- For a full surface, use the `shimmer-warm` utility (already defined) — bronze-toned skeleton, never gray.

---

## 11. Elevation — three tiers, no more

| Tier | Shadow | Use |
|---|---|---|
| Flat | none | Cards, list rows, table cells, page surfaces — border carries the shape |
| Popover | `shadow-lg` | Dropdowns, menus, tooltips, attached popovers |
| Modal | `shadow-2xl` | Centered modal dialogs, drawers, panels |

**Banned:**
- `shadow-sm` on tabs or rows (creates a fake-elevation pill).
- `shadow-xl` on anything (collapses into the modal tier — pick one).
- Card-level `shadow-2xl` (way too heavy for a content tile).
- Hover-only shadows.

The CTA gold button is the one allowed exception: `shadow-lg shadow-tea-gold/10` when the action is the page-level commitment (e.g. modal-footer Save). Toolbar gold buttons remain flat.

---

## 12. Forms

### Field block

```
LABEL                                                ← uppercase eyebrow
[ input value                                    ]   ← input
Helper text or error                                 ← under
```

- Label: `text-ui-11 uppercase tracking-[1.2px] text-tea-text-sec mb-1.5`
- Input: see §13.
- Helper text: `text-ui-12 text-tea-text-dim mt-1`
- Error: `text-ui-12 text-tea-error mt-1` (also turns input border `border-tea-error`)
- Block spacing: `space-y-3` between fields; `space-y-6` between fieldset groups; `<hr className="border-tea-border" />` only between major sections.

### Layout

- Form pages use **narrow chrome** (`max-w-3xl`).
- Two-column field rows only when fields are genuinely paired (e.g. first/last name). Default to single column.

---

## 13. Inputs

Two patterns, used for different jobs.

### Boxed input (forms)

```
[ Type to search...                              ]
```

- `w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim`
- Focus: `focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30`
- Use for: form fields, modal search, anything that reads as a "field."

### Underline input (toolbars)

```
   Search…
   ──────
```

- `bg-transparent border-0 border-b border-tea-border rounded-none px-0 py-2 text-ui-14 font-serif text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none`
- Use for: inline table/list filters, in-page filters, anywhere a boxed input would feel heavy.

**Pick one per surface and stick to it.** Never mix in the same view.

---

## 14. Modals, drawers, panels

| Type | Anchor | Use |
|---|---|---|
| Centered modal | `fixed inset-0 z-modal flex items-center justify-center p-4` + backdrop button at same z | Confirmation, single-task forms, ≤ 600px wide |
| Side drawer | `fixed inset-y-0 right-0 w-full max-w-md z-drawer` | Detail views that scroll within their own height (e.g. order detail, product edit) |
| Full-screen panel | `fixed inset-0 z-panel-modal` with backdrop at `z-panel-backdrop` | Account, primary navigation, contexts that own the screen |

### Shell (all three)

- Surface: `bg-tea-surface border border-tea-border rounded-xl shadow-2xl` (modals/drawers). Panels are full-bleed so no border/radius.
- Header layout: see §15.
- Footer (forms): `flex justify-between gap-2 px-6 py-4 border-t border-tea-border bg-tea-bg`. Cancel left, primary right.

### Anti-patterns

- `rounded-2xl` — pick one (`rounded-xl`) and stick to it.
- Backdrop `z-40` with content `z-50` (the canonical inversion bug). Use the canonical equal-z-plus-DOM-order pattern.

---

## 15. Cancel · Back · Close — placement rules

These are not negotiable. They apply across the entire app.

| Action | Position | Style |
|---|---|---|
| Back (page nav) | Top-left | Icon + label, `text-tea-text-sec hover:text-tea-text` |
| Cancel (form/modal footer) | Bottom-left (left of pair) | Text or secondary button, `text-tea-text-sec hover:text-tea-text` |
| Close X (centered modal) | Top-right absolute | Icon only, `text-tea-text-sec hover:text-tea-text` |
| Close X (drawer / panel / sheet) | Top-left (first in flex) | Icon only, `text-tea-text-sec hover:text-tea-text` |

**Color floor:** `text-tea-text-sec` is the dimmest allowed. Never `text-tea-text-dim`, `text-tea-text/40`, `/50`, `/60`.

**Footer layout:** `justify-between` with Cancel left, primary right. Never `justify-end` with Cancel buried next to confirm. Never put Cancel to the right of the commit action.

**Exception:** when the drawer header contains a clustered toolbar (prev/next/QR/save), the Close X stays on the left and the toolbar stays on the right — splitting the toolbar to fit Close next to it reads worse than the rule it follows.

---

## 16. Navigation

### Desktop left sidebar — canonical active state

```
   ●  Inventory     ← 2px gold left bar, gold label
      Collections
      Magazine
   ────────────────  ← border-tea-border divider
      Activity
      People
```

- Item: `flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/6 transition-colors`
- Label font: `navSidebar` (Cormorant Garamond 500, 15px, tracking 0.04em)
- Active: `text-tea-gold` + 2px gold left-bar absolutely positioned (shared layoutId for smooth motion between items)
- **No background fill on active.** The gold bar + colored text is enough.
- Child items: `ml-3.5 border-l border-tea-border pl-2.5 min-h-[34px] hover:bg-tea-gold/5`
- Section dividers: thin border-top, **no label** — spacing carries the grouping.

### Mobile bottom tab bar

- Four tabs only: Read, Learn, Consult, Shop (keep in sync with sidebar).
- 52px capsule plus safe-area inset.
- Active tab: gold text + gold drop-shadow glow (the lone "glowy" treatment in the system).
- No labels on inactive icons unless space allows.

### Sub-tabs inside a page

Use the bottom-border underline pattern from §6. **Never the segmented pill.**

### Banned active-state idioms

- Gold-tinted rounded pill (`bg-tea-gold/15 text-tea-gold rounded-full`) — chip, not tab.
- Light-on-dark elevation pill (`bg-tea-bg text-tea-text shadow-sm`) — OS control, not editorial.
- Bold-only active text — too low contrast.

---

## 17. Icons

- Library: **Lucide React**, used everywhere.
- Stroke weight: **1.5** (lucide default). Never 1 (too hairline) or 2 (too heavy).
- Sizes:
  - Inline with text: 14px (`size={14}`)
  - Small button: 16px
  - Navigation: 18px
  - Large navigation: 22px
- Color: inherits from text color. Active state uses `text-tea-gold`.
- **Never** rounded/playful/heavy icon styles. Geometric and minimal — drawn with a fine pen.

---

## 18. Animation

| Token | Duration | Use |
|---|---|---|
| `micro` | 150ms | Hover, small feedback |
| `standard` | 300ms | Page transitions, modal in/out, color shifts |
| `emphasis` | 500ms | Hero reveal, color mode switch |

Easing default: `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind default).

**No bouncy springs, no scale-up hover, no rotation on hover.** The exception is `framer-motion`'s `layoutId` for the sidebar gold-bar — that's the one piece of motion that earns its keep.

**Reduced motion:** all animations collapse to 0.01ms under `@media (prefers-reduced-motion: reduce)`.

---

## 19. Loading, empty, error states

### Loading

- Inline button loading: replace icon with `<Loader2 className="animate-spin" size={N} />`.
- Surface loading: bronze shimmer (`shimmer-warm` utility). Never gray.
- Page-level loading: centered `Loader2` at 24px, no text.

### Empty

```
            ▢
       (icon, 28px, stroke 1.25, text-tea-text-dim)

       No collections yet
       Brief secondary line explaining why.

       [ + New Collection ]   ← optional CTA
```

- Container: `flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6`
- Icon: lucide, 28px, `strokeWidth={1.25}`, `text-tea-text-dim`
- Headline: `text-sm text-tea-text` (sentence case, no period)
- Body: `text-ui-12 text-tea-text-dim leading-relaxed mt-2`
- Optional CTA: primary button (§7) — only if there's a clear next action.

### Error

```
            !
       (icon AlertCircle, 28px, text-tea-error)

       Something went wrong
       Brief secondary line.

       [ Try again ]
```

- Same layout as empty state.
- Icon: `AlertCircle`, `text-tea-error`.
- Retry CTA: secondary button (§7).

---

## 20. Page-type templates

Different pages, same rules. Compose the primitives like this:

### 20.1 Settings / form page

```
┌────────────────────────────────────────────────────┐
│   (page chrome: px-4 md:px-6, max-w-3xl)           │
│                                                    │
│   Settings                                         │  ← h2
│   ACCOUNT · WORKSPACE                              │  ← eyebrow subtitle
│                                                    │
│   ──────────────────────────────────────────       │
│                                                    │
│   LABEL                                            │
│   [ field value                                ]   │
│                                                    │
│   LABEL                                            │
│   [ field value                                ]   │
│                                                    │
│   ──────────────────────────────────────────       │
│                                                    │
│   SECTION HEADING                                  │
│                                                    │
│   [ Card with related toggles                  ]   │
│   [ Card                                       ]   │
│                                                    │
│   [ Cancel ]                       [ Save ]        │  ← footer, justify-between
└────────────────────────────────────────────────────┘
```

### 20.2 Data table / inventory page

```
┌────────────────────────────────────────────────────────────┐
│   (sticky h-16 chrome, backdrop-blur, px-4 md:px-6 lg:px-10)
│                                                            │
│   Inventory          [search] [filter] [+ New Product]     │
├────────────────────────────────────────────────────────────┤
│   (tab strip — bottom-border underline)                    │
│   All  ·  Active  ·  Archived  ·  Pending (3)              │
├────────────────────────────────────────────────────────────┤
│   (table — sticky thead)                                   │
│   NAME           │ TYPE       │ STOCK   │ PRICE            │
│   ─────────────────────────────────────                    │
│   Hojicha Aki    │ Roasted    │ 142 g   │ $24.00           │
│   ...                                                      │
└────────────────────────────────────────────────────────────┘
```

### 20.3 Hub / dashboard page

```
┌────────────────────────────────────────────────────────────┐
│   (chrome, px-4 md:px-6 lg:px-10, max-w-7xl)               │
│                                                            │
│   Dashboard                                                │
│   TODAY · MARCH 12                                         │
│                                                            │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│   │ Card     │ │ Card     │ │ Card     │ │ Card     │     │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                            │
│   ┌──────────────────────────────────────┐                 │
│   │  Chart                               │                 │
│   └──────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────┘
```

### 20.4 List / library page (Collections, Magazine, People)

```
┌────────────────────────────────────────────────────────────┐
│   (chrome, narrow, no sticky)                              │
│                                                            │
│   Collections                              [+ New]         │
│   ALL · 12 COLLECTIONS                                     │
├────────────────────────────────────────────────────────────┤
│   (tab strip)                                              │
│   All  ·  Draft  ·  Active  ·  Archived                    │
├────────────────────────────────────────────────────────────┤
│   ●  Spring 2026 Roast                  [ ACTIVE ]         │
│      12 teas · updated 2 days ago                          │
│   ────────────────────────────────────────                 │
│   ●  Wholesale Catalog                  [ DRAFT ]          │
│      24 teas · updated 1 week ago                          │
│   ────────────────────────────────────────                 │
│   ...                                                      │
└────────────────────────────────────────────────────────────┘
```

### 20.5 Detail / reader page

Single-column, narrow, no chrome distractions.

```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Magazine                                        │  ← top-left back
│                                                            │
│         The Quiet Roast                                    │  ← h2 (or h1 for hero)
│         Aki Hojicha · 2026 vintage                         │  ← subtitle italic
│                                                            │
│         (article body — Lora 17px, leading 1.7)            │
│                                                            │
│         A paragraph of editorial prose...                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- Max width: `max-w-2xl` for reading; `max-w-3xl` if it carries images.
- Vertical padding: `pt-12 pb-24`.
- Back button: top-left, secondary text style.

---

## 21. Composition principles

When designing a new page:

1. **Decide page type.** Settings, table, hub, list, or reader. The choice picks your chrome width and max-width.
2. **Pick what goes in the header right side.** Primary CTA goes furthest right. Search inline if it's the page's primary affordance. Icon actions (refresh, settings) sit between.
3. **Decide if you need tabs.** If there are >3 modes/filters, yes. Use the bottom-border underline pattern. Never a segmented pill.
4. **Pick row, table, or card list.** Rows for ≥6 items where each is similar. Table for data-heavy comparisons. Cards for ≤4 featured items.
5. **No more than two surface depths.** Page → card. Page → table. Don't put cards inside cards inside cards.
6. **No more than three primary actions per page.** Anything else goes into an overflow menu.
7. **Every page must work at 390px wide.** Toolbar actions collapse to icons; tab strips wrap; tables become side-scrollable inside their own container (never page-level horizontal scroll).
8. **Dark and light render equally.** If a hex appears anywhere in your design, it's wrong — pull from the token list (§2).

---

## 22. Anti-pattern checklist

Before shipping any page, run through this list. Any match is a violation.

- [ ] White used for borders / rings / glows / spinners
- [ ] Arbitrary `text-[Npx]` for sizes in the named scale
- [ ] Arbitrary `z-[N]` or `style={{ zIndex: ... }}`
- [ ] Arbitrary `tracking-[Xem]` outside the scale
- [ ] `bg-tea-gold/15` (the chip pill — banned for tabs)
- [ ] `bg-tea-bg shadow-sm` on an active tab (the OS-segmented pill — banned)
- [ ] Primary button with `uppercase tracking-[0.15em]` or `font-medium`
- [ ] `rounded-2xl` on a modal (use `rounded-xl`)
- [ ] Cancel button to the right of confirm
- [ ] `text-tea-text-dim` or `text-tea-text/50` on a cancel/back/close
- [ ] Inline `style={{ fontFamily: 'var(--font-display)' }}` instead of the `h2`/`h3` class
- [ ] Inline `style={{ marginTop: 10 }}` instead of `mt-2.5`
- [ ] Color outside the palette (amber, sky, violet, etc.)
- [ ] Horizontal scroll at any breakpoint
- [ ] Hover state with scale/translate/shadow change
- [ ] Two levels of fake elevation on a tab strip
- [ ] Loader/spinner showing gray instead of bronze

---

## 23. Quick reference — the canonical class strings

Drop these directly into JSX/HTML.

```
PAGE CHROME (wide)
  px-4 md:px-6 lg:px-10

PAGE CHROME (narrow)
  px-4 md:px-6 max-w-3xl mx-auto

STICKY PAGE HEADER
  sticky top-0 z-sticky h-16 px-4 md:px-6 lg:px-10
  bg-tea-bg/90 backdrop-blur-md border-b border-tea-border
  flex items-center

PAGE TITLE (h2)
  font-display text-[clamp(24px,3.5vw,32px)] font-medium leading-[1.2] tracking-[0.01em] text-tea-text

PAGE SUBTITLE
  text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mt-1

TAB STRIP
  flex items-center gap-6 px-4 md:px-6 lg:px-10 border-b border-tea-border

TAB (inactive)
  py-2.5 text-ui-12 uppercase tracking-[0.15em]
  text-tea-text-sec hover:text-tea-text
  border-b border-transparent

TAB (active)
  py-2.5 text-ui-12 uppercase tracking-[0.15em]
  text-tea-text border-b border-tea-gold

PRIMARY BUTTON
  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md
  bg-tea-gold text-tea-bg text-xs font-semibold
  hover:bg-tea-gold/90 active:bg-tea-gold/80
  transition-colors disabled:opacity-40

SECONDARY BUTTON
  inline-flex items-center gap-1.5 px-3 py-2 rounded-md
  border border-tea-border text-tea-text-sec
  hover:text-tea-text hover:bg-tea-accent-sub
  transition-colors

ICON BUTTON
  p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec
  transition-colors

CARD
  bg-tea-surface border border-tea-border rounded-xl p-4

LIST CONTAINER
  ul.divide-y divide-tea-border

LIST ROW
  w-full text-left px-4 md:px-6 py-4
  hover:bg-tea-accent-sub transition-colors

TABLE
  <table>
    <thead className="sticky top-0 z-sticky bg-tea-bg shadow-sm">
      <th className="text-ui-10 uppercase tracking-wider font-serif
                     text-tea-text-sec text-left px-4 py-3
                     border-b border-tea-border">

    <tbody>
      <tr className="border-b border-tea-border hover:bg-tea-accent-sub">
        <td className="px-4 py-3 text-ui-14 text-tea-text">

STATUS PILL (active)
  inline-flex px-2 py-0.5 rounded-full
  text-ui-9 uppercase tracking-[1.2px]
  bg-tea-gold/10 text-tea-text
  ring-1 ring-inset ring-tea-gold/40

INPUT (boxed)
  w-full bg-tea-surface border border-tea-border rounded-md
  px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim
  focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none

INPUT (underline)
  w-full bg-transparent border-0 border-b border-tea-border rounded-none
  px-0 py-2 text-ui-14 font-serif text-tea-text
  placeholder:text-tea-text-dim
  focus:border-tea-gold focus:outline-none

MODAL SHELL
  fixed inset-0 z-modal flex items-center justify-center p-4
  // backdrop button: absolute inset-0 bg-tea-bg/70
  // panel:
  relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl
  w-full max-w-md p-6
```

---

## 24. Using this document in a design tool

To generate or evaluate a page in a separate design tool:

1. **Paste this whole file as the system instruction or design brief.**
2. **State the page's job in one sentence**, then which page-type template from §20 it most resembles.
3. **List the page's specific data** — what shows up, what actions exist, what tabs/filters apply.
4. **Constrain the output:** "Apply every rule in §1, §15, §22 — do not deviate."
5. **Iterate on the result.** Use §22's anti-pattern checklist to grade what comes back.

Different page jobs will produce different layouts. That's correct. What stays constant: the color tokens, the type scale, the spacing rhythm, the button shapes, the tab pattern, the z-index discipline, the cancel/back/close placement, the hover language, the elevation tiers.

> Rules are universal. Layouts vary. Visual language is consistent.

---

# Part II — Domain components & specialized widgets

Part I covers structural primitives. This part covers Teajia-specific components and widgets that the generic primitives compose into. Every domain component still obeys Part I — these are recipes, not exceptions.

---

## 25. Hub pages (multi-tab pages with embedded sub-views)

A **hub** is a page that hosts several sub-views as siblings under one title (e.g. People → Contacts / Sources / Purchase Orders / Audit / Team / Tags). Hub pages are distinct from data-table pages: the hub itself is just chrome + tab strip, with the active sub-view filling the rest.

### Anatomy

```
┌─────────────────────────────────────────────────────────┐
│  People                                                 │  ← h2 title
│  BUYERS, SOURCES, GUESTS, CONTRIBUTORS, AND TEAM        │  ← eyebrow subtitle
│                                                         │
│  Contacts · Sources · Purchase Orders · Audit · Team    │  ← underline tab strip
│  ───────                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  (active sub-view fills remaining height)               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Rules

- Use the canonical **underline tab strip** (§6) — never the segmented pill.
- Tab labels are title case. Icons (lucide, 14-16px) sit left of the label inside each tab.
- Tab state syncs to URL `?tab=...` so back-button works.
- The active sub-view is responsible for its own internal chrome (filters, search, secondary tabs). The hub does not double-stack a sub-toolbar.
- Hub content area uses `flex-1 overflow-auto` so each sub-view scrolls independently — height contract per CLAUDE.md.
- Permission-gated tabs (`canSeeSources`, `canSeeTeam`, etc.) compute `visibleTabs` before render. Fall back to `visibleTabs[0]` if the URL points to a hidden tab.

### Canonical class strings

```
HUB ROOT
  h-full flex flex-col overflow-hidden bg-tea-bg

HUB HEADER
  px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0
  // title:
  font-display text-[clamp(24px,3.5vw,32px)] font-medium leading-[1.2] tracking-[0.01em] text-tea-text
  // subtitle:
  text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mt-1

HUB TAB STRIP
  flex items-center gap-6 px-4 md:px-6 lg:px-10 border-b border-tea-border
  overflow-x-auto scrollbar-hide flex-shrink-0

HUB TAB (inactive)
  inline-flex items-center gap-1.5 py-2.5
  text-ui-12 uppercase tracking-[0.15em]
  text-tea-text-sec hover:text-tea-text
  border-b border-transparent whitespace-nowrap transition-colors

HUB TAB (active)
  inline-flex items-center gap-1.5 py-2.5
  text-ui-12 uppercase tracking-[0.15em]
  text-tea-text border-b border-tea-gold

HUB CONTENT
  flex-1 overflow-auto
```

---

## 26. Identity card (customer / vendor / team member)

Used at the top of any profile drawer or detail page. One per profile.

### Anatomy

```
┌─────────────────────────────────────────┐
│  [AS]    Adrian Stone                   │  ← avatar + name
│          adrian@teajia.com              │  ← contact line
│          Member since March 2024        │  ← meta line
│          [CUSTOMER]  [WHOLESALE]        │  ← tags
└─────────────────────────────────────────┘
```

### Rules

- Avatar: 48×48 rounded-full; if no photo, initials on `bg-tea-elevated text-tea-text-sec` using `font-display`.
- Name: `h3` typography class. Title case.
- Contact line: `text-ui-13 text-tea-text-sec`.
- Meta line (member-since, last-active): `text-ui-12 text-tea-text-dim`.
- Tags: status pill style (§8), max 3 visible; rest behind a `+N more` chip.
- Card surface: `bg-tea-surface border border-tea-border rounded-xl p-5`.
- Hover: none (it's identity, not an action).

### Canonical class string

```
IDENTITY CARD
  bg-tea-surface border border-tea-border rounded-xl p-5
  flex items-start gap-4

AVATAR (with photo)
  w-12 h-12 rounded-full overflow-hidden border border-tea-border flex-shrink-0

AVATAR (initials)
  w-12 h-12 rounded-full bg-tea-elevated text-tea-text-sec
  font-display text-ui-15 flex items-center justify-center flex-shrink-0
```

---

## 27. Avatar — full size scale

| Size | px | Use |
|---|---|---|
| `xs` | 20 | Inline in dense rows, comment threads |
| `sm` | 28 | List rows, table cells |
| `md` | 36 | Compact identity, drawer headers |
| `lg` | 48 | Full identity card (canonical) |
| `xl` | 72 | Profile hero |

Always rounded-full. Always uses `font-display` for initials. Photo variant adds `border border-tea-border` to prevent merging into the surface.

---

## 28. Tags & tag chips

Two patterns: **display chip** (read-only label) and **input chip** (with × to remove).

### Display chip

```
  [WHOLESALE]
```

- `inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px]`
- Variants (color-coded by category):
  - Customer-segment: `bg-tea-accent-sub text-tea-text-sec` (default)
  - Status-positive: `bg-tea-green/10 text-tea-green ring-1 ring-inset ring-tea-green/40`
  - Status-warning: `bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40`
  - Status-error: `bg-tea-error/10 text-tea-error ring-1 ring-inset ring-tea-error/40`
- Truncate at ~16 characters. Beyond that, use `+N` aggregator.

### Tag input

```
  [wholesale ×]  [vip ×]  Add tag…
```

- Container: `flex flex-wrap items-center gap-1.5 bg-tea-surface border border-tea-border rounded-md px-2 py-1.5`
- Chip with remove: `inline-flex items-center gap-1 bg-tea-accent-sub text-tea-text px-2 py-0.5 rounded-full text-ui-11`
- Remove × icon: `<X size={11} className="text-tea-text-sec hover:text-tea-text" />`
- Inline input: `flex-1 min-w-[100px] bg-transparent border-0 text-ui-13 placeholder:text-tea-text-dim focus:outline-none`

---

## 29. Activity timeline

Used in customer profiles, audit logs, order history threads.

### Anatomy

```
  ┊
  ●  Mar 12 · 2:14 PM
  │  Placed order — $124.00
  │
  ●  Mar 11 · 4:02 PM
  │  Sent invoice INV-0042
  │
  ●  Mar 11 · 3:58 PM
  │  Created order — 3 items
```

### Rules

- Vertical rail: `border-l border-tea-border` running through the whole timeline; events hang to the right at `pl-4`.
- Dot: 8×8, `rounded-full bg-tea-gold absolute -left-[5px]`. For "system" events (auto-generated), use `bg-tea-text-dim` instead.
- Timestamp: `text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim mb-0.5`.
- Event body: `text-ui-13 text-tea-text-sec`. Reference numbers, amounts, and IDs use the `font-mono` class.
- Group consecutive same-day events under a single date header (`text-ui-12 font-display text-tea-text-sec mb-3`).

---

## 30. Order / invoice line items

For invoices, order summaries, cart contents.

### Anatomy

```
┌─────────────────────────────────────────────────────┐
│  Hojicha Aki 2026          50 g × $0.48      $24.00 │
│  Koicha Spring             20 g × $1.80      $36.00 │
│  Sample Set (3)             1 × $12.00       $12.00 │
├─────────────────────────────────────────────────────┤
│  Subtotal                                    $72.00 │
│  Shipping                                     $9.00 │
│  Tax (GST 10%)                                $7.20 │
├─────────────────────────────────────────────────────┤
│  Total                                       $88.20 │
└─────────────────────────────────────────────────────┘
```

### Rules

- Line items: each row `flex justify-between py-2 text-ui-14 text-tea-text`.
- Item name: `flex-1` truncate.
- Quantity-price block: `text-tea-text-sec text-ui-13 mx-4 font-mono tabular-nums`.
- Line total: `font-mono tabular-nums w-20 text-right`.
- Totals block: same layout but `text-tea-text-sec` for labels, `text-tea-text` for amounts.
- Final total: `font-display text-ui-17 font-medium` on a top border line.
- All numerics: `font-mono tabular-nums`. Never proportional.
- Currency symbol stays attached to the number, no extra space.

---

## 31. Tea card (shop tile)

The most-rendered card in the app — appears in product grids, search results, collection contents.

### Anatomy

```
┌────────────────────┐
│                    │
│      [photo]       │   ← aspect 1:1, scale 1.06 on hover
│                    │
├────────────────────┤
│  Hojicha Aki       │   ← font-display, transitions to gold on hover
│  KYOTO · 50g       │   ← uppercase eyebrow
│  $24.00            │   ← mono price
└────────────────────┘
```

### Rules

- Surface: `bg-tea-surface` + `cardWarmth` gradient + 1px radius (intentionally minimal).
- Shadow: resting `SHADOWS.card`, hover `SHADOWS.cardHover` (per designTokens.ts).
- Photo: `aspect-ratio: 1/1, object-cover, opacity 0.9 → 1` on hover, scale `1.06`.
- Title: `font-display text-ui-17 text-tea-text` → `text-tea-gold` on hover.
- Eyebrow line: `text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim mt-1`.
- Price: `.num` class (IBM Plex Mono, tabular-nums).
- Type-color accent (optional): a 4px tea-type colored bar at the bottom — pull from `TEA_TYPE_COLORS` in designTokens.

The full-fidelity recipe lives in `src/styles/card-utilities.css` under `.card-grid-item`. Use that class; do not reinvent.

---

## 32. Alcove card (premium product display)

Used when a tea is featured (story/lore/heritage), not just listed. One alcove per page max — they're the editorial centerpiece.

### Rules (high level — full spec in §12 of designTokens.ts)

- Uses the **Alcove texture system** (`SURFACE_TREATMENTS` constant) — radial warmth, fine grain noise, recessed inset panels, scroll fades, image masks.
- Color palette: drawn from the main token set, **not** a separate alcove palette.
- Image: ~60% of card width, gradient-masked into the surface (`alcovePhotoMaskH`, `alcovePhotoMaskV`).
- Text column: title in `font-display`, descriptive body in `font-body italic`, prices in `font-mono`.
- Commerce bar: pinned bottom strip with quantity, preset chips, order CTA. Border-top `rgba(200,170,120,0.06)`.
- This is the single component that's allowed to use texture layering. Everywhere else: borders and surfaces only.

**Do not build a new alcove from scratch.** Use `src/components/shop/AlcoveCard.tsx` as the source of truth. If you need a variant, propose changes to that component.

---

## 33. Magazine article patterns

Used inside `MagazinePageReader` and any long-form prose surface.

### Drop cap (article opening)

- First letter of opening paragraph: `font-size: 2.5em, font-weight: 700, float: left, color: var(--tea-gold), line-height: 1, padding-right: 8px, padding-top: 4px`.
- Use sparingly — opening of major sections only, never every paragraph.

### Pull quote

```
  ┃  "A roast that hovers between fire and decay —
  ┃   the smell of autumn in a cup."
  ┃                              — adrian, march 2026
```

- Container: `font-body italic text-ui-17 text-tea-text-sec leading-relaxed my-8`.
- Left accent: `border-l-[3px] border-tea-gold pl-6` + `pullQuote` gradient background (from designTokens).
- Attribution: `text-ui-12 text-tea-text-dim not-italic mt-2`.

### Body pagination

- Article body is paginated at `MAX_CHARS_PER_PAGE = 600` chars per page.
- Each page is a fixed-height surface — `overflowY: hidden`. Content that doesn't fit goes on the next page, not behind a scroll. These pages get screenshotted for social sharing.
- Q&A pages: 1 question/answer pair per page.

### Section break ornament

- Use `.divider-ornament` (already in card-utilities.css) — never `<hr />`.

---

## 34. Tasting session card

Used in `TastingControlRoom` and tasting event lists.

### Rules

- Card surface: same as regular card (`bg-tea-surface border rounded-xl`).
- Header strip: tea name (`font-display text-ui-17`), session number (`text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim`), live indicator (red dot + "LIVE" pill when active).
- Sensory inputs: radio chip groups for aroma/flavor/finish — use the `.tasting-segment-toggle` utility (already defined).
- Voice capture button: `.tasting-voice-btn` (defined). Recording state: `.tasting-voice-btn-recording`.
- Submit row: sticky bottom inside the card, primary "Submit" button on the right.

Most patterns here are pre-baked utility classes. Compose them — don't redefine.

---

## 35. Tooltip

```
   button
     ▲
   ┌─────────────────┐
   │ helpful detail  │
   └─────────────────┘
```

- Surface: `bg-tea-elevated border border-tea-border rounded-md shadow-lg`
- Padding: `px-2.5 py-1.5`
- Text: `text-ui-12 text-tea-text whitespace-nowrap`
- Position: above the trigger by default (`-translate-y-full -translate-x-1/2 -mt-1`).
- Arrow: optional 6px triangle, same `bg-tea-elevated border-tea-border`.
- Z-index: `z-popover` (45).
- Show delay: 400ms; hide instant.
- Reserved for genuinely helpful detail — never repeat the visible label.

---

## 36. Toast

```
  ┌──────────────────────────────────────┐
  │  ✓  Saved.                       ×   │
  └──────────────────────────────────────┘
```

- Position: fixed bottom-right on desktop, top-center on mobile (above safe-area).
- Z-index: `z-toast` (50).
- Surface: `bg-tea-elevated border border-tea-border rounded-lg shadow-lg`
- Padding: `px-4 py-3`
- Icon (leading): 14px lucide — `Check` (success, tea-green), `AlertCircle` (error, tea-error), `Info` (neutral, tea-text-sec).
- Body: `text-ui-13 text-tea-text`.
- Close × on the right, `text-tea-text-dim hover:text-tea-text`.
- Auto-dismiss: 4s for info/success, 8s for error, never for "action required".
- Stack: max 3 visible; older ones collapse.

---

## 37. Popover menu (dropdowns inside chrome)

The most-misused element in the app. Canonical rule: **same DOM block, equal z, click-out backdrop at the same z.**

### Anatomy

```
   button ⌄
   ┌─────────────────┐
   │ Item one        │
   │ Item two        │
   │ ───────         │
   │ Destructive     │
   └─────────────────┘
```

- Anchor wrapper: `relative inline-block`.
- Click-out backdrop: `<button className="fixed inset-0 z-popover" onClick={close} aria-hidden />` (same z as the menu).
- Menu: `absolute right-0 mt-1 min-w-[180px] z-popover bg-tea-elevated border border-tea-border rounded-md shadow-lg overflow-hidden`.
- Item: `w-full text-left px-3 py-2 text-ui-13 text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors flex items-center gap-2`.
- Destructive item: `text-tea-error hover:bg-tea-error/10`.
- Divider: `<div className="h-px bg-tea-border my-1" />`.

**Banned:** raw `z-50` menus with `z-40` backdrops. Use `z-popover` for both.

---

## 38. Pagination & load-more

Two patterns. Pick by content density.

### Load-more button (infinite list)

```
              [ Show 20 more ]
                  N of M shown
```

- Centered below the list, `py-6`.
- Button: secondary style (§7).
- Helper line: `text-ui-11 text-tea-text-dim mt-2`.

### Page-numbered pagination (long indexed lists)

```
   ‹  1  2  [3]  4  5  …  12  ›
```

- Container: `flex items-center justify-center gap-1 py-6`.
- Page button: `w-8 h-8 rounded-md text-ui-12 text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub`.
- Active page: `bg-tea-gold/10 text-tea-text`.
- Prev/Next chevrons: 14px lucide, same button shape. Disabled at boundaries (opacity-40).

---

## 39. Breadcrumbs

Use sparingly — only when navigation depth > 2 and the user can't infer parent from context.

```
  People  ›  Adrian Stone  ›  Order INV-0042
```

- Container: `flex items-center gap-1.5 text-ui-12 mb-4`.
- Crumb (inactive): `text-tea-text-sec hover:text-tea-text transition-colors`.
- Crumb (current): `text-tea-text` (no link).
- Separator: `<ChevronRight size={12} className="text-tea-text-dim" />`.
- Never combine breadcrumbs with a top-left back button — pick one. Inside drawers/panels, prefer the back button.

---

## 40. Date / time picker

Use the native `<input type="date">` styled to match. Custom calendars are over-engineered for our needs.

```
  [ 2026-03-12 ▢ ]
```

- Wrapper: same as boxed input (§13).
- Add `[color-scheme:dark]` (Tailwind arbitrary) so the browser picker is themed correctly in dark mode.
- For date *ranges*, render two `<input type="date">` side-by-side with a "→" between, never one custom popover.

---

## 41. File upload zone

```
┌─────────────────────────────────────────┐
│            ⬆                            │
│                                         │
│       Drag photos here, or              │
│       [ Choose file ]                   │
│                                         │
│       PNG, JPG, up to 10MB              │
└─────────────────────────────────────────┘
```

- Container: `border-2 border-dashed border-tea-border rounded-xl p-10 text-center hover:border-tea-gold/40 transition-colors`.
- Drag-over: `border-tea-gold bg-tea-gold/5`.
- Icon: `Upload` lucide 28px, `text-tea-text-dim`.
- Headline: `text-sm text-tea-text mt-3`.
- "Choose file" inline button: secondary style.
- Constraints line: `text-ui-11 text-tea-text-dim mt-2`.
- Error state: red border + `text-tea-error` headline.
- Active upload: replace center icon with progress bar (`h-2 bg-tea-border rounded-full overflow-hidden`, fill `bg-tea-gold transition-all`).

---

## 42. Image gallery / lightbox

- Thumbnail strip: horizontal scroll on mobile (with `scrollbar-hide`), grid on desktop. Each thumb `aspect-ratio: 1/1, rounded-md, object-cover, opacity 0.85 → 1 on hover`.
- Active thumb: `ring-2 ring-tea-gold` (no border — preserves layout).
- Lightbox: full-screen overlay at `z-panel-modal` with `bg-tea-bg/95 backdrop-blur-md`.
- Lightbox image: `max-w-full max-h-full object-contain`.
- Lightbox controls: Close × top-right (centered-modal rule), prev/next arrows at left-center / right-center, all using `IconButton` style on `bg-tea-elevated/80 backdrop-blur`.
- Pinch-to-zoom on mobile via standard browser behavior — do not custom-implement zoom controls.

---

## 43. Rich text editor toolbar

Used inside the Magazine editor.

- Toolbar bar: `flex items-center gap-1 px-3 py-2 border-b border-tea-border bg-tea-bg/50 backdrop-blur-sm sticky top-0 z-dropdown`.
- Tool button: `tap-target p-1.5 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors`.
- Active tool: `bg-tea-gold/10 text-tea-gold`.
- Group separator: `<div className="w-px h-4 bg-tea-border mx-1" />`.
- Use lucide icons at 14px throughout (`Bold`, `Italic`, `Underline`, `Link`, `Quote`, `Image`, `List`, `Heading1`, `Heading2`).
- Format dropdown (Heading, Quote, Code): popover menu (§37).

---

## 44. Multi-step wizard

Used in CSV import, onboarding flows, complex add-product modals.

```
   ① Choose file → ② Map columns → ③ Review → ④ Commit
   ───────────────                                       ← progress fill
```

- Stepper bar: `flex items-center gap-2 mb-6` at the top of the wizard surface.
- Step circle: `w-7 h-7 rounded-full flex items-center justify-center text-ui-11 font-mono`.
- States:
  - Completed: `bg-tea-gold text-tea-bg` (number replaced by `<Check size={12} />`).
  - Current: `bg-tea-gold/10 text-tea-gold ring-1 ring-tea-gold`.
  - Future: `bg-tea-elevated text-tea-text-dim`.
- Step label: `text-ui-11 uppercase tracking-[0.15em]` next to each circle. Current step = `text-tea-text`; others = `text-tea-text-dim`.
- Connector line: `flex-1 h-px bg-tea-border` between circles, filled with `bg-tea-gold` for completed segments.
- Footer: always `flex justify-between` — left has "Back" (ghost button, hidden on step 1); right has primary "Next" or "Commit".

---

## 45. Inline editing

Use when the field is part of a list/row and a full modal is overkill.

### Rest state

```
   Display name                         Adrian Stone   ✎
```

- The field reads as plain text with a tiny `Edit3` icon at 12px, `text-tea-text-dim`, only visible on row hover.
- Click anywhere on the row enters edit mode.

### Edit state

```
   Display name              [ Adrian Stone        ]
                             [ Save ]  [ Cancel ]
```

- Replace the text with the canonical boxed input (§13).
- Show inline `Save` (primary, py-1.5) and `Cancel` (ghost) below the input.
- Enter commits; Escape cancels.
- Saving: replace `Save` with `<Loader2 className="animate-spin" />`; disable both buttons.

---

## 46. Sticky bottom action bar (mobile commit bars)

Used in long forms or detail drawers where the primary action would scroll off-screen.

```
┌─────────────────────────────────────────┐
│  (form content scrolling above)         │
│                                         │
├─────────────────────────────────────────┤
│  [ Cancel ]               [ Save ]      │  ← sticky bottom
└─────────────────────────────────────────┘
```

- Container: `sticky bottom-0 z-sticky bg-tea-bg/95 backdrop-blur-md border-t border-tea-border px-4 py-3 flex justify-between gap-2 pb-nav-gap`.
- Cancel left (ghost or secondary), primary right.
- On mobile inside a `fixed inset-0` panel, use `pb-nav-gap` so it sits above the bottom tab bar.
- Drops to `pb-3` on `lg+` automatically.

---

## 47. QR code display

Used on share cards, invoice receipts, table cards.

- Container: `bg-tea-bg p-4 rounded-md inline-block` (white-on-warm only for the QR area; everything else stays warm-toned).
- QR svg: render at 144px or 192px depending on context. Never smaller than 96px.
- Caption beneath: `text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mt-2 text-center`.
- For print: ensure the QR has `bg-white` and 12px+ padding (quiet zone) so scanners read it.

---

## 48. Charts (sparklines, bar, line)

Charts are **muted in tone**. They are data backdrops, not focal points.

### Color rules

| Element | Color |
|---|---|
| Primary series | `var(--tea-gold)` |
| Comparison series | `var(--tea-text-sec)` |
| Negative / shortfall | `var(--tea-error)` |
| Axes & gridlines | `var(--tea-border)` (faint) |
| Axis labels | `var(--tea-text-dim)` text-ui-10 uppercase tracking-[1.2px] |
| Tooltip on hover | use Tooltip (§35) shape |

### Type-specific

- **Sparkline (in-card trend)**: single gold line, 1.5px stroke, no axes, no fill. Height 40-60px.
- **Bar chart**: bars are `fill: var(--tea-gold)` with `opacity: 0.85`. No gradient. 16px gap between bars on desktop, 8px on mobile.
- **Line chart**: 2px stroke. If the line crosses zero, the below-axis portion shifts to `var(--tea-error)`.
- **Pie/donut**: discouraged. Use a stacked horizontal bar instead.

### Behavior

- Always include a numeric callout above/below the chart (`font-display text-ui-26`) showing the current value.
- Animate the line/bar draw on mount with 300ms ease-out — never longer.
- Mobile: charts collapse to vertically-stacked bars or single-value KPIs. Don't ship miniature 4-axis charts at 390px wide.

---

## 49. Print styles (invoices, share cards)

When a surface must look identical in browser and on paper:

- Wrap in `<div className="print:bg-white print:text-black">` and override token colors at print time via `@media print` CSS.
- Hide chrome: `<header className="print:hidden">`.
- Force page breaks for multi-page invoices: `<div className="print:break-before-page">`.
- Use the warm palette during preview; switch to black-on-white only when actually printing — never print the dark mode as-is.

---

## 50. Map embeds (store locator, venue picker)

Use a third-party tile provider; do **not** render full-color satellite tiles. Use a custom Mapbox/Leaflet style tuned to the palette:
- Background: `--tea-bg`
- Land: `--tea-surface`
- Water: `--tea-elevated`
- Roads: `--tea-border` at 60% alpha
- Pins: `--tea-gold` filled circle, 12px diameter, no shadow.

Map height: 280px on mobile, 480px on desktop. Always paired with a list of locations below — never map-only.

---

## 51. Composition examples

How the components compose into real pages.

### Customer profile drawer

```
┌──────────────────────────────────────────────┐
│  ←  Profile                             ⋯    │  ← drawer header
├──────────────────────────────────────────────┤
│                                              │
│  [ Identity card (§26) ]                     │
│                                              │
│  Tabs: Activity · Orders · Notes  (§6)       │
│  ─────                                       │
│                                              │
│  [ Activity timeline (§29) ]                 │
│                                              │
└──────────────────────────────────────────────┘
```

### Invoice page

```
┌──────────────────────────────────────────────┐
│  ← Back                                       │
│                                              │
│  Invoice INV-0042                            │
│  ISSUED MARCH 12, 2026                       │
│                                              │
│  [ Identity card — billed to ]               │
│                                              │
│  [ Line items (§30) ]                        │
│                                              │
│  Notes…                                      │
│  [ QR code (§47) ]                           │
│                                              │
├──────────────────────────────────────────────┤
│  [ Print ]      [ Cancel ]    [ Send ]       │  ← sticky bottom (§46)
└──────────────────────────────────────────────┘
```

### Magazine article

```
┌──────────────────────────────────────────────┐
│  ← Back to Magazine                          │
│                                              │
│  The Quiet Roast                             │
│  AKI HOJICHA · 2026 VINTAGE                  │
│                                              │
│  Tthe leaves are roasted... (drop cap, §33)  │
│                                              │
│  [ pull quote (§33) ]                        │
│                                              │
│  ◆ ◆ ◆  (section break ornament)             │
│                                              │
│  ...body continues, paginated (§33)          │
└──────────────────────────────────────────────┘
```

---

## 52. Extending this spec

When you build a component that's truly new (not already covered above):

1. Sketch it with the **Part I rules** only — color tokens, type scale, spacing, z, hover, elevation.
2. If it works inside those rules, add it to Part II as its own section. Match the format: anatomy + rules + canonical class string.
3. If it requires breaking a Part I rule, **don't build it.** Re-scope until it fits — or propose a Part I amendment with reasoning.

Part II is not a closed list. It's the set of recipes we've crystallized so far. Domain growth is expected.

---

> Universal rules (Part I). Concrete recipes (Part II). One visual language.


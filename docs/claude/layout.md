# Layout: bottom nav, InventoryView height chain, desktop/mobile, buttons, magazine pages

> Moved verbatim from CLAUDE.md on 2026-11-03 so it loads only when needed. The short rules stay in [CLAUDE.md](../../CLAUDE.md).

- **Bottom nav clearance — MANDATORY**: The mobile bottom nav (`flex lg:hidden`, `52px + safe-area-inset-bottom`) overlaps page content at every breakpoint below `lg`. Every layout MUST account for it. Use the utility classes from `src/styles/card-utilities.css` — never write the `calc()` inline:
  | Class | When to use |
  |---|---|
  | `pb-nav` | Scrollable page content — flush clearance |
  | `pb-nav-gap` | Scrollable page content — 1rem gap above nav |
  | `pb-nav-gap-lg` | Scrollable page content — 2rem gap above nav |
  | `bottom-nav` | Fixed/absolute elements positioned just above the nav |
  | `bottom-nav-gap` | Fixed/absolute elements positioned 1rem above the nav |
  - On `lg`+, all of these automatically reset to 0/standard values — no extra `lg:` class needed.
  - For sticky footer bars inside `fixed inset-0` panels: use `pb-nav-gap` on the footer div (resets to `pb-4` on desktop).
- **Full-screen admin overlays use `z-modal` (40)**, not `z-50`. AccountPanel (`z-modal`) and its backdrop (`z-drawer`) are rendered later in App.tsx's DOM, so they correctly appear on top at equal z-index. Using `z-50` blocks AccountPanel from opening.
- All reusable UI styles → `src/styles/card-utilities.css`
- **Typography**: use `TYPOGRAPHY_CLASSES` from `src/designTokens.ts` for new headings/body text (`h1`–`h3`, `body`, `label`, `nav`, etc.) — do not hardcode raw font/size/leading combos
- **UI text scale**: for raw px font sizes, use the `text-ui-N` named scale (`text-ui-8` … `text-ui-28`) defined by `UI_TEXT_SCALE` in `src/designTokens.ts`. **Never** write `text-[Npx]` for any value in {8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 26, 28} — `lint:colors` Rule 7 blocks the commit. Long-tail values (>20px display sizes) are allowed as arbitrary classes.
- **Tap targets**: any interactive icon/button under 44×44 must add the `tap-target` class (defined in `card-utilities.css`). It enforces the WCAG 2.5.5 floor without resizing the visible element — it adds invisible padding around the click area.

## InventoryView height chain — DO NOT BREAK
The inventory page (`src/admin/components/InventoryView.tsx`) scrolls via an internal `flex-1 overflow-auto` container, NOT via the document. That container only works if every ancestor passes a definite height down. The chain is:

1. `App.tsx` outer wrapper: `h-screen overflow-hidden flex flex-col lg:flex-row` (when `isAdminRoute`)
2. `App.tsx` main content area: `flex-1 min-w-0 flex flex-col`
3. `AdminApp.tsx` AdminContent root (line ~412): `flex flex-col flex-1 min-h-0 h-full`
4. `AdminApp.tsx` `<main>` (line ~415): `flex-1 relative flex flex-col min-w-0 overflow-hidden`
5. `AdminApp.tsx` routes wrapper (line ~530): `flex-1 relative min-h-0 overflow-hidden` (for inventory)
6. `PageTransition` motion.div (line ~94): `h-full`
7. `InventoryView.tsx` root (line ~2010): `h-full flex flex-col overflow-hidden`
8. Scroll container (`[data-testid="inventory-scroll"]`): `flex-1 overflow-auto`

**If you insert any wrapper into this chain** (a new provider, an `<AnimatePresence>`, a debug div, an auth gate, etc.) it MUST preserve the height contract: a flex item needs `flex-1 min-h-0` (or `h-full`), a non-flex wrapper needs `h-full`. Failing to do so silently collapses the scroll container to 0 — no error, page just stops scrolling on every device.

Guards in place:
- Dev-mode runtime check in `InventoryView` logs a `console.error` if the scroll container's `clientHeight < 100px`.
- `tests/inventory-scroll.spec.ts` runs on Desktop + Mobile Chrome and asserts the container is sized and scrollable. Run with `npm run test:mobile`.

If either fires, fix the ancestor chain — do not paper over with `h-dvh` on the scroll container, since that would conflict with the sticky header bars above it.

## Desktop / mobile layout principles
- **Mobile:** AccountPanel (person icon, top-right) is the primary engagement hub — everything personal lives there.
- **Desktop (redesigned 2026-09-21, round two of a six-direction canvas; column made collapsible the same day):** LeftSidebar is a 72px rail of words flush to the left edge, and a Manage column beside it that exists only while Manage is the room. The rail wears `.nav-rail` in `card-utilities.css`: the page ground lifted a few percent of tone (`color-mix` of `--tea-surface` into `--tea-bg-rgb`) and one keyline on its right edge. No pod, no blur, no paper, no shadow, no radius, no icons. It replaced two floating pods cut from the mobile bar's material, which on a wide dark page read as objects placed on the page rather than part of it, so depth now comes from tone, never effects. The `.nav-pod` recipe is gone with them.
- The rail, top to bottom: emblem, then `read / craft / advise / shop` as lowercase Cormorant at `text-ui-14`, a hairline and `manage` as a fifth word when the signed-in account has a Manage room, a spacer, then the foot: three glyphs (search, the person for Your Table, the bag for cart with a gold count), the same three the mobile bar and page headers use, then two words at `text-ui-12`: people (the directory at `/people`) and places (`/spaces`, until the connections page, people and places merged with Find a Table, is decided; the word is Places, never Connections). Settings left the foot on 2026-09-22 and is a room in the Manage column; the light/dark control lives in the Your Table header, not on the rail. Adrian asked for the foot to be glyphs (2026-09-22): words there were the one thing on the rail that did not match the bar. Words are written capitalised in the markup and lowercased by CSS so accessible names stay `Read`, `Your Table`, which the browser specs match exactly. The words sit on a 34px pitch, clumped as drawn on the canvas: never put `tap-target` on them, it makes each word a 44px box and spreads the column down the whole edge (this happened, 2026-09-21). `.nav-rail-word` grows the hit area by a pseudo-element instead, the full rail width and half the gap above and below.
- The Manage column has two states, both governed by `sidebarCollapsed` in the store: open, at 11rem (176px), and folded to a 3rem (48px) strip of icons with no labels. 11rem is not a round pick, it is the narrowest width that seats every Manage label on one line, measured (2026-09-21, before the seven-room regroup shortened every label) against the longest parent ("Collections") and the longest child ("Carry from network") at their real rendered width including padding, margin and border, not just the text. Open rows are unchanged: 42px rows, `text-ui-16` words, the children column under the active parent. Folded rows swap each parent's label for its own icon (already carried on the nav item, Phosphor light, 18px), still 42px tall, gold when that parent or one of its children is active, otherwise the usual secondary text colour; children never show while folded. The word "Manage" at the top of the open column is itself the link to Today (the old Dashboard) for an owner, and the folded strip leads with Today's icon; there is no Dashboard row (2026-09-29). A small caret button sits beside the word "Manage" when open (`CaretLeft`, folds it) and at the top of the strip when folded (`CaretRight`, opens it); both carry `title`/`aria-label` and the `tap-target` class since they are icon-only. Clicking a browse word puts the room back to browse and the column goes, open or folded makes no difference there. Landing on an admin route opens the Manage room but leaves the fold state alone, so the column stays folded across navigation if that's how it was left. Clicking the rail word "manage" itself always unfolds it, that is the one action that forces it back open. The fold state is persisted, so a reload keeps it. `sidebarCollapsed` used to sit unused in the store; it is back in use, and now means "the Manage column is folded", not "the whole sidebar is".
- The aside width is one CSS variable, `--teajia-sidebar-w`, set by LeftSidebar: `4.5rem` rail alone, `15.5rem` (4.5 + 11) with the column open, `7.5rem` (4.5 + 3) with the column folded. `App.tsx` reads it for the main column's left margin and `.sidebar-inset` reads it for full-screen panels, so nothing else needs to know which state the sidebar is in.
- The sidebar nav (Read, Craft, Advise, Shop) and the mobile bottom tab bar are the same four sections rendered differently — keep them in sync. The active word is bronze with the mobile bar's glow filter. No left indicator bars, no hover or active washes on rows, no icons beside words.
- **The bottom bar has two doors (2026-09-22).** Its left end is a three-line glyph in the same 1.6 to 1.75 stroke as the person glyph on the right, so the two ends mirror. It raises the site panel (`src/components/SiteMenu.tsx`) the way the right end raises Your Table: search first, then sessions, people, places, tea wisdom, cart, about (2026-09-23: About had no door but the footer), and for anyone with a Manage room a hairline and the Manage rooms. A customer never sees the second band. Search left the bar to make the slot; it is first in the panel and in every page header. The Manage rooms come from one list, `src/components/manageNav.ts`, read by both the desktop column and the panel, so a room added there appears on both under the same word; Members & Access is in that list because it was reachable only through a Your Table tile before. One word per route (2026-09-23): Business and its Activity child became one room, gated on sell like its route, renamed Sales on 2026-09-29 so "orders" means only what a person bought, in Your Table; Events became Sessions the same day, the word Your Table and the site panel already used; Equipment, Collection and Sources left the column because their routes only redirect. On 2026-09-29 the column became seven rooms named for the job (Curate, Stock, Sales, People, Sessions, Publish, Settings), each with its screens under it; the site panel shows a room's screens only while you are in that room, the same rule as the laptop column. `manageNav.rooms.test.ts` holds the seven and their order. The phone's admin bar reads its words from `src/components/adminBarTabs.ts`, and `src/components/manageNav.oneWord.test.ts` fails if either list gives a route a second word. The bar keeps its seven slots and its widths at 375px; do not put a word in the left slot, it unbalances the capsule (measured 2026-09-22).
- Homepage hero: emblem 76px mobile, 108px desktop. Headline `lg:text-[48px] lg:max-w-[560px]`. The hero overlay centres in the space beside the sidebar (`sidebar-inset`), not the full viewport.
- Source/Discover/Deepen/Create lines are navigation buttons — show underline + arrow on hover.

## Cancel / Back / Close button rules
These must be consistent across the entire app. Violations must be fixed immediately.

| Action | Position | Style |
|---|---|---|
| Back (page nav) | Top-left | Icon + label, `text-tea-text-sec hover:text-tea-text` |
| Cancel (modal/form) | Bottom-left (or left of pair) | Text button, `text-tea-text-sec hover:text-tea-text` |
| Close X (centered overlay modal) | Top-right absolute | Icon only, `text-tea-text-sec hover:text-tea-text` |
| Close X (panel/drawer/sheet header) | Top-left (first in flex) | Icon only, `text-tea-text-sec hover:text-tea-text` |

**Exception — panel with header navigation toolbar:** When the header contains a clustered toolbar (prev/next/QR/save/etc.), keep the close X on the *left* and the toolbar on the *right*. Splitting the toolbar to fit close X next to it reads worse than the rule it follows. `ProductEditPanel` is the canonical example.

**Color floor:** `text-tea-text-sec` is the minimum. Never use `text-tea-text-dim`, `text-tea-text/40`, `text-tea-text/50`, `text-tea-text/60`, or any opacity modifier on cancel/back/close buttons — they become invisible.

**Footer layout:** `flex justify-between` with Cancel on the left, primary action on the right. Never `justify-end` with Cancel buried next to the confirm button.

**Never put Cancel to the right of the confirm action.** Right side is for commitment (Save, Import, Confirm). Left side is for escape (Cancel, Back).

## Magazine / Journal article pages
- **No vertical scroll on pages** — each article page in `MagazinePageReader` must use `overflowY: 'hidden'`. Pages are shared to Instagram and must stay fixed-size. Content that doesn't fit belongs on the next sub-page, not behind a scroll.
- Body text is paginated at `MAX_CHARS_PER_PAGE = 600` chars; Q&A blocks at 1 pair per page. These limits are intentional — magazine feel, not essay. Do not raise them. If a new page type is added, it must include its own length limit or be inherently short.

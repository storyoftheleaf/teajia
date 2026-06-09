---
name: teajia
status: active
stack: [Vite 6, React 19, TypeScript, Tailwind v3, Zustand, React Query, Framer Motion, Cloudflare Pages, Cloudflare Workers, D1]
deploy: https://teajia.com
deploy_project: teajiafinal (Cloudflare Pages, auto-deploys from git on push to main; serves teajia.com + www.teajia.com). NOTE: teajia.pages.dev is a stale/abandoned project — do NOT deploy there or link it.
family: tea
supersedes: [tea-dev-inital, teajia-grid]
last_reviewed: 2026-05-02
---

# Teajia — flagship e-commerce + content platform

> **Documentation hub:** start at [docs/INDEX.md](docs/INDEX.md). Architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Current state in [docs/STATE_OF_THE_SITE.md](docs/STATE_OF_THE_SITE.md). What's next in [docs/ROADMAP.md](docs/ROADMAP.md). What shipped in [docs/CHANGELOG.md](docs/CHANGELOG.md).

## What this is
Professional tea infrastructure — sourcing, inventory, education, events, and multi-store management. This is NOT a wellness app, social network, or franchise. Adrian's curation is the engine (139 products). WhatsApp checkout is intentional — every order is a personal conversation. The app works before/after tea sessions, never during (no phone-at-the-table features).

## Stack & constraints
- React 19 + Vite 6 + TypeScript + Tailwind v3 (CSS-variable tokens, not Tailwind defaults)
- Zustand (`src/lib/store.ts`) for client state; React Query for server state
- Cloudflare Pages (frontend) + Cloudflare Workers + D1 (API)
- Multi-tenancy: every entity table has `account_id`; API routes scoped by `X-Teajia-Account` header
- Cloudflare Workers size limit — keep worker bundle lean

## Entry points
- `src/main.tsx` — app bootstrap
- `src/App.tsx` — public routes + root layout
- `src/admin/AdminApp.tsx` — admin routes (20+ views, behind JWT auth at `/admin/*`)
- `worker/src/index.ts` — Cloudflare Worker (D1 queries, auth)

## Where to look for…
- **Products / inventory** → `src/pages/` + `src/admin/` (inventory views)
- **Cart / currency / auth state** → `src/lib/store.ts` (Zustand)
- **API calls** → `src/lib/api.ts`
- **Worker API routes** → `worker/src/index.ts`
- **Color tokens** → `tailwind.config.ts` + `src/styles/card-utilities.css`
- **Types** → `src/types.ts` (global), `src/admin/types.ts` (admin)
- **Multi-store plan** → `docs/MULTI_STORE_PLAN.md`
- **Product strategy** → `docs/VISION.md`, `docs/ROADMAP.md`

## MANDATORY styling rules
Read `docs/COLOR_RULES.md` before writing any component styles.
- Safe tokens: `tea-text`, `tea-surface`, `tea-bg`, `tea-elevated`, `tea-gold`, `tea-gold-lt`, `tea-border`, `tea-accent-sub`, `tea-text-sec`, `tea-text-dim`
- Banned: `tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal` (legacy tokens)
- `border-tea-border` — NEVER add opacity modifiers. `border-tea-gold` — ONLY for focus/hover/active.
- NO horizontal scroll anywhere — use `flex-wrap` instead
- **Bottom nav clearance — MANDATORY**: The mobile bottom nav (`flex lg:hidden`, `44px + safe-area-inset-bottom`) overlaps page content at every breakpoint below `lg`. Every layout MUST account for it. Use the utility classes from `src/styles/card-utilities.css` — never write the `calc()` inline:
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
- Run `npm run lint:colors` before every commit. No exceptions.

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

## Deploy
```bash
npm run dev          # dev server port 7777 (exclusively reserved — see project_port_7777 memory)
npm run build        # production build → dist/
npm run lint         # tsc --noEmit
npm run lint:colors  # MANDATORY pre-commit color check (run before every commit)
npm run preview      # preview production build
# deploy via Cloudflare Pages CI on push to main
```

## Testing
```bash
npm run test:mobile  # Playwright mobile audit — 26 tests at 390×844 (Mobile Chrome)
```
Catches: JS crashes (error boundaries), 404 pages, JS console errors, horizontal overflow.
Requires dev server already running (`npm run dev`). Takes ~90 seconds.

**Run `npm run test:mobile` before pushing any change that touches:**
- `src/components/AccountPanel/` — panel views, navigation, sub-views
- `src/pages/` — any account route page
- Any routing or navigation change in `src/App.tsx`

**Test files:**
- `tests/account-panel-mobile.spec.ts` — AccountPanel + linked routes
- `tests/inventory-scroll.spec.ts` — InventoryView scroll regression guard (Desktop + Mobile)

**Screenshots saved to:** `test-results/<spec-name>/` (not committed)

### Known stub/incomplete pages — do not add links to these without building them first
| Route | Status |
|---|---|
| `/account/orders` | Empty state only — no order data wired |
| `/account/samples` | Empty state only — no sample data wired |

## Open work
See `docs/ROADMAP.md` for build sequence and `docs/MULTI_STORE_PLAN.md` for multi-tenancy rollout.

## Desktop / mobile layout principles
- **Mobile:** AccountPanel (person icon, top-right) is the primary engagement hub — everything personal lives there.
- **Desktop:** LeftSidebar is the navigation system. Account Identity card sits directly below the logo (top of sidebar), not buried at the bottom. Cart lives in the sidebar utility footer.
- The sidebar nav (Read, Learn, Consult, Shop) and the mobile bottom tab bar are the same four sections rendered differently — keep them in sync.
- Sidebar section labels ("Browse", "Admin") are removed — use spacing and dividers only.
- Nav labels use `var(--font-display)` with `fontWeight: 300` — not generic sans-serif.
- Hover state on sidebar items: `hover:bg-tea-gold/5`, active: `bg-tea-gold/8`.
- Collapse toggle: icon only (ChevronsLeft/Right), no text label.
- Grain texture at `opacity: 0.035` on sidebar matches content area grain.
- Homepage hero: emblem 76px mobile, 108px desktop. Headline `lg:text-[48px] lg:max-w-[560px]`.
- Source/Discover/Deepen/Create lines are navigation buttons — show underline + arrow on hover.

## DO NOT build
Streak trackers, gamification, engagement notifications, algorithmic recommendations, social feeds/likes/followers, auto-replenish subscriptions.

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

## NEVER change without explicit confirmation
- Navigation links, tab labels, or routing in `src/components/BottomTabBar.tsx` or any nav component — ask first, do not assume.

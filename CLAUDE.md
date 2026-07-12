---
name: teajia
status: active
stack: [Vite 6, React 19, TypeScript, Tailwind v3, Zustand, React Query, Framer Motion, Cloudflare Pages, Cloudflare Workers, D1]
deploy: https://teajia.com
deploy_project: teajiafinal (Cloudflare Pages, auto-deploys from git on push to main; serves teajia.com + www.teajia.com). NOTE: teajia.pages.dev is a stale/abandoned project — do NOT deploy there or link it.
family: tea
supersedes: [tea-dev-inital, teajia-grid]
last_reviewed: 2026-07-08
---

# Teajia — flagship e-commerce + content platform

> **Documentation hub:** start at [docs/INDEX.md](docs/INDEX.md). Architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Current state in [docs/STATE_OF_THE_SITE.md](docs/STATE_OF_THE_SITE.md). What's next in [docs/CONSOLIDATED_DIRECTION.md](docs/CONSOLIDATED_DIRECTION.md) (the single directional list; per-track build queues in [docs/tracks/](docs/tracks/)). What shipped in [docs/CHANGELOG.md](docs/CHANGELOG.md).

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
- **Product strategy** → `docs/VISION.md`, `docs/CONSOLIDATED_DIRECTION.md`

## MANDATORY styling rules
Read `docs/COLOR_RULES.md` before writing any component styles.
- Safe tokens: `tea-text`, `tea-surface`, `tea-bg`, `tea-elevated`, `tea-gold`, `tea-gold-lt`, `tea-border`, `tea-accent-sub`, `tea-text-sec`, `tea-text-dim`
- Banned: `tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal` (legacy tokens)
- `border-tea-border` — NEVER add opacity modifiers. `border-tea-gold` — ONLY for focus/hover/active.
- NO horizontal scroll anywhere — use `flex-wrap` instead
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

## Secrets — Infisical is the source of truth (set up 2026-05-24)
Worker secrets live in Infisical (project: Teajia, env: dev). The repo no longer carries a tracked `.env.local` or `worker/.dev.vars`; both are generated on demand or ignored.

**Local dev flow:**
- `cd worker && npm run dev` runs `infisical export ... > .dev.vars && wrangler dev`. Each boot regenerates `.dev.vars` from Infisical, so the on-disk file is a throwaway cache.
- To change a secret: edit it in the Infisical web UI, then restart `npm run dev`. No file edits needed.
- `.infisical.json` (committed) links this folder to the Teajia project. Safe — just an ID.
- `.dev.vars` is gitignored. Original pre-Infisical copy archived at `~/.infisical-backups/teajia/dev.vars.backup-2026-05-24` (kept until prod side is also migrated).

**Production (Cloudflare Worker):**
- Still uses `wrangler secret put` — not yet wired to Infisical. When ready, the path is `infisical run --env=prod -- wrangler secret put X` or a Machine Identity in CI.

**Frontend (`.env.local`):**
- Was untracked from git in commit `6eb75fc` (was on disk + tracked despite `.gitignore` listing it). Not yet wired to Infisical because Teajia's frontend only reads `VITE_API_URL` (a public URL) and dev-only seed credentials. Migrate when adding real `VITE_*` secrets.

**Never paste secret values into chat or scripts.** Source of truth is Infisical; if a value is needed, use `infisical secrets set KEY=...` in Terminal directly. See `~/.claude/projects/.../memory/feedback_secret_handling_strict.md`.

**Full cross-project pattern docs:** [../i64os/docs/SECRETS.md](../i64os/docs/SECRETS.md) — covers all four projects, the two-Infisical-projects shape, prod boundary, and command cheat sheet.

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
| `/account/orders` | Wired (`api.me.orders()`); per-order detail page still missing (TODO in `OrderHistoryPage.tsx`) |
| `/account/samples` | Wired (`api.me.samples()`) |
| `/api/verify/*` | Code delivery (WhatsApp/email) not built — codes are only echoed when `DEV_RETURN_VERIFY_CODES=true` (dev), so production verification is effectively disabled until delivery ships |

## Customer sign-in surfaces (Google OAuth)
"Continue with Google" must stay present on all five customer/admin auth surfaces, each linking to `${API_URL}/api/auth/google?return=<path>` (never a bare relative `/api/auth/google` — the API is on a separate origin from the app, so a relative link 404s on teajia.com): `src/pages/SignInPage.tsx`, `src/pages/SignUpPage.tsx`, `src/components/AccountPanel/index.tsx`, `src/admin/components/AuthModal.tsx`, `src/components/events/RSVPFormSheet.tsx`. The worker callback (`handleGoogleCallback` in `worker/src/index.ts`) redirects the user back to the **app** origin via `env.APP_URL` (defaults to `https://www.teajia.com`), NOT `url.origin` — `url.origin` is the worker and has no app routes. The frontend reads `#oauth_token=` on load (`src/App.tsx`). Two orphaned `LoginScreen.tsx` files (`admin/`, `admin-panel/`) are dead demo code — do not wire auth into them.

## Voice & agent control (MCP)
The worker exposes an MCP server at `/mcp` for voice/agent control. Tokens are minted at `/admin/mcp-tokens` (owner-tier only) and shown ONCE, or obtained via the OAuth 2.1 connector flow. There is ALSO a public, unauthenticated, read-only MCP at `/mcp/public` for the shopping public.

**Authenticated tools (`/mcp`)** — gated by scopes; mutating tools use a two-step preview/confirm pattern (first call returns a `confirmation_token`, second commits):
- **Read** (`inventory:read` / `customers:read` / `sales:read`): `search_tea`, `get_tea`, `list_low_stock`, `find_customer`, `get_customer`, `get_account_context`, `list_invoices`, `get_invoice`, `sales_summary`.
- **Write — Operator** (`stock:write` / `sales:write`): `create_tea`, `add_stock`, `remove_stock`, `set_low_stock_threshold`, `record_sale`, `update_invoice`, `void_invoice`, `fulfill_invoice`, `mark_invoice_paid`.
- **Write — Owner** (`catalog:write` / `customers:write` / `admin:write`, owner-tier only): `update_tea_pricing`, `set_archive_status`, `create_customer`, `update_customer`, `tag_customer`, `untag_customer`, `link_vendor`, `unlink_vendor`, `update_account_settings`, `update_exchange_rate`.

A held write scope implicitly grants its read scope, so pre-`sales:read` tokens still work with the new invoice read tools. `record_sale` / `fulfill_invoice` go through the same fulfillment path as the admin UI (stock_ledger, listing mirror, low-stock alerts, sold-out auto-archive all fire). Invoice PDF/email delivery is still **Phase 2** — download/share from the admin UI for now.

**Public tools (`/mcp/public`, no auth, read-only):** `search_tea`, `get_tea`, `browse_catalog`, `prepare_order`. Public-safe fields only (no cost/margin/vendor/exact stock). `prepare_order` returns a prefilled `wa.me` checkout link — it never places an order; the human WhatsApp conversation closes it. Scope a shop with `?account=<slug>`, default platform-owner.

**Confirmation tickets are durable:** mutation previews are stored in D1 (`mcp_confirmation_tickets`), NOT module memory — Cloudflare may route preview and confirm to different isolates. Single-use via atomic `UPDATE…RETURNING`.

**Protocol:** `2025-06-18` (negotiated down to the client's requested version); results carry both text and `structuredContent`; tool defs carry read-only/destructive/idempotent annotations.

**Implementation:** [worker/src/mcp.ts](worker/src/mcp.ts) (JSON-RPC handlers, tool defs, OAuth, public server), [src/admin/views/MCPTokensView.tsx](src/admin/views/MCPTokensView.tsx) (token management), [src/admin/views/OAuthConsentView.tsx](src/admin/views/OAuthConsentView.tsx) (OAuth consent).

**Schema:** [066_mcp_tokens.sql](worker/migrations/066_mcp_tokens.sql) (tokens as SHA-256 hash; `last_used_at` bumped on auth), [074_mcp_confirmation_tickets.sql](worker/migrations/074_mcp_confirmation_tickets.sql) (durable confirm tickets), [067_oauth.sql](worker/migrations/067_oauth.sql) + [082_oauth_authorize_requests.sql](worker/migrations/082_oauth_authorize_requests.sql) (OAuth + scoped grants + mobile-safe consent passing).

**AI discoverability:** `public/llms.txt` indexes the public MCP + shop + journal; Organization/WebSite JSON-LD in `index.html`, Product JSON-LD on `ProductPage`, Article JSON-LD on `ArticlePage`.

## Open work
See `docs/CONSOLIDATED_DIRECTION.md` (single directional list) and `docs/tracks/` (per-track build queues) for the build sequence, and `docs/MULTI_STORE_PLAN.md` for multi-tenancy rollout.

## Desktop / mobile layout principles
- **Mobile:** AccountPanel (person icon, top-right) is the primary engagement hub — everything personal lives there.
- **Desktop:** LeftSidebar is the navigation system. Account Identity card sits directly below the logo (top of sidebar), not buried at the bottom. Cart lives in the sidebar utility footer.
- The sidebar nav (Read, Learn, Consult, Shop) and the mobile bottom tab bar are the same four sections rendered differently — keep them in sync.
- Sidebar uses micro-caps section labels (`BROWSE`, `MANAGE`, `CURATE`) via `TYPOGRAPHY_CLASSES.navSidebarGroup` in `text-tea-text-dim`. Labels — not dividers — carry grouping; the earlier dividers-only attempt failed legibility in sun.
- Sidebar nav labels are Cormorant Garamond display serif (`TYPOGRAPHY_CLASSES.navSidebar` = `font-display text-ui-15 font-medium`). The serif carries the editorial-tea-brand feel — the sans-serif experiment lost soul. Outdoor-sun legibility is a real tradeoff accepted for this surface.
- Inactive sidebar icons use `text-tea-text-sec`, NEVER `text-tea-gold/55` — gold is reserved for the active state, brand, and badges, so the eye can find the active row without competing brass tint on every icon.
- Hover state on sidebar items: `hover:bg-tea-gold/6`, active: `bg-tea-gold/8`.
- Browse rows are `min-h-[44px]` (customer-facing breathing room); admin rows are tighter at `min-h-[36px]` with `text-ui-12` (tool palette density). Same height for both flattens the hierarchy.
- Sidebar background is flat `#13100a` in dark mode (no gradient) and `var(--tea-surface)` in light. Gradients on a 56–224px wide column read as banding.
- Collapse toggle: icon only (ChevronsLeft/Right), no text label.
- Grain texture at `opacity: 0.025` on sidebar — narrow surface = pixel-noise risk at higher opacities.
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

## TODO format
`TODO.md` items follow the workspace convention: `- [ ] **Bold lead.** _(band: agent-runnable | you-required | routine)_ One descriptive sentence.` with an optional link/detail line underneath pointing to the full plan doc, PR, or referenced files. Group items under `## Soon` / `## Pre-launch` / `## Future` / `## Operational notes`. The band hint tells the i64os Temple page which lane to render the item in.

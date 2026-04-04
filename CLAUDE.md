# CLAUDE.md — Teajia

## Commands

```bash
npm run dev          # Dev server (port 3000)
npm run build        # Production build → dist/
npm run lint         # TypeScript type check (tsc --noEmit)
npm run lint:colors  # MANDATORY before committing styled files
npm run preview      # Preview production build
```

## Architecture

React 19 + TypeScript + Vite 6 app deployed to Cloudflare Pages (frontend) + Workers (API/D1).

- **Public site** (`src/components/`): Home, Magazine, Learn, Shop, Consult, About
- **Admin** (`src/admin/`): Inventory, orders, CRM, events, sourcing — behind JWT auth at `/admin/*`
- **API client**: `src/lib/api.ts` → Cloudflare Worker at `worker/src/index.ts`
- **State**: Zustand (`src/lib/store.ts`) for client, React Query for server
- **Routing**: react-router-dom v7 — routes defined in `src/App.tsx` and `src/admin/AdminApp.tsx`
- **Types**: `src/types.ts` (global), `src/admin/types.ts` (admin)
- **Public** shop hits `/api/products/public` (no auth, cost fields stripped). Admin hits `/api/products`.

## MANDATORY: Color & Styling Rules

**Read `COLOR_RULES.md` before writing ANY component styling.**

Safe tokens: `tea-text`, `tea-surface`, `tea-bg`, `tea-elevated`, `tea-gold`, `tea-gold-lt`, `tea-border`, `tea-accent-sub`, `tea-text-sec`, `tea-text-dim`. If your class doesn't start with one of these — wrong token.

Banned: `tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal` (legacy, lie about behavior). Banned: hardcoded `rgba()` in inline styles, `border-white`, `border-black`.

### Border Rules (90% of styling bugs)

1. **`border-tea-border`** — NEVER add opacity (`/20`, `/30`, `/50`). Token has correct opacity built in.
2. **`border-tea-gold`** — ONLY for focus/hover/active states. NEVER as structural borders.
3. **Dividers** — Always `border-t border-tea-border` or `border-b border-tea-border`.

**Run `npm run lint:colors` before committing. No exceptions.**

## MANDATORY: Bottom Navigation Clearance

Bottom tab bar is `h-[44px]` + `env(safe-area-inset-bottom)`, renders below `lg:` only.

- Full-height modals: `calc(100dvh - 44px - env(safe-area-inset-bottom, 0px))`
- Fixed bottom elements on mobile: `bottom-[44px]` or equivalent
- Desktop (`lg:+`): no clearance needed

## MANDATORY: Centralized Component Styles

**All reusable UI styles live in `src/styles/card-utilities.css`.** Never inline border/background/color on pills, badges, or tags — use CSS classes from that file.

Key classes: `.pill` / `.pill-active`, `.badge-status`, `.badge-role`, `.badge-format`, `.tag` / `.tag-selectable`, `.card-grid-item`, `.nav-control`, `.inset-panel`

**No-Border Rule:** Never add visible `border` to pills, badges, or tags. Differentiation = background tint + text color only.

## Product Vision (condensed — see VISION.md & ROADMAP.md)

Teajia is professional tea infrastructure — sourcing, inventory, education, events. NOT a wellness app, social network, or franchise.

**Presence principle:** The app works before/after tea sessions, never during. No features that encourage phone use at the tea table.

**Design rules:**
- Simple by default, detailed when opted in
- Human curation over algorithms (139 products, Adrian's voice is the engine)
- WhatsApp checkout is intentional — every order is a personal conversation
- Magazine-quality editorial or nothing

**Do NOT build:** streak trackers, gamification, engagement notifications, live tasting modes, algorithmic recommendations, social feeds/likes/followers, auto-replenish subscriptions.

**Multi-tenancy:** Multi-account (multi-store) rollout is active. Every entity table has an `account_id` column and every authenticated query is scoped by the caller's active account (via `X-Teajia-Account` header validated against `account_members`). Public storefronts live at `/store/:slug` and fetch from `/api/s/:slug/*`. See `MULTI_STORE_PLAN.md` for the full data model, roles, API catalog, and the `tea_reviews` cross-account collaboration model. When adding new tables with entity data, include `account_id TEXT REFERENCES accounts(id)` from the start.

## Key Files

| File | Purpose |
|---|---|
| `src/App.tsx` | Public routes + root layout |
| `src/admin/AdminApp.tsx` | Admin routes (20+ views) |
| `src/lib/store.ts` | Zustand store (cart, currency, auth) |
| `src/lib/api.ts` | API client (auth, session handling) |
| `src/types.ts` | Product, Event, and shared types |
| `src/styles/card-utilities.css` | Semantic UI classes (2700 lines) |
| `src/designTokens.ts` | Typography, spacing, shadow tokens |
| `tailwind.config.ts` | CSS-variable-driven color tokens |
| `worker/src/index.ts` | Cloudflare Worker API (D1 queries) |
| `COLOR_RULES.md` | Full color/styling reference |
| `VISION.md` | Product strategy & philosophy |
| `ROADMAP.md` | Build sequence & phases |

## Adding New Inventory

Receipt → CSV → Import workflow. No in-app AI generation configured yet.

1. **Receipt → CSV**: Adrian provides receipts; parse into CSV with columns: Type, Given Name, Chinese Name, Product Name, Form, Year, Origin, Grams, Stock, Cost Amount, Cost Currency, Vendor, Restockable, Personal Collection, Status
2. **Generate wisdom**: Add Lore, Tasting Notes, Processing Notes, Terroir, Mood, Experience — match voice of existing entries in `Spread Sheets/Teajia_Tea_Complete.csv`. Poetic but grounded.
3. **Save CSV** to `../1 Projects/TeaJia/Spread Sheets/Import_YYYY_Month.csv`
4. **Import** via Admin → Inventory → ⋮ → Import CSV

Teaware skips wisdom fields. Use Status: Draft + "INCOMING" for unreceived stock.

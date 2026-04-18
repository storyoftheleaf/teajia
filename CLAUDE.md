---
name: teajia
status: active
stack: [Vite 6, React 19, TypeScript, Tailwind v3, Zustand, React Query, Framer Motion, Cloudflare Pages, Cloudflare Workers, D1]
deploy: https://teajia.pages.dev
family: tea
supersedes: [tea-dev-inital, teajia-grid]
last_reviewed: 2026-04-18
---

# Teajia — flagship e-commerce + content platform

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
- **Multi-store plan** → `MULTI_STORE_PLAN.md`
- **Product strategy** → `VISION.md`, `ROADMAP.md`

## MANDATORY styling rules
Read `COLOR_RULES.md` before writing any component styles.
- Safe tokens: `tea-text`, `tea-surface`, `tea-bg`, `tea-elevated`, `tea-gold`, `tea-gold-lt`, `tea-border`, `tea-accent-sub`, `tea-text-sec`, `tea-text-dim`
- Banned: `tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal` (legacy tokens)
- `border-tea-border` — NEVER add opacity modifiers. `border-tea-gold` — ONLY for focus/hover/active.
- NO horizontal scroll anywhere — use `flex-wrap` instead
- Bottom nav clearance: `h-[44px] + env(safe-area-inset-bottom)` on mobile only
- All reusable UI styles → `src/styles/card-utilities.css` (2700 lines)
- Run `npm run lint:colors` before every commit. No exceptions.

## Deploy
```bash
npm run dev       # dev server port 3000
npm run build     # production build → dist/
npm run lint      # tsc --noEmit
npm run lint:colors  # MANDATORY pre-commit color check
npm run preview   # preview production build
# deploy via Cloudflare Pages CI on push to main
```

## Open work
See `ROADMAP.md` for build sequence and `MULTI_STORE_PLAN.md` for multi-tenancy rollout.

## DO NOT build
Streak trackers, gamification, engagement notifications, live tasting modes, algorithmic recommendations, social feeds/likes/followers, auto-replenish subscriptions.

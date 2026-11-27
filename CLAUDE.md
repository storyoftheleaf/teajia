---
name: teajia
status: active
stack: [Vite 6, React 19, TypeScript, Tailwind v3, Zustand, React Query, Framer Motion, Cloudflare Pages, Cloudflare Workers, D1]
deploy: https://teajia.com
deploy_project: teajiafinal (Cloudflare Pages, auto-deploys from git on push to main; serves teajia.com + www.teajia.com). NOTE: teajia.pages.dev is a stale/abandoned project — do NOT deploy there or link it.
family: tea
supersedes: [tea-dev-inital, teajia-grid]
last_reviewed: 2026-11-03
---

# Teajia — flagship e-commerce + content platform

> **The pillar:** [docs/PILLAR.md](docs/PILLAR.md) is what this site is and how it works in one read; keep it true in the same commit that changes the shape of the site.
> **Documentation hub:** start at [docs/INDEX.md](docs/INDEX.md). Architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Current state in [docs/STATE_OF_THE_SITE.md](docs/STATE_OF_THE_SITE.md). What's next in [docs/CONSOLIDATED_DIRECTION.md](docs/CONSOLIDATED_DIRECTION.md) (the single directional list; per-track build queues in [docs/tracks/](docs/tracks/)). What shipped in [docs/CHANGELOG.md](docs/CHANGELOG.md).

## The Wisdom Base is one place (Adrian, 2026-11-27)
All tea knowledge (types, places, grades, marks, processes, producers, named teas) lives in the one Wisdom Base at /wisdom: the records in `data/tea-wisdom-source/` and the written pages in `data/tea-reference/pages/`, joined by shared id. Never start a second library, store or set of pages for it. Before posting or composing a tea, check what it needs in the Wisdom Base and write that first. How: [docs/TEA_WISDOM_BASE.md](docs/TEA_WISDOM_BASE.md#one-wisdom-base-two-layers-read-this-before-adding-anything). A new tea's path from Curate to its entry, step by step with each agent's model and never-list: [docs/agents/TEA-WISDOM-AGENTS.md](docs/agents/TEA-WISDOM-AGENTS.md), run with `/tea-wisdom`.
Run `node scripts/tea-wisdom-compose/needs.mjs` (or read the Wisdom Base list on the tea in Curate) before composing.

## The tea system map
How a tea moves from Curate to the shop, the invoice and after the cup, with each step's screen, tools, owner doc and gaps: [docs/agents/TEA-SYSTEM-MAP.md](docs/agents/TEA-SYSTEM-MAP.md). Change its row in the same commit as any change to a step.

## Tea UI reference

Reuse the shared card, panel summary, and tasting parts documented in [the design system](docs/DESIGN_SYSTEM.md#tea-cards-detail-panels-and-tasting). The interactive reference runs locally at `/preview/tea-ui/`.

## Every photo added goes through the one photo editor
Anywhere a person adds a photo, it opens in the shared editor first (`usePhotoEditor()` in `src/components/shared/usePhotoEditor.tsx`, which wraps `SquareCropModal`): crop, drag to reposition, zoom, straighten. Faces and avatars open centred on the face (`src/lib/faceFrame.ts`, on the device, served from this site); `freeShape` photos (events, posts, teaware, shop photos) open on their own shape. A photo already shown gets the same editor to reframe it, as the vendor Faces grid does. Never write a new cropper or a bare `<input type="file">` that uploads a picture straight. The exceptions are photos the shop's analysis reads whole (package scans, imports, receipts, evidence) and places that already keep the original with a frame (tastings, family photos, contributor pages). (Adrian, 2026-11-25.)

## Handoffs (standing rule, global)

**Never give Adrian a zip file for a handoff.** A handoff is plain files saved on GitHub, given to him as links he can open. No archive as the handoff, and none as a "second copy" either. (Adrian, 2026-11-16.)

## What this is
Professional tea infrastructure — sourcing, inventory, education, events, and multi-store management. This is NOT a wellness app, social network, or franchise. Adrian's curation is the engine. WhatsApp checkout is intentional — every order is a personal conversation. The app never asks during a tea session: it sends nothing, prompts nothing and shows nothing to scroll while people are sitting. A photo is one tap. A tasting is the one kind of session where writing is the point, and the host chooses it. (Adrian, 2026-11-26; this replaces "never during".)

## Stack & constraints
- React 19 + Vite 6 + TypeScript + Tailwind v3 (CSS-variable tokens, not Tailwind defaults)
- Zustand (`src/lib/store.ts`) for client state; React Query for server state
- Cloudflare Pages (frontend) + Cloudflare Workers + D1 (API)
- Multi-tenancy: every entity table has `account_id`; API routes scoped by `X-Teajia-Account` header
- Cloudflare Workers size limit — keep worker bundle lean

## Entry points
- `src/index.tsx` — app bootstrap
- `src/App.tsx` — public routes + root layout
- `src/admin/AdminApp.tsx` — admin routes (20+ views, behind JWT auth at `/admin/*`)
- `worker/src/index.ts` — Cloudflare Worker (D1 queries, auth)

## Where to look for…
- **Products / inventory** → `src/pages/` + `src/admin/` (inventory views)
- **Cart / currency / auth state** → `src/lib/store.ts` (Zustand)
- **API calls** → `src/lib/api.ts`
- **Worker API routes** → `worker/src/index.ts`
- **Every style value** (colours, font sizes by role, spacing, corners, control heights, shadows, motion, the seven button variants) → `src/styles/tokens.css`, the master style file. Change it there; `tailwind.config.ts` and `designTokens.ts` only point at it. Guard: `src/styles/masterStyleFile.test.ts`.
- **Types** → `src/types.ts` (global), `src/admin/types.ts` (admin)
- **Multi-store plan** → `docs/MULTI_STORE_PLAN.md`
- **Product strategy** → `docs/VISION.md`, `docs/CONSOLIDATED_DIRECTION.md`
- **Detail behind every rule below** → `docs/claude/` (one file per area, linked from each section). Open the file when the task touches that area.

## Voice transcription uses AR Create's shared word library

Recordings sent to `/api/transcribe` (and the retry route) are primed and corrected from AR Create's shared word library, so a spelling Adrian confirms once improves every project. The committed copy is `shared/words.snapshot.json` (versioned; refreshed one way by `words-sync` on Adrian's Mac; never read AR Create's data folder). `shared/words.ts` builds the Whisper prompt (people, places and tea terms, inside the token budget) and fixes known mishearings; `shared/teaWords.ts` is Teajia's choice of categories. The raw words stay on the recording row (`private_recordings.transcript`, kept as long as the recording is); the response `text` is the fixed text that goes into the note, with `raw_text` and `word_fixes` added only when something changed. The note itself holds the fixed text only.

## MANDATORY styling rules
Read `docs/COLOR_RULES.md` before writing any component styles. Full detail: [docs/claude/layout.md](docs/claude/layout.md).
- Safe tokens: `tea-text`, `tea-surface`, `tea-bg`, `tea-elevated`, `tea-gold`, `tea-gold-lt`, `tea-border`, `tea-accent-sub`, `tea-text-sec`, `tea-text-dim`. Banned: `tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal`.
- `border-tea-border` never takes an opacity modifier. `border-tea-gold` only for focus/hover/active.
- No horizontal scroll anywhere — use `flex-wrap`.
- Mobile bottom nav overlaps content below `lg`: use `pb-nav` / `pb-nav-gap` / `bottom-nav` classes from `card-utilities.css`, never an inline `calc()`.
- Full-screen admin overlays use `z-modal`, not `z-50` (z-50 blocks AccountPanel).
- Headings/body via `TYPOGRAPHY_CLASSES`; raw sizes via `text-ui-N`. `text-[Npx]` for common sizes fails `lint:colors`.
- Icon/button under 44×44 gets `tap-target` (never on the desktop rail words).
- Run `npm run lint:colors` before every commit. No exceptions.

## Money — detail in [docs/claude/money.md](docs/claude/money.md)
Read that file before touching pricing, cost, currency, freight or any product INSERT. The gotchas:
- **Freight:** 85 Yuan/kg is the shop rate, a setting on the account (`accounts.default_shipping_rate_per_kg`), inside the ×3. Arithmetic lives only in `worker/src/shippingRate.ts`. NULL = follow the level above; a number (zero included) is obeyed. Teaware is the one true zero.
- **Exchange rates:** `exchange_rates` in D1 is the only table, refreshed daily, retried hourly, never emptied. A missing rate is never 1 — decline and show a dash. Currency aliases (CNY = `Yuan`, TWD = `NT`) live once in `src/lib/currency.ts`; canonicalise, never uppercase.
- **Markup:** `SHOP_MARKUP_MULTIPLIER` in `worker/src/markup.ts` = 3. A default is read at use time, never copied into rows. No bare `2.5` in `worker/src` outside `markup.ts`.
- Every product INSERT names the money columns (or goes through `nameProductColumns`) — the table defaults are wrong.

## Nothing entered is NULL. Anything entered is the number, zero included.
Admin edits pass through `enteredNumber()`; imported cells through `enteredCostCell()` (both in `src/admin/productUpdatePayload.ts`). Never `Number(x) || 0`, `x ? Number(x) : null` or `?? 0` on money. A stored 0 must render as 0.

## A tea is not added without saying what it cost
Absence is refused, a typed 0 is kept (`createMissingCost()` / `productCreateCostRefusal` in `worker/src/costCurrency.ts`). No door converts a blank before the guard. Bulk refuses the row, single create refuses the request. Doors that truly cannot know the cost write NULL explicitly.

## A number without its unit is not a number
Every write of `cost_amount` states its currency; `UNK` is not an answer. `cost_currency_source` is stamped server-side. Unstated rows default to yuan (Adrian, 2026-09-07) but only via `list_unstated_costs` → `set_cost_currency` per vendor, with the preview read to him first. `tea_compass_entries.price_currency` is not evidence.

## Site problems go to the builder, not onto the page — [docs/claude/site-problems.md](docs/claude/site-problems.md)
Errors and stale rates go to `incident_ledger`, shown on `/account/fixes`, never as a banner. New health checks use `recordHealthProblem` / `clearHealthProblem`. Fix first, then mark resolved with `resolution_ref`. The worker never messages the owner; serious problems hand off to i64os.

## Curate import and arrivals — [docs/claude/curate-intake.md](docs/claude/curate-intake.md)
The analysis request is built per model in `worker/src/curateAnalysisProvider.ts` (Claude 5 rejects `temperature`). A cake/can/piece needs `pack_size_grams`. Samples are never defaulted to a weight. A pending arrival is rejected, never deleted; an accepted one needs `remove_stock`.

## InventoryView height chain — DO NOT BREAK
The inventory page scrolls inside its own container, so every ancestor from `App.tsx` to `InventoryView` must pass a definite height (`flex-1 min-h-0` or `h-full`). Any wrapper you insert must keep that, or scrolling silently dies. The full chain: [docs/claude/layout.md](docs/claude/layout.md). Guard: `tests/inventory-scroll.spec.ts`.

## Deploy, migrations, secrets — [docs/claude/deploy-and-secrets.md](docs/claude/deploy-and-secrets.md)
```bash
npm run dev          # port 7777 — points at the LIVE API
npm run build
npm run lint         # tsc, src only
npm run lint:worker-types  # worker type errors, ratcheted in CI
npm run lint:colors  # before every commit
# deploy: Cloudflare Pages CI on push to main
```
- `npm run dev` silently does nothing if port 7777 is already taken (the script exits when `lsof` finds a listener), and `npm run sandbox` also uses 7777, so check what holds the port first.
- `worker/src/index.ts` exports functions/classes only — an exported `const` passes CI and breaks `wrangler dev`.
- A migration with `UPDATE`/`DELETE`/`INSERT` gets a page shown to Adrian first, as a link, with seeded before/after rows.
- `wrangler deploy --dry-run` stays above the migration step in `deploy-worker.yml`.
- Secrets live in Infisical (Teajia, dev). Never paste values into chat or files.

### "Ship" command — mandatory
When Adrian says **"ship"**, follow [the Teajia release handoff](docs/claude/deploy-and-secrets.md#ship-command--mandatory). A push to `origin/main` starts publication. Report **publishing in background** once the exact revision and running deployment are verified. Report **shipped** after independent live verification.

## Local sandbox and testing — [docs/claude/testing.md](docs/claude/testing.md)
- Verify admin changes with `npm run sandbox` (API 8787 + site 7777, sign in `sandbox`/`sandbox`), never `npm run dev`, which edits the real shop. Don't hand admin checks back to Adrian.
- Stop `npm run dev` before the browser suite, or it silently runs against the live API.
- Several sessions share this repo: confirm the server on your port is serving YOUR checkout before trusting a result.
- Playwright needs `npx playwright install chromium` once and runs outside the sandbox.
- Run `npm run test:mobile` before pushing changes to `src/components/AccountPanel/`, `src/pages/` or routing in `src/App.tsx`.

## Pay and sign-in — [docs/claude/pay-and-sign-in.md](docs/claude/pay-and-sign-in.md)
- Bank details open only to the contributor, an approved account or a share link (`decidePayAccess`). Approval is permanent. No "I have a link" step.
- "Continue with Google" stays on the surfaces that carry it (`SignInPage.tsx`, `SignUpPage.tsx`; grep `auth/google` in `src`), linking to `${API_URL}/api/auth/google?return=<path>`, never a relative path.

## Voice & agent control (MCP) — [docs/claude/mcp.md](docs/claude/mcp.md)
`/mcp` (scoped tokens, preview/confirm on every write) and `/mcp/public` (read-only). New tools go in `worker/src/mcpTools/` as a module, not into `mcp.ts`. Confirmation tickets come only from `mcpTools/tickets.ts`. Local sessions get the token via `npm run claude`.

## Open work
See `docs/CONSOLIDATED_DIRECTION.md` (single directional list) and `docs/tracks/` (per-track build queues) for the build sequence, and `docs/MULTI_STORE_PLAN.md` for multi-tenancy rollout.

## Layout and buttons — [docs/claude/layout.md](docs/claude/layout.md)
- Desktop rail and mobile bottom bar are the same four sections (Read, Craft, Advise, Shop) — keep them in sync. Manage rooms come from `src/components/manageNav.ts` only.
- Back top-left; Cancel bottom-left; primary action on the right; close X top-right on centred modals, top-left on panels. Never below `text-tea-text-sec`.

## Back and forward: every admin place is in the address (Adrian, 2026-11-25)
Browser back and forward must work everywhere, and nobody gets stuck. Detail: [docs/claude/layout.md](docs/claude/layout.md#back-and-forward).
- A **step** (a tab, a screen, an open record or panel) lives in the address and pushes a history entry: `useStepParam` (`src/hooks/useStepParam.ts`) or a route. Never `useState` alone, never `replace: true`.
- A **refinement** (typing, filters, sort, folds) lives in the address too but replaces the entry; mark the line `// history: refine`.
- Back buttons use `useAdminBack(fallback)` (`src/admin/hooks/useAdminBack.ts`), never bare `navigate(-1)`. Section pages get the shared Back/Forward row (`AdminHistoryBar`); a page with its own top-left Back is listed in `src/admin/components/adminHistory.ts`.
- Guard: `src/admin/guards/historySteps.test.ts`. Browser check: `tests/admin-history.spec.ts`.

## DO NOT build
Streak trackers, gamification, engagement notifications, algorithmic recommendations, social feeds/likes/followers, auto-replenish subscriptions.

**One exception, order only (Adrian, 2026-11-21).** The people list may place the people who use the site most nearer the top of "The family". Position is the whole of it: no badges, counts, streaks, nudges or notifications, and no wording that says why anyone sits where they do. The method lives in `worker/src/peopleList.ts`; the plan is `todo/plans/teajia-family.md`, "The people list".

**Second exception, the Tea Table (proposed by Adrian, 2026-11-25; not in force until he confirms the wording).** One public page may show, newest first, what people have chosen to put on the tea table: shared tastings with their words and photographs, and published session recaps. It shows what has happened, not what is coming. Time order is the rule, with two things chosen by Adrian on 2026-11-26: a host, or Adrian for the whole table, may hold a piece at the top for a while by hand, and anyone may keep a piece to their own favourites, with the number of keeps shown to nobody but Adrian in Manage. Nothing rises by itself. No likes, comments, follows, follower or view counts, scores, streaks, ranking, recommendations or notifications, and it is never called a feed on the site. A person can take their own item off and the owner can hide any item. The plan is `todo/plans/tea-table.md`; the section map is `docs/SECTIONS.md`. Build nothing under it until he says yes.

**Third exception, quiet acknowledgement (Adrian, 2026-11-26).** Active people may be acknowledged only through things one person gives another: a host's thank-you, being quoted by name, "photograph by", "poured with", and the word on a page that Adrian grants by hand. No numbers, no levels, no titles for volume, nothing automatic, and nothing that nudges. A host's standing may decide how widely their sessions are shown, by Adrian's hand, and that standing is never displayed. The plan is `todo/plans/guests-and-tea-masters.md`, "Quiet acknowledgement".

## NEVER change without explicit confirmation
- Navigation links, tab labels, or routing in `src/components/BottomTabBar.tsx` or any nav component — ask first, do not assume.

## TODO format
`TODO.md` follows the workspace TODO convention (one plain sentence with `_(band: …)_ _(effort: …)_`, big items linked to `todo/plans/<slug>.md`): see the workspace's `docs/workspace/todos.md`. The old **Bold lead.** format is retired.

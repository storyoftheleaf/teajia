---
name: teajia
status: active
stack: [Vite 6, React 19, TypeScript, Tailwind v3, Zustand, React Query, Framer Motion, Cloudflare Pages, Cloudflare Workers, D1]
deploy: https://teajia.com
deploy_project: teajiafinal (Cloudflare Pages, auto-deploys from git on push to main; serves teajia.com + www.teajia.com). NOTE: teajia.pages.dev is a stale/abandoned project — do NOT deploy there or link it.
family: tea
supersedes: [tea-dev-inital, teajia-grid]
last_reviewed: 2026-08-31
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

## Freight is charged on every tea, at one rate, and the rate is a setting
**85 Yuan/kg, converted to USD live, and it is inside the ×3.** Freight is money out, so it belongs in the cost basis the markup multiplies; recovering it at 1× while the rest of the shelf runs at 3× is selling your own postage at cost. The rate is `accounts.default_shipping_rate_per_kg`, quoted in `default_shipping_rate_currency`, edited in Store Settings or through `update_account_settings`. `shippingPerGramUsd()` and `resolveShopFreightDefault()` in [worker/src/shippingRate.ts](worker/src/shippingRate.ts) are the only places the arithmetic lives.

- **It is quoted in the currency it is paid in.** Adrian pays his forwarder in yuan, so the shop rate is a yuan figure and the dollar value is derived from it on every request. A rate held in USD is a translation frozen at the day someone typed it, and it silently stops matching the invoice the moment the yuan moves.
- **It is a setting, not a constant, because it is negotiated.** A better freight deal should be a field, not a deploy. `FALLBACK_SHIPPING_RATE_PER_KG` in the same file is only the floor under a shop that has never set one, so that a new shop still charges for freight instead of shipping at a loss in silence.
- **NULL means nobody entered a rate, and the level above applies. A number means Adrian entered it, and it is obeyed — zero included.** True at both levels: a tea with no rate takes the shop's, a shop with no rate takes the fallback. Never write `?? 0` for a missing rate, and never read a missing rate as free freight. Migration `0007` NULLed the legacy zeros that had been doing both jobs.
- **The per-product column is written in the tea's OWN cost currency**, because a rate entered beside a CNY invoice is a CNY rate. The shop rate carries its own currency. They are converted separately, never added and divided together.
- **Teaware is the one true zero.** It prices per piece with freight already inside that price.
- **It is entered and shown, never applied invisibly.** The rate is a column in the inventory list (`Ship $/kg`) and a field in the product edit panel, both in USD so a single column can be read down, both converting to the tea's cost currency on save. A tea with nothing recorded displays the shop rate rather than a blank or a dash, because that is what it is actually being charged and a dash reads as free. Migration `0008` wrote the rate onto every tea that had none; migration `0009` moved the rate itself onto the account.
- This went wrong once and cost real money: products defaulted to 0, the intake batch to 10, the Add Product form filled in 13, the agent tool documented 10. Four answers, so the same tea landed at a different cost depending on which door it came through, and every hand-entered product sold with no freight in it at all. A missing cost looks exactly like a cheap tea, which is why nobody saw it.
- **Clearing the field is how a tea goes back to the shop rate, and a dot says which teas own theirs.** Emptying `Ship $/kg` in the edit panel writes NULL, so the tea follows the shop rate from then on; a typed 0 still means free. Until 2026-09-06 emptying it ran through `Number(val) || 0` and silently saved a rate of ZERO, so there was no way to unpin a tea and trying made it ship free. In the inventory list a pinned rate carries a gold dot, with the reason in the cell's title and a screen-reader label, because a tea pinned to 85 and a tea following a shop rate of 85 print the same number and only one of them stops following when the rate is renegotiated.
- Enforced by [worker/tests/shipping-rate.test.ts](worker/tests/shipping-rate.test.ts) (`npm run test:worker`). It pins the arithmetic AND scans the source: a second hardcoded rate anywhere in the worker fails it, as does an admin form drifting from the shared helpers, a pricing call site that stops reading the shop rate, or an instruction doc naming a rate the shop does not charge.

## One exchange rate table, refreshed daily, and it never empties
**`exchange_rates` in D1 is the only rate table.** The worker refreshes it once a day from one free feed, `/api/rates` serves it, and `useRates` in `src/admin/hooks/useAdminData.ts` is the single read. Everything that converts money goes through that: the worker's cost basis and ×3, the shop freight rate, the storefront currency selector (`useShopPrice`, read by twelve components), the admin inventory. Rates are visible and editable at `/admin/currency`, which shows each rate's last-updated date.

- **Yesterday's rate beats the system going down.** A failed fetch returns early and leaves every stored row standing; nothing here ever deletes or zeroes a rate. On the browser, a failed read falls back to the last rates that browser actually saw (`src/admin/lastKnownRates.ts`), so a bad minute leaves prices as they were instead of blanking them.
- **A fallback must be a remembered reading, never a typed figure.** There used to be three tables: `src/utils/currency.ts` at IDR 16250, the admin seed constants at IDR 16210, and D1. The two in the app were 2024 figures, roughly 8% out, and rendered on every boot before the real rates arrived. Neither looked wrong, which is why it lasted. Both are gone; the cache stores what the shop last said and carries the date it was read.
- **A missing rate is never a rate of 1.** `rateObj ? rateObj.rateToUSD : 1` reads a ¥380 cost as $380, a sevenfold error the ×3 triples, and it surfaces as an expensive tea rather than as a fault. Both `calculatePricing` and the worker's `addPricingFields` decline to price instead, so the surface shows a dash. A cost with **no currency recorded at all** still converts at 1: that is the older `UNK` convention meaning USD, not a missing rate.
- **A currency the refresh does not cover is refused where it can be chosen.** The map lives in [worker/src/exchangeRateFeed.ts](worker/src/exchangeRateFeed.ts) and is the definition of "kept current". HKD sat outside it for months while twenty-seven Hong Kong lots priced off a seeded figure, with nothing failing. The sync now logs by name any stored currency it cannot refresh, and `get_account_context` returns each rate's `last_updated` plus a `stale` flag.
- **Three days without a refresh is a warning on screen, not just in a log.** Keeping an old rate is safe for a day and invisible for a month, so the trade needs a floor: `StaleRatesBanner` sits above the admin content and links to `/admin/currency` where a rate can be corrected by hand, and the cron logs the same condition. Both read `STALE_RATES_AFTER_DAYS = 3`; the test fails if they disagree.
- **Daily, retried hourly.** The gate reads the timestamp of the last *successful* write, so a good day costs one fetch and skips the other twenty-three ticks, while a failure leaves the timestamp old and is retried on the next tick an hour later. Gating on the attempt instead would turn one bad minute into a full day of yesterday's dollar. Twenty-three hours, not twenty-four: the cron fires on the hour, and a full day would walk the refresh forward until it skipped one.
- Enforced by [worker/tests/exchange-rate-feed.test.ts](worker/tests/exchange-rate-feed.test.ts): a currency-feed host anywhere under `src` fails it, as does a second table of rates, a refresh that stops being daily or stops retrying hourly, `useShopPrice` ceasing to read the shared table, a fallback that invents a number, or the stale warning being unmounted.

## Nothing entered is NULL. Anything entered is the number, zero included.
**One rule, at one boundary: `enteredNumber()` in [src/admin/productUpdatePayload.ts](src/admin/productUpdatePayload.ts).** Every admin edit passes through that switch on its way to a column that is nullable in the schema, and that is the only place where absence and zero can be confused *permanently*, because it is where a form becomes a stored fact.

JavaScript makes the wrong thing easy here: `Number('')` is 0, `Number(null)` is 0, and an empty input is falsy exactly like a typed zero. So the natural way to write the conversion turns "I cleared this field" into "the value is zero", and money does not survive it. **A freight rate of zero is free shipping. A cost of zero is a free tea. A retail override of zero is a giveaway. None of them mean unset.**

The same confusion cost this shop three separate bugs that looked unrelated:
- Products defaulted freight to 0, so every hand-entered tea sold with no freight in its price. A missing cost looks exactly like a cheap tea, which is why nobody saw it.
- Clearing the `Ship $/kg` field saved 0, so the only way to unpin a tea from its own rate made it ship free instead.
- The retail override ran it backwards with `value ? Number(value) : null`. A deliberate 0 is falsy, so setting a price of zero became no price at all.

Two of those were in the same 70-line file, in opposite directions, and `fixed_retail_price_usd` was written by **two** cases that disagreed with each other. Two doors to one column with different rules is the shape that gave the shop four freight rates at once.

- **Scoped deliberately.** This is not a ban on `Number()` in a codebase that uses it 300+ times, most of them harmlessly on a total about to be displayed. It is a ban at this one switch.
- **A zero must render as a zero.** `GhostInput` used `value || ''`, so a stored 0 showed as an empty field: free and unset looked identical in the one control that tells them apart.
- Enforced by [worker/tests/entered-number.test.ts](worker/tests/entered-number.test.ts): a bare `Number(value)` in a case, a truthiness-gated conversion, or two cases writing one column by different rules all fail the suite.

## A default is READ at use time, never COPIED into rows
**The markup is `SHOP_MARKUP_MULTIPLIER` in [worker/src/markup.ts](worker/src/markup.ts), and it is three.** Cost plus freight, times three. Adrian's number.

It had four homes before that file existed: `costPerUnitUSD * 3.0` in the worker's pricing, `trueCostUSD * 3` in the admin's preview of that same price, a `markup_multiplier` column defaulting to **2.5** on every product, and a `?? 2.5` in the create path. The shelf ran at three while a column on each of those rows said two and a half. This is the freight bug exactly, on a different number, and it was still live while freight was being fixed.

- **Copied defaults drift; read defaults cannot.** Migration `0008` wrote `12` into 340 rows and turned one fact into 340 that could disagree; `0010` undid it. A default belongs in one place and is read when it is used.
- **A negotiated number is a setting; a fixed one is a constant, in one place.** Freight moved onto the account because it changes when Adrian renegotiates. The markup has not been asked to vary, so it stays a constant, but only one.
- `CURATOR_FALLBACK_MARKUP` (2.5) is deliberately not the shop markup and deliberately unchanged: altering it would change what curators charge and nobody asked for that. It is *named* so the difference is a decision someone can find and question. `products.markup_multiplier` also defaults to 2.5, which is itself a copied default; noted in `TODO.md`.
- **Three, everywhere, as of migration `0013`.** `markup_multiplier` was created `DEFAULT 2.5` while the shop priced at three, and the curator listing path reads that column, so one tea carried two prices depending on which surface asked. `0013` clears the rows still holding the old default rather than writing 3 into them, because writing a policy number into hundreds of rows is the fault being removed, not the fix; the create path now writes NULL too. A multiplier somebody deliberately set to something else is left alone. Curator listings that were multiplying by 2.5 now multiply by 3; nothing on the shop shelf moved, because shop pricing never read the column.
- **Every column default is a decision, and each one has to be written down.** [worker/tests/schema-defaults-are-decisions.test.ts](worker/tests/schema-defaults-are-decisions.test.ts) is a registry: every numeric default that is not 0 or 1, every currency column that guesses its unit, and every tenancy default must appear there with a reason, and adding one fails the suite until somebody writes why it is safe. A state default (`'draft'`, `'pending'`) is fine, because a new row genuinely starts somewhere. What is not fine is a default that answers a question nobody asked in a column whose honest answer is "nobody said" — those get copied, and copies drift. Seven entries are marked DEBT and named in `TODO.md`, including four tables that default `account_id` to Bali.
- **It came back once, through the agent door.** `create_tea`'s `product_listings` INSERT passed the markup positionally — `p.fixedRetailPriceUsd, 2.5,` — so every tea added by voice was born carrying the default `0013` had just cleared off the whole shelf, one row at a time, through the door with no form and nobody watching. The guard did not catch it for two reasons worth remembering: it read two files and `mcp.ts` was not one of them, and it looked for a multiplier NEXT TO a word like `cost`, which a bind value is not next to. It now also refuses a bare `2.5` anywhere under `worker/src` outside `markup.ts`, comments stripped first so the reason a number is gone stays writable. The listing writes NULL, which reads `SHOP_MARKUP_MULTIPLIER`.
- Enforced by [worker/tests/one-number-one-home.test.ts](worker/tests/one-number-one-home.test.ts): a single-digit multiplier beside a cost or price, a `markup ?? n`, or the old default typed anywhere in the worker, fails the suite.

## A number without its unit is not a number
**A cost is an amount and a currency, or it is not a cost.** `cost_currency` carries `DEFAULT 'USD'`, so a row that never stated one is indistinguishable from a row that chose dollars. That is absence answered with a guess, and here the guess is worth seven times the money: a ¥1,200 invoice stored as $1,200 prices the tea sevenfold and the schema has no objection, because 1200 is a perfectly good number. This is how the 1993 Y562 came to show a cost of $1,200 against notes that say 60 CNY × 20 boxes.

- **Every door that writes `cost_amount` must say what it is in.** The rule is [worker/src/costCurrency.ts](worker/src/costCurrency.ts), in its own module because `index.ts` imports `mcp.ts` and both doors must read one copy. It was written in the REST path first, which left `create_tea` free to invent dollars with `|| 'USD'` — the agent door being exactly the one with no form and nobody watching. Both now refuse, on create and on update.
- **The update path reads the row first**, because most edits move an amount on a tea whose currency was settled long ago. What is refused is only the case where neither the payload nor the row has ever said.
- **`UNK` is not an answer.** It is this codebase's sentinel for a currency nobody recorded; accepting it would make the guard a formality that types dollars for you.
- **A row nobody answered is now findable, which is the most the schema can honestly offer.** A defaulted `'USD'` and a chosen `'USD'` are the same three letters, so the past cannot be repaired by reading it. Migration `0014` adds `cost_currency_source`: every write that states a currency is stamped `'stated'` server-side (a caller cannot set the column, because provenance a caller can set is not provenance), so what stays NULL is the backlog. Adrian's own reading of the shelf is that MOST of those teas were not paid for in dollars.
- **The backlog is worked off per VENDOR, because that is the unit the answer arrives in.** He knows a vendor was settled in yuan; he does not know it tea by tea. `list_unstated_costs` groups the unanswered rows by vendor with the count and what any intake receipt recorded; `set_cost_currency` applies one answer to a whole vendor behind the usual preview/confirm, touching only unanswered rows unless told otherwise out loud, so a bulk fix cannot quietly undo a careful one. The confirm commits the ids the PREVIEW held, not whatever matches at commit time, and refuses a token confirmed against a different currency than it previewed: the shelf must never move by a number nobody was shown. Both live in [worker/src/mcpTools/costCurrency.ts](worker/src/mcpTools/costCurrency.ts), covered by [worker/tests/mcp-cost-currency.test.ts](worker/tests/mcp-cost-currency.test.ts).
- **`inventory_receipt_lines.original_cost_currency` is evidence and is READ, never copied.** It has no default, so NULL there honestly means nobody said, which makes it the one trustworthy record of what was actually paid. It is joined live on every call and written nowhere: a backfill would freeze an answer the receipts can later contradict, which is the copied-default shape `0010` and `0013` exist to remove. `tea_compass_entries.price_currency` is NOT evidence despite looking like it — it carries `DEFAULT 'NT'`, the same disease in a second table, so believing it would silently retag as Taiwanese every tea that ever passed through the compass without a currency.
- **The evidence is shown, never applied by itself.** Where a receipt disagrees with the stored currency the preview says so and stops. Correcting a currency moves the tea's cost by the exchange rate and the ×3 carries that to the shelf, so it is Adrian's call, not a migration's and certainly not a join's.
- The inventory CSV export carries `Cost Currency` so the shelf can also be audited by eye.

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

### The worker entry exports a handler, and no bare constants

The Workers runtime reads every named export of `worker/src/index.ts` as an
entrypoint, so `export const STALE_RATES_AFTER_DAYS = 3` is offered to it as a
request handler and it refuses to start: *"not of type 'function or
ExportedHandler'"*. Functions and classes are valid entrypoints and stay
exported; types are erased before the runtime sees them. Only `const`, `let` and
`var` are refused, by [worker/tests/entry-exports-only-the-handler.test.ts](worker/tests/entry-exports-only-the-handler.test.ts).

**It does not fail where you would look for it.** `wrangler deploy` and its dry
run only BUILD the bundle, so the deploy goes green and the live API keeps
answering. What breaks is `wrangler dev`, which actually boots the runtime, and
that is the local sandbox: the one tool that lets an agent click an admin change
instead of handing it to Adrian. On 2026-09-06 one exported number took the
sandbox down for every session while CI stayed green all day, so nothing
announced it and the only symptom was verification quietly becoming impossible.

### The worker builds before the database moves

`deploy-worker.yml` runs, in order: worker tests, **`wrangler deploy --dry-run`**, D1 migrations, deploy. The dry run is there because vitest only transpiles the files a test imports, so it has no opinion about a module no test loads. On 2026-09-06 a renamed export left `curateImports.ts` importing a name that no longer existed: 1198 tests passed, migration `0009` applied to the live database, and the deploy then died in esbuild, leaving the schema ahead of the code. The dry run builds the same bundle, writes nothing, needs no credentials, and must stay **above** the migration step.

### "Ship" command — mandatory

When Adrian says **"ship"**, immediately publish the completed task-scoped changes to `origin/main` and verify the pushed commit is present on the remote. For Teajia, "ship" does not mean create a PR, stop after local verification, or merely prepare a commit. If the shared checkout contains unrelated work, isolate the task in a clean worktree and push its commit directly to `main`; never include unrelated changes. Do not report work as shipped until the push succeeds.

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

## Local sandbox — how to verify admin work yourself

`npm run dev` points the site at the **live production API**, so anything you
click in `/admin` edits the real shop. Never verify admin changes that way.

Use the sandbox instead: `npm run sandbox` runs the API locally on 8787 against
its own database plus the site on 7777 pointed at it. Sign in as `sandbox` /
`sandbox` (owner-tier, both shops). The local database carries a copy of the
product catalogue and **no users, customers, invoices or orders**, so clicking
anything is free. Refresh the copy with `npm run sandbox:refresh`.

Full notes, including the browser snippet that drops a session into storage
without touching the sign-in form: [worker/sandbox/README.md](worker/sandbox/README.md).

**Do not hand admin verification back to Adrian.** The sandbox exists so the
agent can click the thing it just changed.

## Testing
```bash
npm run test:mobile  # Playwright mobile audit — 26 tests at 390×844 (Mobile Chrome)
```
Catches: JS crashes (error boundaries), 404 pages, JS console errors, horizontal overflow.
Requires dev server already running (`npm run dev`). Takes ~90 seconds.

The browsers are NOT installed by `npm install` on this machine: npm blocks the
install scripts that would fetch them, so a fresh checkout fails every test in a
millisecond with "Executable doesn't exist". Run this once per machine:

```bash
npx playwright install chromium
```

Run the suite with the sandbox disabled; Playwright cannot manage its own browser
processes inside it and every test dies on `kill EPERM`.

**Stop `npm run dev` before running the browser suite.** The config starts
`npm run dev:test`, which points `VITE_API_URL` at the dev server itself so
every API call lands on a Playwright mock. It also sets
`reuseExistingServer`, so if your ordinary dev server is already on 7777 the
suite silently runs against the LIVE API instead. Tests that mock auth then
have their fake tokens rejected by the real worker and fail in ways that look
like app bugs: on 2026-08-31 that alone accounted for eight false failures and
several hours chasing them. If a test fails only when you have been developing,
check which server is on 7777 before believing it.

**A free port is not the same as your port.** The warning above is about 7777,
but the shape of it applies to any port, and the second half is worse because it
does not look like a failure. Adrian runs five or six sessions on this repo at
once and each has its own worktree, so a dev server answering on the port you
picked may be serving a different checkout entirely. On 2026-08-31 a browser run
started on 7788 to avoid disturbing 7777, got a healthy server and three passing
tests, and every one of them had exercised another session's copy of the code.
Reintroducing the defect under test changed nothing, which is the tell: a
mutation that cannot fail its own test means the test is not looking at your
work. Confirm the server is yours before believing a result:

```bash
for p in $(lsof -ti:PORT); do lsof -p "$p" | awk '$4=="cwd"{print $NF}'; done
```

The stronger habit is to make the code prove it: request the file you changed
from the server and check the change is in the response, then run. That is one
command and it converts "the server is up" into "the server is serving my work".

When you do need a server of your own, `PLAYWRIGHT_BASE_URL` skips the config's
managed one entirely, so you can point the suite at a port you started and
verified without touching anyone else's:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia" && VITE_API_URL=http://localhost:7802 npx vite --port 7802 --strictPort
```

Kill only what you started. Another session's dev server is another session's
verification in progress.

A build is also a prerequisite for two specs: `china-reachability` and
`admin-chunk-failure-production` read `dist/sw.js` and `dist/_headers`, so run
`npm run build` first or they fail on a stale or missing `dist`.

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia" && lsof -ti:7777 | xargs kill 2>/dev/null; npm run build && npm run test:mobile
```

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
- **Write — Owner** (`catalog:write` / `customers:write` / `admin:write`, owner-tier only): `update_tea_pricing`, `set_tasting`, `set_archive_status`, `create_customer`, `update_customer`, `tag_customer`, `untag_customer`, `link_vendor`, `unlink_vendor`, `update_account_settings`, `update_exchange_rate`.

`set_tasting` writes the shop's own sensory claim about a tea (taste, feel, body, finish, liquor colour) as taxonomy term ids, and is the only agent path to it: `update_tea_pricing`'s `tasting_notes` is the LEGACY free-text tag array, not the structured tasting the product page reads. It MERGES rather than overwrites, because `products.tasting` also holds the starred notes the page quotes, the teaser and the brewing terms; only the categories you pass change, and an empty array clears one. Unknown term ids are refused by name rather than dropped, since a dropped term publishes a shorter claim in silence. Terms present stamps `tasting_source` as `owner`, which is what removes the "potential profile" qualifier on the page. Validation and the merge live in `worker/src/curateImportTasting.ts` so the vocabulary has one home in the worker (`worker/tests/mcp-set-tasting.test.ts` covers the merge). Brewing is not settable: the shared validator does not accept it, and widening it for one tool would change what the Curate import path accepts too.

### Tools added after `mcp.ts` got long live in `worker/src/mcpTools/`

Twenty-nine more tools ship as four modules, not as four more edits to a 7,700-line file. A tool used to touch `mcp.ts` in four places (the `PendingMutation` union, `TOOL_DEFS`, the dispatch switch, its handler), which is survivable for one tool and unmergeable for four groups written at once. A module exports a `ToolModule` and `mcp.ts` gains it in one line; `mcpTools/registry.ts` refuses a duplicate tool name, a def with no handler, and a handler with no def, at boot rather than silently.

- **`transfer.ts`** — `transfer_stock`, `list_transferable_accounts`. Moves stock between shops in one `db.batch()` guarded on `stock_movement_guard`, so it lands on both shelves or neither. It will not create the destination product: a new row needs a cost, a currency and a freight rate, and the source's are what *that* shop paid, so copying them is the four-freight-rates shape. Destination authority is re-derived from `account_members`, never inherited from the token.
- **`curation.ts`** — collections (`list`/`create`/`add_tea`/`remove_tea`/`publish`/`unpublish`) and images (`set_tea_image`, `add_tea_images`, `remove_tea_image`). An unparseable `additional_images` is an error, not an empty array: every read path in the codebase does `catch { [] }`, which on a write silently replaces the stored photos. An ambiguous product prefix is refused rather than resolved to the first match, because for a photo that means the picture lands on the wrong tea in silence.
- **`events.ts`** — events, sessions and RSVPs.
- **`writing.ts`** — articles, drafts and sample sets.

**The ticket lives in `mcpTools/tickets.ts`, once.** All four modules independently re-implemented the durable preview/confirm helper, because `mcp.ts` imports them and importing its helpers back would be a cycle. All four reasoned correctly and separately, and disagreed three ways: two put `kind` and `account_id` inside the `UPDATE`'s `WHERE` and two checked them after the row came back, which marks a wrong-kind ticket consumed on its way to rejecting it — a model that hands an `add_stock` ticket to `publish_collection` then **spends** a confirmation Adrian gave for something else. Three awaited the housekeeping reap inside a `try`; one left it on a floating `.catch()`, which throws against the D1 shim the tests run on. Three redefined a `sha256Hex` that `inquiryDomain` exports. Five places held the five-minute TTL: one real and four comments promising to mirror it. That is the four-freight-rates shape with a security property in place of a price, so there is now one implementation, taking the strictest reading of each, and `mcp.ts` imports the TTL from it. Enforced by [worker/tests/one-ticket-one-home.test.ts](worker/tests/one-ticket-one-home.test.ts), which fails any module that writes its own `issueTicket`, `consumeTicket`, `sha256Hex` or TTL.

**The seam carries scope, annotations and the audit trail, or a module tool is a second-class tool.** All three were missing when the modules were written: `visibleToolDefs` rebuilt annotations from `mcp.ts`'s own name sets, so every module tool advertised `readOnlyHint: false` whatever it did, and a careful client will not call a writing tool unprompted — a read-only tool nobody may call is not a tool. `AUDITED_TOOLS` names built-in tools one at a time, which is fine for a list that grew slowly and is a trap for a seam, because a module added later would be dispatched, listed and scoped by that file and silently missing from its audit log, and nobody finds a hole in a log by looking at it. Both are now derived: read-only follows from a `:read` scope (the scope check runs before the handler, so it cannot write), and every module tool that is not read-only is audited.

A held write scope implicitly grants its read scope, so pre-`sales:read` tokens still work with the new invoice read tools. `record_sale` / `fulfill_invoice` go through the same fulfillment path as the admin UI (stock_ledger, listing mirror, low-stock alerts, sold-out auto-archive all fire). Invoice PDF/email delivery is still **Phase 2** — download/share from the admin UI for now.

**Public tools (`/mcp/public`, no auth, read-only):** `search_tea`, `get_tea`, `browse_catalog`, `prepare_order`. Public-safe fields only (no cost/margin/vendor/exact stock). `prepare_order` returns a prefilled `wa.me` checkout link — it never places an order; the human WhatsApp conversation closes it. Scope a shop with `?account=<slug>`, default platform-owner.

**Confirmation tickets are durable:** mutation previews are stored in D1 (`mcp_confirmation_tickets`), NOT module memory — Cloudflare may route preview and confirm to different isolates. Single-use via atomic `UPDATE…RETURNING`.

**Protocol:** `2025-06-18` (negotiated down to the client's requested version); results carry both text and `structuredContent`; tool defs carry read-only/destructive/idempotent annotations.

### Connecting a Claude session to it
`.mcp.json` (committed) points a session at `https://api.teajia.com/mcp` and reads the token from **`TEAJIA_MCP_TOKEN`**. The file carries the variable, never the value: mint an owner-tier token at `/admin/mcp-tokens` (shown once) and put it where that surface keeps secrets.

- **Claude Code locally** — Infisical, same as every other Teajia secret: `infisical secrets set TEAJIA_MCP_TOKEN=...` in Terminal, then launch under `infisical run`. Never in the file, never in chat.
- **Claude Code on the web / a cloud session** — the environment's variables, set where the environment was created (claude.ai/code → environment settings). A cloud session ALSO needs `api.teajia.com` on its network allowlist, or the connection fails at the proxy with no route rather than with an auth error, which reads like a broken token and is not one.

Connected, a session can do the admin work directly instead of describing it: set visibility, correct a cost, read the live catalogue. Without it a session is blind to the live shop and can only ask Adrian to paste, which on 2026-09-04 cost most of an afternoon in round trips over a migration ledger.

**What a session cannot reach from a cloud sandbox by default:** `api.teajia.com`, `api.cloudflare.com` and `registry.npmjs.org` are all off the allowlist, so no MCP, no `wrangler`, no `npm install`, which means no `npm run lint` and no `npm run test:worker` either. Deploys do not need any of it (CI holds the Cloudflare credentials and runs migrations then deploy on every push to `main` touching `worker/**`); diagnosis does. To give a cloud session Cloudflare directly, add `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit + D1: Edit) and `CLOUDFLARE_ACCOUNT_ID` to the environment and allow those hosts.

**Implementation:** [worker/src/mcp.ts](worker/src/mcp.ts) (JSON-RPC handlers, tool defs, OAuth, public server), [src/admin/views/MCPTokensView.tsx](src/admin/views/MCPTokensView.tsx) (token management), [src/admin/views/OAuthConsentView.tsx](src/admin/views/OAuthConsentView.tsx) (OAuth consent).

**Schema:** [066_mcp_tokens.sql](worker/migrations/066_mcp_tokens.sql) (tokens as SHA-256 hash; `last_used_at` bumped on auth), [074_mcp_confirmation_tickets.sql](worker/migrations/074_mcp_confirmation_tickets.sql) (durable confirm tickets), [067_oauth.sql](worker/migrations/067_oauth.sql) + [082_oauth_authorize_requests.sql](worker/migrations/082_oauth_authorize_requests.sql) (OAuth + scoped grants + mobile-safe consent passing).

**AI discoverability:** `public/llms.txt` indexes the public MCP + shop + journal; Organization/WebSite JSON-LD in `index.html`, Product JSON-LD on `ProductPage`, Article JSON-LD on `ArticlePage`.

## Open work
See `docs/CONSOLIDATED_DIRECTION.md` (single directional list) and `docs/tracks/` (per-track build queues) for the build sequence, and `docs/MULTI_STORE_PLAN.md` for multi-tenancy rollout.

## Desktop / mobile layout principles
- **Mobile:** AccountPanel (person icon, top-right) is the primary engagement hub — everything personal lives there.
- **Desktop (redesigned 2026-09-06):** LeftSidebar is TWO floating pods cut from the mobile bar, inset 12px from the top, left and bottom, 208px wide (56px as one capsule when collapsed). Every pod wears the `.nav-pod` material in `card-utilities.css`, which is the mobile bar's own recipe: page tone at 92%, blur, one keyline, label paper, grain, the same shadow. No flat fill, no border-right, no separate grain layer. Changing the bar's material changes the pods with it, on purpose.
- Pod 1 is the place: emblem + LogoText wordmark, then `browse / manage` as a lowercase serif tab pair with a 1px bronze underline under the active room (only when the signed-in account has a Manage room), search, the room's words, spacer, cart. Pod 2 is the person: the Your Table row, then a foot row of four icon marks (connections, settings when the account has one, light/dark, collapse). The foot row is icon space; never put a word there.
- The sidebar nav (Read, Craft, Advise, Shop) and the mobile bottom tab bar are the same four sections rendered differently — keep them in sync. Nav words are lowercase Cormorant like the mobile tabs; the active word is bronze with the mobile bar's glow filter. No left indicator bars, no hover or active washes on rows, no icons beside expanded words (icons live only in the collapsed capsule).
- Browse rows are 52px with a hairline `bg-tea-border` between consecutive rows; manage rows are 42px with `text-ui-16` words and the children column under the active parent.
- "Connections" is the label on the foot link that still opens the spaces page until the connections page exists (see TODO).
- Homepage hero: emblem 76px mobile, 108px desktop. Headline `lg:text-[48px] lg:max-w-[560px]`. The hero overlay centres in the space beside the sidebar (`sidebar-inset`), not the full viewport.
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

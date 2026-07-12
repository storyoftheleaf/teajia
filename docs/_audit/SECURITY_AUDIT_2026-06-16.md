# Teajia Inventory System — Security & Hardening Audit

**Date:** 2026-06-16
**Scope:** Inventory API (Cloudflare Worker `worker/src/index.ts`, MCP server `worker/src/mcp.ts`), D1 schema (`worker/schema.sql` + `worker/migrations/`), and the public MCP at `teajia-api.lightcodes.workers.dev/mcp`.
**Mode:** Read-only. No data, secrets, config, routes, or deploys were changed. Every recommendation that requires a write, migration, secret, config, or deploy change is flagged for your approval and was **not** executed.

---

## Overall verdict

The platform is, on the whole, **well-built**. The things that usually sink an app of this size are clean here:

- **SQL injection: none.** ~1,028 prepared-statement sites reviewed; all values bound, dynamic column/table names come from server-side allowlists or compile-time literals. Zero findings.
- **JWT/auth: sound.** HMAC-SHA256, signature verified every request, 30-day TTL with `exp` check, no `alg:none`, no hardcoded secret fallback, PBKDF2 passwords with legacy-SHA256 auto-upgrade.
- **Multi-tenancy: correctly enforced.** `X-Teajia-Account` is treated as a *request*, then validated against a live `account_members` row before any access — a logged-in user **cannot** pivot into another tenant. Platform-role bypass is re-read from the DB every request, not trusted from the JWT.
- **CORS: sound.** Allowlist + scoped regexes, no wildcard, no blind origin reflection, no credentialed cross-origin exposure.
- **Secrets: clean.** No hardcoded secrets in tracked files; BYOK OpenAI keys are AES-GCM encrypted and never returned to clients; MCP tokens stored as SHA-256 hashes.

The real risk clusters in **three places**: (1) a Critical OAuth open-redirect on the MCP connector, (2) Critical non-atomic stock math that can corrupt inventory and the audit ledger, and (3) a Critical schema-provenance gap that makes the database unrebuildable from source. Everything else is hardening.

---

## DO THESE FIRST (top 6)

1. **C1 — Lock down OAuth `redirect_uri`** (auth-code theft → full token mint). Code change.
2. **C2 — Make every stock deduction atomic** (`... WHERE stock_grams >= ?` + rows-affected check). Code change; closes negative-stock + ledger corruption.
3. **C3 — Establish one schema source of truth** and resolve the duplicate-numbered migrations (esp. the two conflicting `017`s) before any restore is ever needed. ⚠ Needs your decision (migration/process).
4. **H1 — Make the public-MCP rate limiter mandatory + bound the per-request full-table scans** (unauthenticated DoS / D1 cost amplification). Code + config.
5. **H2 — Stop leaking raw exception/`err.message`/upstream-provider text to clients** (info disclosure). Code change.
6. **H3 — Unify invoice-number formatting** across the three call sites and handle the unique-index collision instead of 500ing. Code change.

---

## CRITICAL

### C1 — OAuth open redirect via unvalidated dynamic client registration → auth-code theft → token mint
**Where:** `worker/src/mcp.ts:3620-3646` (registration accepts *any* `redirect_uri`, by explicit design), `:3799-3806` (only checks the URI matches the client's *own* registered list), `:3840-3844` (302 to `${redirect_uri}?code=...`); route is public at `worker/src/index.ts:17624`.
**What:** `/oauth/register` is open and unauthenticated and validates nothing about the redirect host. An attacker registers a client named e.g. "Teajia Official" with `redirect_uri: https://evil/cb`, then lures a signed-in **owner** to the consent screen (which shows the attacker-controlled `client_name`, `mcp.ts:3729-3732`). On approval the auth code is delivered to the attacker's origin; the attacker holds the PKCE verifier (they are the client), exchanges the code at `/oauth/token`, and mints a full-scope `mcp_tokens` row up to the approver's tier. The "redirect_uri must match what the client registered" check is worthless because the attacker controls both sides.
**Why it matters:** Full owner-tier API access (catalog/pricing/customers/settings writes) from a single social-engineered consent click. PKCE does not mitigate — the attacker *is* the client.
**Confirm:** `POST /oauth/register {client_name, redirect_uris:["https://attacker/cb"]}` → open `/oauth/authorize?...&redirect_uri=https://attacker/cb&code_challenge=...` → approve while authenticated → observe `code=` at attacker origin → exchange.
**Fix:** Allowlist redirect schemes/hosts to the known connector set (`claude://…`, `https://claude.ai/…`, ChatGPT's), or prominently display the literal redirect host on the consent page and hard-warn on unknown hosts. **Code change — approval not required, but review before deploy.**

### C2 — Stock deduction is read-then-write and non-atomic → negative stock + corrupted ledger
**Where:** `worker/src/index.ts:2824-2827` (`handleFulfillInvoice`), `:3398` (`handleLinkLineItem`), `:2300-2341` (`handleManualStock`, absolute-set variant); `worker/src/mcp.ts:1349-1351` (`commitRecordSale`), `:1155` (`commitRemoveStock`). Independently confirmed by both the bug pass and the data-model pass.
**What:** Every deduction reads current stock, computes `newBalance` in JS, then issues an unconditional `UPDATE products SET stock_grams = stock_grams - ?` whose WHERE clause is only `id = ? AND account_id = ?` — **no `AND stock_grams >= ?` guard**. D1/SQLite has no interactive transaction across awaits, and `env.DB.batch()` is *not* a serializable transaction against concurrent batches. Two concurrent fulfillments of a 100g product for 80g each both read 100 and land at **−60g**. Worse, `stock_ledger.balance_after` is computed from the stale read (`index.ts:2821`), so the audit ledger permanently diverges from `stock_grams`. `handleFulfillInvoice` additionally **never checks availability at all** before deducting (admin path computes `newBalance = currentStock - qty` and writes it regardless of sign, ignoring `stock_holds`). There is no `CHECK(stock_grams >= 0)` either. The sold-out auto-archive then fires on `balance_after <= 0`, mislabeling oversells as "Sold Out."
**Why it matters:** Silent inventory corruption and a financial audit trail you cannot trust — the headline integrity risk for an inventory system.
**Confirm:** fire two concurrent `fulfill-invoice` calls for the same product whose combined qty exceeds stock; observe negative `stock_grams` and inconsistent `balance_after` rows.
**Fix:** Conditional UPDATE `SET stock_grams = stock_grams - ? WHERE id=? AND account_id=? AND stock_grams >= ?`, derive `balance_after` from `RETURNING stock_grams`, and treat `meta.changes === 0` as a 409 `insufficient_stock` that aborts the whole operation. Validate every line against available stock (minus holds) in `handleFulfillInvoice` before building the batch. **Code change — approval not required; recommend a `CHECK(stock_grams >= 0)` as a follow-up table rebuild ⚠ (migration → your approval).**

### C3 — No migration runner; core tables exist only in `schema.sql`; duplicate-numbered migrations conflict
**Where:** `worker/wrangler.toml` (no `[[migrations]]` block); `worker/schema.sql:80-206` (the only definition of `products`, `invoices`, `invoice_line_items`, `customers`, `activity_logs`); duplicate files `017_multi_account.sql` vs `017_multi_account_patched.sql`, plus duplicate `004/012/025/028/058/059/082`.
**What:** `worker/migrations/` is a hand-maintained journal applied ad-hoc, not via Wrangler's tracked migration system. Core tables and heavily-used columns (`given_name`, `markup_multiplier`, `fixed_retail_price_usd`, …) appear in **no migration** — only in `schema.sql`. The two `017` files conflict: running both double-`ALTER ADD COLUMN` (D1 has no `IF NOT EXISTS` on ADD COLUMN) and errors, and nothing records which one was applied. `schema.sql` has also drifted from the journal (e.g. `collection_publications.target_type` CHECK omits `'tag'`, which migration 044 added — a fresh `db:init` would reject tag-audience rows the code writes, `schema.sql:504`).
**Why it matters:** A ground-up restore from `migrations/` alone produces a broken database; per-environment schema provenance is unverifiable; disaster recovery is not guaranteed to reproduce production.
**Confirm:** attempt a fresh DB build from `migrations/` only — base tables are absent.
**Fix:** Adopt one source of truth — regenerate `schema.sql` as canonical and either retire the journal or move to a tracked `[[migrations]]` directory; resolve the duplicate-numbered files. ⚠ **Needs your decision (process + migration writes).**

---

## HIGH

### H1 — Public MCP rate limiter is optional + per-isolate, and each request runs full-table scans (unauthenticated DoS)
**Where:** `worker/src/index.ts:17590-17592` (edge limiter keyed on `CF-Connecting-IP` — good source — but binding is optional `PUBLIC_MCP_LIMITER?` at `index.ts:38`; absent it is a **no-op**); `worker/src/mcp.ts:4199-4208` (`publicRateOk` fallback is per-isolate `Map`, resets on recycle, multiplies by isolate count); `mcp.ts:4027/4062/4083` (`publicSearchTea`/`publicBrowseCatalog`/`publicPrepareOrder` each `SELECT … FROM products` with no `LIMIT`).
**What:** If the rate-limit binding isn't configured in prod, the public MCP has *zero* durable rate limiting; even with it, the in-code fallback is diluted across Cloudflare isolates. Each unauthenticated request triggers up to three full-table scans.
**Why it matters:** Unauthenticated DoS and D1 read-cost amplification from a single IP.
**Confirm:** check prod `wrangler.toml` for the `[[unsafe.bindings]]` `PUBLIC_MCP_LIMITER`; if missing, no durable limit. Then send bursts and watch D1 read units.
**Fix:** Fail closed if the binding is missing (or assert at startup), and `LIMIT`-bound / index the public search scans. **Code + config — config side needs your approval.**

### H2 — Internal error detail leaked to clients (info disclosure)
**Where:** `worker/src/index.ts:17651` (global catch returns `err.message` on any unhandled 500 — often raw D1/SQLite constraint text exposing column/schema names); `:5455` (`extract-from-image` returns full upstream Gemini `errText`); `:5035` (`transcribe` returns raw Groq error body).
**Why it matters:** Leaks schema, column names, upstream-provider internals, and logic to any caller who can trigger an error.
**Confirm:** trigger a DB constraint error on any route, inspect the 500 body.
**Fix:** Return a static client message; keep detail in `console.error` only. **Code change — no approval needed.**

### H3 — Invoice number formatting drift + collision → duplicate numbers / unhandled 500
**Where:** `worker/src/index.ts:2691-2696` (`handleCreateInvoice` uses `String(seq)`), `:3265-3270` (`handleSplitInvoice`), `worker/src/mcp.ts:1318-1323` (`commitRecordSale` uses `String(seq).padStart(5,'0')`).
**What:** The atomic seq bump (`UPDATE accounts SET invoice_seq = invoice_seq + 1 … RETURNING`) is fine, but the three paths format the number inconsistently (`5` vs `00005`). The unique index `idx_invoices_account_invoice_number_active` (migration 075) compares strings, so the two formats don't collide and **both persist as effectively duplicate numbers**. A crash between the bump and a failed INSERT also burns a number with no rollback, and the partial-unique-index collision surfaces as an unhandled 500.
**Fix:** One shared number-formatting helper for all three paths; catch the unique-constraint failure and retry with the next seq instead of 500ing. **Code change — no approval needed.**

### H4 — MCP tokens never expire
**Where:** `worker/src/mcp.ts:250-257` (auth is a SHA-256 hash lookup with no `expires_at`); migration 066 has no expiry column; OAuth-minted tokens also non-expiring with no refresh (`mcp.ts:3951-3953`).
**Why it matters:** A leaked token is valid until someone manually revokes it — large blast radius. (Note: the hash compare is not constant-time but is entropy-safe given a 256-bit secret, so that sub-point is acceptable.)
**Fix:** add `expires_at` to `mcp_tokens` and enforce it in `authenticateMcp` (mirror the JWT `exp` check). ⚠ **Migration + code — your approval for the migration.**

### H5 — Confirmation tickets aren't bound to the issuing token or its scope/tier
**Where:** `worker/src/mcp.ts:074_*` ticket carries only `kind` + payload + `account_id`, no `token_id`; commit branches like `mark_invoice_paid` (`mcp.ts:2528-2535`), `create_tea` (`:467`), `record_sale` (`:1290`) don't re-bind the ticket to the supplied id.
**What:** Single-use and cross-account replay *are* correctly prevented (atomic `UPDATE…RETURNING`, payload carries `account_id`, owner-tier tools re-gate at dispatch). The residual gap: any token **on the same account with the same scope** can confirm a ticket another token previewed, and confirm trusts `pending.accountId` without re-validating the *current* token still owns it. Per-token auditability and least-surprise are violated.
**Fix:** store `token_id` (+ required scope/tier) on the ticket; verify `auth.tokenId === ticket.token_id` and re-check scope/tier in each commit. Add the missing `pending.invoiceId === invoiceId` guard to `mark_invoice_paid`. ⚠ **Migration + code — your approval for the migration.**

### H6 — D1 foreign keys are inert; orphans are possible
**Where:** all `REFERENCES` / `ON DELETE CASCADE` clauses (`schema.sql:201-202, 290, 491, 503` and migration cascades). No `PRAGMA foreign_keys` anywhere, and D1 cannot enable it per-connection.
**What:** Every FK and cascade is advisory documentation only. Deleting a `products` row leaves dangling `invoice_line_items.product_id`, `stock_ledger.product_id`, `collection_items.product_id`, `tea_samples.product_id`. `invoice_line_items.account_id` is nullable (`schema.sql:200`) while all reads filter on it — a NULL-account line item is a silent orphan invisible to scoped queries.
**Fix:** enforce in code (delete-children-first helpers), prefer soft-delete for `products`, backfill + `NOT NULL` on `invoice_line_items.account_id`. **Code now; constraint changes ⚠ need approval.**

### H7 — `stock_ledger.product_id` is unindexed
**Where:** `schema.sql:288` (indexes `account_id`, `batch_id`, never `product_id`); per-product ledger/balance lookups and the seed `NOT EXISTS` scan (`025_stock_ledger_seed.sql`) full-scan.
**Fix:** `CREATE INDEX idx_stock_ledger_product ON stock_ledger(product_id)`. ⚠ **Migration — your approval.**

### H8 — Fire-and-forget writes after the committed batch can silently lose data while returning success
**Where:** `worker/src/index.ts:2886-2940` (post-fulfillment compass-queue `INSERT INTO tea_compass_entries` at `:2912` is a plain individual `.run()` outside the batch, failures swallowed at `:2937`). Email at `:2942` is acceptable; the queue inserts are not.
**Fix:** move queue population into the main batch or make it idempotent + retried. **Code change — no approval needed.**

---

## MEDIUM

| # | Finding | Where | Fix |
|---|---|---|---|
| M1 | **Auth rate limiting is per-isolate (`Map`) and resets on cold start** — brute-force on admin/customer login is diluted across isolates. | `index.ts:17509-17520`, login `:1130`, signup `:1251` | Move auth endpoints to a Cloudflare `ratelimit` binding (same mechanism as `PUBLIC_MCP_LIMITER`). ⚠ config |
| M2 | **`X-Forwarded-For` fallback in the rate-limit key is client-spoofable** — attacker rotates the header for a fresh bucket per request. | `index.ts:1129`, `:1250` | Drop the XFF fallback; use `CF-Connecting-IP` only (as verify/public paths already do). Code |
| M3 | **Cross-tenant write into another account's xref tables** — `link`/`unlink` verify the *product* belongs to the caller but never the article/module/project `params.id`. | `index.ts:4699-4732`, routes `:17431-17443` | Add `account_id = ctx.accountId` check on `params.id` before insert/delete. Code |
| M4 | **Pagination has no NaN/bounds handling** — `parseInt('abc')→NaN` as bound LIMIT, negative offset accepted, no upper cap (`?limit=999999999` = full scan). | `index.ts:2646-2647` (`handleGetInvoices`), `:3437-3438` (`handleGetStockLedger`) | `Math.min(Math.max(1, Number.parseInt(...)||50), 200)`; clamp offset ≥0. Code |
| M5 | **No CHECK constraints on enum/status fields** — `products.status`, `invoices.status`, `invoices.payment_status`, `stock_ledger.reason`, `product_listings.status`, `wholesale_orders.status`. Typos/invalid states persist silently. | `schema.sql` various | Add CHECKs (table rebuild) or validate exhaustively in code. ⚠ migration |
| M6 | **Prices stored as `REAL` floats; margin-warning math ignores `cost_currency` conversion** — float precision drift in financial `SUM()`s; misleading margin floor when cost is non-USD. | `schema.sql` (`price_at_sale`, `cost_amount`, …); `mcp.ts:~1571` | Centralize rounding + fix currency conversion in margin math (code); consider integer cents ⚠ migration |
| M7 | **`invoice_line_items.quantity INTEGER` truncates fractional grams** while sale math treats grams as continuous. Three names for one concept (`delta`/`grams`/`quantity`). | `schema.sql:205`; `mcp.ts` record_sale | Decide INTEGER vs REAL to match the grams model. ⚠ migration |
| M8 | **Missing indexes** on `invoices.customer_id` (customer order-history scans) and `invoices.source_event_id/source_collection_id` (sales attribution). | `schema.sql:175-196` | `CREATE INDEX idx_invoices_customer(account_id, customer_id)` etc. ⚠ migration |
| M9 | **`add_stock` dual-write assumes listing id `list_${productId}`** — products created post-048 with no listing silently skip the `product_listings` mirror, deepening the dual-model drift. | `mcp.ts` add_stock; data model `products`↔`product_listings` | Reconcile/retire the dual model. ⚠ decision |
| M10 | **`handleListBatches.item_count` counts ledger product_ids ever touched, not current stock** — the headline intake-screen number overstates. | `index.ts:2987-2988` | Confirm intent; if wrong, join on current `stock_grams > 0`. Code |
| M11 | **`handleManualStock` absolute-set lost-update race** — `SET stock_grams = ?` (absolute) racing a deduction discards the deduction; ledger lies. | `index.ts:2300-2341` | Conditional update keyed on expected old value; abort + re-read on mismatch. Code |
| M12 | **`collection_publications.target_type` CHECK omits `'tag'`** — fresh `db:init` rejects tag-audience publications the code writes. | `schema.sql:504` vs migration 044 | Reconcile schema.sql CHECK. ⚠ migration |

---

## LOW

- **`requireAdmin` trusts stale JWT `claims.role`** (no DB re-check) — a demoted admin keeps access ≤30 days; confined to the internal feature-status tracker. `requireOwner` is defined but **never used** (dead code). `index.ts:968-978`, used at `:3102/:3124`.
- **Favorites/tasting-journal handlers read `X-Teajia-Account` without `getActiveAccount`'s membership check** — safe because also scoped to `WHERE user_id = ?` (caller's own rows), but route through `requireAccount` for consistency. `index.ts:7305/7323/9577/9602/9660/9734`.
- **`handleRequestSample` lets any authenticated user write a `requested` sample row into any account** (product must exist in that account, so no breach — spam/abuse vector). `index.ts:9768-9796`. Rate-limit / require a published store.
- **`handleTruncateAll` leaves `product_listings`, `tea_profiles`, `stock_ledger`, `stock_holds`, `batches` behind** — after a per-account truncate the listing mirror still shows the old catalog. `index.ts:3490-3495`.
- **Listing-mirror stock divergence is structural** (double-write, no reconciliation; record_sale path lacks the `MAX(0, …)` clamp the wholesale path has at `:16572`). `index.ts:2825/2828`, `mcp.ts:1350/1354`.
- **No request-body/file-size cap** on authenticated upload/transcribe/extract endpoints (auth-gated, CF caps at 100MB — low blast radius, but unbounded paid-API cost). `index.ts:5016/5228/5363`.
- **Failed auth is not audit-logged** — `platform_audit_log` covers platform mutations well (36 sites) but records no failed logins, failed verifies, or 401/403 denials. No forensics trail for credential-stuffing. `index.ts:1232` and the `require*` 403 branches.
- **Dev-admin backdoor** (`identifier 'aaa'`, fixed SHA-256 hash → owner on Bali account) is correctly gated behind `ENABLE_DEV_ADMIN === 'true'` and not attacker-togglable — but it's a real credential in source. `index.ts:1171-1200`. ⚠ Verify the flag is unset in prod; consider removing the hash once DB users exist.
- **CORS `teajia[a-z0-9-]*\.pages\.dev` regex** would match an attacker-registered Pages project (`teajia-evil.pages.dev`). Low risk (no credentialed CORS), but tighten to the exact project name. `index.ts:17552`.
- **Fire-and-forget `last_used_at` bump + ticket reaping** not wrapped in `ctx.waitUntil` — may be cancelled post-response; `mcp_confirmation_tickets`/`oauth_authorize_requests` can grow unbounded. `mcp.ts:260-261/325-326/3689-3690`.
- **Thrown errors on mutating MCP tools bypass `logMcpToolCall` audit** (only confirmed/record_sale logged). `mcp.ts:3346-3351`.
- **Low-stock alert is effectively one-shot** — once stock is below threshold, further drops never re-alert (`currentStock >= threshold` is then false). `index.ts:2852`, `mcp.ts:1369`. Document intent or fire on each crossing.
- **`prefixInvoiceNumber` swallows DB errors** (returns raw value → unprefixed number that can collide) and may now be dead relative to the inlined seq path. `index.ts:2671-2680`.
- **Unbounded profile query** flagged with `TODO: add pagination when catalog grows past ~500 profiles`. `index.ts:15152`.
- **Likely dead/build-ahead schema:** `seasonal_calendar`, `member_connections`/`connection_invites`/`anonymous_verdicts`/`table_share_tokens` (mig 064), the wholesale-order chain (048/050), `account_wholesale_overrides`. Usage sweep before any drop.

---

## NEEDS YOUR DECISION (writes / destructive / config / deploy / migration)

1. **C3** — schema source-of-truth consolidation + duplicate-migration resolution (process + migration writes).
2. **C2 follow-up** — `CHECK(stock_grams >= 0)` table rebuild.
3. **H1** — making the public-MCP rate-limit binding mandatory (`wrangler.toml` + deploy).
4. **H4** — `mcp_tokens.expires_at` migration + enforcement.
5. **H5** — confirmation-ticket `token_id`/scope binding migration.
6. **H7 / M8** — new indexes (`stock_ledger.product_id`, `invoices.customer_id`, source_* columns).
7. **H6 / M5 / M6 / M7 / M12** — NOT NULL backfill, enum CHECKs, integer-cents pricing, quantity type, `target_type` CHECK reconcile (all table rebuilds).
8. **M1** — auth-endpoint rate-limit binding (config + deploy).
9. **Low** — confirm `ENABLE_DEV_ADMIN` is unset in production and decide whether to remove the hardcoded dev-admin hash.

Code-only fixes that do **not** need approval (recommend doing now): C1, C2 (the conditional-UPDATE logic), H2, H3, H8, M2, M3, M4, M10, M11, and the listing-mirror clamp.

---

## What I could NOT inspect, and why

- **Live production configuration** — whether `PUBLIC_MCP_LIMITER` and the auth rate-limit binding are actually present in the deployed Worker, and whether `ENABLE_DEV_ADMIN` / `DEV_RETURN_VERIFY_CODES` are unset in prod. `wrangler.toml` declares them but the runtime/secret state lives in Cloudflare and Infisical, which are out of scope for a read-only repo audit. **Verify via the Cloudflare dashboard / `wrangler secret list`.**
- **Actual D1 data** — orphaned-record counts, whether negative `stock_grams` or duplicate invoice numbers already exist, and which of the duplicate `017`/`028`/etc. migrations were truly applied to the remote DB. Confirming requires read queries against production D1 (a write-free but live-data action) — **not run**, per read-only scope. Recommend a read-only reconciliation query set once you approve.
- **Dependency/supply-chain** — the worker has only `wrangler` + `@cloudflare/workers-types` as devDependencies and no runtime npm dependencies, so the supply-chain surface is minimal; no `npm audit` was run (no production deps to audit).
- **R2 bucket contents / object ACLs** — `MEDIA_BUCKET` object-level access was not inspectable from source.

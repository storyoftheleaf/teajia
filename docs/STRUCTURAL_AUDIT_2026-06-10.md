# Structural Audit — 2026-06-10

Full-project audit: where things don't fully connect, where to harden, and where the
structure can grow. Produced from four deep passes (worker/API, frontend, data layer,
docs/tests/hygiene) with the highest-stakes findings hand-verified against source.

Severity legend: 🔴 fix before real customers · 🟠 fix soon · 🟡 plan it · ⚪ cleanup

---

## 1. Critical — security & tenancy (🔴)

### 1.1 Verification flow is an identity bypass
`POST /api/verify/request` returns the verification code **in the API response**
(`worker/src/index.ts:8697-8699`, comment says "remove before production"). Anyone can
request a code for *any* phone/email and read it back, then pass
`POST /api/verify/confirm` as that customer. Until WhatsApp/email delivery exists, this
endpoint should be disabled or gated behind a dev flag — not shipped returning the code.
Same `_note` appears again near `index.ts:17698`.

### 1.2 Verify flow ignores multi-tenancy entirely
The same handlers look up and create customers **globally**:
- Lookups: `WHERE email = ?` / `WHERE phone = ? OR whatsapp = ?` with no `account_id`
  (`index.ts:8659-8661`, `index.ts:8707-8710`, also `handleGetJourney` ~`index.ts:8790`).
- The INSERT at `index.ts:8682-8694` writes a customer with **no `account_id` at all**,
  creating orphan rows outside every account-scoped query in the rest of the API.
- Cross-account leak: a phone number that exists under another account returns that
  customer's name/existence to the caller.

### 1.3 Event slugs are globally unique-checked, not per-account
`SELECT id FROM events WHERE slug = ?` with no account filter at `index.ts:6243`
(create), `index.ts:6634` (duplicate), `index.ts:8248` (update); the public resolver at
`index.ts:6121` also matches by slug alone. Two accounts can collide, and the public
endpoint returns whichever row matches first. Fix: `AND account_id = ?` on the
uniqueness checks, and decide whether public event URLs are `/:account/:slug` or
globally unique by construction.

### 1.4 Schema-level slug uniqueness is global where code assumes per-account
- `collection_publications.slug` — `UNIQUE` global (`migrations/039_collections.sql:25`)
- `articles.slug` — `UNIQUE` global (`migrations/031_articles.sql:17`)
- `products.slug` — no `UNIQUE(account_id, slug)` at all

As more stores onboard (MULTI_STORE_PLAN), these become real collisions. Pick one rule
— per-account uniqueness with account-scoped public URLs — and enforce it in schema.

---

## 2. Where things don't fully connect

### 2.1 Migrations: 8 duplicate numbers, no applied-migrations tracker
Duplicate sequence numbers confirmed: **004 (×3), 012, 017, 025 (×3), 028 (×3), 058,
059 (×3), 082**. Notably `017_multi_account.sql` vs `017_multi_account_patched.sql` —
two competing versions of the *multi-tenancy* migration. There is no
`migrations_applied` table; files are applied by hand/CI in filesystem order, so the
actual production schema state is not reconstructible from the repo. This is the single
biggest "doesn't fully connect" gap: the schema the code assumes and the schema D1
actually has are only connected by convention.

**Recommended:** add a tracker table + a small apply script; renumber the duplicates
(or adopt timestamp prefixes going forward); record which of each duplicate pair prod
actually ran; delete the loser of the 017 pair.

### 2.2 ~25 tables no worker code ever queries
Defined in migrations, zero references in `worker/src` (grep-based — spot-check before
deleting): `anonymous_verdicts`, `connection_invites`, `event_post_session`,
`feature_status`, `purchase_orders`, `seasonal_calendar`, `table_share_tokens`,
`wholesale_margin_defaults`, `user_taste_profile`, `saved_collections` (despite
migration 080), and others. Either these are features that stalled between schema and
code (the wholesale tables look like an abandoned half of `WholesaleOrderDraft`/
`WholesaleOrderTimeline` UI) or they're dead. Each one is a place where an idea was
half-landed — decide: finish, or drop the table.

### 2.3 Dead-end columns
`products.source_compass_entry_id` is indexed (migration 012) but nothing does the
reverse lookup; `products.last_synced_at` has no readers; `customer_tasting_journal.archived`
exists but no archive flow uses it. Same pattern as 2.2 at column granularity.

### 2.4 Frontend dead weight
- `src/data/tea-database/` — **~13.5K lines** of static tea data imported by nothing
  (only reference is its own docstring). Not in the bundle (tree-shaken), but it's a
  large stalled idea: either wire it into Learn/Compass as the reference library it was
  clearly meant to be, or delete it.
- `@phosphor-icons/react` (5 imports, legacy) vs `lucide-react` (197 imports) — finish
  the migration, drop the dep. `recharts` (2 imports) and `cmdk` (1 import) are
  borderline; cmdk's single use suggests an unfinished command-palette idea.
- `DesignSystemShowcase.tsx` (2.1K lines) ships behind public `/design/*` routes —
  lazily loaded, but should be dev-only or admin-gated.

### 2.5 Docs say one thing, deploys do another
- `README.md` and `DEPLOY.md` still point at the abandoned `teajia` Pages project; the
  workflows correctly deploy to `teajiafinal`. DEPLOY.md is a pre-launch Phase-1A
  playbook that references a migration path that no longer matches the files.
- Root clutter tracked in git: `playwright-report/index.html` (test artifact),
  `audit-admin-results.json`, `audit-temp.mjs`, `April to-do list.md` (superseded by
  `TODO.md`). `.gitignore` covers `test-results/` but not `playwright-report/`.

### 2.6 Known-stub surfaces are healthier than documented
CLAUDE.md lists `/account/orders` and `/account/samples` as empty-state stubs, but both
pages now fetch and render real data via `api.me.orders()` / `api.me.samples()` with
error/empty states. Update CLAUDE.md; the remaining gap is the per-order detail page
(TODO at `src/pages/OrderHistoryPage.tsx:101`).

---

## 3. Hardening

### 3.1 CI has no gates at all (🟠)
`deploy-frontend.yml` runs only `npm run build`; `deploy-worker.yml` runs migrations +
deploy. Nothing runs `npm run lint` (tsc), `npm run lint:colors` (which CLAUDE.md calls
mandatory), `npm run test:worker`, or any Playwright spec. A broken type build or a
failing auth test deploys to production. Minimum fix: lint + `test:worker` as required
steps in both workflows; lint:colors in the frontend one.

### 3.1b The mandatory color lint currently fails on the tree (🟠)
`npm run lint:colors` — which CLAUDE.md requires before every commit — exits 1 today:
2 rule classes violated across ~22 sites (`border-tea-border/NN` opacity modifiers in
Videos/LearnExplore/LearnCurriculum/CommunityWisdomView/ResourcesPage/curatedCollections/
BriefingPage; `border-tea-gold` dividers in GlobalSearch/TeaInventory/TaxonomyChipPicker/
EventForm sections/CreateWizard/AdminApp/PlatformAccessView). A mandatory check that
always fails trains everyone to ignore it. Fix the violations (or grant explicit
exemptions in the script), then gate it in CI per §3.1.

### 3.2 TypeScript is running with the safety off (🟠)
`tsconfig.json` has `strict: false`, `strictNullChecks: false`, `noImplicitAny: false`;
~312 `: any` across src + worker. Flipping strict on wholesale is a huge diff — instead
enable `strictNullChecks` first (highest bug-catch per unit of churn), fix forward, and
require new files to be clean.

### 3.3 Worker monolith (🟠)
`worker/src/index.ts` is 17,549 lines with **339 routes** in one flat match table.
Parameterization is consistently safe (allowlisted dynamic SET clauses, bound values —
no SQL injection found), batching is used well (60+ `DB.batch()` for atomic multi-table
writes), but the file has clear seams that should become modules: auth/JWT
(~lines 81–277), products (~2194–2480), invoices (~2635–3425), customers
(~3495–4917), events (~5680–8430), collections (~13466–15604), samples/journal
(~9497–10070). Split incrementally — one domain per PR — keeping `index.ts` as the
route table. This also helps the Workers bundle-size concern and makes per-domain
testing tractable.

### 3.4 Error responses are inconsistent
Across 339 routes: `{error}`, `{error, reason}`, `{error, required_bundle}`,
`{success:false, error}` all coexist. Standardize one envelope
(`{ error: string, code?: string, details?: object }`) so the frontend can stop
pattern-matching strings (e.g. `'Account access denied'` triggers
`ACCOUNT_MISMATCH_EVENT` in `src/lib/api.ts:402-408` by string equality).

### 3.5 Missing indexes on hot auth paths
No indexes on: `users` (any), `password_reset_tokens` (user_id, token),
`oauth_clients` (client_id), `invoice_line_items.product_id` (only invoice_id is
indexed, migration 023), `exchange_rates`, `account_features`. Every login/token
mint/invoice list pays for it. One small migration fixes the lot.

### 3.6 Delete behavior is undefined
D1 doesn't enforce FKs by default and the schema declares no `ON DELETE` rules on
`invoice_line_items → invoices/products`, `stock_ledger → products`,
`account_features → users`. Deleting a product orphans ledger rows. Combined with mixed
soft-delete conventions (`invoices.deleted_at` TEXT vs `…journal.archived` INTEGER vs
hard deletes elsewhere), deletion is the least-specified operation in the system. Write
down the rule per entity (archive vs delete vs cascade) and enforce it in the handlers,
since the DB won't.

### 3.7 Timestamp formats are split
Most tables use TEXT ISO-8601 (`datetime('now')`); `mcp_confirmation_tickets` and
`oauth_authorize_requests` use INTEGER unix-ms; `oauth_codes.expires_at` is TEXT while
`oauth_authorize_requests.expires_at` is INTEGER. Cross-table time comparisons need
per-table knowledge. Standardize new tables on one format and note the legacy ones.

### 3.8 Rate limiting is per-isolate
Login throttle (10/min/IP) lives in an in-memory map that resets on cold start and
isn't shared across isolates. Fine as a speed bump; for real abuse resistance move it
to the same edge rate-limiter binding already used for `/mcp/public`, or D1/KV.

### 3.9 What's already strong (keep it)
JWT HS256 via WebCrypto with expiry + grace-window refresh; PBKDF2 with legacy-hash
upgrade on login; constant-time compares; MCP tokens stored as SHA-256 with scope
re-verification at dispatch and durable single-use confirmation tickets
(`UPDATE…RETURNING`); OAuth with PKCE; CORS allowlist; stack traces logged but not
returned. The auth core is in good shape — the gaps are at the edges (verify flow,
tenancy scoping), not the center.

---

## 4. Test coverage vs surface area

| Surface | Size | Coverage |
|---|---|---|
| Worker API | 339 routes, 21.8K lines | 3 vitest files, 797 lines (auth boundaries, intake batches, MCP fulfillment) |
| Frontend | 587 files, ~165K lines | **0 unit tests** |
| E2E | — | 9 Playwright specs (mobile smoke + inventory-scroll guard) |

The three worker test files target exactly the right things — extend that pattern:
1. **Tenancy isolation tests** (account A cannot read account B's customers/events/
   invoices) — would have caught every finding in §1.
2. Verify/confirm flow tests (currently zero, and it's broken).
3. Invoice void/split, product mirror-write sync (`tea_profiles`/`product_listings`).
4. Frontend: a handful of vitest specs for `store.ts` (cart math, currency, account
   switching) and `api.ts` token refresh — the two files everything depends on.

---

## 5. Where the structure can grow (development opportunities)

1. **Finish or fold the wholesale system.** Big UI (`WholesaleOrderDraft`,
   `WholesaleOrderTimeline`, ~2.3K lines) + big schema (migration 050) but orphaned
   tables (`purchase_orders`, `wholesale_margin_defaults`) suggest the loop was never
   closed. It's the most-built unshipped feature in the repo.
2. **Order lifecycle surface.** WhatsApp checkout is intentional, but post-conversation
   state (confirmed → packed → shipped) has schema and admin support while the customer
   side stops at the order list (`OrderHistoryPage` TODO). A per-order status page
   closes the loop without violating the "personal conversation" model.
3. **tea-database as the Learn engine.** 13.5K lines of curated regional tea data
   already written — wiring it into Learn/Compass (reference pages, "what is this
   cultivar" lookups) turns dead weight into the educational moat the VISION doc
   describes.
4. **MCP Phase 2 is well-positioned.** The preview/confirm pattern, durable tickets,
   and scope model are solid foundations; invoice PDF/email delivery (documented as
   Phase 2) and real verification-code delivery (§1.1) are the two obvious next
   handlers, and both reuse existing plumbing.
5. **Shared page primitives.** `OrderHistoryPage`/`SampleHistoryPage` are ~95%
   identical; `formatDate` is reimplemented in 3+ places; status-tone helpers are
   copy-pasted. A small `src/utils/formatters.ts` + a generic list-page component pays
   for itself with the next account surface.
6. **Component splits with the most leverage:** `InventoryView` (3,280 lines, ~65
   useState hooks → extract row renderer, bulk toolbar, reduce to useReducer),
   `ArticlePage` (2,868 → one renderer module per page `kind`), `CaptureCard` (2,117 →
   flavor/feeling/body sub-forms).

---

## 6. Suggested sequencing

**Now (small diffs, high stakes):** disable/gate verify-code-in-response (§1.1); scope
verify lookups + INSERT to account (§1.2); add `AND account_id` to event slug checks
(§1.3); index migration for auth tables (§3.5); add lint + test:worker gates to CI
(§3.1); untrack playwright-report/audit artifacts and fix `.gitignore` (§2.5).

**Next:** migrations tracker + duplicate-number reconciliation (§2.1); error envelope
standardization (§3.4); tenancy-isolation test suite (§4); update README/DEPLOY/
CLAUDE.md drift (§2.5, §2.6).

**Then:** worker modularization one domain at a time (§3.3); `strictNullChecks` (§3.2);
orphaned table/column reconciliation (§2.2–2.3); component splits (§5.6); wholesale
finish-or-fold decision (§5.1).

---

*Caveats: orphaned-table/column lists are grep-derived against `worker/src` — verify no
dynamic SQL references before dropping anything. `npm run lint` could not be executed in
the audit environment (no node_modules), so current tsc status is unverified; the CI
finding (§3.1) stands regardless. Line numbers reference the audit-date state of
`worker/src/index.ts` and will drift.*

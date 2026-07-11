# Track 8: Platform Hardening: Worker, MCP, Architecture

> Make it safe to hand to a second developer and a second store: split the 18.9K-line worker monolith along its seams, close the one real tenancy-testing gap, finish the mechanical code-split, and put the MCP layer to bed.

Status: pre-launch, in development.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [ ] **Tenancy-isolation test suite.** `worker/tests/` has exactly 3 files (853 lines total: `auth-boundaries.test.ts`, `intake-batches.test.ts`, `mcp-fulfillment.test.ts`). `auth-boundaries.test.ts` tests bundle-gate denial/allowance (16 cases), but none of them prove account A cannot read account B's customers/events/invoices; there is no cross-account isolation test anywhere in the repo today. This is the precondition for Track 2 opening a real second store (Australia) safely. Write fake-D1 tests that seed two accounts and assert every scoped read/write 404s or 403s across the account boundary for customers, events, invoices, and products. (day)
- [ ] **Fix customer route bundle inconsistency.** `GET /api/customers/:id` requires only `requireAccount` (`worker/src/index.ts:4246`, any account member can read), but `PUT`/`DELETE /api/customers/:id` require `requireBundle(request, env, 'gather')` (`worker/src/index.ts:4527`, `4551`), the events bundle, gating writes to a person record instead of `sell` as `docs/plan/customer-contact-taxonomy.md` recommends (buyer relationship maps to `sell`). Decide the right bundle per the taxonomy doc's proposed split (sales customers to `sell`, vendors to `catalog`, event participants to `gather`) and align GET/PUT/DELETE. (hours)
- [ ] **Remove the legacy `PUT /api/products/:id` fallback.** Confirmed zero remaining callers: `src/lib/api.ts:880`'s `products.update()` wrapper around it has no call sites in `src/` (grep-verified), and MCP tools don't touch it either. Everything now goes through `updateProductByDomain` (`src/lib/api.ts:886`) and the four command routes (`/catalog`, `/stock`, `/commercial`, `/publication`). Delete `handleUpdateProduct` (`worker/src/index.ts:2514`), the route registration (`worker/src/index.ts:18302`), and the `api.products.update()` wrapper. (hours)
- [ ] **Error envelope standardization.** Across the route table (368 `['METHOD', ...]` entries), error shapes still fork: `json({error: '...'})`, `json({error, reason})` (7+ call sites), `json({success:false, error})` elsewhere. `ACCOUNT_MISMATCH_EVENT` in `src/lib/api.ts:580` still pattern-matches on the literal string `'Account access denied'`. Pick one envelope (`{ error: string, code?: string, details?: object }`), migrate route by route, and update the frontend match at `api.ts:580` to check `code` instead of the message string. (day, mechanical but touches every handler)
- [ ] **Worker modularization.** `worker/src/index.ts` is 18,917 lines (was 17,549 at the June 10 audit; still growing), with 368 routes in one flat match table and handlers scattered non-contiguously by domain (for example, product handlers run 1907-15405, invoice handlers 2814-3605, interleaved with unrelated domains). Split along domain seams (auth, products, invoices, customers, events, collections, samples/journal) into `worker/src/routes/*.ts`, one PR per domain, keeping `index.ts` as the top-level route table. Re-run `grep -n "^const handle"` per domain before starting each PR; line numbers have drifted since the June audit and will drift again. (multi-day, one domain at a time)
- [ ] **Code-split Wave 2.** Wave 1 shipped (Suspense infra in `AdminApp.tsx` plus `TeaCompass`, `InventoryView`, `DashboardView` lazy-loaded, PR #264/#266). 36 routed views remain static top-level imports in `src/admin/AdminApp.tsx` (`AccessView`, `AccountActivityView`, `AccountSettingsView`, `ActivityView`, `AdoptionQueue`, `CatalogBrowse`, `CatalogView`, `CollectionEditView`, `CollectionsView`, `ContactTagsView`, `CurrencyRatesView`, `CustomerProfilePage`, `EventDetail`, `EventsManager`, `InboundCollectionView`, `IntakeWorkspace`, `MCPTokensView`, `MagazineView`, `MovementStockView`, `NetworkLanding`, `OAuthConsentView`, `PartnerListingEdit`, `PeopleView`, `PlatformAccessView`, `PlatformAdminView`, `PlatformAuditLogPage`, `ProductStoryView`, `PurchaseOrdersPage`, `StoreLaunchPlaybookView`, `SuggestionsInbox`, `TeaTable`, `TeawareCatalog`, `VendorProfileView`, `VenueManager`, `WholesaleOrderDraft`, `WholesaleOrderTimeline`, `WholesaleOrdersList`). Convert each to the same `lazy(() => import(...).then(m => ({ default: m.X })))` pattern used for Wave 1. Mechanical, one PR since the pattern is identical per view. Verify with `npm run build` (chunk map, no view over 600KB) plus `npm run test:mobile`. (day)
- [ ] **Code-split Wave 3: idle prefetch.** After Wave 2, prefetch `TeaCompass` and `InventoryView` chunks on idle after the admin shell mounts (`requestIdleCallback` plus `import()`, or `<link rel="modulepreload">`), since those are the two surfaces Adrian opens most. Optional, only do it if the common-case load feels slow after Wave 2. (hours)
- [ ] **MCP: real-iPhone OAuth verification.** The transport bug is already fixed in code. `/oauth/authorize` now persists the request in D1 (`oauth_authorize_requests`, migration 082) and redirects to `/admin/oauth-consent/<id>` (path-based, survives the iOS in-app-browser query-string drop). This needs Adrian to actually add the Teajia connector on Claude mobile and confirm the consent screen renders with the params populated; no agent can complete this step, it requires his physical phone. If it still fails, the candidate causes are ranked in the archived `MCP_MOBILE_OAUTH_TODO.md`. (10 min Adrian test, hours of agent follow-up only if it still fails)
- [ ] **Migration 017 duplicate resolution.** Two files exist: `worker/migrations/017_multi_account.sql` (177 lines, adds `account_id` to `guest_invites`, `interest_signups`, `tea_samples`, `tea_sample_sets`, `tea_sample_tastings`, `customer_tasting_journal`, `stock_holds`, `newsletter_subscribers`, `user_favorites` among others) and `017_multi_account_patched.sql` (153 lines, identical minus those ALTERs, written because those tables didn't exist yet in prod at patch time). Both apply on a fresh environment today (the CI migration runner tracks by filename in `d1_migrations`, so duplicate-number files don't corrupt prod, but a fresh clone replays both in lexical order). Query prod's `d1_migrations` table to see which one is actually recorded as applied, delete the other, renumber forward. (hours)
- [ ] **Distributed rate limiting: close the remaining gap.** Login and signup already use the durable edge limiter (`LOGIN_LIMITER` binding, `worker/wrangler.toml:66-69`, wired at `worker/src/index.ts:1176-1183` and `1309-1310`); `/mcp/public` uses its own edge limiter (`PUBLIC_MCP_LIMITER`, wired at `worker/src/index.ts:18822-18824`). `handleVerifyRequest` (`worker/src/index.ts:9799`) and `handleRedeemJoinCode` (`worker/src/index.ts:13769`) still only use the per-isolate in-memory `checkRateLimit()`, which resets on cold start and doesn't span isolates. Add a third edge-limiter binding (or reuse `LOGIN_LIMITER` with a distinct key prefix) for these two. (hours)
- [ ] **strictNullChecks forward-fix.** `tsconfig.json:15-17` still has `strict: false`, `strictNullChecks: false`, `noImplicitAny: false` (worker's own `worker/tsconfig.json:8` is already `strict: true`; this is frontend-only). Flip `strictNullChecks` on, fix the errors it surfaces, and require new files to be clean going forward per the June audit's recommendation (highest bug-catch per unit of churn, without the huge diff of flipping `strict` wholesale). (multi-day, background pace)
- [ ] **Delete unused `tea-database`.** `src/data/tea-database/` is now 9,104 lines (was roughly 13.5K at the June audit; some has apparently already been trimmed) of static tea reference data imported by nothing outside its own docstring (grep-verified, tree-shaken out of the bundle already). Track 8's call is to delete it, not wire it in; turning it into the Learn/Compass reference library is a content decision that belongs to Track 3 if anyone wants to pick it up later. (hours)

### Polish

- [ ] **IndexedDB offline write queue.** No offline mutation queue exists today (grep-verified: no `offlineQueue`/`syncQueue` anywhere in `src/`). The read side is solid (Workbox NetworkFirst/CacheFirst, see Already shipped), but writes made while offline (China trips, rural signal) are simply lost. Judged "yes, worth building" in VISION_AUDIT_7, but timed to when China trips resume rather than urgent now. Coordinate with Track 4 (China Reachability), which owns the existing service worker and media proxy this would extend. (day, when picked up)
- [ ] **Timestamp format unification.** Most tables use TEXT ISO-8601 (`datetime('now')`); `mcp_confirmation_tickets.expires_at` and `oauth_authorize_requests.expires_at` are INTEGER unix-ms (confirmed still true, migrations 074/082). Standardize new tables on one format; leave existing ones documented as legacy. (background)
- [ ] **Unified search endpoint.** Current state: `src/components/shared/GlobalSearch.tsx` runs four separate client-side `Fuse.js` instances (products, published stories, DB articles, events), functional, but no glossary coverage and no server-side FTS. Only worth building a real `/api/search` (D1 FTS5, `notes_fts` in `worker/migrations/025_notes.sql` shows the pattern already exists for one table) once a real usage signal asks for it, per the June audit's own judgment. Not urgent. (background, judged low-priority)
- [ ] **Image batch optimization plus index audit.** One-time batch optimization of existing R2 product images (WebP/AVIF where missing) and a pass confirming every frequent D1 query has a supporting index (the one confirmed gap, `invoice_line_items.product_id`, is already fixed in migration 084). `src/components/shared/ResponsiveImage.tsx` already handles srcset on the read side. (background)
- [ ] **"Today" briefing card, low priority.** `src/admin/components/AdminHomeView.tsx` already aggregates pending orders plus pending RSVPs into tile badges (lines 98-108), a partial version of the VISION_AUDIT_6 "Needs Attention" concept. The fuller version (Today's Numbers, Quick Actions) was judged low priority salvage; pick up only if the admin home screen feels thin in daily use. (hours if picked up)

## Gated on launch decision

None. Every open item in this track is a code/schema/test task an agent or Adrian can do solo pre-launch. The one item needing Adrian personally (real-iPhone OAuth test) is Adrian verifying his own MCP connector, not onboarding a real user; it's account/device setup, the same shape as the Track 7 Maps-API-key item.

## Already shipped

- Bundle enforcement closure plus fail-closed auth (April); 142 `requireBundle()` call sites across `worker/src/index.ts` today (the May audit's "no server-side enforcement" finding is stale).
- `auth-boundaries.test.ts` (16 cases: bundle denial/allowance, MCP OAuth verification, scope filtering).
- SQL filter parameterization (customer `type` filter, article `status` filter both bound, not interpolated).
- Account-scoped React Query keys (`useProducts`, `useRates`, `useCustomers`, `useActivityLogs`, `useStockLedger` all include account/user scope) plus cache invalidation on AccountPanel switch.
- Contact-relationship taxonomy (`contact_relationships` table, migrations 069-070, `src/lib/contactTaxonomy.ts`).
- Product command routes by domain (`PUT /api/products/:id/{catalog,stock,commercial,publication}`, each bundle-gated and field-allowlisted); frontend fully migrated to `updateByDomain`.
- 40+ MCP tools with scope tiering, durable confirmation tickets (`mcp_confirmation_tickets`, atomic `UPDATE...RETURNING`), public `/mcp/public`, OAuth 2.1 with mobile-safe path-based consent (migration 082). This closes out essentially all of `AUDIT_2026_05.md`'s Wave 1-3 MCP wishlist (`create_customer`, `update_customer`, `update_tea_pricing`, `update_invoice`, `void_invoice`, `set_low_stock_threshold`, `tag_customer`, `link_vendor`, `unlink_vendor`, `update_account_settings`, `update_exchange_rate`, `set_archive_status`, `fulfill_invoice` are all live). Only bulk operations and `create_product` remain deliberately deferred (Wave 4, "only after real usage shows demand").
- `create_tea` plus `mark_invoice_paid` MCP tool port (`MCP_TOOLS_PORT_TODO.md`, done, doc retained for history only).
- Edge rate limiting: `LOGIN_LIMITER` (login and signup, durable cross-isolate) and `PUBLIC_MCP_LIMITER` (`/mcp/public`) both wired via native Cloudflare Workers rate-limit bindings (`worker/wrangler.toml:60-69`). This covers the June audit's Section 3.8 recommendation and the consolidated direction's "Cloudflare WAF rate limit on `/mcp/public`" ask (native binding, not a zone WAF rule, same effect).
- `llms.txt` plus JSON-LD (Organization/WebSite, Product, Article).
- Admin code-split Wave 1: shell chunk 1.78MB down to 992KB gzip, Suspense infra in `PageTransition`, chunk-load retry (`recoverFromChunkError.ts` plus `lazyWithReload`).
- CI-gated deploys: worker deploy runs `npm run test:worker` before migrations; frontend deploy runs `npm run lint` plus `npm run lint:colors` before build. Auto-applied migrations via `wrangler d1 migrations apply`.
- React Query `staleTime` config: global 5-minute default (`src/index.tsx:15`) plus per-query overrides where shorter freshness matters (`AdminHomeView.tsx`, `ActivityView.tsx` at 30s/60s).
- Offline read caching via `vite-plugin-pwa`/Workbox (`vite.config.ts:27-79`): NetworkFirst for `/api/*`, CacheFirst for media/fonts, `navigateFallbackDenylist` correctly excludes `/api`, `/media`, `/mcp`, `/oauth`. This is the read-side half of VISION_AUDIT_7's "True Offline-First"; the write-side (IndexedDB offline mutation queue) is still open, see below.
- Token-refresh retry-of-original-request (`src/lib/api.ts` `authedFetch`, roughly lines 608-665: on 401, refresh once, retry once, only surface `SESSION_EXPIRED` if the retry also fails).
- Suspended-account write block (`worker/src/index.ts:654-671`, distinct from the read-allowed check at 566-570; writes 403 with `account_suspended`, platform-tier bypasses for recovery).
- `X-Teajia-Account` derived from the JWT's `active_account_id` claim (`src/lib/api.ts:276-292`); Zustand state is now only a logged fallback for old token shapes, not the primary source.
- `idx_invoice_line_items_product` index (migration 084).
- Orphaned-table cleanup: re-verified 2026-07-11 against all 78 tables defined across `worker/migrations/*.sql`. Only 3 have zero references in `worker/src` (`collection_publications_new`, `event_attendees_new`, `products_new`), and all three are SQLite table-rebuild artifacts from migrations 034/044/089, not abandoned features. The June audit's ~25-table list is stale; there is no real orphaned-table cleanup left to do.

## Not building (killed)

- `analytics_events` tracking table. Vision is "Adrian packs every order, he knows what's selling," not dashboards.
- `product_similarity` Jaccard cron plus relationship-computed recommendations. Hand-curation is the engine, not an algorithm.
- Tasting-data normalization framed as consolidation. The journal/compass split is intentional (see Track 5 for the real unification work).
- Inventory health scores, vendor scorecards, sales-velocity dashboards. Analytics theater at one store's scale.

## Sources

- `docs/STRUCTURAL_AUDIT_2026-06-10.md` (live)
- `docs/plan/customer-contact-taxonomy.md` (live)
- `docs/plan/product-architecture-phase-0-inventory.md` (live)
- `docs/plan/product-architecture-route-auth-inventory.md` (live)
- `docs/_archive/consolidated-2026-07/VISION_AUDIT_6_ADMIN.md` (archived)
- `docs/_archive/consolidated-2026-07/VISION_AUDIT_7_TECHNICAL.md` (archived)
- `docs/_archive/consolidated-2026-07/ADMIN_CODE_SPLIT_PLAN.md` (archived, Wave 1 shipped)
- `docs/_archive/consolidated-2026-07/MCP_MOBILE_OAUTH_TODO.md` (archived)
- `docs/_archive/consolidated-2026-07/MCP_TOOLS_PORT_TODO.md` (archived, done)
- `docs/_archive/consolidated-2026-07/AUDIT_2026_05.md` (archived, MCP coverage section superseded by shipped work)
- `docs/_archive/consolidated-2026-07/product-architecture-initiative.md` (archived)
- `docs/_archive/consolidated-2026-07/product-architecture-prd.md` (archived)
- `docs/_archive/consolidated-2026-07/product-architecture-implementation.md` (archived, phases 0-2 shipped; phases 3-6 live on in Tracks 3, 5, 9)
- `docs/_archive/consolidated-2026-07/product-architecture-discussion-log.md` (archived)

## Cross-track dependencies

- The tenancy-isolation test suite is the stated precondition for Track 2 opening a real second store (Australia) to production traffic. Track 2's "run the Australia checklist" item should not proceed without it.
- The IndexedDB offline write queue (VISION_AUDIT_7 salvage, judged "yes, when China trips resume") overlaps with Track 4 (China Reachability), which already owns the shipped read-side service worker and media proxy. Coordinate before building so the write queue reuses the same origin/proxy assumptions instead of diverging.

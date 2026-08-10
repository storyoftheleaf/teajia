# Tea Master Operating Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved inventory lifecycle, global Tea Master profiles, curated favorites, external payment destinations, direct personal tasting entry, and validated Wisdom relationships as one verified Teajia program.

**Architecture:** Preserve `contributors` and `tea_profiles` as the global person and tea identities. Add additive D1 relations for contributor accounts, public profile favorites, payment methods, and Wisdom relationships; derive inventory stages from existing product/receipt data; keep public reads as allowlisted projections. Shared router, API, types, app routes, and migration numbering have one integration owner while non-overlapping UI/domain lanes run in parallel.

**Tech Stack:** React 19, TypeScript, Vite 6, React Query, Zustand, Tailwind v3 semantic tokens, Cloudflare Worker, D1, Vitest, Playwright, `qrcode.react`.

---

## File ownership map

### Shared integration owner

- `worker/migrations/124_tea_master_profiles.sql` — contributor associations, languages, public favorites, payment methods.
- `worker/migrations/125_wisdom_relations.sql` — Wisdom overrides/relations and idempotent article-product xref schema.
- `worker/src/profileDomain.ts` — contributor/favorite/payment validation and public projection.
- `worker/src/wisdomRelations.ts` — typed Wisdom relationship validation and integrity findings.
- `worker/src/index.ts` — route registration and thin handler integration only.
- `worker/tests/tea-master-profiles.test.ts` — identity, self-edit, favorites, payments, privacy, tenancy.
- `worker/tests/wisdom-relations.test.ts` — relation legality, publication, findings, privacy.
- `src/types.ts` — shared response and mutation types.
- `src/lib/api.ts` — client methods.
- `src/App.tsx` — `/account/profile`, `/people/:slug/favorites`, `/people/:slug/pay` routes.
- `src/components/AccountPanel/workflows.ts` and Account Panel view registry — approved Profile entry.

### Inventory/tasting lane

- `src/admin/components/inventory/domain.ts` and `.test.ts` — stage/facet derivation.
- `src/admin/components/inventory/types.ts` and `config.ts` — lifecycle names, filters, summary types.
- `src/admin/components/inventory/useInventoryProducts.ts` — lifecycle grouping/filtering.
- `src/admin/components/InventoryView.tsx` — staged rendering and personal tasting session.
- `src/admin/components/inventory/InventoryActionRail.tsx` — direct personal tasting action.
- Focused inventory tests and Playwright specs; no migrations or shared route registration.

### Profile/favorites/payment lane

- `src/pages/AccountProfilePage.tsx` — self-management shell.
- `src/components/profile/ProfileEditor.tsx` — basic profile and portrait fields.
- `src/components/profile/ProfileFavoritesEditor.tsx` — canonical favorite search/order/notes.
- `src/components/profile/PaymentMethodsEditor.tsx` — methods and public preview.
- `src/pages/ContributorProfilePage.tsx` / `src/components/ContributorProfile.tsx` — associations, selection, favorites, payment entry.
- `src/pages/ProfileFavoritesPage.tsx` — direct share view.
- `src/pages/ProfilePaymentPage.tsx` — public chooser and payment context.
- Component tests; shared API/types/routes stay with the integration owner.

### Wisdom lane

- `src/admin/components/wisdom/relations.ts` and `.test.ts` — client relation/finding presentation domain.
- `src/admin/components/wisdom/WisdomRelationsPanel.tsx` — relation editor.
- `src/admin/components/wisdom/WisdomIntegrityQueue.tsx` — derived findings queue.
- `src/admin/components/wisdom/WisdomDetailPanel.tsx` and `src/admin/views/WisdomView.tsx` — integration.
- `src/pages/wisdom/WisdomRelatedMaterial.tsx` — public teas/writing.
- Public Wisdom detail pages — shared related-material insertion.
- `src/admin/components/ContentLinksEditor.tsx`, `src/pages/ArticlePage.tsx` — repair live D1 links.

## Task 1: Add the inventory lifecycle domain

**Files:**
- Modify: `src/admin/components/inventory/domain.ts`
- Modify: `src/admin/components/inventory/domain.test.ts`
- Modify: `src/admin/components/inventory/types.ts`

- [ ] **Step 1: Write failing stage tests**

Add fixtures covering Published, Ready private, Incoming-only, Needs preparation, Archived/Sold Out, and Published-with-incoming-replenishment. The core assertions are:

```ts
expect(deriveInventoryStage(published, noIncoming)).toBe('published');
expect(deriveInventoryStage(privateReady, noIncoming)).toBe('ready_private');
expect(deriveInventoryStage(zeroStock, { remaining: 500 })).toBe('incoming');
expect(deriveInventoryStage(incomplete, noIncoming)).toBe('needs_preparation');
expect(deriveInventoryStage(archived, noIncoming)).toBe('archived');
expect(deriveInventoryFacets(published, { count: 2 }, writing, { remaining: 500 }))
  .toMatchObject({ personallyTasted: true, incomingReplenishment: true });
```

- [ ] **Step 2: Verify the focused test fails**

Run `npx vitest run src/admin/components/inventory/domain.test.ts` and expect missing-export failures for `deriveInventoryStage` and `deriveInventoryFacets`.

- [ ] **Step 3: Implement the pure domain seam**

Export exact types and functions:

```ts
export type InventoryStage = 'published' | 'ready_private' | 'incoming' | 'needs_preparation' | 'archived';
export interface IncomingSummary { remaining: number; eta?: string | null }
export interface PersonalTastingSummary { count: number }
export interface WritingSummary { hasDescription: boolean; draftArticles: number; publishedArticles: number }
export function deriveInventoryStage(product: Product, incoming: IncomingSummary): InventoryStage;
export function deriveInventoryFacets(
  product: Product,
  tasting: PersonalTastingSummary,
  writing: WritingSummary,
  incoming: IncomingSummary,
): InventoryFacets;
```

Apply precedence `archived → published → incoming-only → ready-private → needs-preparation`. Keep incoming replenishment as a facet when on-hand stock exists.

- [ ] **Step 4: Run the focused test and commit the lane checkpoint**

Run `npx vitest run src/admin/components/inventory/domain.test.ts`; expect all tests to pass. Commit only inventory-domain files with `feat: derive inventory lifecycle stages`.

## Task 2: Add shared migrations and domain modules

**Files:**
- Create: `worker/migrations/124_tea_master_profiles.sql`
- Create: `worker/migrations/125_wisdom_relations.sql`
- Create: `worker/src/profileDomain.ts`
- Create: `worker/src/wisdomRelations.ts`
- Create: `worker/tests/tea-master-profiles.test.ts`
- Create: `worker/tests/wisdom-relations.test.ts`

- [ ] **Step 1: Write failing domain tests**

Cover these exact contracts:

```ts
expect(resolvePaymentMethods(defaults, [], null)).toEqual(defaults);
expect(resolvePaymentMethods(defaults, storeMethods, 'teajia-bali')).toEqual(storeMethods);
expect(publicFavorite(privateFavorite, publicTea)).toBeNull();
expect(publicFavorite(publicFavoriteRow, hiddenTea)).toBeNull();
expect(validateWisdomTarget({ target_type: 'wisdom_node', target_subtype: null })).toMatchObject({ ok: false });
expect(validateWisdomTarget({ target_type: 'article', target_subtype: null })).toMatchObject({ ok: true });
```

- [ ] **Step 2: Verify tests fail**

Run `npx vitest run worker/tests/tea-master-profiles.test.ts worker/tests/wisdom-relations.test.ts`; expect module-not-found failures.

- [ ] **Step 3: Add additive schemas**

Migration 123 adds `contributors.languages`, the partial unique linked-user index, `contributor_accounts`, `profile_favorites`, and `payment_methods`. It backfills contributor/account and host associations with `INSERT OR IGNORE`. Add CHECK constraints for payment method type and favorite source exclusivity.

Migration 124 creates `wisdom_node_overrides`, `wisdom_relations`, their composite/index constraints, and `article_products` with `CREATE TABLE/INDEX IF NOT EXISTS` so the Worker ledger matches deployed compatibility data.

- [ ] **Step 4: Implement focused domain helpers**

`profileDomain.ts` owns normalized links/languages, safe self-edit fields, payment resolution, and public favorite/payment projections. `wisdomRelations.ts` owns target enums, legal relationship kinds, typed node keys, relation validation, and pure integrity finding derivation.

- [ ] **Step 5: Run domain tests and migration syntax checks**

Run the two focused Vitest files and the repository migration rehearsal command documented in `worker/MIGRATIONS.md`. Expect all tests and both clean/upgrade applications through 124 to pass.

- [ ] **Step 6: Commit**

Commit only the migrations, modules, and focused tests with `feat: add tea master and wisdom relation domains`.

## Task 3: Implement Worker profile, favorites, and payment behavior

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/tests/tea-master-profiles.test.ts`
- Modify: `worker/tests/article-contributors.test.ts`

- [ ] **Step 1: Add failing route tests**

Cover:

- one contributor linked to two accounts;
- self draft read/update and self-unpublish;
- self publication/association denial;
- owner/platform association and publish authority;
- cross-account article authorship without draft leakage;
- favorite create/reorder/note/private omission;
- payment default/store resolution and inactive-method omission;
- invalid amount/currency/reference public context;
- cross-account resource denial.

- [ ] **Step 2: Verify the focused route tests fail**

Run `npx vitest run worker/tests/tea-master-profiles.test.ts worker/tests/article-contributors.test.ts`; expect 404/new-behavior failures.

- [ ] **Step 3: Add thin handlers and routes**

Implement:

```text
GET/PUT  /api/me/profile
POST     /api/me/profile/unpublish
GET/POST/PUT/DELETE /api/me/profile/favorites[/:teaProfileId]
PUT      /api/me/profile/favorites/order
GET/POST/PUT/DELETE /api/me/profile/payment-methods[/:id]
GET      /api/public/people/:slug/favorites
GET      /api/public/people/:slug/payment-methods
GET/PUT  /api/admin/contributors/:id/accounts
```

Reuse existing contributor public/admin handlers, making account equality a steward filter rather than global identity validation. Public handlers select explicit published projections. Keep sensitive payment values out of logs and error bodies.

- [ ] **Step 4: Enrich public contributor data**

Return public associations, public selections, authored articles, public favorites preview, and `has_payment_methods`. Preserve legacy contributor fields and slugs.

- [ ] **Step 5: Run focused and tenancy tests**

Run the two focused files plus `worker/tests/tenancy-isolation.test.ts`; expect all pass.

- [ ] **Step 6: Commit**

Commit Worker changes with `feat: add global tea master profile services`.

## Task 4: Implement Worker Wisdom relations and inventory summaries

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/src/wisdomRelations.ts`
- Modify: `worker/tests/wisdom-relations.test.ts`
- Add or modify: focused inventory Worker test

- [ ] **Step 1: Add failing route tests**

Cover typed node lookup, proposed/approved relations, network approval authority, public target filtering, exact article-product adaptation, missing/unpublished/orphan findings, batched inventory incoming/writing summaries, and incoming-only publication rejection.

- [ ] **Step 2: Verify failures**

Run focused Wisdom and inventory Worker tests; expect missing routes and publication-guard failures.

- [ ] **Step 3: Implement routes**

```text
GET  /api/admin/wisdom/relations?node_type=&node_id=
POST /api/admin/wisdom/relations
PUT/DELETE /api/admin/wisdom/relations/:id
PUT  /api/admin/wisdom/nodes/:nodeType/:nodeId
GET  /api/admin/wisdom/findings
GET  /api/public/wisdom/:nodeType/:nodeId/related
GET  /api/inventory/summaries
```

Use batched SQL for inventory receipt/writing summaries. Reject publication when on-hand stock is zero and an open incoming quantity remains. Adapt exact legacy xrefs; ambiguous matching returns a finding rather than an approved relation.

- [ ] **Step 4: Run focused tests and commit**

Run focused Worker tests; expect pass. Commit with `feat: connect inventory writing and wisdom relations`.

## Task 5: Build inventory lifecycle and direct personal tasting UI

**Files:**
- Modify the inventory-lane files in the ownership map
- Modify: `tests/inventory-scroll.spec.ts`
- Add: `tests/inventory-lifecycle.spec.ts`

- [ ] **Step 1: Write failing UI/domain coverage**

Assert lifecycle order/counts, folded sections, personal versus product tasting labels, Record/Continue/View behavior, incoming replenishment staying in Published, and no wrapper between the InventoryView root and its scroll container.

- [ ] **Step 2: Run focused tests and observe failures**

Run inventory unit tests and `npx playwright test tests/inventory-lifecycle.spec.ts --project='Desktop Chrome'`; expect missing stage/action failures.

- [ ] **Step 3: Implement lifecycle rendering**

Load the summary once, join by product ID, derive stages/facets, and render the existing table inside five collapsible typographic sections. Filters narrow rows without duplicating them.

- [ ] **Step 4: Implement direct personal tasting**

Use the normal `TastingSession` for Record/Continue/View and keep `TastingEditorModal` under the explicit “Edit product tasting profile” label. Add the action rail entry with the existing permission and tap-target patterns.

- [ ] **Step 5: Verify inventory behavior**

Run unit tests, the new lifecycle spec, and `tests/inventory-scroll.spec.ts` on Desktop and Mobile Chrome. Expect sized/scrollable container and no horizontal overflow.

- [ ] **Step 6: Commit**

Commit with `feat: organize inventory by tea lifecycle`.

## Task 6: Build profile, favorites, and payment interfaces

**Files:**
- Create/modify the profile lane files in the ownership map
- Add focused component tests

- [ ] **Step 1: Add failing component tests**

Test draft/approval state, portrait upload error, association display, favorite ordering/note/private omission, payment fallback/store context, QR destination, and invalid payment context.

- [ ] **Step 2: Verify tests fail**

Run the new focused Vitest files; expect missing component failures.

- [ ] **Step 3: Implement the account profile editor**

Build `/account/profile` content with basic profile, Favorites, and Payments sections. Reuse contributor forms and R2 crop/upload behavior through the new self-profile contract. Keep associations read-only for ordinary profile owners.

- [ ] **Step 4: Extend the public profile and share pages**

Add public associations/selections, favorites, and payment entry to `/people/:slug`. Build `/people/:slug/favorites` and `/people/:slug/pay`; use `QRCodeSVG` for the Teajia payment-page QR and external links for providers.

- [ ] **Step 5: Verify responsive behavior**

Run focused tests, lint:colors, and mobile route checks for the new account/public routes. Confirm bottom-nav clearance and no horizontal overflow.

- [ ] **Step 6: Commit**

Commit with `feat: add tea master profile and payment pages`.

## Task 7: Build Wisdom relation and integrity interfaces

**Files:**
- Create/modify the Wisdom-lane files in the ownership map
- Modify focused Wisdom component tests

- [ ] **Step 1: Add failing relation presentation tests**

Test approved/proposed/broken relation labels, findings filters, typed-node URLs, hidden-node state, and public exclusion of unpublished targets.

- [ ] **Step 2: Verify failures**

Run focused Wisdom Vitest files; expect missing components/functions.

- [ ] **Step 3: Add admin relation panels**

Insert relation and finding panels into the existing Wisdom detail/browser without changing its shareable URL, grouping, sorting, usage, or scroll topology. Use a linkable findings filter rather than a new dashboard.

- [ ] **Step 4: Repair content links and public reverse material**

Replace legacy static article selection with D1 data, render live article/product reverse links, and add `WisdomRelatedMaterial` to each public Wisdom detail page through one shared component.

- [ ] **Step 5: Run focused tests and commit**

Run Wisdom tests and lint:colors; expect pass. Commit with `feat: link wisdom to teas and writing`.

## Task 8: Integrate routes, APIs, account navigation, and shared types

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/AccountPanel/workflows.ts`
- Modify Account Panel view registry and route tests

- [ ] **Step 1: Add failing API/route registry tests**

Assert exact API paths, lazy routes, and the approved Profile destination while keeping Read/Learn/Consult/Shop unchanged.

- [ ] **Step 2: Implement shared contracts and route wiring**

Add exact response/mutation types matching Worker fields, client methods, lazy route components, and Account Panel Profile entry. Preserve the admin Inventory height chain and auth/OAuth wrappers.

- [ ] **Step 3: Run type, route, and focused UI tests**

Run `npm run lint` and focused route tests. Expect no type mismatches or missing exports.

- [ ] **Step 4: Commit**

Commit with `feat: integrate tea master operating surfaces`.

## Task 9: Integrated verification and documentation

**Files:**
- Modify: `docs/STATE_OF_THE_SITE.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/SITE_MAP.md`
- Modify relevant code-area indexes only when routes/files require it

- [ ] **Step 1: Run focused suites**

Run inventory, profile, payment, contributor, article, Wisdom, tenancy, and migration tests. Every focused suite must pass before the broad gate.

- [ ] **Step 2: Run the broad gate**

Run:

```text
npm run lint
npm run lint:colors
npm run build
npm run test:worker
npm run test:mobile
npx playwright test tests/inventory-scroll.spec.ts --project='Desktop Chrome' --project='Mobile Chrome'
```

Expect zero failures. Keep the dev server on port 7777 for browser tests.

- [ ] **Step 3: Run the UI detector and bounded visual review**

Run Impeccable's detector once over changed UI targets. Capture desktop and 390×844 screenshots for Inventory, Account Profile, public profile/favorites/payment, and admin/public Wisdom. Fix the complete defect batch once, then confirm once.

- [ ] **Step 4: Update current-truth documentation**

Record shipped behavior, routes, remaining human content inputs, and verification evidence. Do not create another roadmap or duplicate launch checklist.

- [ ] **Step 5: Final commit**

Stage only task-scoped changes and commit with `feat: complete tea master operating program`.

## Post-build cohesion pass

The first integrated audit found that the individual surfaces were largely sound but several
cross-surface contracts were incomplete. Rayi and Barry are Tea Masters (global person
identities), not store names. Each approved Tea Master has a primary
`accounts.kind='master'` operational home for their selection, stock, and sales. The public
profile remains the person; additional account relationships are optional associations.

### Task 10: Close identity and approval boundaries

- [x] Separate live contributor editing from pending Tea Master review.
- [x] Add request-changes notes and keep portrait/avatar changes inside the pending draft.
- [x] Make `contributor_accounts` canonical, with atomic host transfer and explicit stewardship.
- [x] Remove global self-service dependence on an active tenant membership.

### Task 11: Connect selection, favorites, and payments

- [x] Derive a Tea Master's public selection from visible teas in their active hosted Tea Master account.
- [x] Add association management, profile readiness, public previews, and share/copy actions.
- [x] Distinguish Saved teas from Public favorites and use a name-first tea picker.
- [x] Preserve validated payment context and add canonical store/account choice and audit history.

### Task 12: Complete inventory, article, and Wisdom loops

- [x] Deep-link inventory to the exact personal tasting entry and show truthful summary errors/facets.
- [x] Make article-product linking reachable and render public reverse links in both directions.
- [x] Enforce Wisdom hidden state on direct public access and make relation repair name-first and actionable.
- [x] Centralize incoming-only publication protection across every product write path.

### Task 13: Entry architecture and final gate

- [x] Add permission-aware operator entrances for Tea Masters and Wisdom without changing the four primary tabs.
- [x] Add public footer entrances for People and the Tea Wisdom Base.
- [x] Update current-truth documentation and run the complete integrated verification matrix.

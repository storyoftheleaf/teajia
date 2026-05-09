# Product Architecture Implementation Plan

*Engineering plan for the Product Architecture Initiative.*

Last updated: 2026-05-09

---

## Implementation Strategy

Do not treat this as one large rewrite. Treat it as a sequence of boundary-setting projects that make the existing system safer to extend.

Recommended order:

1. Establish domain contracts.
2. Fix high-risk robustness issues.
3. Unify article/editorial contracts.
4. Scope client state by user/account.
5. Harden network and route authorization.
6. Refine interface grammar and IA.

This sequence gives later product work a stable foundation without blocking useful incremental releases.

## Phase 0 - Alignment and Inventory

Goal: confirm the source of truth before changing code.

Tasks:

- Create a domain glossary covering tea profile, listing, product, tasting, journal, article, event, order, account, membership, bundle, and trust tier.
- Review current docs for drift against code.
- Build a route/auth inventory from `worker/src/index.ts`.
- Build a client-state inventory from Zustand and React Query.
- Build an article-block inventory across reader, editor, parser, and database shapes.

Deliverables:

- Domain glossary document or section in ARCHITECTURE.md.
- Route/auth table.
- Client state scoping table.
- Article block compatibility table.

Initial inventory: `product-architecture-phase-0-inventory.md`.

## Phase 1 - Domain Contracts

Goal: make product distinctions explicit in code.

Code areas:

- `src/types.ts`
- `src/admin/types.ts`
- `src/lib/api.ts`
- `worker/src/index.ts`
- `worker/migrations/048_tea_profiles.sql`
- `worker/schema.sql`

Implementation details:

- Move shared domain contracts into a single source where feasible.
- Separate identity fields from experience fields in types and UI props.
- Document source of truth for canonical profile versus per-account listing.
- Add comments only where they protect non-obvious product rules.
- Avoid introducing a large abstraction layer unless it removes real duplication.

Acceptance criteria:

- New code cannot easily confuse canonical tea identity with tasting experience.
- Article and tea-related types do not fork silently between public and admin contexts.
- Docs and code use the same object names.

## Phase 2 - Robustness and Security Fixes

Goal: remove avoidable risks before deeper product work.

Known issues from the review:

- `worker/src/index.ts:3101` interpolates `typeFilter` into SQL for customers.
- `worker/src/index.ts:11749` builds an article status SQL clause from request state.
- `src/admin/hooks/useAdminData.ts:10` uses broad query keys such as `['products']`.
- `src/index.tsx:24` persists React Query cache under one global key.
- `src/lib/store.ts:475` persists mixed global, account, and personal state in `teajia-storage`.
- `src/components/AccountPanel/index.tsx:418` and `src/components/AccountPanel/index.tsx:419` switch account state optimistically.
- `src/admin/AdminApp.tsx` has competing `/activity` route ownership that should be verified.

Tasks:

- Replace unsafe SQL interpolation with bound parameters or strict whitelist maps.
- Introduce account/user scoped query-key helpers.
- Classify persisted Zustand slices as global, user-scoped, account-scoped, or guest-local.
- Add account switch cache invalidation or namespacing.
- Verify duplicate admin routes and decide which surface owns activity.

Acceptance criteria:

- Account switching does not show stale products, customers, activity, or inventory from another account.
- Query keys include account/user scope where required.
- SQL filters are parameterized or whitelist-constrained.
- Route duplication is resolved or documented with tests.

## Phase 3 - Editorial Engine

Goal: turn magazine from renderer plus editor into one publishing system.

Code areas:

- `src/pages/ArticlePage.tsx`
- `src/components/SinglePageRenderer.tsx`
- `src/admin/components/ArticleEditorModal.tsx`
- `src/admin/views/MagazineView.tsx`
- `scripts/parseDirectives.ts`
- `src/types.ts`
- `src/admin/types.ts`
- Worker article handlers in `worker/src/index.ts`

Tasks:

- Choose one canonical `ArticleBlock` contract.
- Create an article block registry that maps block type to editor support, reader support, validation, and fallback behavior.
- Curate a keeper list of magazine templates before expanding editor controls.
- Ensure editor preview and public reader share the same rendering assumptions.
- Preserve product/article references without turning magazine into a sales surface.

Acceptance criteria:

- The editor can round-trip existing rich article content without destructive simplification.
- New real articles can be created without code edits.
- Unsupported legacy/demo layouts are hidden from creation but remain readable if needed.
- Magazine quality can be improved template by template without breaking article data.

## Phase 4 - Personal Tea Memory Spine

Goal: unify personal tea history without making it social or performative.

Code areas:

- `src/components/AccountPanel/TastingJournalView.tsx`
- `src/components/tasting/TastingJournal.tsx`
- `src/pages/JournalPage.tsx`
- `src/lib/teaCompassStore.ts`
- `src/lib/store.ts`
- Worker tasting journal, session, event, order, and account endpoints

Tasks:

- Define the relationship between tasting session, journal entry, Compass entry, collection item, event attendance, favorite, and order.
- Decide which personal records are local-first and which sync to D1.
- Harmonize the quieter AccountPanel journal with any richer browse/filter view.
- Remove or reframe personal stats where they contradict the journal brief.
- Add account/user scoping for personal record persistence.

Acceptance criteria:

- A user can understand "my tea record" without learning multiple disconnected tools.
- Personal history survives the right transitions and clears on the right boundaries.
- The UI feels like a notebook/archive, not an engagement dashboard.
- Events and purchases can connect to memory without pressure to buy or perform.

## Phase 5 - Network and Multi-Account Hardening

Goal: prepare network features for trusted partner use.

Code areas:

- `worker/src/index.ts`
- `worker/migrations/048_tea_profiles.sql`
- `worker/migrations/050_wholesale_orders.sql`
- `worker/migrations/051_network_adoption.sql`
- `src/admin/toolRegistry.ts`
- `src/lib/api.ts`
- Network admin views

Tasks:

- Produce a route/auth registry for all network, catalog, wholesale, members, publish, gather, stock, and platform routes.
- Keep `requireBundle` usage aligned with toolRegistry bundle requirements.
- Clarify the legacy `products` to `tea_profiles` plus `product_listings` transition.
- Add migration replay or schema consistency verification.
- Add tests for allowed and denied route access by bundle.

Acceptance criteria:

- A partner cannot access catalog, wholesale, members, stock, gather, or publish actions without the correct bundle.
- Canonical tea identity and per-account listing expression remain separate.
- Fresh local database setup can support current features.
- Network screens preserve attribution and trust language from NETWORK_UI_BRIEF.md.

## Phase 6 - IA and Surface Grammar

Goal: make the platform feel like one intentional system.

Code areas:

- `src/App.tsx`
- `src/admin/AdminApp.tsx`
- `src/admin/toolRegistry.ts`
- `src/components/AccountPanel/`
- `src/components/BottomTabBar.tsx` only with explicit confirmation
- `src/components/LeftSidebar.tsx` and related nav components only with explicit confirmation

Tasks:

- Define the job of each major surface.
- Review `/me`, `/compass`, AccountPanel, `/account/*`, public routes, and admin groups for overlap.
- Keep sidebar and mobile bottom tab sections in sync.
- Do not change navigation links or tab labels without explicit confirmation.
- Create a surface grammar checklist for future feature reviews.

Acceptance criteria:

- Users are not forced to infer which tool owns a task.
- Admin groups match real work: sell, source, gather, publish, teach, network.
- Personal, public, and professional surfaces do not compete for the same job.
- Future nav work has a clear approval process.

## Testing Plan

Always run:

```bash
npm run lint
npm run lint:colors
```

Run when public/account/admin surfaces are touched:

```bash
npm run test:mobile
```

Add or extend tests for:

- Account switch cache isolation.
- Inventory scroll height chain if wrappers change.
- Article editor/read preview round trips.
- Network bundle authorization.
- Migration replay or schema consistency.
- Tasting journal privacy and no horizontal overflow.

## Suggested Backlog

### P0 - Safety and correctness

- Parameterize or whitelist unsafe SQL filters.
- Add account-scoped React Query key helpers.
- Classify and scope persisted Zustand state.
- Verify duplicate `/activity` route behavior.
- Create route/auth inventory.

### P1 - Product contracts

- Write domain glossary.
- Unify article block contracts.
- Define tea profile/listing/tasting/journal object boundaries.
- Document source-of-truth ownership for personal memory records.

### P2 - Product refinement

- Curate magazine template keeper list.
- Upgrade article editor to support richer blocks.
- Harmonize tasting journal surfaces.
- Refine admin tool taxonomy and IA.
- Add network authorization tests.

### P3 - Growth enablement

- Contributor workflow.
- Guest portability.
- Network directory.
- Wholesale-to-listing import hardening.
- Foundation-facing reporting structure when ready.

## Definition of Done

This initiative is implementation-ready when:

- The PRD is accepted.
- Phase 0 inventories exist.
- P0 work is scheduled or completed.
- Workstreams have owners or sequence.
- Docs in this packet are linked from INDEX.md and ACTIVE_BRIEFS.md.
- Follow-on implementation tickets can be created without relying on chat history.

# Track 9: Coherence & IA Finishing

> The rooms are built; finish the hallways — quiet cross-links, one clear answer to "where do my thoughts about a tea live," settled URL grammar, and doc hygiene so the map matches the territory.

Status: personal-tea wiring and documentation cleanup implemented; homepage and URL-grammar decisions remain. Manual approvals are tracked in [Launch Validation](../LAUNCH_VALIDATION.md).

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [x] **Personal-tea wiring.** Remember now lands on `/account/collection`; `/account/cellar` is a real API-backed route; Journal, Favorites, and Cellar use the shared `PersonalTeaLinks` strip while remaining distinct models. Desktop/mobile coverage ships in `tests/personal-tea-journey.spec.ts`. The singular/plural Collection naming question remains only in the URL-grammar item below.

- [ ] **Homepage pair.** Persistent explore-the-shop CTA above the fold + one-line value proposition. Preserve the scroll reveal, character display, and “Source/Discover/Deepen/Create” lines. Adrian's approval is tracked in [Launch Validation](../LAUNCH_VALIDATION.md); implementation is hours once decided.

- [ ] **URL grammar + findability pass.** Final route approval is tracked in [Launch Validation](../LAUNCH_VALIDATION.md); nav/route changes still require explicit confirmation.
  - `/account/saved` (adjective) and `/account/journey` (metaphor) break the noun pattern set by `journal`/`collection`/`orders`/`samples`/`settings` (`src/App.tsx:1011-1023`). Propose renames, confirm with Adrian, then execute with a redirect using the existing precedent: `<Route path="/consult" element={<Navigate to="/advise" replace />} />` (`App.tsx:961`).
  - `/start` (`StartHerePage.tsx`, a "choose your path" hub) has zero inbound links anywhere in the app — confirmed by grep across `src/**/*.tsx`, reachable only by typing the URL directly. `/for-your-space` and `/spaces` are linked from several places (`AdvisePage.tsx:208`, `LeftSidebar.tsx:713`, `ReaderView.tsx:110`, `StartHerePage.tsx:36`, `SpacesPage.tsx:254`) so they are not orphaned, contrary to the original IA_REVIEW note — only `/start` still is. Ask Adrian: link it from the homepage/nav, or archive the page.
  - Rename `/account/collection` → something that reads as "favorites" (it renders `MyCollection.tsx`, a heart-icon favorites list, not personal inventory) to stop colliding in meaning with `/account/collections` (the shared-collections shelf). Bundle into the same redirect pass.
  - Done when: Adrian has signed off on a final route list; renamed routes 301/redirect from their old paths; `/start` is either linked or archived, not silently orphaned. (hours of execution once Adrian decides)

- [x] **Documentation source-of-truth cleanup.** Reconciled 2026-07-13: `INDEX.md` routes to seven active tracks, `STATE_OF_THE_SITE.md` is current, `LAUNCH_VALIDATION.md` owns every human/external gate, and superseded plans, audits, and session artifacts were removed.

### Polish


## Post-launch / usage-gated IA

- Admin nav regrouped by product jobs (Sell/Source/Gather/Publish/Teach) — deferred until a second operator exists to prove the current grouping actually confuses someone.
- Admin tool taxonomy rebalancing (registry currently six groups, some with one entry, some with ten) — same gate, needs a second operator's real usage to know which way to rebalance.
- Events' four-homes unification (public `/events`, admin `/admin/events`, member `/account/journey`, Account Panel "today" preview) — deferred; a single "events I care about" surface is only worth building once there's more than Adrian's own usage pattern to design against.

## Already shipped

- Cross-link rendering (item 1 of the original open list) is fully built, contrary to the consolidated direction's "mostly did not [ship]" note — this line in `CONSOLIDATED_DIRECTION.md` is itself stale and should be corrected on its next edit. Verified end to end: `src/components/reader/ProductReferences.tsx` (shared colophon primitive) → `ArticleColophon.tsx` wired into `Reader.tsx:1002` (Magazine), `ModuleExplore` in `LearnCurriculum.tsx:34-60` (Learn), `ProjectProvenance` in `advise/ProjectDetail.tsx:19-30` (Advise) → all three read the public xref endpoints (`/api/public/xref/{articles,modules,projects}/:id/products`) → curated from the admin side via `ContentLinksEditor.tsx`, reachable from `InventoryView.tsx:2903-2908`. No task needed.
- Public xref endpoints (`/api/public/xref/*/products`, `worker/src/index.ts:18276-18281`).
- Compass homelessness resolved: admin-only tool, no longer expected in member nav.
- `/account/orders` and `/account/samples` are wired to real data, and `/account/orders/:id` now provides ownership-safe customer order detail.
- Bottom nav = sidebar parity (Read/Craft/Advise/Shop).
- Sidebar editorial nav system, design tokens + lint enforcement ecosystem.
- Journal/Collection(favorites)/Cellar already carry distinct, well-considered verbs and hint copy at the Launchpad tile level (`LaunchpadView.tsx:172-207`) — the original "no unified mental model" framing overstated the gap; what's missing is wiring (dead link, missing route) and cross-linking, not a naming redesign.

## Not building (killed)

- The IA review's full four-phase discovery project (walkthrough → taxonomy proposal → migration plan → phased implementation) as a standalone initiative — its live findings became the numbered items above; the rest resolved itself through shipping.

## Sources

- `docs/_archive/consolidated-2026-07/IA_REVIEW.md` (archived)
- `docs/_archive/consolidated-2026-07/POST_AUDIT_ROADMAP.md` (archived, Body B1/B2 sections)
- `docs/_archive/consolidated-2026-07/FRICTION_REVIEW.md` (archived, homepage items C-P1-1/C-P3-1)
- `docs/FLOWS.md` (live, corrected here)
- `docs/SITE_MAP.md` (live, corrected here)
- `docs/plan/product-architecture-phase-0-inventory.md` (live)
- `docs/plan/product-architecture-route-auth-inventory.md` (live)
- `docs/brief/PERSONAS.md`, `docs/brief/OFFER_AND_STRATEGY.md` (live, strategy references, no action items pulled from these)
- `docs/_archive/consolidated-2026-07/DEVELOPMENT_PRIORITIES.md`, `docs/_archive/consolidated-2026-07/SPRINT_APRIL_2026.md` (archived, already fully shipped, no residue)

## Cross-track dependencies

- Personal-tea wiring and customer order detail are complete; no active cross-track file ownership remains.
- Track 3 correctly records that public content cross-links are shipped and keeps only editorial backlog.
- Documentation source-of-truth cleanup is complete; there is no remaining INDEX rewrite dependency.
- URL grammar and homepage approval are batched in [Launch Validation](../LAUNCH_VALIDATION.md).

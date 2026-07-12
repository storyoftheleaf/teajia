# Track 9: Coherence & IA Finishing

> The rooms are built; finish the hallways — quiet cross-links, one clear answer to "where do my thoughts about a tea live," settled URL grammar, and doc hygiene so the map matches the territory.

Status: pre-launch, in development.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [ ] **One mental model for tea thoughts: fix the dead "remember" link, give Cellar a route, disambiguate Collection from Collections.** Three surfaces already exist and are already distinctly named at the UI level (`src/components/AccountPanel/LaunchpadView.tsx:172-207`: "steep" = journal, "remember" = favorites, "cellar" = owned stock) — the gap is wiring and URL grammar, not naming from scratch.
  - **Dead link:** the "remember" tile navigates to `navigate('/account/journey?tab=collection')` (`LaunchpadView.tsx:197`), but `AccountJourneyPage.tsx` never reads a `tab` query param (confirmed: no `useSearchParams`/`location.search` in the file) — the link silently drops the user on the general Journey page instead of their favorites. Fix: point it at the real route, `/account/collection`. (mins)
  - **Cellar has no route.** `CellarView.tsx` (stock-spine step 4, "tea you own") is fully built and API-backed (`api.cellar.*`, `src/lib/api.ts:2977-3020`) but only reachable through `AccountPanel` modal state (`panelView === 'cellar'`, `index.tsx:789,1269`) — no `/account/cellar` URL, so it can't be linked to, shared, or deep-linked like Journal/Collection/Journey can. Add the route + a thin page wrapper (same pattern as `CollectionPage.tsx`). (hours)
  - **`/account/collection` (singular, favorites via `MyCollection.tsx`) vs `/account/collections` (plural, `SharedCollectionsPage.tsx`, curator-shared collections shelf) are one letter apart and mean different things.** Confirmed both routes exist today (`src/App.tsx:1012-1013`). At minimum, correct any doc/copy that conflates them (see doc-hygiene item below); a real URL fix belongs in the URL-grammar pass since it is a rename. (mins, doc-only; folds into the URL-grammar item for the route rename)
  - **One connective view, not new tables:** add a quiet cross-link strip on Journal, Collection, and Cellar pointing at each other (e.g. "N teas in your cellar" / "N favorites" / "N tasting notes" with a link), same visual language as the existing `ProductReferences` colophon pattern (`src/components/reader/ProductReferences.tsx`) — a footnote, not a merge. No new table; each page already has its own query. (hours)
  - Done when: the "remember" tile lands on `/account/collection`; `/account/cellar` is a real, linkable route; Journal/Collection/Cellar each show a one-line pointer to the other two.

- [ ] **Homepage pair (Adrian judgment).** Persistent explore-the-shop CTA above the fold + one-line value proposition. Constraint: the grounding lines' editorial voice is untouchable (per `CLAUDE.md` "Homepage nav links" rule and `feedback_homepage_nav_links` memory) — do not touch the scroll-reveal animation, the character display, or the "Source/Discover/Deepen/Create" lines. Confirmed still open: `src/components/HomePage.tsx:161-280` shows the only CTAs ("Create an account" / "Sign in", lines 267-273) and the only body copy (lines 245-247) gated behind the 200dvh scroll reveal (`166`) — nothing is visible or interactive until a visitor scrolls most of the way through. Needs Adrian's call on where a persistent CTA sits without competing with the reveal. (hours once decided)

- [ ] **URL grammar + findability pass (needs Adrian sign-off before executing — nav/route changes require explicit confirmation per `CLAUDE.md`).**
  - `/account/saved` (adjective) and `/account/journey` (metaphor) break the noun pattern set by `journal`/`collection`/`orders`/`samples`/`settings` (`src/App.tsx:1011-1023`). Propose renames, confirm with Adrian, then execute with a redirect using the existing precedent: `<Route path="/consult" element={<Navigate to="/advise" replace />} />` (`App.tsx:961`).
  - `/start` (`StartHerePage.tsx`, a "choose your path" hub) has zero inbound links anywhere in the app — confirmed by grep across `src/**/*.tsx`, reachable only by typing the URL directly. `/for-your-space` and `/spaces` are linked from several places (`AdvisePage.tsx:208`, `LeftSidebar.tsx:713`, `ReaderView.tsx:110`, `StartHerePage.tsx:36`, `SpacesPage.tsx:254`) so they are not orphaned, contrary to the original IA_REVIEW note — only `/start` still is. Ask Adrian: link it from the homepage/nav, or archive the page.
  - Rename `/account/collection` → something that reads as "favorites" (it renders `MyCollection.tsx`, a heart-icon favorites list, not personal inventory) to stop colliding in meaning with `/account/collections` (the shared-collections shelf). Bundle into the same redirect pass.
  - Done when: Adrian has signed off on a final route list; renamed routes 301/redirect from their old paths; `/start` is either linked or archived, not silently orphaned. (hours of execution once Adrian decides)

- [x] **Documentation source-of-truth cleanup.** Completed 2026-07-12: `docs/INDEX.md` points to Consolidated Direction plus all nine tracks; `STATE_OF_THE_SITE.md` is a concise current snapshot; competing TODOs and session artifacts are archived; active references no longer route work into the removed ROADMAP/ACTIVE_BRIEFS system.

### Polish


## Gated on launch decision

- Admin nav regrouped by product jobs (Sell/Source/Gather/Publish/Teach) — deferred until a second operator exists to prove the current grouping actually confuses someone.
- Admin tool taxonomy rebalancing (registry currently six groups, some with one entry, some with ten) — same gate, needs a second operator's real usage to know which way to rebalance.
- Events' four-homes unification (public `/events`, admin `/admin/events`, member `/account/journey`, Account Panel "today" preview) — deferred; a single "events I care about" surface is only worth building once there's more than Adrian's own usage pattern to design against.

## Already shipped

- Cross-link rendering (item 1 of the original open list) is fully built, contrary to the consolidated direction's "mostly did not [ship]" note — this line in `CONSOLIDATED_DIRECTION.md` is itself stale and should be corrected on its next edit. Verified end to end: `src/components/reader/ProductReferences.tsx` (shared colophon primitive) → `ArticleColophon.tsx` wired into `Reader.tsx:1002` (Magazine), `ModuleExplore` in `LearnCurriculum.tsx:34-60` (Learn), `ProjectProvenance` in `advise/ProjectDetail.tsx:19-30` (Advise) → all three read the public xref endpoints (`/api/public/xref/{articles,modules,projects}/:id/products`) → curated from the admin side via `ContentLinksEditor.tsx`, reachable from `InventoryView.tsx:2903-2908`. No task needed.
- Public xref endpoints (`/api/public/xref/*/products`, `worker/src/index.ts:18276-18281`).
- Compass homelessness resolved: admin-only tool, no longer expected in member nav.
- `/account/orders` and `/account/samples` wired to real data (Track 6 work) — history pages functional, just missing per-order detail (tracked in Track 6).
- Bottom nav = sidebar parity (Read/Craft/Advise/Shop).
- Sidebar editorial nav system, design tokens + lint enforcement ecosystem.
- The full `DOC DISPOSITION` table in `CONSOLIDATED_DIRECTION.md` — every ARCHIVE/MERGE/SHIPPED row was checked against the live `docs/`, `docs/plan/`, `docs/brief/` directories and `docs/_archive/consolidated-2026-07/`: all of it has already executed. Nothing left to move; only the INDEX.md/FLOWS.md/SITE_MAP.md link cleanup above remains.
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

- The dead-link/route items and the per-order detail page both touch `/account/*` — Track 6 owns the per-order detail page; this track's Cellar route and cross-link strip should land independently, no shared file conflict.
- Track 3 (`docs/tracks/03-read-editorial-engine.md:69`) still describes the article cross-link rendering as owned by this track and unbuilt ("Track 9 does the rendering, not this track") — that line is now stale per the "Already shipped" finding above and should be corrected when Track 3 is next touched.
- The INDEX.md rewrite is blocked on Tracks 1, 2, and 8 having their own `docs/tracks/0X-*.md` files so the rewrite can link a complete set instead of a partial one.
- URL grammar renames and the homepage CTA both route through the same house rule (`CLAUDE.md` "NEVER change without explicit confirmation") — batch both asks to Adrian together rather than interrupting him twice.

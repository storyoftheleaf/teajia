# Track 3: Read & the Editorial Engine

> The code stopped being the blocker in June. The engine is built: D1 articles, block editor, Smart Paste, contributor schema. What's left is content Adrian has been sitting on since April and a handful of finishing wires the content depends on.

Status: contributor-to-article publishing workflow implemented and locally verified; editorial production and optional follow-ons remain. Human/editorial launch evidence is tracked in [Launch Validation](../LAUNCH_VALIDATION.md).

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [ ] **Curate ~20 keeper templates and wire the editor dropdown.** `ArticleEditorModal.tsx:640-646` (`LAYOUT_TEMPLATES`) only offers 5 options today (immersive scroll + 4 carousel variants: default/minimal/dark/interview). Oldest open item on the books; it gates the public face of the magazine. (multi-day)
  - Adrian's part: pick 1-3 reference magazines, pick ~20 keeper layouts from the print-quality template library.
  - Agent's part: polish each mechanically into a `layout_template` value + preview thumbnail, add to `LAYOUT_TEMPLATES`.
- [x] **Contributor admin editor panel.** Owner-scoped contributor list/create/edit/publish APIs and UI are implemented at `/admin/contributors`, with account-safe mirrored host linkage and public `/people/:slug` rendering. Worker, component, and browser coverage shipped in Release 3.
- [x] **Article author picker.** The article editor now loads contributor options and uses searchable contributor selection while preserving legacy author data.
- [x] **Pull-quotes.** `pull_quote` and `pull_quote_subject` are editable, account-validated, persisted, and rendered at the contributor-profile insertion points.
- [ ] **Publish Barry as the first real contributor.** `src/content/people.ts:39-43` has a hardcoded legacy bio for Barry. Port it into a real `contributors` row (Origin/Now/Inspirations/Closing, in Barry's actual voice) once the admin editor exists; this is the validation case the plan calls for before building later waves. Depends on the contributor editor item above. (hours, content)
- [ ] **Publish the interview archive.** Adrian has interviews and imagery ready since April. Only 5 seed articles exist in D1 today (`worker/migrations/046_seed_articles.sql`). Use the shipped Smart Paste flow (`docs/plan/magazine-editor-spec.md` Layer 3: structure externally via claude.ai, paste into the editor, it auto-parses `TITLE`/`SECTION`/`QUOTE`/`IMAGE` blocks). Writing and layout, not engineering. (multi-day, content)
- [ ] **Brewing guide pages for the QR system.** `src/components/shared/BrewingQRCard.tsx:48` builds a QR pointing at `/craft/brew/:teaType` for 6 slugs (`TEA_TYPE_TO_SLUG`, `BrewingQRCard.tsx:20-27`); no such route exists in `src/App.tsx`, and the component itself has zero importers anywhere in `src/` (dead code, never wired into a real page). (day)
  - Build the 6 static guide pages (green/white/oolong/black/puerh/yellow) at `/craft/brew/:type`.
  - Wire `BrewingQRCard` into an actual surface (product page brew section, or the sample/table-card flow at `src/pages/SamplePage.tsx` / `src/pages/TableCardPage.tsx`).
- [ ] **Advise portfolio images.** `src/data/adviseProjects.ts` has 10 real projects (Intaaya Resort, Private Tea Room, sourcing journeys, etc.) but none set `heroImage` or `gallery`; both fields already exist on the type (`src/types/advise.ts:14-17`) and fall back to a coloured wash when absent. Needs Adrian to supply photos per project. (hours, content, blocked on photos)

### Polish

- [ ] **Delete orphaned `ServiceContent.tsx`.** `src/components/advise/ServiceContent.tsx` has zero imports anywhere in `src/` (confirmed by grep); dead code left over from the archived path-cards Consult redesign. (mins)
- [ ] **Glossary tooltips.** `src/data/glossary.ts` (558 lines) has a full term/definition/category data structure with zero UI consumers; no `Tooltip` usage exists anywhere in `src/`. Wrap known terms in a hover tooltip, starting on `src/pages/ProductPage.tsx`. Salvaged from the killed VISION_AUDIT_4 learning-transformation doc as a small, standalone win. (hours)
- [ ] **Magazine editor AI layer** ("Structure with AI" button + per-block rewrite, `docs/plan/magazine-editor-spec.md` build steps 5-6). Needs `ANTHROPIC_API_KEY` as a Cloudflare secret. Not started. Nice-to-have, build when article volume justifies it, not before. (multi-day, deferred)
- [ ] **Contributor later waves** (build-order steps 6-13: `Hands on` attribution columns on `products`, portrait upload, seasonal calendar, `Voice` audio clip, `Pouring today`, `Hosting` prose, and the directory relational-map upgrade). Host-contributor linkage itself is now implemented; these richer public/editorial surfaces remain explicitly deferred until Barry's real profile proves the shape. (multi-day, deferred)

## Already shipped

- D1 articles table + block editor + Smart Paste (`docs/plan/magazine-editor-spec.md` build steps 1-4).
- Article unification Phases A-D; legacy magazine reader deleted.
- Immersive scroll reader + 4:5 reader architecture per `docs/MAGAZINE_PLAN.md`'s locked decisions.
- Edge meta rewriting for link previews (`functions/_middleware.ts`) with a real `public/og-image.png` now in place (was the one open risk in `SEO_EDGE_META_PLAN.md`, resolved).
- Article JSON-LD.
- Contributor schema live (`worker/migrations/059_contributors.sql`): `contributors` table, `articles.subject_ids`/`pull_quote`/`pull_quote_subject`, `products.sourced_by`/`roasted_by`/`vouched_by`, `accounts.host_contributor_id`, `seasonal_calendar` table.
- Public `/people/:slug` page rendering 8 of 15 planned sections: Masthead, Seasonal stamp, Origin, Now, Inspirations, Words, Elsewhere, Closing (`src/pages/ContributorProfilePage.tsx`).
- Public `/people` directory, v1 typeset alphabetical list (`src/pages/ContributorsIndexPage.tsx`).
- 5 pilot articles migrated to D1 (`worker/migrations/046_seed_articles.sql`).
- Contributor administration, searchable article author/subject selection, pull-quote editing/rendering, legacy-author fallback, and account-safe host mirroring (Launch-to-Real-Use Release 3).

## External and editorial validation

Barry approval, keeper-layout selection, and other human/editorial launch checks are maintained in [Launch Validation](../LAUNCH_VALIDATION.md). The content-production tasks above remain here because they are real editorial backlog, not technical release gates.

## Not building (killed)

- Adaptive learning paths, skill badges, practice challenges, spaced repetition: gamification/algorithmic, DO-NOT-BUILD.
- Audio content layer (narrated articles, guided-tasting audio, ambient soundscapes): scope, off-phone-during-tea principle.
- UGC content pipeline ("My Tea Story" submissions): social/UGC, DO-NOT-BUILD.
- Consult redesign spec (path cards, service switcher, testimonial carousel): superseded, the shipped simpler AdvisePage is the design.
- Learn archive redesign spec (discovery carousels, Community Voices pull-quotes): superseded, the shipped simpler Learn page is the design.

## Sources

- `docs/MAGAZINE_PLAN.md` (live, mostly historical, locked decisions already shipped)
- `docs/plan/magazine-editor-spec.md` (live)
- `docs/superpowers/specs/2026-07-12-launch-to-real-use-program-design.md` (contributor workflow closeout)
- `docs/MAGAZINE_WRITING_SURFACE_SPEC.md` (live, external-tool spec, build on demand)
- `docs/_archive/consolidated-2026-07/VISION_AUDIT_4_LEARNING.md` (archived)
- `docs/_archive/consolidated-2026-07/SEO_EDGE_META_PLAN.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/consult-redesign-spec.md` (archived, superseded)
- `docs/_archive/consolidated-2026-07/learn-archive-redesign.md` (archived, superseded)

## Cross-track dependencies

- Cross-link rendering is already shipped across articles, Learn, and Advise; Track 9 retains only the remaining personal-surface connective wiring.

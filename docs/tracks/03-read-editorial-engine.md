# Track 3: Read & the Editorial Engine

> The code stopped being the blocker in June. The engine is built: D1 articles, block editor, Smart Paste, contributor schema. What's left is content Adrian has been sitting on since April and a handful of finishing wires the content depends on.

Status: pre-launch, in development.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [ ] **Curate ~20 keeper templates and wire the editor dropdown.** `ArticleEditorModal.tsx:640-646` (`LAYOUT_TEMPLATES`) only offers 5 options today (immersive scroll + 4 carousel variants: default/minimal/dark/interview). Oldest open item on the books; it gates the public face of the magazine. (multi-day)
  - Adrian's part: pick 1-3 reference magazines, pick ~20 keeper layouts from the print-quality template library.
  - Agent's part: polish each mechanically into a `layout_template` value + preview thumbnail, add to `LAYOUT_TEMPLATES`.
- [ ] **Contributor admin editor panel.** No `/admin/contributors` route exists anywhere in `src/admin/AdminApp.tsx` (admin routes register the same way `people` does at `AdminApp.tsx:720`). Backend only has `GET /api/admin/contributors` (list, `worker/src/index.ts:4431`) and `PUT /api/admin/contributors/:id/contact` (links a customer contact, `worker/src/index.ts:4452`); there is no create/read-one/update endpoint for `beginnings` / `now_text` / `inspirations` / `closing` / `links` / `face_of_account_id`. This is build-order step 3 of `docs/CONTRIBUTOR_PROFILES_PLAN.md`. (day)
  - Worker: `POST /api/admin/contributors`, `GET /api/admin/contributors/:id`, `PUT /api/admin/contributors/:id` covering the full field set in `worker/migrations/059_contributors.sql:36-82`. Setting `face_of_account_id` must also write `accounts.host_contributor_id` (mirrored pair, not yet touched anywhere in `src/` or `worker/`).
  - Admin UI: `/admin/contributors` (list + create) and `/admin/contributors/:slug/edit`, styled like `src/admin/components/ProductEditPanel.tsx` per the plan's voice rules (borderless inputs, bottom-rule focus states, markdown preview panes).
  - Done when: Adrian can write and publish a contributor from the admin, and the public `/people/:slug` page reflects it.
- [ ] **Article author picker.** `ArticleEditorModal.tsx:1070` still renders a freetext `<input>` ("Author name or ID…") writing straight into `author_id` (state at `ArticleEditorModal.tsx:458`). Build-order step 4. Depends on the contributor editor above (need a contributor list/search + inline-create target). (hours)
- [ ] **Pull-quotes.** Schema is already live (`articles.pull_quote` / `pull_quote_subject`, `worker/migrations/059_contributors.sql:112-113`) but two things are missing: the article editor has no fields for the two columns, and the profile page has two dead insertion points (`src/pages/ContributorProfilePage.tsx:269`, `PULL_QUOTE_AFTER_ORIGIN`, and `:290`, `PULL_QUOTE_AFTER_INSPIRATIONS`), both marked "Wave 4A inserts here" and currently unrendered. Build-order step 5. (hours)
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
- [ ] **Contributor later waves** (build-order steps 6-13: `Hands on` attribution columns on `products`, portrait upload, seasonal calendar, `Voice` audio clip, `Pouring today`, `Hosting` prose, storefront integration via `accounts.host_contributor_id` (currently referenced nowhere outside the migration), and the directory relational-map upgrade). Explicitly deferred until Barry's profile proves the shape. (multi-day, deferred)

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

## Not building (killed)

- Adaptive learning paths, skill badges, practice challenges, spaced repetition: gamification/algorithmic, DO-NOT-BUILD.
- Audio content layer (narrated articles, guided-tasting audio, ambient soundscapes): scope, off-phone-during-tea principle.
- UGC content pipeline ("My Tea Story" submissions): social/UGC, DO-NOT-BUILD.
- Consult redesign spec (path cards, service switcher, testimonial carousel): superseded, the shipped simpler AdvisePage is the design.
- Learn archive redesign spec (discovery carousels, Community Voices pull-quotes): superseded, the shipped simpler Learn page is the design.

## Sources

- `docs/MAGAZINE_PLAN.md` (live, mostly historical, locked decisions already shipped)
- `docs/plan/magazine-editor-spec.md` (live)
- `docs/CONTRIBUTOR_PROFILES_PLAN.md` (live)
- `docs/MAGAZINE_WRITING_SURFACE_SPEC.md` (live, external-tool spec, build on demand)
- `docs/_archive/consolidated-2026-07/VISION_AUDIT_4_LEARNING.md` (archived)
- `docs/_archive/consolidated-2026-07/SEO_EDGE_META_PLAN.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/consult-redesign-spec.md` (archived, superseded)
- `docs/_archive/consolidated-2026-07/learn-archive-redesign.md` (archived, superseded)

## Cross-track dependencies

- Track 9's "Render the cross-links" item ("Teas mentioned in this piece" on articles, featured products on Advise projects) builds UI on top of surfaces this track owns (articles, Advise project cards). The xref endpoints already exist; Track 9 does the rendering, not this track.

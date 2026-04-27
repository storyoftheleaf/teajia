> SHIPPED — phases A-D complete. See docs/CHANGELOG.md.

# Article System Unification Plan

**Status (2026-04-25)**: Phases A–D shipped. Phase E partial (legacy reader deleted; legacy content directory + Story type cleanup deferred). See "Shipped" section at end.

**Goal**: Collapse two parallel article systems into one — DB-backed `DbArticle` rows rendered through the new 4:5 paginated reader at `/article/:slug`. Delete the legacy `Story` / `MagazinePageReader` system entirely.

**Sponsor decisions (2026-04-25)**:
- Path **C** chosen: migrate 5 selected articles faithfully, stub the rest as titles-only or skip.
- All other answers in the "Decisions" section below.

---

## Why two systems exist

| | Legacy `Story` | New `DbArticle` |
|---|---|---|
| Source | 32 hardcoded `.ts` files in `src/content/articles/` (excluding 2 demo files) | D1 `articles` table |
| Content shape | `string[]` with `:::DIRECTIVE:::` markers (~70 distinct directives) | Structured `ArticleBlock[]` (currently 6 variants) |
| Reader | [src/components/MagazinePageReader.tsx](../src/components/MagazinePageReader.tsx) (1488 lines) | [src/pages/ArticlePage.tsx](../src/pages/ArticlePage.tsx) (1100 lines, 4:5 paginated) |
| Reached via | Click card on Magazine tab → overlay viewer | URL `/article/:slug` |
| Bridge | [src/components/MagazineTabbed.tsx:687–702](../src/components/MagazineTabbed.tsx) — branches on `item.isDbArticle` |
| Real content | All current articles are here | Empty |

User wants ONE system. New reader is correct architecture (4:5, Instagram + print shareable, structured data). Legacy reader has the rendering richness but wrong architecture.

---

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Are `all-pages.ts` and `template-showcase.ts` real content? | **Demo files. Exclude.** |
| 2 | Is `author_id` an FK to an `authors` table? | **No table exists. Store as free-text slug** (e.g. `'chen-wei'`). Authors table is future work. |
| 3 | Drop directives only used in demo files? | **Yes, drop.** For 1–3-use directives in real content, fold into a sibling variant or drop case-by-case during parser work. |
| 4 | Multi-image directive format? | Confirmed: `:::DIRECTIVE:::caption\|url1\|url2\|url3\|url4`. New `image` block needs `images: string[]` field. |
| 5 | Should over-budget paragraphs split across pages? | **No.** Each block fits one 4:5 page. Migration must validate per-block char budgets and surface violations as editorial cleanup. |
| 6 | `gallery` field deletion safe? | **No. Keep `Story.gallery`.** Used by PhotoEssay components (5 files). Articles don't use it. Migration narrows the type, doesn't delete it. |
| 7 | Embed support for video? | **Yes.** Add `embed` block: `{ kind: 'embed', platform: 'youtube' \| 'instagram', externalId: string, caption?: string }`. Absorbs `TEXT_WITH_VIDEO`. |
| 8 | Slug source? | **Filename.** `travel-feature-video.ts` → `travel-feature-video`. Uniqueness already enforced by `idx_articles_slug` unique index. |
| 9 | Tag storage? | **JSON column** on `articles.tags TEXT NOT NULL DEFAULT '[]'` (already exists). Migration writes `JSON.stringify(story.tags ?? [])`. |
| 10 | Migrated article status? | **`published`.** |
| 11 | Migration scope? | **Path C: 5 selected articles, faithful migration.** Rest get stubbed or deleted. |

---

## The 5 articles to migrate (Path C)

Picked for archetype variety, not just recency. All 7 candidates were committed in the same batch on 2026-03-27.

| Slug | Title | Why this one |
|---|---|---|
| `travel-feature-video` | Into the Wuyi Mountains | Travel pilgrimage; Q&A-ish; map; recipe; embed; the article user was looking at when this conversation started |
| `tea-feature-article` | Laoshan Green | The strategically most important archetype — most future Teajia content will be tea-feature pieces. 17 distinct directives stress-tests the parser. |
| `long-form-interview` | A Conversation with Master Lin | Interview format. Validates `qa_pair` block type. |
| `recipe-and-pairing` | Tea in the Kitchen | Validates `recipe` block + pairing sidebar. |
| `origin-story` | Origin Story | Closest to real brand content in the set. 18 distinct directives, broad coverage. |

**Skipped:**
- `beginners-guide` ("Your First Cup") — overlaps with origin-story content-wise
- `architecture-photo-feature` ("The Urban Tea House") — heavy on multi-image directives (`IMG_GRID_MONDRIAN`, `IMG_OVERLAY_TEXT`); 4:5 visual outcome uncertain; defer until parser is proven

---

## Live directive distribution (excluding demos)

70 distinct directives in 32 real files. Distribution:

- **High-tier (≥10 uses, must support):** `IMG_FULL_BLEED` (86), `TEXT_SINGLE_COL` (71), `TEXT_DOUBLE_COL` (48), `TEXT_JUSTIFIED_NARROW` (39), `IMG_WITH_CAPTION_BOTTOM` (36), `TEXT_SIDEBAR_IMAGE` (34), `TEXT_CENTER_NARROW` (34), `COPYRIGHT_PAGE` (30), `TEXT_SIDEBAR_RIGHT` (24), `QUOTE_BIG` (22), `EPILOGUE_CENTERED` (20), `TEXT_DROP_CAP` (18), `MAGAZINE_INTERVIEW_Q_A` (18), `RECIPE_CARD` (15), `STAT_BIG_NUMBER` (14), `QUOTE_MINIMAL` (13), `IMG_SPLIT_VERTICAL` (12), `DEFINITION_LARGE` (12), `TEXT_SIDEBAR_LEFT` (10) — 19 directives
- **Mid-tier (5–9 uses):** ~13 — covers, chapters, lists, poems, maps, film-strip, polaroid, sidebars
- **Tail (1–4 uses):** ~38 — fold into variant fields or drop

For Path C migration, only the directives appearing in the 5 chosen articles need full handlers. Other directives can be implemented later when their articles get migrated.

---

## Proposed `ArticleBlock` schema

Final shape (compact, ~14 top-level kinds; variation absorbed by `variant` discriminators):

```ts
type ArticleBlock =
  // Existing 6, extended:
  | { type: 'intro'; text: string }
  | { type: 'paragraph'; variant?: 'single' | 'double' | 'triple' | 'justified' | 'center' | 'drop_cap' | 'highlighted' | 'typewriter'; text: string }
  | { type: 'section_heading'; text: string }
  | { type: 'quote'; variant?: 'big' | 'minimal' | 'blockquote_center'; text: string; attribution?: string; imageUrl?: string }
  | { type: 'image'; variant?: 'full_bleed' | 'caption_bottom' | 'split_vertical' | 'film_strip' | 'polaroid_scatter' | 'circle_mask' | 'duotone' | 'panoramic' | 'overlay_text' | 'mondrian_grid' | 'quad_grid' | 'gallery_mosaic' | 'diagonal_split'; url?: string; images?: string[]; description: string; caption?: string }
  | { type: 'divider' }
  // New:
  | { type: 'cover'; variant?: 'main' | 'photo_inset' | 'typographic' | 'minimal' | 'abstract' | 'split' | 'masthead'; title: string; subtitle?: string; image?: string; kicker?: string }
  | { type: 'chapter_divider'; variant?: 'bold' | 'split' | 'minimal' | 'centered_small'; number?: string; title: string; subtitle?: string }
  | { type: 'qa_pair'; items: { q: string; a: string }[] }
  | { type: 'pull_sidebar'; side: 'left' | 'right' | 'image'; body: string; sidebar: string; image?: string }
  | { type: 'epilogue'; text: string; signature?: string }
  | { type: 'stat'; value: string; label: string; context?: string }
  | { type: 'definition'; term: string; body: string; etymology?: string }
  | { type: 'recipe'; title: string; ingredients: string[]; steps: string[]; pairing?: string }
  | { type: 'tasting_notes'; items: { label: string; note: string }[] }
  | { type: 'note_paper'; text: string; handwriting?: boolean }
  | { type: 'poem'; variant: 'centered' | 'haiku' | 'visual' | 'scattered' | 'left'; text: string }
  | { type: 'map'; imageUrl?: string; caption?: string; pins?: { x: number; y: number; label: string }[]; locations?: string[] }
  | { type: 'list'; variant: 'checklist' | 'timeline'; title?: string; items: string[] }
  | { type: 'index_grid'; items: { label: string; image?: string }[] }
  | { type: 'embed'; platform: 'youtube' | 'instagram'; externalId: string; caption?: string; description?: string }
  | { type: 'back_matter'; variant: 'copyright' | 'credits' | 'next_reads' | 'curated_links' | 'colophon'; lines: string[] };
```

This is a sketch; final shape may shift during implementation as we encounter edge cases in the 5 migration source articles.

---

## Phased execution

### Phase A — Schema + parser (Path C scope only)
1. Extend `ArticleBlock` union in [src/admin/types.ts](../src/admin/types.ts).
2. Add zod validator for the new union (new file: `src/admin/articleBlockSchema.ts`).
3. Write `parseStoryToBlocks(story: Story): ArticleBlock[]` in `scripts/parseDirectives.ts`. Implement only the directive handlers needed by the 5 chosen articles. Throw on unknown directives — we want loud failure, not silent loss.
4. Per-block char-budget validation (≤520 for body, lower for headings/quotes). Output a violations report.
5. Unit tests for each handler against fixture inputs.
**Estimate: 3–4 days.**

### Phase B — Reader extension
1. Extend [src/pages/ArticlePage.tsx](../src/pages/ArticlePage.tsx) page-kind dispatch with handlers for new block types.
2. Mine renderers from [MagazinePageReader.tsx](../src/components/MagazinePageReader.tsx), adapt typography to 4:5 frame using `clamp(min, %, max)` pattern already established.
3. Build a dev preview route `/article-preview/:filename` that runs `parseStoryToBlocks` on an in-memory `Story` and renders via the new reader. Used for visual diff against legacy reader during Phase C.
**Estimate: 4–6 days.**

### Phase C — Migrate the 5 articles
1. Run migration script in `--mode=sql` to emit `worker/migrations/046_seed_articles.sql` (or next available number).
2. Manual visual review against legacy reader for each of the 5.
3. Editorial cleanup of any over-budget blocks (surface during validation).
4. Apply migration to D1 dev. Verify `/article/:slug` renders all 5.
5. Apply to D1 prod.
**Estimate: 1–2 days.**

### Phase D — Bridge removal
1. Remove `isDbArticle` branch in [MagazineTabbed.tsx:687–702](../src/components/MagazineTabbed.tsx).
2. Remove `MagazinePageReader` import and overlay path in [App.tsx:787](../src/App.tsx).
3. MagazineTabbed reads only from `api.articles.list`.
4. Remaining 27 unmigrated articles disappear from the Magazine listing — that's intentional (they were sample content, you confirmed everything is just samples).
**Estimate: 0.5 day.**

### Phase E — Deletion
1. Delete [src/components/MagazinePageReader.tsx](../src/components/MagazinePageReader.tsx).
2. Delete `src/content/articles/` directory.
3. Narrow or delete `Story` type in [src/types.ts:283](../src/types.ts) — keep `gallery`-using shape for PhotoEssay components, drop article-specific fields.
4. Search for residual imports: `grep -rn "from.*types.*Story\|import.*Story" src/`.
5. Move `parseStoryToBlocks` to `scripts/archive/` after seed is applied.
**Estimate: 0.5 day.**

### Phase F — Admin v2 (separate sprint)
Rich block editor for new types in `src/admin/`. Out of scope for this plan; minimum-viable v1 = existing UI for old types + raw-JSON paste-in for new types with zod validation on save.
**Estimate: 5–10 days, post-cutover.**

---

## Total effort to cutover (A–E): **9–13 days focused work**

Significantly tighter than the original 10–16 estimate because Path C narrows Phase A scope dramatically (handlers only for directives in 5 articles, not all 70).

---

## Open items / risks

1. **Over-budget blocks may need editorial trimming.** Some legacy paragraphs were authored against magazine spreads, not 4:5 phone pages. Migration validation will surface a list — user decides per-case whether to trim, split into two paragraphs (which become two pages), or drop.
2. **Visual fidelity loss during 4:5 adaptation.** Some legacy directives (asymmetric layouts, overlapping images, vertical CJK text) don't translate to phone-portrait without redesign. The 5 chosen articles avoid the worst offenders, but `IMG_GRID_MONDRIAN`-type blocks in `architecture-photo-feature` are why that one was skipped.
3. **Author resolution.** Free-text author slugs work but lose richness (legacy `PEOPLE.chen` had bio, photo, role). When an authors table is built later, migration backfill is straightforward.
4. **Bridge removal Phase D removes 27 unmigrated articles from public visibility.** User confirmed this is acceptable — they're sample content.

---

## Files this plan touches

- [src/admin/types.ts](../src/admin/types.ts) — schema extension
- [src/pages/ArticlePage.tsx](../src/pages/ArticlePage.tsx) — reader extension
- [src/components/MagazinePageReader.tsx](../src/components/MagazinePageReader.tsx) — deleted in Phase E
- [src/components/MagazineTabbed.tsx](../src/components/MagazineTabbed.tsx) — bridge removal
- [src/types.ts](../src/types.ts) — `Story` type narrowing
- [src/App.tsx](../src/App.tsx) — overlay path removal
- `worker/migrations/046_seed_articles.sql` (new) — migration data
- `scripts/parseDirectives.ts` (new) — parser
- `scripts/migrate-articles.ts` (new) — migration runner

---

## Shipped (2026-04-25)

### Phases A through D, plus partial E

**Phase A — Schema + parser:**
- Extended `ArticleBlock` union to 20 variants ([src/admin/types.ts:159–209](../src/admin/types.ts))
- Wrote directive parser ([scripts/parseDirectives.ts](../scripts/parseDirectives.ts)) handling 27 directives used by the 5 chosen articles
- Per-block char-budget validation; final run = 0 violations
- Skipped zod (not installed in project); rely on TS + parser-side construction

**Phase B — Reader:**
- Rewrote `buildPages` in [src/pages/ArticlePage.tsx](../src/pages/ArticlePage.tsx) to map blocks 1:1 to pages
- Added 14 new page renderers: paragraph_styled (with drop-cap, justified, center variants), block_chapter, qa, pull_sidebar, epilogue, stat, definition, recipe, tasting_notes, poem, map, list, embed, back_matter
- Extended `MultiImagePage` to handle split_vertical, film_strip, polaroid_scatter, circle_mask, arch_mask
- All renderers use the established 4:5 frame + watermark pattern

**Phase C — Migration:**
- Generated [worker/migrations/046_seed_articles.sql](../worker/migrations/046_seed_articles.sql) (5 articles, idempotent INSERT OR REPLACE keyed on slug)
- Run with: `node_modules/.bin/esbuild scripts/migrate-articles.ts --bundle --platform=node --format=esm --outfile=scripts/.migrate-articles.bundled.mjs '--external:node:*' --resolve-extensions=.ts,.tsx,.mjs,.js && node scripts/.migrate-articles.bundled.mjs`
- Apply to D1 with: `npx wrangler d1 execute teajia --file=worker/migrations/046_seed_articles.sql` (dev) and `--remote` (prod)

**Phase D — Bridge removal:**
- Removed `isDbArticle` branch in MagazineTabbed ([src/components/MagazineTabbed.tsx:632–639](../src/components/MagazineTabbed.tsx))
- Magazine listing now sources exclusively from DB; legacy code-defined stories no longer appear
- All article cards navigate to `/article/:slug`

**Phase E partial:**
- Deleted [src/components/MagazinePageReader.tsx](../src/components/MagazinePageReader.tsx) (1488 lines gone)
- Removed legacy `PAGE_READER` overlay from [src/App.tsx](../src/App.tsx)
- Removed lazy import of MagazinePageReader

### Deferred to a separate session

**Phase E — Full deletion:**
- `Story` type is imported by **75 files** across the codebase (PhotoEssay, Reader, AdminApp, etc.) — not safe to delete in one push
- `STORIES` array exported from `src/content/index.ts` is consumed by 6 files including [src/context/StoryContext.tsx](../src/context/StoryContext.tsx), [src/constants.ts](../src/constants.ts), [src/admin/components/ContentLinksEditor.tsx](../src/admin/components/ContentLinksEditor.tsx)
- The 32 `src/content/articles/*.ts` files still exist but are no longer surfaced via `/magazine` (the listing skips them entirely)
- `Story` type narrowing (drop article-specific fields, keep gallery for PhotoEssay) is its own focused refactor

**To finish Phase E later:**
1. Audit each of the 75 `Story` consumers; categorize as PhotoEssay (keep), legacy article reader (delete with the consumer), or something else (decide)
2. Narrow `Story` type to PhotoEssay-relevant fields only
3. Delete `src/content/articles/*.ts` (32 files)
4. Update `src/content/index.ts` to remove article exports
5. Search for residual `STORIES.filter(s => s.type === ContentType.Article)` and prune

**Phase F — Admin v2:**
Rich block editor for the new ArticleBlock variants. Not started. Minimum-viable v1 = manually edit JSON in DB; the existing admin UI handles only the original 6 block types.

### Apply the migration

```bash
# Dev
npx wrangler d1 execute teajia --local --file=worker/migrations/046_seed_articles.sql

# Prod (after dev verification)
npx wrangler d1 execute teajia --remote --file=worker/migrations/046_seed_articles.sql
```

After applying, visit `/magazine` to see the 5 articles; click any card to open the new 4:5 reader.

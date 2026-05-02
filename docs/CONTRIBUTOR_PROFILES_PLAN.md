# Contributor Profiles Plan

> **Status:** Plan, not yet built. Sits alongside `MAGAZINE_PLAN.md` and the article work in `_archive/ARTICLE_UNIFICATION_PLAN.md`.
> **Owner:** Adrian.
> **Last updated:** 2026-05-01.

## Why this exists

Articles, products, and events on Teajia are made by people. Right now those people are flat strings — `articles.author_id` is a free-text slug, `Person` is a TypeScript interface that lives only in code, and there is no public route where a reader can meet a contributor. This plan replaces that with a real contributor record and a public `/people/:slug` page that reads as **a small ceremony, not a dossier**.

The page is the spine. Every other part of the platform — the catalogue, the magazine, the event calendar, the tasting community — connects through it.

## Voice and register

The whole design lives or dies on this. Tea writing is plain. Section labels are short nouns or short phrases. The contributor's voice lives *inside* the sections, never in the headings. The page never instructs the reader to feel anything. Silence and whitespace do most of the work.

Anti-references for this page specifically:
- LinkedIn-style "About" pages with role pills and stats rows.
- Substack author pages with follow buttons and recent-posts grids.
- Wellness-app practitioner pages ("Meet your guide").
- Magazine masthead pages that read as CV.

The closest references in spirit: the contributor page at the back of a literary quarterly, the inside-flap bio of a serious cookbook, the small printed card next to a museum object naming who made it and when.

## Page anatomy

The page reads top to bottom in this order. Section labels are the exact words on the rendered page.

1. **Masthead.** Issue line in `text-ui-11` bronze 60% (e.g. `No.07 — Tea Master`). Display name in Cormorant Garamond 300 at fluid display size. Chinese name in Ma Shan Zheng below it, ~0.4× scale, bronze 70%. One line of Lora italic 14px in `--tea-text-sec` underneath: *"Wuyishan and Taipei. Working in tea since 1998."* This is the only place location, languages, and active-since metadata appear — collapsed into one sentence, not a column.

2. **Seasonal stamp.** Optional. One factual line of Lora 14px in `--tea-text-sec`: *"Wuyishan, spring picking. Week three."* Pulled from a per-region seasonal calendar (see Schema). Disappears when no entry applies for the current date.

3. **Portrait.** 4:5 image, no card, no shadow, no rounded corners — flush against the grid line, with a 1px bronze rule under it carrying a tiny `text-ui-11` italic caption (*"Wuyishan, May 2024 — photograph by …"*). If no portrait, render a single Lora italic line at 30% bronze: *"No portrait on file."*

4. **Origin.** Section label `Origin`. A paragraph the contributor (or Adrian) writes about how they came to tea. Lora 400, ~120–180 words, max 60ch column. One scene, one admission. Not a CV. This is the section that turns a name into a person.

5. **Pull-quote (optional, unlabeled).** A single line of Lora italic, attributed *— Mei Lin, Winter 2024*, sourced from an article in which another contributor wrote about this person. No section heading. It floats between Origin and Now like a margin note. Up to two pull-quotes per page, scattered between sections. If none exist, render nothing.

6. **Now.** Section label `Now`. A short paragraph (~80–140 words) in Lora 400 about what the contributor is currently working on. Followed by a small Cormorant italic 12px stamp written in the contributor's own register (e.g. *"Written the morning of the first rain."*) — not auto-generated. If no stamp is written, fall back to a plain `Updated Spring 2026` line.

7. **Inspirations.** Section label `Inspirations`. A prose paragraph naming who and what shapes their work — a teacher, a poet, a particular pot, a season, a piece of music. Lora 400, freeform, no list, no chips. Three or four threads named with affection.

8. **Pouring today.** Section label `Pouring today`. *Optional.* If the contributor has a single tea they want a reader to drink right now, render two short lines:
   > **Pouring today**
   > 2014 Shui Xian. Second roast. A few jars left.

   The tea name is a quiet underline link to the product page. No CTA pair, no second-person address, no buttons. Omitted entirely if no tea is set.

9. **Words.** Articles by this contributor. A typeset list, not a card grid. Each entry: small Cormorant date stamp on its own line, then a Lora 400 18px title, then a Lora italic 300 15px one-line description, then a Cormorant `→` arrow on the right. Hover: arrow translates 6px right; bottom hairline picks up a bronze tint. No images, no excerpts longer than one line. Section omitted if there are no articles.

10. **Hands on.** Teas this contributor had a hand in. *Not* a flat catalogue grid — grouped by the actual labor, with small italic Lora captions:
    - *Sourced by Chen.*
    - *Roasted by Chen.*
    - *Stood behind by Chen.*

    Each group is a short row of products underneath. A reader learns the difference between sourcing, roasting, and curation just from reading the page. Section omitted if there are no attributions.

11. **Hosting.** Upcoming events this contributor is running. Inline Lora prose, not event cards: *"He'll be pouring 2012 Shui Xian on May 18th in Taipei."* Date links to the event page. Section omitted if no upcoming events. Pulls events from both directions when `face_of_account_id` is set: events where the contributor is the named host AND events run by the account they front.

12. **Where to find them.** *Optional, only when `face_of_account_id` is set.* A short prose paragraph the contributor writes about their shop or studio, with a single underline link to the storefront. Lora 400, max 50ch column, sits between Hosting and Voice. Example: *"Mei Lin keeps a small studio in Tainan. Visits by appointment. The shop carries her sourcing year-round. [Visit the shop →]"* Section omitted entirely when the contributor is not the public face of an account.

13. **Voice.** *Optional.* A single audio clip, 30–90 seconds, of the contributor speaking. A small Cormorant italic 12px caption underneath: *"Chen, on the morning of the first rain."* Hairline play control — no pill button, no shadow, just an inline glyph and a bronze underline that fills as audio plays. Never autoplay. Section omitted if no clip.

14. **Elsewhere.** Outbound links typeset inline as plain text — *"chenwei.tea · Substack · cwteapress on Instagram"* — separated by `·`, not as a row of social icons. Section omitted if no links.

15. **Closing line.** *Optional.* Whatever the contributor wants — a line of poetry, a teacher's name, a thank-you, a date, a single word, nothing. Lora italic, thin bronze divider above, generous space below. The platform's only job is to give them the space and set the type. If empty, the page ends on the previous section. Silence is also a closing.

### Pacing

The first viewport shows only the masthead and the seasonal stamp. The portrait and Origin are below the fold. The reader scrolls when they are ready — the held arrival is the *space*, not an instruction. No "continue reading" prompt, no scroll arrow.

### Motion

One orchestrated entrance, then stillness. Issue line at 0ms, name rises 12px and fades at 80ms (700ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`), Chinese name follows at 220ms, portrait fades at 320ms (no transform), Origin word-fades on scroll-in. Sections below reveal once on scroll via IntersectionObserver, single 600ms fade + 8px rise, never re-trigger. `prefers-reduced-motion`: collapse to a 200ms opacity fade.

### Color discipline

Bronze appears on the page exactly four times: the issue line, the Chinese name, the article-entry arrows on hover, and the underline that draws under "Elsewhere" links on hover. Nowhere else. No backgrounds on sections — they are columns of type, not cards. No pills, no badges, no chips, no rounded-rectangle wrappers anywhere on the page.

## Contributors and accounts

A contributor may also be a tea shop owner, teahouse host, or studio operator — meaning they are simultaneously a `user` (login), an `account` (multi-tenant entity that runs a storefront and events), and a public editorial identity. Without a clear principle, the same person ends up rendered four different ways across the site, which is the incoherence this feature was meant to fix.

**The principle: the contributor record is the canonical editorial identity. Everything else points at it.**

Concretely:
- A `contributor` *may* be linked to a `user` (`user_id`, nullable) — they have a Teajia login.
- A `contributor` *may* be the human face of an `account` (`face_of_account_id`, nullable) — they are the publicly named host of a tea shop, studio, or teahouse on the platform.
- An `account` *may* designate a single contributor as its public face (`accounts.host_contributor_id`, nullable) — the storefront's "About the host" line and any "Run by" attribution links to that contributor's profile page.

`face_of_account_id` and `accounts.host_contributor_id` are two views of the same relationship and must be kept in sync at write time. The relationship is one-to-at-most-one in both directions: a person is the human face of at most one account; an account has at most one human face. Co-hosts and multi-shop arrangements are expressed in prose inside Origin or Now, not as additional joins.

**What this unlocks:**
- The storefront's host card links to `/people/:slug` instead of rendering the host name as plain text. Tea shops stop being anonymous storefronts and become portals into a person who happens to sell tea.
- The contributor profile gains a quiet `Where to find them` section (between Hosting and Voice) when `face_of_account_id` is set: a short prose paragraph the contributor writes, with a single underline link to the storefront. Omitted when not a host.
- The `Hands on` section can distinguish *Sourced by Mei Lin* (direct attribution) from *Carried by Wabi Studio* (her account's catalogue). Same query, two captions.
- The `Hosting` section pulls events from both directions: events where the contributor is the named host AND events run by the account they front.

**What this does NOT do:**
- Does not auto-create a contributor when a user signs up or an account is created. Becoming a public face on Teajia is a deliberate editorial act — Adrian publishes a contributor profile by writing Origin and flipping `is_published`.
- Does not collapse `users` and `contributors` into one table. Most contributors will not have logins; most users will not have public profiles. Public-facing-ness is editorial, not a registration side effect.
- Does not change permissions, account access, or auth in any way. `users.platform_role` and `account_users` are untouched.
- Does not let one contributor front multiple accounts. If a person works across multiple shops, the secondary relationships are written into prose, not modeled as joins.

**Role label.** With this in place, the masthead's `role` field becomes more flexible: `Tea Master`, `Host`, `Writer`, `Maker`, or freeform. The label is editorial; permissions still flow through `users.platform_role` and `account_users`. When `face_of_account_id` is set and the contributor's `location_line` is empty, the masthead may auto-fill with the account's location — always overridable.

## Schema

### `contributors` table

```
id              TEXT PK              -- slug, e.g. "chen-wei"
account_id      TEXT NOT NULL        -- multi-tenancy scope (which tenant owns this record)
user_id         TEXT NULL FK users   -- only if they have a Teajia login
face_of_account_id TEXT NULL FK accounts -- if this contributor is the public host of an account
display_name    TEXT
chinese_name    TEXT NULL
role            TEXT                 -- "Tea Master", "Writer", "Farmer"
location_line   TEXT                 -- the single italic line under the name
active_since    TEXT NULL            -- year, used in location_line if present

beginnings      TEXT                 -- markdown, the Origin paragraph
now             TEXT NULL            -- markdown, current preoccupation
now_stamp       TEXT NULL            -- "Written the morning of the first rain."
now_updated_at  INTEGER NULL         -- unix ms, fallback for the date stamp
inspirations    TEXT NULL            -- markdown, prose paragraph
closing         TEXT NULL            -- max 200 chars, freeform

avatar_url      TEXT NULL
portrait_url    TEXT NULL
portrait_caption TEXT NULL
voice_clip_url  TEXT NULL
voice_clip_caption TEXT NULL

pouring_today_product_id TEXT NULL FK products
pouring_today_note       TEXT NULL  -- "2014 Shui Xian. Second roast. A few jars left."

links           TEXT NULL            -- JSON: [{label, url}]

is_published    INTEGER DEFAULT 0    -- gates the public profile
created_at, updated_at
```

Notes:
- No `interests`, `expertise`, or `languages` arrays. Those collapse into the `location_line` and the prose. If a fact matters enough to appear on the page, write it into one of the prose fields.
- No relationship table in v1. Who-knows-whom is expressed inside Origin / Inspirations as named people, and surfaces as **pull-quotes** sourced automatically from articles.

### `articles` additions

```sql
ALTER TABLE articles ADD COLUMN subject_ids TEXT;       -- JSON array of contributor slugs
ALTER TABLE articles ADD COLUMN pull_quote TEXT;        -- single ~30-word line
ALTER TABLE articles ADD COLUMN pull_quote_subject TEXT; -- which contributor slug the quote is about
```

The pull-quote is set by the article author (or Adrian) when an article is published. When a profile renders, the page queries:

```
SELECT pull_quote, author_id, published_at
FROM articles
WHERE pull_quote_subject = :slug
  AND is_published = 1
ORDER BY published_at DESC
LIMIT 2
```

This is the only mechanism that pulls one contributor's voice into another's profile — and it's a byproduct of writing articles, not a separate workflow. No relationship modelling.

### `products` additions

```sql
ALTER TABLE products ADD COLUMN sourced_by    TEXT NULL; -- contributor slug
ALTER TABLE products ADD COLUMN roasted_by    TEXT NULL;
ALTER TABLE products ADD COLUMN vouched_by    TEXT NULL;
```

These power the `Hands on` section and let product pages route back into a contributor (*"Sourced by [Chen Wei →]"*).

### `accounts` additions

```sql
ALTER TABLE accounts ADD COLUMN host_contributor_id TEXT NULL; -- contributor slug
```

Designates a single contributor as the public host / face of the account. When set, the storefront's host card links to `/people/:slug` and the contributor profile renders the `Where to find them` section. Must be kept in sync with `contributors.face_of_account_id` at write time — both reads and writes go through a single helper that updates the pair.

### `seasonal_calendar` table

```
id              INTEGER PK
region          TEXT       -- "Wuyishan", "Taipei", "Yunnan", ...
month_start     INTEGER    -- 1–12
month_end       INTEGER    -- 1–12
day_start       INTEGER    -- 1–31, optional (NULL = whole month)
day_end         INTEGER
line            TEXT       -- "Wuyishan, spring picking. Week three."
```

Adrian writes these by hand. Twelve to twenty entries per active region. Never auto-generated. When a profile renders, look up the contributor's region(s) (parsed from `location_line` or stored separately if needed later) and pick the entry whose date range covers today.

### Migration from existing state

A migration reads the distinct values of `articles.author_id` and seeds a `contributors` row per slug:
- `id` = the slug as it appears.
- `display_name` = title-cased slug (`"chen-wei"` → `"Chen Wei"`).
- `is_published` = 0.
- All other fields empty.

Existing articles continue to render. The `formatAuthor()` helper in `ArticlePage.tsx` is replaced with a lookup against `contributors` — falling back to the title-cased slug if no contributor row exists.

## Routes

- **`/people/:slug`** — public profile page (gated by `is_published`).
- **`/people`** — directory. v1 ships as a simple typeset list (Cormorant names, italic role line, alphabetical). The "directory as map" idea is deferred.
- **`/admin/contributors`** — admin list + create.
- **`/admin/contributors/:slug/edit`** — full editor panel.

The article masthead's `By Chen Wei` becomes a link to `/people/chen-wei`. Article subjects (when set) render at the top of the article as *"In conversation: 陳偉, Mei Lin"* with each name linking out. Product pages render *"Sourced by [Chen Wei →]"* / *"Roasted by [...]"* / *"Stood behind by [...]"* whenever the corresponding column is set.

## Admin editor

A panel (not a modal) styled like `ProductEditPanel`. Inherits the page's voice rather than a generic form aesthetic.

- Field labels: Cormorant 400 13px in `--tea-text-sec`, on their own line above each input. No colons, no asterisks.
- Inputs: borderless with a 1px bottom rule in `--tea-border`, becoming bronze on focus. No boxed input fields.
- Beginnings / Now / Inspirations / Closing: long-form markdown textareas with the same type rendering as the public page (preview pane shows exactly what the reader will see).
- `now_stamp`: short text input with a placeholder reminding the contributor it's optional and freeform.
- `links`: repeatable {label, url} rows.
- `pouring_today_product_id`: product picker; `pouring_today_note` is a short text input.
- Pull-quotes are not editable here — they are set on the article side.
- Save bar: Cancel left in `text-tea-text-sec`, Save right as the single bronze element on screen. `flex justify-between`.
- Slug field is read-only after first save with a tiny italic note: *"Slug is permanent. Articles are linked by it."*

## Empty state floor

A profile that only has a name renders only:
1. Issue line + name + Chinese name (if any) + location line (if any).
2. A single Lora italic line: *"A contributor whose work is on its way."*

Nothing else. No portrait placeholder, no "Coming soon" sections, no skeleton. Reads as editorial reticence, not as a broken page. A contributor is not published until at least `beginnings` is filled in — enforced at the admin save step, not at render.

## Build order

Each step is small and independently shippable. The v1 cut is steps 1–5.

1. **Migration + seed.** Create `contributors` table, seed from distinct `articles.author_id` values, all `is_published = 0`.
2. **Public `/people/:slug` page.** Reads from DB. Renders Origin, Now, Inspirations, Words, Closing. No portraits or pull-quotes yet. `formatAuthor()` swap so existing articles light up the link.
3. **Admin contributor list + editor panel.** Adrian can write Beginnings / Now / Inspirations / Closing for the contributors that matter most, publish them, and have the public page render.
4. **Article author picker.** Replace the freetext author input in `ArticleEditorModal` with a contributor picker that supports inline create.
5. **Pull-quotes.** Add `pull_quote` / `pull_quote_subject` columns to articles. Article editor gains the two fields. Profile page renders up to two pull-quotes scattered between sections.

The aspirational layer — **steps 6 onward, only built when earned**:

6. **`Hands on` section.** Adds `sourced_by` / `roasted_by` / `vouched_by` to products. Backfill the catalogue. Render the section.
7. **Portraits + captions.** Field, upload, caption.
8. **Seasonal calendar.** Adrian writes the first set of entries for active regions.
9. **`Voice` clip.** Field, R2 upload, hairline play control.
10. **`Pouring today`.** Field + product picker.
11. **`Hosting`.** Inline prose pulled from upcoming events where the contributor is the host.
12. **Storefront integration.** Storefront's host card reads `accounts.host_contributor_id` and links to `/people/:slug`. `Where to find them` section renders on the profile when `face_of_account_id` is set. ~30 lines, single component edit.
13. **Directory upgrade.** From alphabetical list to relational map.

## Tradeoffs and open questions

- **Editorial work over engineering work.** Most of this design's power is in writing — Adrian writing Origin paragraphs, contributors recording 60-second clips, the discipline of pull-quote curation. The technical surface is small; the editorial surface is the whole job. v1 is intentionally narrow so the editorial pipeline can be tested before more sections are added.
- **No relationship table.** v1 expresses who-knows-whom only through prose mentions and pull-quotes. If a relational map directory becomes a goal, a `contributor_mentions` table can be derived from article subjects rather than authored by hand — defer until the directory upgrade.
- **`location_line` as one field.** The trade is flexibility (the contributor or Adrian writes whatever reads best) versus structure (no clean filter for "all contributors in Taiwan"). Profile filtering isn't a v1 need; revisit when the directory grows past ~30 entries.
- **Pull-quote source of truth.** Pull-quotes live on `articles`, not on `contributors`. A contributor cannot edit how they are quoted on someone else's page — same as a magazine. Flag if this becomes an issue for a real contributor.
- **Audio hosting.** R2 is fine for clips at this scale. Revisit if total audio exceeds a few hundred MB.

## Out of scope

- Streak counters, follower counts, "most-read this month" stats, contributor leaderboards.
- Auto-generated bios from article history.
- Cross-contributor recommendation widgets ("readers also visited…").
- Social sharing buttons on profile pages.
- A relationship-map directory in v1.

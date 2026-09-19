# Creator profile fixtures

Companion to `creator-profiles.md`. Three placeholder creators at three fill
levels, so `/design` and Playwright see real pages instead of empty states.
All content here is explicitly placeholder — swap before anything ships
public.

## Why a dedicated seed, not the normal sandbox refresh

`worker/sandbox/refresh.mjs`'s `DATA_TABLES` list (verified 2026-09-19, line
43) is `accounts, exchange_rates, products, tea_profiles, product_listings,
collections, collection_items, batches`. It does not copy `contributors`,
`contributor_accounts`, `profile_favorites`, `payment_methods`,
`contributor_gallery_images` (new), `users`, or `customers` — the last two
are excluded platform-wide for privacy, on purpose. So a fresh sandbox has
zero creators, always. A new standalone script fills that gap without
touching the refresh script's privacy boundary.

**New file: `worker/sandbox/seed-creator-fixtures.mjs`**, run after
`npm run sandbox:refresh` (or on its own against an already-running sandbox
DB). Pattern to follow: `seed-operator.mjs` in the same directory — it's the
existing example of a standalone seed script writing directly to the local
D1 file, not exported through `wrangler d1 execute` against remote. Add
`npm run sandbox:seed-creators` to `package.json` alongside the existing
`sandbox` / `sandbox:refresh` scripts.

The script needs a local `users` row per fixture creator too (contributors
reference `user_id`, and the sandbox has zero users by default) — three
throwaway sandbox-only user rows, clearly named, not real accounts.

## The three fixtures

### 1. Sparse — "Wei Chen"

Tests the floor: does a nearly-empty profile still read as finished, or as
broken.

- `display_name`: "Wei Chen"
- `business_name`: NULL (not set)
- `role`: "Tea Master"
- `portrait_url`: `https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80`
  (portrait orientation, warm-lit person, no other identifying detail —
  Unsplash direct-image URL, license permits this placeholder use)
- One paragraph in `now_text`: "Started sourcing oolong from Wuyi Shan in
  2019. Still learning the mountain every season."
- `beginnings`, `inspirations`, `closing`: all NULL
- `links`: `[]` (empty — Elsewhere section must not render)
- Zero gallery images, zero `profile_favorites` rows, zero `payment_methods`,
  zero `event_contributors` hosting rows
- `is_published`: 1

**What this fixture proves**: every conditional section (gallery, tea
selection, elsewhere, hosting, pull-quotes) disappears cleanly rather than
rendering empty containers, and the page still feels like a finished page
with just a portrait and a paragraph — the exact case Adrian's spec calls
out ("A sparse profile ... must still look finished").

### 2. Medium — "Amara Osei"

A working profile without the full spread.

- `display_name`: "Amara Osei"
- `business_name`: "Osei Tea Imports"
- `role`: "Tea Master"
- `pronouns`: "she/her"
- `location_line`: "Portland, Oregon"
- `portrait_url`: `https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&q=80`
- `beginnings`: two short paragraphs (placeholder prose, clearly fictional —
  "Grew up drinking gunpowder green at her grandmother's table in Accra...")
- `now_text`: one paragraph on current focus
- `inspirations`: one paragraph naming a mentor (fictional)
- `links`: one entry — `{platform: 'instagram', value: '@amarateas'}`
- Gallery: 0 images (medium fixture deliberately skips the section some
  creators won't have yet)
- `profile_favorites`: 3 rows, each with a `note` (real product ids pulled
  from the sandbox's copied product catalogue at seed time — the script
  should query `product_listings` for 3 active listings and reference their
  `tea_profile_id`, not hardcode ids that may not exist in a given sandbox)
- `payment_methods`: 1 row, `method_type: 'bank_transfer'`, unpublished
  (`is_published: 0` — tests that an unpublished method doesn't appear
  publicly even though the profile itself is published)
- No hosting rows
- `is_published`: 1

**What this fixture proves**: partial fill renders correctly — some sections
present, some absent, no "coming soon" placeholders anywhere, and an
unpublished payment method stays invisible on a published profile.

### 3. Full — "Kenji Tanaka"

Every section, to see the full magazine-spread version.

- `display_name`: "Kenji Tanaka"
- `chinese_name` field reused for a script name if applicable, or leave NULL
  and set a note — **check at build time whether `chinese_name` should carry
  Japanese script for a non-Chinese name, or whether that field is China-
  specific and should stay NULL here** (design question, not blocking the
  fixture)
- `business_name`: "Tanaka Tea House"
- `role`: "Tea Master · Host"
- `pronouns`: "he/him"
- `location_line`: "Kyoto, Japan"
- `active_since`: "2015"
- `portrait_url`: `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80`
- `beginnings`, `now_text`, `inspirations`, `closing`: all filled with
  placeholder prose (2-4 short paragraphs each)
- `links`: three entries —
  - `{platform: 'wechat', value: 'tanaka_tea_kyoto', qr_image_url: 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=400&q=80'}`
    (placeholder square image standing in for a QR code — not a real QR,
    clearly a stand-in)
  - `{platform: 'instagram', value: '@tanakateahouse'}`
  - `{platform: 'website', value: 'https://example.com'}` (deliberately the
    reserved example domain, never a real one)
- Gallery: 5 images, "tea in action" subjects (not headshots):
  1. `https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1200&q=80` — pouring tea into a cup, close-up hands
  2. `https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=1200&q=80` — person seated at a tea table mid-session
  3. `https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=1200&q=80` — tea leaves being weighed/prepared
  4. `https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=1200&q=80` — teaching gesture over a tray of teaware
  5. `https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=1200&q=80` — steam rising from a gaiwan, hands visible
- `profile_favorites`: 6 rows with notes, pulled live from sandbox product
  catalogue at seed time (same approach as fixture 2)
- `payment_methods`: 2 rows, both `is_published: 1` (one bank transfer, one
  payment link)
- `event_contributors`: 1 row, `role: 'lead_host'`, `is_public: 1`, linked to
  a future-dated sandbox event (the seed script needs to either find an
  existing sandbox event with a future `starts_at` or, if none exists,
  create one minimal placeholder event — **events are not in the sandbox's
  copied table list either, check at build time whether any exist locally
  or whether this fixture needs its own throwaway event row too**)
- One article: seed a minimal `articles` row with `author_id` = this
  contributor's id, `status: 'published'`, a `pull_quote` and
  `pull_quote_subject` set to this contributor's id (self-quoting a piece
  they wrote, which is a valid case), so the "Words" section and the
  pull-quote anchor jump both have something real to point at
- `is_published`: 1

**What this fixture proves**: the full spread — gallery, typed links with a
QR image, tea selection, hosting, and at least one pull-quote with a working
anchor-jump — all in one page, plus that a favorite pulled from a real
sandbox product resolves correctly end to end.

## Image sourcing note

Every URL above is a direct Unsplash image URL (`images.unsplash.com/photo-...`),
which Unsplash's license permits for this kind of placeholder use without
attribution requirements. These are NOT curated for exact subject match —
they were chosen by URL pattern recognition for plausible framing (portrait
orientation for portraits, hands/tea-action framing for gallery shots) and
must be eyeballed once loaded before relying on them in a design review; if
any resolve to something unsuitable, swap the specific URL, the seed script's
shape doesn't change.

## Dev fixture (non-sandbox, for quick local iteration)

Separately from the sandbox seed, add a small in-memory or JSON fixture at
`src/pages/__fixtures__/contributorProfiles.ts` (new file) mirroring the
three shapes above, for component-level Storybook-style iteration if the
codebase has that pattern — **check at build time whether Teajia has any
existing component-preview tooling to hook into; if not, skip this and rely
on the sandbox seed alone**, since inventing a new preview mechanism is out
of scope for this plan.

## Verification hook

`creator-profiles.md`'s Lane K specs (`creator-profile-sparse.spec.ts`,
`creator-profile-full.spec.ts`) target these fixtures by slug directly
(`wei-chen`, `kenji-tanaka` — pick stable, readable ids at seed time rather
than random uuids, so a spec file reads clearly). The medium fixture
(`amara-osei`) backs any test that needs "some sections, not all."

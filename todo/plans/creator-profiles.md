# Creator profiles

Written 2026-09-19, planning only — no product code in this pass. Branch
`claude/creator-profiles`, worktree `.claude/worktrees/creator-profiles`.

## Shipped 2026-09-21: the presence beyond the profile page

Commit 5ab99ff3 on main. The store page shows the people at its table (the
host as the portrait cover, the rest as rows), the event page shows its hosts
in the first person, the product page's "Selected by" wears the profile's
row, and the tea master's own page gained "Who taught me", "The last line",
and "What I call it", which names the public favorites into a collection
with its own page. Design canvas for the map and the boards:
https://claude.ai/artifact/J1FyxzXFVQiYpteog1xCRQ (the seven editing boards on
it were NOT built; Adrian chose the existing plain forms over a restyle).

## Purpose, in Adrian's words

"A profile style. People like myself as an image. You can learn about me. You
can see my tea selection in the shop. It should be interconnected."

Anyone can hold an account. Being upgraded to a creator (tea master) account is
invitation-only, decided 2026-08-31 and already shipped — see
`todo/plans/tea-master-onboarding.md`. The profile hangs off Your Table once
upgraded. Quoted customers are never creators; unpublishing a profile turns a
byline back to plain text and leaves the article alone.

## What exists and is reused

Verified against `worker/schema.sql` and the live routes on 2026-09-19, not
assumed from an earlier survey:

- **`contributors`** (schema.sql ~193–223) already carries display_name,
  chinese_name, role, pronouns, location_line, active_since, languages,
  beginnings, now_text, inspirations, closing, avatar_url, portrait_url,
  portrait_caption, voice_clip_url, pouring_today_product_id,
  where_to_find_text, `links` (JSON, currently `{label,url}[]`), is_published
  (default 0), user_id, face_of_account_id. Slug = `contributors.id`.
- **`contributor_accounts`** — many-to-many person↔shop, `is_host` flag (one
  host per account), `public_role`, `display_order`.
- **`contributor_profile_drafts`** — pending/approved/changes_requested review
  queue, reuse for the invitation→profile-born step.
- **`profile_favorites`** — contributor_id + tea_profile_id, `note` (≤280
  chars), `position`, `is_public`. This is the tea-selection table; already
  shaped for "five to eight teas with a line each."
- **`payment_methods`** + `payment_method_audit_events`.
- **`event_contributors`** — role incl. `author`, `lead_host`/`co_host`/etc.,
  `is_public`.
- **articles**: `author_id = contributors.id`, `subject_ids` (JSON array,
  matched with a `LIKE` scan in `handleGetPublicContributor`), `pull_quote`,
  `pull_quote_subject`.
- **Routes**: `/people` (`ContributorsIndexPage.tsx`), `/people/:slug`
  (`ContributorProfilePage.tsx`, 480 lines — its own header comment says
  Masthead/Origin/Now/Inspirations/Words/Elsewhere/Closing are rendered today;
  **Pull-quotes, Hands on, Hosting, Voice, Pouring today, Where to find them
  are "reserved for later waves"**), `/people/:slug/favorites`,
  `/people/:slug/pay`, `/u/:slug` (personal shelf), `/account/profile`
  (`AccountProfilePage` — draft editor, readiness, favorites/payment editors).
- **Admin**: `/admin/contributors` (`ContributorsView.tsx` +
  `ContributorEditorPanel.tsx`), `ArticleEditorModal.tsx`'s `ContributorSelect`
  (used for both Author and Pull-quote-subject, lines ~916–1133).
- **Public API**: `handleListPublicContributors` / `handleGetPublicContributor`
  in `worker/src/index.ts` (~22378, ~22432), safe-field projection logic in
  `worker/src/profileDomain.ts` (146 lines). The client-side counterpart is
  `src/components/profile/profileDomain.ts` (341 lines, `primaryTeaMasterAccount`
  etc.) — two files, same name, different layers; don't confuse them.
- **Fragments**: `src/components/shared/ContributorIdentityMark.tsx` (initials
  disc fallback — no image, uses `Icons.Seal` + initials), `src/components/profile/*`
  (`PublicFavoritesCollection`, `PublicIdentityLinks`, `PaymentChooser`,
  `PaymentMethodsEditor`, …).
- **Bylines today**: `ArticlePage.tsx` links the author's name to
  `/people/:slug` as plain text (no avatar, no image at all — confirmed by
  reading the masthead/colophon render blocks). `ImmersiveArticlePage.tsx`
  renders no author whatsoever (confirmed: zero matches for author/byline in
  that file).
- **Dead legacy, zero importers** (confirmed by grepping every `.tsx`/`.ts`
  under `src` and `worker` for each name): `src/components/ContributorsDirectory.tsx`,
  `src/components/ContributorBioPage.tsx`, `src/components/ContributorDrawer.tsx`,
  `src/data/contributorCollections.ts`.

## Contradiction found — say what was measured, not assumed

**`src/components/ContributorProfile.tsx` is a second, separate, LIVE
"profile modal" — not the dead component its name suggests.** It is imported
in `App.tsx:208` and rendered at `App.tsx:1384` when `selectedPerson` is set.
`selectedPerson` is set only from `onPersonClick={setSelectedPerson}` inside
the legacy full-screen `Reader` component (`viewState === 'READER'`,
`App.tsx:1358`), which is the old story-reading path built on
`src/content/people.ts`'s `PEOPLE_DIRECTORY` and the TS-only `Person` type —
a second, older parallel identity system that pre-dates the `contributors`
table and still ships live, reachable only through the legacy Reader. It is
out of this plan's scope to remove (it isn't named in the brief's dead-file
list and touches the Reader/STORIES system, a bigger cleanup), but it means
"the profile" is not yet a single thing in the codebase — flagging for a
separate cleanup rather than silently expanding this lane list.

**Your Table already shows a "profile" tile to every account, not only
upgraded ones — contradicts surface 4 of the spec as stated.**
`LaunchpadView.tsx` (~343–349) renders an unconditional `profile` tile
(`hint: 'public identity & payment'`) routing to `/account/profile` for
every signed-in account, ordinary or creator. The spec says "ordinary account
sees nothing; upgraded account sees 'your profile' and the editor." Two ways
to resolve, Adrian's call (listed below under "design must decide"): (a) gate
the existing tile behind creator status and add a distinct "become a creator"
nudge for ordinary accounts pointing at the invitation flow, or (b) keep the
tile for everyone (since anyone can start a draft profile per
`tea-master-onboarding.md`'s "may not need an invitation" finding) and only
change what happens *inside* — ordinary accounts land on an invite-gated
screen, creators land on the editor. (b) matches the already-shipped
"anyone can draft, publishing needs approval" behavior more closely than
rebuilding a gate the code doesn't currently need. Lane 4 below assumes (b)
unless design says otherwise, since it is the smaller, non-destructive change.

**The `links` field is typed as a flat `{label, url}` pair today, not the
platform-typed list the spec wants (WeChat with ID + QR image, Instagram
handle, website, etc.).** `ContributorProfilePage.tsx:442–459` renders
`data.links` as a plain list of label/url pairs with no per-platform icon or
validation. This is a real data-shape change, not a rename — see Lane A.

**The sandbox does not copy `contributors` on refresh.** `worker/sandbox/refresh.mjs`'s
`DATA_TABLES` list (line 43) is `accounts, exchange_rates, products,
tea_profiles, product_listings, collections, collection_items, batches` —
no `contributors`, `contributor_accounts`, `profile_favorites`,
`payment_methods`, or `users`/`customers` (deliberately excluded platform-
wide for privacy). Fixture creators need their own seed script; see the
fixtures doc.

## Data changes

1. **`business_name`** — new nullable column on `contributors` (a person's
   business/shop-facing name, distinct from `display_name`; a tea master may
   go by "Mei Lin" but trade as "Cloud Mountain Tea"). Shown under the name on
   the masthead only when set.
2. **Gallery images** — new table `contributor_gallery_images` (contributor_id,
   image_url, caption nullable, position, created_at) rather than a JSON
   column, so ordering/removal is row-level and matches the pattern
   `profile_favorites`/`payment_methods` already use. 3–5 rows is the editorial
   ceiling; the editor UI enforces it, not the schema.
3. **Typed links** — migrate `links` JSON from `{label,url}[]` to
   `{platform, value, qr_image_url?}[]` where `platform` is one of a fixed
   vocabulary (`wechat`, `instagram`, `website`, `other` to start — extend
   later without a migration since it's still JSON). A migration script
   rewrites existing rows: `website`-shaped urls get `platform: 'website'`,
   everything else falls to `other` with its current label preserved as
   `value`. No production rows are known to exist yet outside test fixtures
   (is_published defaults to 0 and the feature hasn't shipped a public writer
   path), so this is low-risk, but write the backfill anyway rather than
   assume the table is empty.
4. **Quote anchors** — "jump to their spot" needs a stable per-quote anchor.
   Decision: assign each pull-quote a stable DOM id at render time
   (`quote-<contributor_id>`), not the browser-native `#:~:text=` text
   fragment (inconsistent Safari/Firefox support, and this content is
   controlled server-side already). The profile links to
   `/article/:slug#quote-<contributor_id>`, `ArticlePage.tsx` scrolls to that
   element on mount and applies a 2–3s highlight class, then removes it. No
   schema change — the anchor is derived at render time from data that
   already exists (`pull_quote_subject` match).
5. **Auto-publish rule** — a creator's profile flips `is_published = 1`
   automatically the moment one of their articles reaches `status = 'published'`
   with `author_id` matching their `contributors.id`, if the profile isn't
   already published. Implementation: in the article-publish handler, after
   the status write, check-and-flip the author's `contributors.is_published`
   in the same request (not a cron — the moment is the publish action itself).
   Unpublishing an article never un-publishes the profile (one-directional,
   matches "unpublishing turns bylines back to plain text; articles stay" —
   the profile and the article are independent once born).
6. **Creator upgrade / invitation states** — no new state machine needed.
   `tea-master-onboarding.md` already shipped the invite endpoint
   (`POST /api/platform/tea-masters/invite`) and confirmed a person can start
   a draft profile with no invitation at all (create is ungated, publish is
   owner-approved via `contributor_profile_drafts`). This plan does not touch
   that; it only wires Your Table to show the right thing per state (Lane G).

## Non-goal, folded in from the existing TODO item

**"A published customer note names a person who has no page"** — decided
non-goal for this build. Quoted customers are explicitly not creators per
Adrian's spec ("Not creators: quoted customers"). A customer note naming
someone is not a creator-profile gap; it's either a testimonial-display
question (does the name need to link anywhere at all) or an out-of-scope
future feature (a lightweight "mentioned" page with no editorial content).
Do not build a stub page for every name a customer note mentions — that
directly violates "every section earns its place or disappears" applied one
level up: a directory entry with nothing behind it is worse than no entry.
Remove this line from the untriaged TODO list once this plan lands.

## The five surfaces

### Surface 1 — Profile page (`/people/:slug`)

**Files touched**: `src/pages/ContributorProfilePage.tsx` (redesign within
the existing file — it's already the right shape, add gallery + hosting +
pull-quote-anchor sections, wire `business_name`), `src/types.ts`
(`ContributorProfile` interface: add `business_name`, `gallery_images`,
retype `links`), `worker/src/profileDomain.ts` (safe-field projection: add
gallery + business_name to the public payload), `worker/src/index.ts`
(`handleGetPublicContributor`: join `contributor_gallery_images`, join
`event_contributors` for the Hosting section — "their next event"),
new `src/components/profile/GalleryStrip.tsx`, new
`src/components/profile/HostingCard.tsx` (or fold into the page directly if
small enough — decide at build time), the elsewhere-links render block lives
inline in `ContributorProfilePage.tsx:442-459` and needs a new per-platform
icon/label component (note: `PublicIdentityLinks.tsx` is a *different*
component — it links *to* a profile from elsewhere, not the profile's own
outbound links; don't touch it for this).

**API changes**: `handleGetPublicContributor` gains a gallery query (mirrors
the existing `productsRes` pattern — `JOIN contributor_gallery_images ... ORDER BY position LIMIT 5`)
and an upcoming-hosted-event query (`event_contributors` role IN
`('lead_host','co_host')`, `is_public=1`, joined to `events` for the next
future `starts_at`, LIMIT 1).

**Empty-state behaviour**: zero gallery images → no gallery section at all
(not a placeholder strip). Zero elsewhere links → no Elsewhere section (already
correct in current code, confirmed at line 442). Zero favorites → no tea
selection section (`PublicFavoritesCollection`'s empty behavior should be
verified at build time, not assumed). Zero upcoming hosted events → no
Hosting section. Sparse profile (portrait + paragraph only, per the fixtures
doc) must still read as finished: the masthead + one prose block, full-bleed,
no visible "sections that would be here."

**Verification**: `tests/creator-profile-sparse.spec.ts` — loads the sparse
fixture slug, asserts no gallery/hosting/tea-selection/elsewhere DOM nodes
exist (not just hidden), asserts no horizontal overflow, asserts the page
still has a visible portrait + name + at least one paragraph.
`tests/creator-profile-full.spec.ts` — loads the full fixture slug, asserts
every section renders with real content (gallery image count, favorite tea
count, WeChat + Instagram both present with distinct icons, hosting card
shows a future event, at least one pull-quote block present and its "read in
context" link resolves to the right article + anchor).

### Surface 2 — People directory (`/people`)

**Files touched**: `src/pages/ContributorsIndexPage.tsx` (currently an
alphabetical typeset list per the brief — redesign to image cards),
`worker/src/index.ts` (`handleListPublicContributors`: extend its projection
to include a card image — **verify at build time** exactly what it selects
today, since the spec wants "people in action," not headshots, meaning the
card image is NOT `portrait_url` but a gallery photo — see design-must-decide
item 1).

**API changes**: `handleListPublicContributors` gains the card-image field
in its projection.

**Empty-state behaviour**: a published creator with zero gallery images falls
back to the `ContributorIdentityMark` initials disc (already built, already
used elsewhere) rather than a broken image — never a blank card.

**Verification**: `tests/people-directory.spec.ts` — asserts every card shows
either a real image or the initials mark (never a broken `<img>`), asserts
clicking a card navigates to the right `/people/:slug`, asserts no horizontal
overflow at mobile width.

### Surface 3 — Links between things

**Files touched**:
- `src/pages/ArticlePage.tsx` (masthead ~line 156, colophon ~line 337, byline
  render ~895–920): add a small avatar/initials-mark image before the author
  name in both the masthead and colophon byline blocks. Currently text-only.
- `src/pages/ImmersiveArticlePage.tsx`: currently renders no author at all —
  add the same byline block, matching ArticlePage's pattern rather than
  inventing a second one.
- Product detail component (**not located in this survey — locate at build
  time**, likely under `src/pages/` or `src/components/shop/`): add a
  "selected by" line when the product appears in someone's `profile_favorites`
  with `is_public=1`, linking to their profile. Needs a new query — does the
  product detail payload already carry this, or does it need a new endpoint
  addition? Check at build time.
- `src/components/AccountPanel/LaunchpadView.tsx`: profile tile already
  exists and links to `/account/profile` (see contradiction above) — this
  lane doesn't change the tile itself, only what it's gated by (Lane G).

**API changes**: article detail payload needs `author_avatar_url` (extend
whatever join already resolves the author's display name, if one exists —
check at build time). Product detail payload needs a "selected by"
projection (see above).

**Empty-state behaviour**: no avatar set → `ContributorIdentityMark` initials
disc, same fallback as the directory. Product with no curator selection →
no "selected by" line, nothing rendered.

**Verification**: `tests/article-byline-avatar.spec.ts` — asserts avatar or
initials mark renders next to the author name on both `ArticlePage` and
`ImmersiveArticlePage` fixture articles. `tests/product-selected-by.spec.ts`
— asserts the line appears only on a product actually favorited by a
published creator, and links to the right profile.

### Surface 4 — Your Table creator state

**Files touched**: `src/components/AccountPanel/LaunchpadView.tsx` (the
`profile` tile block, ~343–349) — change the `hint` and destination behavior
based on creator state, not the tile's existence (per the contradiction note
above, unless design overrules). Needs a `isCreator` / `hasContributorProfile`
flag threaded into `LaunchpadView`'s props — **locate where its other flags
(`canSell`, `canPublish`, `isOwner`) are computed and follow the same pattern**
(find the parent component or hook at build time).

**API changes**: whatever computes `canSell`/`canPublish`/`isOwner` today
needs one more boolean, or the client needs a cheap "do I have a contributor
row" check. Prefer extending the existing capabilities payload over a new
round-trip.

**Empty-state behaviour**: ordinary account without a contributor row sees
the tile with a different hint pointing at what starting one looks like (not
"nothing," since drafting is already ungated per `tea-master-onboarding.md` —
Adrian's spec line "ordinary account sees nothing" may need revisiting given
that finding; flagged under design-must-decide item 3).

**Verification**: `tests/launchpad-creator-state.spec.ts` — asserts the tile
text differs between a fixture account with a published contributor row and
one without.

### Surface 5 — Invitation

**Files touched**: none new — `POST /api/platform/tea-masters/invite` and
`PlatformAccessView`'s "Invite a Tea Master" form are already shipped per
`tea-master-onboarding.md`. This lane is verification-and-small-wiring only:
confirm the invited person's claim flow ends by creating (or pointing at) a
`contributor_profile_drafts` row so "profile is born" reads naturally, rather
than a cold empty form. **Check at build time**: does claiming an invite
today pre-create a draft contributor row, or does the person still have to
navigate to `/account/profile` and start from scratch? If the latter, the
claim handler creates an empty `contributors` row + draft in the same
transaction as the account membership.

**Verification**: `tests/invite-to-profile.spec.ts` — invites a fixture
email, claims the invite, asserts a contributor row now exists for that user
and `/account/profile` shows a draft, not an empty-state prompt to "create
your profile" from nothing.

## Build sequence — lanes split by files

Every lane names its file ownership explicitly. Anything claimed twice is
sequenced, not parallelized, per the workspace's "split by files" rule.

| Lane | Owns | Depends on | Estimate |
|---|---|---|---|
| **A — Schema** | `worker/schema.sql`, new `worker/migrations/0XXX_*.sql` (business_name, contributor_gallery_images, links retype + backfill), `worker/src/profileDomain.ts` | none — goes first | business_name column: 30 min. Gallery table + migration: 1 hr. Links retype + backfill script + test: 2 hrs. **Total: ~3.5 hrs** |
| **B — Public API** | `worker/src/index.ts` (`handleGetPublicContributor`, `handleListPublicContributors` only — do not touch unrelated handlers in this 27k-line file) | A | Gallery join: 45 min. Hosting query: 45 min. Card-image field: 20 min. "Selected by" product query: 1 hr (new, needs product-detail handler located first). **Total: ~2.5 hrs** |
| **C — Profile page redesign** | `src/pages/ContributorProfilePage.tsx`, `src/types.ts` (ContributorProfile interface only), new `src/components/profile/GalleryStrip.tsx`, new `src/components/profile/HostingCard.tsx`, elsewhere-links inline block (same file) | A, B | Gallery section: 1.5 hrs. Hosting card: 1 hr. Typed elsewhere links + platform icons: 1.5 hrs. Pull-quote anchor + highlight: 1.5 hrs. Sparse-vs-full empty states: 1 hr. **Total: ~6.5 hrs** |
| **D — Directory redesign** | `src/pages/ContributorsIndexPage.tsx` | A, B | Card grid layout: 2 hrs. Initials-mark fallback wiring: 30 min. **Total: ~2.5 hrs** |
| **E — Article bylines** | `src/pages/ArticlePage.tsx`, `src/pages/ImmersiveArticlePage.tsx` | A, B (avatar field) | ArticlePage masthead + colophon avatar: 1 hr. ImmersiveArticlePage new byline block: 1.5 hrs (no prior art in that file). **Total: ~2.5 hrs** |
| **F — Product "selected by"** | product detail page/component (locate first), its data hook | B | Locate + read existing product detail payload: 30 min. Add line + link: 1 hr. **Total: ~1.5 hrs** |
| **G — Your Table state** | `src/components/AccountPanel/LaunchpadView.tsx`, its capabilities-flag source (locate first) | A (needs to know if a contributor row exists) | Locate flag source: 30 min. Thread new flag: 45 min. Tile hint/destination logic: 45 min. **Total: ~2 hrs** |
| **H — Invitation wiring check** | invite-claim handler in `worker/src/index.ts` (different section from B — the platform tea-master invite claim, not the tea-session `/join/:code`) | A | Read current claim flow: 30 min. Pre-create draft row if missing: 1 hr. **Total: ~1.5 hrs** |
| **I — Admin editor updates** | `src/admin/components/ContributorEditorPanel.tsx` | A | Add business_name, gallery upload/reorder, typed links editor. **~3 hrs** (gallery upload UI is the biggest piece — check whether an existing image-upload pattern exists elsewhere in admin to copy, e.g. product images) |
| **J — Dead code deletion** | `src/components/ContributorsDirectory.tsx`, `src/components/ContributorBioPage.tsx`, `src/components/ContributorDrawer.tsx`, `src/data/contributorCollections.ts` (delete all four, remove any now-dangling imports — confirmed zero importers as of 2026-09-19; re-grep immediately before deleting in case another lane's WIP references them) | none — can run first or last, touches nothing else claims | 30 min delete + verify build. **Total: ~0.5 hr** |
| **K — Playwright specs** | `tests/creator-profile-sparse.spec.ts`, `tests/creator-profile-full.spec.ts`, `tests/people-directory.spec.ts`, `tests/article-byline-avatar.spec.ts`, `tests/product-selected-by.spec.ts`, `tests/launchpad-creator-state.spec.ts`, `tests/invite-to-profile.spec.ts` | C, D, E, F, G, H (writes against the finished surfaces) | ~45 min per spec × 7 = **~5.5 hrs**, run last |

**Sequencing**: A blocks B. B blocks C, D, E, F. G and H only need A. I only
needs A. J is independent. K needs everything else done. A reasonable parallel
split for several agents: **A alone first**, then **{B, G, H, I, J} in
parallel** (no file overlap — B touches only the two named handlers in
index.ts, G touches LaunchpadView, H touches a different handler in
index.ts, I touches the admin editor, J deletes four untouched files), then
**{C, D, E, F} in parallel** once B lands (no overlap — four different page
files), then **K last**.

**Total estimate across all lanes: ~28 hours of agent time**, not wall clock
— lanes B/G/H/I/J run concurrently, then C/D/E/F run concurrently, so wall
clock is closer to A (3.5h) + max(B,G,H,I,J) (2.5h) + max(C,D,E,F) (6.5h) + K
(5.5h) ≈ **18 hours** if fully parallelized with no coordination overhead.

## Design must decide

Visual/curation calls only — not implementation:

1. **Directory card image** — always gallery photo #1 by position, or does a
   creator mark one gallery photo as "the card image" separately from its
   position? Affects whether `contributor_gallery_images` needs an
   `is_card_image` flag.
2. **Platform link icons** — what the WeChat/Instagram/website icons look
   like and whether a QR image (for WeChat) displays inline on the profile or
   only on click/hover. The spec says "WeChat (ID plus QR image)" — does the
   QR show by default or does it need a deliberate reveal?
3. **Ordinary-account Your Table state** — given the finding that drafting a
   profile is already ungated, does "ordinary account sees nothing" still
   hold, or should the tile show a lighter-weight "start a public profile"
   nudge instead of literally nothing? This is a curation call about whether
   Adrian wants self-serve profile-starting surfaced at all, independent of
   the invitation-only *publishing* gate.
4. **Pull-quote highlight treatment** — what "briefly highlighted" looks like
   (background wash, underline pulse, border flash) and how long it holds
   before fading, consistent with the no-glow/no-glass visual-taste rules.
5. **Hosting card content** — just "hosting [event name] on [date]," or does
   it carry a photo/location the way the events system already does
   elsewhere? Keep-list says "keep Hosting," not what it looks like.
6. **Sparse-profile floor** — with portrait + one paragraph and every other
   section legitimately absent, what fills the vertical rhythm so the page
   doesn't read as broken/unfinished rather than "intentionally quiet"? (This
   is the same question the fixtures doc's sparse fixture exists to let
   design actually see, not guess at.)

# Design brief — Creator profiles (paste this into Claude Design)

Produced by the `design-brief` skill, 2026-09-19. Rung: **guided** — Teajia
has a written visual guide (`docs/DESIGN_SYSTEM.md`, 1,648 lines, and
`docs/COLOR_RULES.md`) and a shipped reference screen for part of this work.
No screenshot could be captured this pass — the dev server was not running
and booting + verifying one was out of scope for this planning session.
Claude Design should treat the guide below as the only source of visual
values, and the reference screen (named below) as the structural precedent
for the sections that already exist.

---

## What the screen is and who opens it

Two connected public screens on Teajia, a tea e-commerce and editorial
platform:

1. **A creator's profile page** (`/people/:slug`) — a tea master's public
   page. Opened by a customer who read an article, saw a "selected by" line
   on a product, or clicked a name in the people directory. Purpose, in the
   product owner's words: "a profile style. People like myself as an image.
   You can learn about me. You can see my tea selection in the shop. It
   should be interconnected." Phone-first — this is the page that goes in
   an Instagram or WeChat bio.
2. **The people directory** (`/people`) — the "see each other" home, one
   step up. Opened by someone browsing to find a tea master, or from a
   shop's storefront. Should read as a room full of people doing the work
   (pouring, picking, teaching), not a staff-photo wall.

Both screens serve **published creators only**. A creator is invited (not
self-signed-up) and their profile is one thing among several tied together:
the shop they run, the articles they write, the teas they favorite.

## What already exists and must not be re-invented

- **The profile page is already built and shipping a subset of its
  sections**: Masthead, Origin, Now, Inspirations, Words, Elsewhere, Closing
  line. Source: `src/pages/ContributorProfilePage.tsx` (480 lines). Its own
  header comment says six more sections — Pull-quotes, Hands on, Hosting,
  Voice, Pouring today, Where to find them — are "reserved for later waves."
  This brief asks for a redesign that **adds gallery photos, a hosting card,
  and pull-quotes with a jump-to-passage link**, not a rebuild of what's
  there. Read the file itself as the structural precedent — it already uses
  a quiet magazine-issue conceit (a deterministic "issue number," a
  Cormorant section label with a thin top divider, generous vertical rhythm
  via `clamp()`, a Chinese-name font stack for names that carry one).
- **The directory page exists today as a plain alphabetical typeset list**
  (`src/pages/ContributorsIndexPage.tsx`) and needs to become image cards.
  This is the one screen in this brief being asked to change more than it
  keeps — treat the current list as functional precedent for what data it
  shows, not as a visual anchor.
- **The identity fallback already exists and must be reused, not
  redesigned**: `ContributorIdentityMark` — a circular mark with a faint
  seal icon and the person's initials in `font-display`, shown whenever a
  creator has no photo for a given slot. It's already used elsewhere in the
  app; both screens in this brief need it (directory cards with no gallery
  photo, byline avatars with no portrait — though bylines are a different
  lane, not part of this brief).

## Real content — three fixture creators

Full detail and reasoning for each fixture lives in
`todo/plans/creator-profiles-fixtures.md`. Summarized for this brief:

**Sparse — Wei Chen.** Portrait photo, name, role ("Tea Master"), one short
paragraph ("Started sourcing oolong from Wuyi Shan in 2019. Still learning
the mountain every season."). No business name, no links, no gallery, no tea
selection, no hosting, no pull-quotes. **This is the floor the design has to
clear**: a page with almost nothing must still look like a finished page, not
a broken or half-loaded one.

**Medium — Amara Osei.** Portrait, "Osei Tea Imports" as business name,
location line, two paragraphs of origin story, one paragraph on current
focus, one Instagram link, three favorited teas each with a short note, one
unpublished payment method (must not appear). No gallery, no hosting.

**Full — Kenji Tanaka.** Portrait, "Tanaka Tea House," full origin/now/
inspirations/closing prose, three typed elsewhere links (WeChat with a QR
image, Instagram, website), five gallery photos of tea-in-action (pouring,
seated at a tea table, weighing leaves, teaching a gesture, steam off a
gaiwan — never headshots), six favorited teas with notes, two published
payment methods, one hosted upcoming event, one published article with a
pull-quote that links back to its exact passage.

## The point of the screen

The profile page has one job: make a stranger feel they know this person a
little, and hand them three exits — read what they wrote, buy what they
picked, or pay them for tea bought elsewhere. Every section on the page
either deepens the first job or serves one of the two exits. Nothing is
decorative.

The directory page has one job: make it easy and a little delightful to find
a specific person, or to discover one by browsing — cards that show
personality and action, not a staff directory.

## Structure — state this in full; it is not visible in the guide

### Profile page, section order (top to bottom)

1. **Masthead** — portrait, display name, Chinese name (if set, rendered in
   the existing hand-lettered font stack), business name (if set — new,
   sits quietly under the display name, does not compete with it), role,
   pronouns, location line, active-since. A deterministic two-digit "issue
   number" already appears here; keep it.
2. **Origin** (`beginnings`) — prose, only if set.
3. **Gallery** — NEW. 3-5 photos, only if any exist. Should read as a strip
   or loose grid, not a carousel with arrows (no "next" chrome — this is a
   quiet page, not a slideshow app). "People in action" framing, matching
   the directory's photo direction.
4. **Now** (`now_text` + `now_stamp`) — prose, only if set.
5. **Inspirations** — prose, only if set.
6. **Hosting** — NEW. Only if the creator has an upcoming public hosted
   event. A small card: what they're hosting, when. Should feel like a
   single fact stated plainly, not a full event-promo block — the events
   system elsewhere on the site is where someone goes to learn more or RSVP.
7. **Words** — articles they've written, and separately, pull-quotes from
   articles where they're a subject (whether or not they wrote it). A
   pull-quote links to the article scrolled to and briefly highlighting the
   exact passage — the mechanism exists in the data (a per-quote anchor);
   design only the visual moment (how the quote block looks, and what the
   highlight looks like when the reader lands on it in the article, without
   any glow or glass effect — flat color wash or an underline pulse are the
   kinds of options in bounds).
8. **Tea selection** (`profile_favorites`) — 5-8 teas, each with the
   creator's one-line note, linking into the shop. Only if any exist.
9. **Payment** — only if the creator has at least one published payment
   method. A single CTA into the existing payment-chooser flow, not a list
   of methods on this page.
10. **Elsewhere** — typed links (WeChat with ID + QR image, Instagram
    handle, website, other). Only if any exist. **New requirement this
    brief adds**: today these render as bare text links; design needs a
    small per-platform mark (not a generic globe icon) so four links "look
    deliberate" rather than like a plain list. WeChat's QR image needs a
    treatment decision — shown inline by default, or revealed on tap/hover
    (either is fine; note which was chosen).
11. **Closing line** — whatever the creator wrote, or nothing.

Every numbered section above is conditional except Masthead. **A page
showing only Masthead + Origin must still feel complete** — that's the
sparse fixture's job to prove out.

### Directory page

A grid of cards, one per published creator. Each card: an image (a chosen
gallery photo, or the identity-mark fallback if none), name, role or
business name, one short line if there's room. Clicking anywhere on the card
opens their profile. No pagination controls visible if the list is short;
design should still consider what a long list looks like (Adrian runs
several shops, more creators will be invited over time).

## States to design

- **Loaded with real content** — use the three fixtures above; design at
  least the full (Kenji) and sparse (Wei Chen) fixtures explicitly, since
  they're the two ends of the range.
- **Empty section** — not a separate visual state; conditional sections
  simply don't render. Confirm this reads correctly by looking at Wei Chen
  next to Kenji Tanaka side by side.
- **Directory with zero photo** — a creator card falling back to the
  identity mark; should not look like an error or a missing image.
- **Error / not found** — a published-only route; visiting an unpublished
  or nonexistent slug is a 404-equivalent. Follow whatever the site's
  existing not-found pattern is rather than inventing a new one (not this
  brief's job to specify further — flag if none seems to exist).

## Project's own prohibitions (from `docs/DESIGN_SYSTEM.md` §1 and
`docs/COLOR_RULES.md`, universal, non-negotiable)

- No horizontal scroll at any width, including 390px mobile.
- No white — no `#fff`, no `rgba(255,255,255,*)`, anywhere, including
  borders and glows. Warm-bronze tones only.
- No raw pixel font sizes for the named UI scale values (8–28px named
  sizes); use the existing `text-ui-N` scale.
- No decorative color outside the semantic palette (gold = primary/accent,
  leaf-green = success only, terracotta = error only — nothing else is a
  UI color).
- Every tappable element needs at least a 44×44 effective tap area.
- One typography system: display serif for headings, Lora for body, Plus
  Jakarta Sans for UI/metadata, IBM Plex Mono for numerics. No new fonts for
  "just this one component."
- Cancel-left, primary-right on any modal or form footer this work touches.
- Light and dark mode are equal citizens — nothing hardcoded, everything
  through the existing CSS variable tokens.
- No icons/emoji/glyphs as generic decoration — if a per-platform Elsewhere
  mark is used, it should be a considered, minimal mark (in the spirit of
  the existing `Icons.Seal` used by the identity-mark fallback), not a
  generic icon-font glyph dropped in casually.
- No gamification, streaks, or engagement nudges anywhere.

## Attachments to bring into Claude Design (priority order)

1. **`docs/DESIGN_SYSTEM.md`** — the full written visual guide: color
   tokens (light + dark), typography scale, spacing, z-index scale,
   component recipes. This is the only source of visual values for this
   brief; nothing here should be guessed against Teajia's general "tea,
   editorial, warm" reputation instead of these exact tokens.
2. **`src/pages/ContributorProfilePage.tsx`** — the shipped profile page
   source. Structural precedent for the sections that already exist
   (section-label styling, the issue-number conceit, prose-paragraph
   handling, the closing-line treatment). Read as code, not a picture — no
   screenshot was captured this pass; if Adrian wants to hand over an actual
   screenshot, the route to capture (once a fixture like Wei Chen exists in
   a running sandbox) is `/people/wei-chen`.
3. **`docs/COLOR_RULES.md`** — the ten safe tokens and the explicit
   banned-alias list, shorter and more actionable than DESIGN_SYSTEM.md's
   color section for a quick color-only check.
4. **`todo/plans/creator-profiles-fixtures.md`** — the full fixture detail
   (exact placeholder image URLs, exact copy) if Claude Design wants to work
   from real pixel content rather than the summarized version above.
5. **`src/pages/ContributorsIndexPage.tsx`** — the current directory list,
   for the data it already surfaces (not its visual layout, which this
   brief is asking to replace).

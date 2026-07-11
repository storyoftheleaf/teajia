# Build Sprint — April 2026

A record of everything designed, decided, and built in this session.

---

## Strategy Work

- Defined 10 audience personas (PERSONAS.md)
- Audited what Teajia offers each persona and where the gaps are (OFFER_AND_STRATEGY.md)
- Created a ranked list of 30 development priorities, easiest to hardest (DEVELOPMENT_PRIORITIES.md)

---

## Built This Sprint

### Already Done (discovered, not rebuilt)
Newsletter wired to API, "Send Inquiry" label, share button on product cards, NetworkStatus banner, SessionExpired notice, URL-backed product modals, price-per-gram display, stock level indicators — all already implemented in recent development.

### Tier 1 + 2 — Fixes and Small Features
- **Gathering type label** on public event pages — shows "Private Tasting", "Workshop", etc.
- **Snake/camelCase bug fixed** in EventLanding — several fields were silently undefined at runtime
- **B2B inquiry page** at `/for-your-space` — for hotels, studios, retreat centers. WhatsApp inquiry form. Linked from ConsultPage.
- **Post-session guest experience** at `/event/:slug/recap` — teas served, purchase links, host notes, personal note (localStorage). New public Worker endpoint.

### Tier 3 — Meaningful Features
- **Start Here page** at `/start` — 6 entry paths for new visitors. Quiet link added to homepage.
- **Gift sets** — 5 new sets in the Shop Sets tab: Dark Tea Sampler, The Journey of Flavor, Tea with Chi, The Starter's Pack, The Entry Set. Placeholder product IDs need to be replaced with real inventory IDs.
- **Brewing QR sticker** — `BrewingQRCard` component. Compact (label printer) and full card modes. WhatsApp share built in. Shows inside AlcoveCard for tea products. Points to `/learn/brew/:teaType`.
- **Barry contributor profile** — Added to `src/content/people.ts`. Wires automatically into magazine article attribution.
- **Tasting Journal view** in AccountPanel — shows CustomerTasting history, sync indicator.
- **Spaces page** at `/spaces` — 3 Bali locations (2 home tea rooms, art studio). WhatsApp inquiry per space. "Our spaces" link in desktop sidebar. Designed to scale when operators join.

### Magazine Editor (major feature)
- **D1 articles table** — migration `worker/migrations/031_articles.sql`
- **9 Worker API routes** — full CRUD + publish/unpublish, public + admin endpoints
- **Admin editor** at `/admin/magazine` — article list, full block editor, Smart Paste system
- **Smart Paste workflow** — paste Claude-structured content, auto-parses into typed blocks

---

## Decisions Made

| Decision | Rationale |
|---|---|
| No Anthropic API in Worker | Adrian uses Claude.ai subscription for article structuring. No token cost. |
| Event discovery feed — removed from near-term roadmap | Events flow through WhatsApp groups. Not enough volume for a discovery page yet. |
| Magazine contribution pipeline — deferred | Adrian is the sole author. Interviews → Claude.ai → paste into editor → publish. |
| Collection tracking = MyCollection (already built) | The favorites system covers home practitioner needs. No separate home inventory needed. |
| Journal in AccountPanel, not a separate page | Personal, quick-access, mobile-first. Sync infrastructure was already built. |
| Network map = Spaces page, manually seeded | 3 Bali locations as seed. Structured to pull from DB when multi-account ships. |

---

## Pending (in TODO.md)
- Replace gift set placeholder IDs with real product IDs
- Run `031_articles.sql` migration in production D1 before using magazine editor
- Add Barry's photo and last name when available
- Write ~20 brewing profiles for `/learn/brew/:teaType` pages (Adrian approves)
- Magazine template reference — find 1–3 examples of the quality/feel you're aiming for
- Published articles need to appear in the public `/read` feed (one more agent away)
- Tier 4 items: personal journal detail view, collection enhancements, multi-account infrastructure, wholesale catalog

---

## The Paste Format for Magazine Articles

When structuring articles in Claude.ai, use this prompt:

> "Structure this interview/transcript as a Teajia magazine article. Output in the Teajia paste format: start with TITLE: / SUBTITLE: (optional) / AUTHOR: (if known), then content sections separated by ---. Use INTRO for the opening paragraph, SECTION: heading for each section, QUOTE: 'exact text' for pull quotes, IMAGE: description + CAPTION: text for photos. Tone: elevated but grounded, not pretentious. Preserve quotes exactly. 600–1200 words."

Then paste the output into `/admin/magazine` → New Article → Smart Paste → Parse into blocks.

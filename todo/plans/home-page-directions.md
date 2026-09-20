# The home page: four directions

> Written 2026-09-20 by Fable, from four agent surveys (public routes, signed-in surfaces, home page history, the live site and API). The question Adrian asked: the page is nice to land on, but is it the best use of the landing. Keep it classy, keep it functional, let people know what is happening. The pillar this judges against: [docs/PILLAR.md](../../docs/PILLAR.md).

## What the surveys settled before any design

- **The page is good and scored 8 of 10 for feel in the September audit.** It says who Teajia is and hands the visitor four doors. Nothing on it is broken.
- **It has already refused two kinds of "what's happening".** April 2026: live previews under the four lines (featured tea, latest article) were reverted in two days as "a sales dashboard". Same week: a third act listing network stores was built and stripped. Any new direction that puts data under the grounding lines is re-proposing a rejected thing.
- **There is very little happening to show, today.** Measured on the live API on 2026-09-20: 0 upcoming sessions, 5 articles all published in one batch, 1 space, 1 tea master, 1 shop collection named Featured with no product flagged, and products carry no public date so "new arrivals" cannot be computed without a worker change. A live block would render empty. Whatever says "what's happening" has to be written by a person, or wait.
- **The real hole is reachability, not content.** Sessions, People, Tea Wisdom and Spaces have no path from the mobile nav, and the footer that links them is hidden on the home page. A newcomer's path cards at `/start` are linked from nowhere. A visitor who lands and does not scroll cannot find the calendar, the people, or the reference.
- **Two recorded rules are currently broken on the live page.** The memory says "stay connected" and "it's nothing without you" sit below the email field; the code puts them above. "New here? Start here" scrolls to the brand story instead of opening the start page that exists for it.

## The four, ranked

Recommendation first. Each one obeys the locked rules: the four lines keep their words, font, case and size; characters equal and bronze; no feed, no icons, no white, no scroll hijack, no footer on home, the work owns the viewport.

### 1. As is, refined, plus the doors that are missing (recommended now)

**What changes.** Nothing above the fold. At the very end of act two, after the email field, one quiet hairline row in the grounding-line voice: *sessions · people · tea wisdom · spaces · about*. Body font, sentence case, dim until hover, each a real link. Then the fixes the surveys found: the two "stay connected" lines move below the field as recorded; "New here? Start here" opens the start page and the start page gets its seven cards checked; the seven dead props come out of the component; the home entry stops eagerly importing seven full pages (1.3 MB today, which is the first thing a phone on a Bali connection downloads); the newsletter endpoint gets the rate limit the audit flagged; the stale site-map line gets rewritten.

**Why consider it.** The page already does the one thing a landing must do for this brand: it says what Teajia is in a voice nothing else on the web has, and it hands over four doors. The vision document itself says the brand is the tea and the technology should not perform. Every missing surface becomes reachable with one row of five words that a scrolling visitor earns, which is exactly how the rest of the page treats attention. It costs an afternoon, touches no data, and breaks no test.

**Why not.** It does not answer "what is happening". It assumes the calendar will stay quiet, which is true today and may not be in a month.

### 2. The notice: one dated sentence, in Adrian's hand

**What changes.** Under the four grounding lines, a single line of body italic, dim, that reads like a note left on a door: *Saturday, a shou session in Penestanan. Four seats.* One link. Behind it, one field in Manage (account settings, "the front door line", with an optional link and an expiry date). Empty means the line does not render and the page is exactly what it is now. The worker gains one small table or one column on the account, and a public read.

**Why consider it.** It is the only form of "what's happening" that survives the April revert, because it is not a widget reading data; it is a sentence a person wrote, the same material as the headline. It is honest about the site's stage: with zero events and one batch of articles, a hand-written line is the truthful signal and it can point at anything, a session, a piece, a tea that just landed, a closure over a travel week. It gives the page a pulse without a feed, and it gives Adrian a reason to touch the front door weekly. It composes with direction 1; the two together are my actual recommendation if he wants the page to say something time-bound.

**Why not.** A line nobody updates goes stale in public, which is worse than silence; the expiry date exists for that, but the habit is his. Bronze is scarce on this page, so the line must stay dim and the link must be the only accent, or the hero loses its one focal point.

### 3. On the table: the middle act becomes the shelf, the page, the seat

**What changes.** The character reveal moves to the end (or to About), and the second act becomes three full-bleed editorial scenes, one per scroll: **the tea on the table** (one tea from the Featured collection, its origin line, its price), **the piece to read** (one article, its first sentence), **the next seat** (the nearest published session, or, when there is none, the line "The next session is not yet set. Sessions are announced here."). Each scene is one image or one tone field, one headline, one link. Chosen by hand: the Featured collection, a "front page" flag on an article, and the events table as it stands. This is the magazine-forward home the vision describes for Adrian's own store.

**Why consider it.** It makes the landing do work for the returning visitor, who is the person the vision is built around: attend, read afterwards, buy what you tasted, come back. It turns the site's three best assets into the first impression instead of hiding them behind a word. Done as scenes rather than cards, with one item each and no counts, it is cinema rather than dashboard, and that is the distinction the April revert did not have.

**Why not.** It is the closest of the four to what was rejected, and only the treatment separates them; if the scenes ever grow a second item they become the sales dashboard again. It needs the data Adrian does not have today: a flagged tea, a flagged article, a scheduled session. Built now it would show one tea, one of five identical-dated articles, and the "not yet set" line. And it is the largest build, roughly a week with the worker changes and the images.

### 4. The map: the four doors open on the page

**What changes.** The hero stays. Below it, each of the four words becomes its own full-height scene as you scroll, in the order of the grounding lines: Source shows the shop's line ("Sourced by hand, one lot at a time.") and a count of what is on the shelf; Discover shows the four pieces by title; Deepen shows the six courses by name; Create shows the three services. Every item is a link, nothing is an image, nothing is a card. The brand story and the email field close the page as they do now. The missing doors (sessions, people, wisdom, spaces) sit as a row inside the scene they belong to.

**Why consider it.** It answers the survey's real finding, that a visitor cannot see how much is behind the four words, without adding a single time-bound element. It is the most "self-explanatory on first encounter" of the four: a stranger scrolls once and has seen the whole house. It uses only what is already live and static, so it cannot render empty.

**Why not.** It is the longest page and the least poetic; the current page earns a scroll with a reveal, this earns it with an index. The audit already faults the home bundle for eagerly loading other pages, and this direction pulls their content onto the landing on purpose. And it says nothing about now: it is a table of contents, not a notice.

## My call

Do 1 now. Add 2 the week there is something to say, because 2 is a field and a sentence, not a surface. Hold 3 until there are three things to put on the table at once, then revisit with the data in hand rather than in prospect. Keep 4 as the fallback if 1 proves the doors row is not enough.

## What each costs, so the choice is real

| Direction | Touches | Data needed | Rough size |
|---|---|---|---|
| 1 Refined | one component, one route, one worker rate limit | none | an afternoon |
| 2 Notice | one field in Manage, one worker read, one line on home | Adrian writes it | a day |
| 3 On the table | second act rewritten, worker exposes a front-page flag, images | a flagged tea, a flagged article, a session | about a week |
| 4 Map | four scenes, static content | none | two to three days |

Next step once a direction is chosen: render it, not describe it. Three structurally distinct renderings on one page is the rule for visual options, and none of the above has been rendered yet.

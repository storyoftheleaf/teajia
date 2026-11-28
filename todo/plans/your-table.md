# Your Table: the person's own table, as a real place

> Original account grouping and return-navigation decisions. The [current delivery plan](../../docs/CONSOLIDATED_DIRECTION.md) determines which work proceeds.

Status: proposal, 2026-11-25. Nothing built. It waits on Adrian's yes in [docs/SECTIONS.md](../../docs/SECTIONS.md), decision 6.

> **Revised 2026-11-25, second pass.** Your Table also gains two doors from [guests-and-tea-masters.md](guests-and-tea-masters.md): "Host a table" and "add your table" (private, area only), and favourites in three kinds (articles, shop teas, Tea Chest teas).
>
> **Build order, 2026-11-26.** This plan is built in Launch 3 for "Host a table" (L3-02) and Launch 4 for the page itself (L4-04, L4-08) of [guests-and-tea-masters-build.md](guests-and-tea-masters-build.md). Nothing here starts before the launches ahead of it have been used by real people.

## What it is

Your Table is everything that is yours on Teajia: what you tasted, what you photographed, what you own, what you want, what you ordered, where you have been, the page other people see, and the tea houses you belong to. It is the private half of the Tea Table. You keep things here. The ones you choose to share are seen there.

## What exists already

- The person glyph on the phone bar and in the rail's foot, labelled "Your Table".
- An overlay panel (`src/components/AccountPanel/`), opened by the glyph or by `/account`. Signed out it shows a reader view with Discover, Read, Shop and Find a Table. Signed in it shows a launchpad of tiles: journal, sessions, remember, Tea Chest, discover, profile, orders, journey, and for some people switch, manage, tea atlas, library and fixes.
- Panel views inside the overlay: journal, Tea Chest, sessions, the table switcher ("Your Tea Houses").
- Full pages beside it: `/account/journal`, `/account/collection`, `/account/cellar`, `/account/collections`, `/account/journey`, `/account/settings`, `/account/profile`, `/account/orders`, `/account/samples`.
- The rule from the pillar that the four personal records stay separate: Journal is what you tasted and thought, Favourites is what you want, Tea Chest is what you own, Journey is where you have been.

## What is wrong with it today

- The panel is not a place in the address. Its inner views are not steps you can go back through, and closing it from `/account` sends you to the home page.
- Journal and Tea Chest each exist twice, once as a panel view and once as a page.
- The tiles are a flat grid of up to thirteen. Nothing says which are your tea, which are your record and which are your houses.
- Nothing on it says what you have shared and what is private.

## Decisions proposed (each needs Adrian's yes)

1. **Your Table becomes a page at `/account`.** The same glyph opens it. On a phone the panel was already a full sheet, so the look barely changes; what changes is that it is a real address and back works.
2. **It is not a bar word.** The glyph is its door, on the bar and on the rail, as now.
3. **Every tile keeps its word.** No label changes. The tiles are grouped under five quiet headings:

   | Group | Tiles | Where each goes |
   |---|---|---|
   | On your table | journal | `/account/journal` |
   | Your tea | Tea Chest, remember, orders | `/account/cellar`, `/account/collection`, `/account/orders` |
   | Your path | sessions, journey, discover | `/account/sessions` (new address for the panel view), `/account/journey`, `/discover` |
   | Your page | your public page, profile | `/people/:slug`, `/account/profile`, `/account/settings` |
   | Your tea houses | switch, manage | `/account/tea-houses` (new address for the switcher), the Manage door |

   Tea atlas, library and fixes stay for the few people who have them, under a last quiet group.
4. **One plain line of share state on each tasting in the journal:** private, on your page and the Tea Table, or offered to Teajia. Tapping it opens the existing Share step. No counts.
5. **The four records stay separate.** Journal, Favourites, Tea Chest and Journey do not merge. Grouping tiles is not merging records.
6. **Signed out, `/account` is the reader view it is today,** with its explore links updated to the new sections once the bar changes.
7. **The Tea Chest keeps its address** until Adrian makes a route decision, as the closeout plan says.

## How it relates to the Tea Table

- Nothing leaves Your Table without a tap. Private is the default, as the family plan decided.
- Sharing a tasting puts it on your page and on the Tea Table together.
- "Remove from my page" takes it off both. Your own copy stays in your journal.
- Your page (`/people/:slug`) is your corner of the Tea Table: the same items, only yours.

## Build stages

Changes here touch `src/components/AccountPanel/` and routing in `src/App.tsx`, so `npm run test:mobile` runs before pushing, and each stage is walked in the sandbox signed out, as a member, and as someone with a Manage room.

1. **The page.** `/account` renders the launchpad as a page with the five groups. The glyph navigates to it. Closing is simply going back.
2. **One copy of each view.** The panel's journal and Tea Chest views give way to their pages. The sessions view and the switcher get their own addresses.
3. **Share lines.** Each journal tasting shows its share state and opens the Share step.
4. **The panel retires.** The overlay code and its duplicate views are removed once nothing opens them. `src/components/AccountPanel/INDEX.md` and the pillar are brought into line in the same commit.

## Not building

- Streaks, tasting counts shown as achievement, levels, badges, or a "year in tea".
- A merged timeline of journal, favourites, chest and journey.
- Reminders or nudges to taste, post or come back.
- A second tasting screen. The one tasting screen stays the only one.
- New tile names. Any label change is a separate question to Adrian.
- A separate Connections page inside Your Table. People are under the Tea Table and places are under Tea Houses. See [connections-page.md](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/todo/plans/connections-page.md).

## Open questions

- Whether the desktop keeps a small quick-look drawer from the glyph as well as the page. Recommendation: no, one surface.
- Whether "sessions" on Your Table shows only your own seats, or also the next public sessions. Recommendation: your own, with one line leading to the Tea Table's Sessions view.

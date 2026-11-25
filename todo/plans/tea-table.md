# The Tea Table: what people put on the table, in one place

Status: proposal, 2026-11-25. Nothing built under this name. It waits on Adrian's yes to the words in [docs/SECTIONS.md](../../docs/SECTIONS.md) and to the rule exception proposed in `CLAUDE.md`.

> **Revised 2026-11-25, second pass.** The Tea Table is step 3 of the loop in [guests-and-tea-masters.md](guests-and-tea-masters.md): what guests put on the table after a session or a tasting at home. Its stages now come after the session invitation and the one-screen "after the sit", and the quick rule there applies: it is never linked from a screen meant for the table.

## What it is

One public page where a visitor sees what the people of Teajia have put on the tea table lately: a tea someone tasted, with their words and photographs, and a session someone poured. Newest first. Around it, under the same word, sit the sessions calendar and the people.

It is the public face of things that already exist. A member tastes a tea and shares it to their page (the family plan). A host publishes a recap of a sit (the connected sit work). Today those live on separate pages that a visitor has to know to look for. The Tea Table puts them on one table.

## Adrian's words so far

- 2026-11-25: "we're including the new tea table, which should be the feed of people putting stuff on the tea table."
- 2026-11-24, from the closeout plan: "Let's not call it a T-Feed." That governs the name. The same note says to keep "the wider idea of things on and around the Tea Table, with deliberate posts, events and useful connections to Craft and Read."
- 2026-11-24, same plan: "Let members publish a recap of a casual sit and let guests share photos just with the people who were there. Then show me the whole thing connected from the profile."

## Decisions proposed (each needs Adrian's yes)

1. **The name is the Tea Table.** Never "feed", "Tea Feed" or "Brewing experiences" on the site. The address is `/tea-table`.
2. **Time order is the whole of it.** Newest first, grouped by day. No ranking of any kind.
3. **Only what people chose to share.** Nothing is posted for anyone. A tasting appears because its author tapped share. A recap appears because its host published it.
4. **Two kinds of item to begin with**, both already built:
   - A shared tasting: the person, the tea, their words, their photographs in the shape they chose. Never the score, as the family plan decided.
   - A poured session: a published recap of a hosted session or a casual sit, with its teas and lead photograph.
5. **Only Teajia teas for tastings**, as the family plan decided. A session may pour a Tea Chest tea, as the connected sit already allows.
6. **One share choice, not two.** The Share step after saving a tasting says "Share to my page and the Tea Table". Things shared before that wording do not appear here unless shared again.
7. **No review queue for family items.** They appear when shared, as family pages do. The guards are the ones the family plan set: confirmed email, the daily limits, a report line, and the owner's one-tap hide. Tea masters keep their approve gate for their pages.
8. **Taking things off.** "Remove from my page" takes an item off the Tea Table too. The owner's hide takes it off everywhere at once.
9. **What you can do from an item:** open the tea, open the person, open the tasting or recap, add your own tasting of that tea. Nothing else.

## What exists already

- `/tea-feed` renders `TeaFeedPage` (`src/pages/TeaFeedPage.tsx`), titled "Brewing experiences", which shows `SessionCards` (`src/components/sessions/SessionCards.tsx`): published hosted recaps and public casual sits merged into one list, newest first. This is the Tea Table's first form.
- It is switched off by `BREWING_EXPERIENCES_OPEN = false` in `src/lib/brewingExperiences.ts`, "built but not approved by Adrian yet". The same switch governs a guest's consent to that placement (`brewingConsent`).
- The family work: the one tasting screen with camera and voice notes, the Share step, a page for anyone at `/people/:slug`, the people list with its quiet order, Guest notes for offered photographs, the one-tap hide, the report line. See [teajia-family.md](teajia-family.md).
- The shared parts to reuse: `TeaCard` for an item, `Photographs` for thumbnails and zoom, the one photo editor for any crop.
- The closeout plan (on Adrian's Mac, `todo/plans/teajia-closeout-2026-11-24.md`) records the connected sit and Guest Book release, and links two Tea Chest and Tea Table plans (`todo/plans/tea-chest-tea-table/gaps-plan.md` and `buildout.md`) on branches that are not on GitHub today. They were not read for this plan. Find them and reconcile before stage 2.

## The three views

| View | Address | Notes |
|---|---|---|
| On the table | `/tea-table` | The stream. One quiet line at the top names the next session when there is one. "Earlier" at the foot is a step in the address (`?before=<date>`), so back returns to where you were |
| Sessions | `/events` | Unchanged. Coming sessions and past recaps |
| People | `/people` | Unchanged. The family list as it works today |

A refinement, All, Tastings or Sessions, lives in the address as `?show=` and replaces the history entry.

When the stream is empty it says so in one plain line and shows the next session and the people. It never shows made-up items.

## Build stages

Each stage ends with lint, `lint:colors`, the unit tests for what it touched, and a walk in the sandbox at phone width.

0. **The yes.** Adrian confirms the name, the address and the rule exception.
1. **The page under its name.** `/tea-table` renders the three views. On the table shows what `SessionCards` shows now. `/tea-feed` forwards. The switch and its consent helper are renamed to match. Reached from the home strip and the menus. No bar change.
2. **Gates before members' tastings appear.** The closeout plan names them and they stand: consent of anyone pictured, account deletion and export, media and reporting limits, and withdrawal that clears every place a photograph is shown, including the direct file address. The lawyer's read of "How we use photographs" from the family plan belongs here too.
3. **Tastings join.** One public worker route, in a new module, lists shared tastings with tenancy and the hidden flag respected. The Share step takes the new wording. The item card is `TeaCard` with the person, the words and the photographs.
4. **The owner's hand.** Hide and restore for any Tea Table item in Publish, Guest notes, and the one-tap hide on the item itself for the owner. The report line on each item.
5. **Connections.** The home strip of the latest three. A person's page links to their items. A tea's page links from a family photograph to that tasting.
6. **The bar word**, as stage 4 of [docs/SECTIONS.md](../../docs/SECTIONS.md), if Adrian chose it.

## What "done" looks like for the first form (stages 1 to 4)

1. A signed-out visitor opens `/tea-table` and sees real items, newest first, with no number on any of them.
2. An old `/tea-feed` link lands on `/tea-table`.
3. A member shares a tasting and it is on the Tea Table at once, with their name and no score.
4. They remove it from their page and it is gone from the Tea Table.
5. The owner hides an item in one tap and restores it in one tap.
6. A visitor reports an item and the report reaches the owner.
7. Back and forward walk through "Earlier" pages and views without losing place.
8. Nothing anywhere on the page counts, ranks, or notifies.

## Not building

- Likes, hearts, reactions, comments, replies, reposts.
- Follows, followers, "people you follow", friend lists.
- Counts of anything: views, items, photographs, people, days.
- Streaks, badges, levels, "most active", "trending", "popular".
- Ranking or recommendation. No "for you". The people list keeps its one quiet exception and the Tea Table has none.
- Notifications, emails or nudges about activity. No "new since your last visit".
- Posting for anyone. No automatic items from orders, stock or sign-ups.
- Shop arrivals and magazine articles in the stream. Those belong to Shop and Read.
- An endless scroll that hides the footer. "Earlier" is a button.
- Share buttons to outside networks, and any live feed from Instagram.
- Free posts with no tea and no session. Revisit only after the first form has real use.

## Open questions

- Whether a Tea Chest tea from outside the shop may ever carry a public tasting. Today the answer is no (family decision 8).
- Whether a hosted tea house's own sessions and tastings appear on the main Tea Table or only on its storefront. Recommendation: only houses that opted into the public directory, the same rule the sessions directory already uses.

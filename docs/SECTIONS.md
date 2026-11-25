# Teajia sections: the proposed overhaul

> **Status: proposal, 2026-11-25. Nothing here is built and no navigation word has changed.** Adrian asked for a section overhaul that brings in the Tea Table, Your Table, tea houses as an offering, and every other section. This is the one map of that. The site as it runs today is described in [PILLAR.md](PILLAR.md). Nothing in this file is to be built until Adrian says yes to the words in "Open decisions".

Plans that hang off this file: [tea-table.md](../todo/plans/tea-table.md), [your-table.md](../todo/plans/your-table.md), [tea-houses.md](../todo/plans/tea-houses.md). Where every other plan sits: [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md).

## The whole thing on one screen

The pillar already says what Teajia is for: a place to source tea, study it, and share it with the people who gather around the cup. Add the thing Adrian has always done and the site never showed properly, building the rooms where that happens, and the site has four jobs. One word each.

| Section | Word on the bar | What it is | Who it is for | Routes | What it replaces |
|---|---|---|---|---|---|
| **Read** | read | Everything you study: the magazine, Craft (how to make and serve tea), and Tea Wisdom (the reference) | Readers, learners, anyone looking something up | `/read`, `/article/:slug`, `/craft`, `/wisdom/*` | Read and Craft as two words, and Wisdom with no door on desktop |
| **Tea Table** | table | What people have put on the tea table, newest first: tastings, photographs, notes, sessions poured. With it, the sessions calendar and the people | Family members, guests, visitors who want to see the life of the place | `/tea-table`, `/events`, `/event/:slug`, `/people`, `/people/:slug` | The switched-off `/tea-feed`, Sessions and People hidden in menus |
| **Tea Houses** | houses | Building a tea house with Adrian, the houses already built, the houses you can visit, and working with Adrian in general | Founders, hotels and retreats, tea masters with a room, travellers looking for a table | `/tea-houses`, `/tea-houses/build`, `/tea-houses/work`, `/tea-houses/visit`, `/store/:slug`, `/advise` | Advise as a word, `/for-your-space`, `/spaces`, `/find-a-table`, the gated portfolio |
| **Shop** | shop | Tea and teaware, by inquiry | Buyers and collectors | `/shop`, `/shop/product/:id` | Nothing. Stays as it is |
| **Your Table** | the person glyph | Your own table: journal, photographs, Tea Chest, favourites, orders, journey, your page, your tea houses | Anyone signed in | `/account` and `/account/*` | The overlay panel. Same door, a real page behind it |
| **Manage** | manage (staff only) | The seven working rooms | Adrian, shop owners, staff | `/admin/*` | Nothing. Seven rooms stay |

The bar and the rail stay four words, in the same slots as today: **read, table, (emblem), houses, shop**. Table takes Craft's place and houses takes Advise's. The rail's foot becomes exactly the "Narrow B" drawing Adrian picked on 2026-11-25: search, account, bag, and manage for staff. People and Places leave the foot because each now lives under a word.

Three words to hold apart from now on:

- **Table** is people. The Tea Table is everyone's, Your Table is yours.
- **House** is a place. A tea house is a room with an owner, and on Teajia it is an account.
- **Session** is a time. People sit at a table, in a house, at a session.

## Why this shape

1. **Four jobs, four words.** Study it (Read), share it (Tea Table), build the place for it (Tea Houses), source it (Shop). Each word is one answer to "why am I here".
2. **The live things get a door.** The pillar says sessions are "the one genuinely time-bound thing the site has and the desktop nav does not show it." People are in the rail's foot. The Tea Table gathers the living side of the site under one word.
3. **The offering Adrian cares about stops being a row in a list.** Today "Tea House Design & Curation" is one of three service rows on Advise, and its portfolio is switched off. It becomes the centre of its own section.
4. **Three thin study sections become one full one.** Read has five live pieces. Craft is a course, a glossary and guides waiting to be written. Wisdom is large but has no desktop door. Together they are a library. Apart they are three half-empty rooms, and finished essays already appear in both Read and Craft.
5. **It matches where Adrian was already heading.** The closeout plan of 2026-11-24 says to "decide whether and where a public Tea Table destination earns a place" and to "review what happens to Craft on phone and desktop". This file is that decision written out.

## Section by section

### Read

**What it holds.** Three shelves, three addresses that do not change:

- **Stories** at `/read`: the magazine, the long reads, and articles at `/article/:slug`.
- **Craft** at `/craft`: the course, glossary, journeys, reading and listening, brewing guides when written.
- **Wisdom** at `/wisdom`: cultivars, regions, producers, marks, styles, named teas.

**What changes.** The word "read" lights for all three. Each shelf's page carries the same small row of three shelf names at the top, so a reader on the magazine can step to Craft or Wisdom in one tap. Craft keeps its landing, its address and everything in it. It stops being a bar word and becomes the second shelf of Read.

**Small tidying inside it.**

- Craft has a view called "Shared Wisdom" (`/craft?v=wisdom`) that is not Tea Wisdom. One of the two names should change. Recommendation: rename the Craft view, since Tea Wisdom is the bigger thing. Adrian picks the word.
- Craft's "Tea Spaces" view (corners and rooms at home) stays, and gains one line at its foot leading to Tea Houses for when the corner becomes a room.
- `/read/craft` is an article about a pot and `/craft` is a shelf. Leave both; it is only a naming coincidence.
- The private Tea Atlas stays private and out of the navigation.

**Plans that live here.** Editorial track 1, the magazine TODO lines, [brewing-guides.md](../todo/plans/brewing-guides.md), the four Tea Wisdom plans, [TEA_WISDOM_BASE.md](TEA_WISDOM_BASE.md), [TEA_ATLAS.md](TEA_ATLAS.md).

### Tea Table

**What it is.** One public page, newest first, of what people have chosen to put on the tea table. Adrian's naming rule from 2026-11-24 stands: "Let's not call it a T-Feed." On the site it is only ever "the Tea Table".

**What is on it.** Only things that already exist in the family and sessions work:

- A tasting someone shared: their words, their photographs, the tea (linked to its shop page), their name (linked to their page). Never the score.
- A session someone poured: a published recap of a hosted session or a casual sit, with its teas and lead photograph.

**Three views under the one word.**

| View | Address | What it shows |
|---|---|---|
| On the table | `/tea-table` | The stream. A quiet line at the top names the next session when there is one |
| Sessions | `/events` (unchanged) | What is coming, and recaps of what was poured |
| People | `/people` (unchanged) | The family, as the people list works today |

**How it stays Teajia.** Time order is the whole of it. No likes, no comments, no follows, no counts of any kind, no streaks, no ranking, no "for you", no notifications, no "new since you were here". A person can take their own item off. The owner can hide any item in one tap. What you can do from an item: open the tea, open the person, open the tasting or recap, add your own tasting of that tea. That is all.

**Where it comes from in the code.** `/tea-feed` (`TeaFeedPage`, titled "Brewing experiences", behind `BREWING_EXPERIENCES_OPEN = false`) already lists published hosted recaps and public casual sits together, newest first. That is stage one of the Tea Table under an old name. It becomes `/tea-table` and `/tea-feed` forwards to it.

Full plan: [tea-table.md](../todo/plans/tea-table.md).

### Tea Houses

**What it is.** The section for places. It answers four questions, in this order:

| View | Address | The question it answers |
|---|---|---|
| Overview | `/tea-houses` | What is a Teajia tea house, and what can I do here |
| Build | `/tea-houses/build` | I want one. What happens, in what order, and how do I start |
| Work | `/tea-houses/work`, `/tea-houses/work/:slug` | Show me ones Adrian has built |
| Visit | `/tea-houses/visit`, then `/store/:slug` | Where can I sit down at one |

`/advise` stays as "work with Adrian": his biography, sourcing for a collection, sessions and guidance, sourcing journeys, the testimonial, the inquiry. It is reached from Tea Houses, from Sessions, from Shop and from About. Its design row points into `/tea-houses/build`.

**What it gathers that is scattered today.**

- The Advise design service and its guided inquiry.
- `/for-your-space` (hotels, studios, teams), which becomes one of the kinds of build.
- The portfolio, switched off in Advise since it was written, which becomes Work.
- `/spaces` and `/find-a-table`, two directories of the same network, which become Visit.
- `/store-launch-playbook`, which becomes the opening step for a house that is joining.
- The multi-store accounts: a finished house gets an account, a storefront, stock, sessions and a place in Visit.

**How it connects to the rest.** Teaware and the starter tea menu come from Shop and the network catalogue. Training starts from Craft's course. Opening sessions run through Sessions and appear on the Tea Table. The house's people appear under People. Its story can run in Read.

Full plan, including the stages of the offering: [tea-houses.md](../todo/plans/tea-houses.md).

### Shop

Stays as it is: the catalogue, by inquiry, every order a conversation. Three small connections are added, none of them a rebuild:

- "Ask Adrian to find a tea" (today's "For a Collection" row on Advise) gets a door in Shop, next to the existing "Inquire about purchasing more".
- A tea's page already shows family photographs in one row. Each can lead to that person's tasting on the Tea Table.
- Teaware gets one line leading to Tea Houses for someone fitting out a room.

The names around collections are tangled (`/collection`, `/c/:slug`, `/account/collection`, `/account/collections`, `/u/:slug`). That is worth a tidy one day. It is not part of this overhaul.

### Your Table

**What changes.** Today Your Table is an overlay panel. It has no address of its own steps, closing it from `/account` sends you home, and two of its views (journal, Tea Chest) exist a second time as pages. It becomes a real page at `/account`, with the same person glyph as its door on the bar and the rail. Back and forward then work the way they must everywhere.

**What is on it, in five groups.** The tiles and their words stay; they are only grouped:

| Group | Tiles |
|---|---|
| On your table | Journal (tastings, notes, photographs), with a plain line on each saying whether it is private, on your page and the Tea Table, or offered to Teajia |
| Your tea | Tea Chest, remember (favourites and collections shared with you), orders |
| Your path | Sessions, journey, discover |
| Your page | Your public page, profile and sign-in |
| Your tea houses | Switch between houses you belong to, and the one "manage" door |

**How it relates to the Tea Table.** Your Table is where you keep things. The Tea Table is where the ones you chose to share are seen. Nothing moves from one to the other without your tap, and "Remove from my page" takes it off both.

Full plan: [your-table.md](../todo/plans/your-table.md).

### Manage

The seven rooms stay: Curate, Stock, Sales, People, Sessions, Publish, Settings. The Manage rebuild is in flight and this overhaul does not disturb it. Three small additions inside existing rooms, no new room:

- **Publish, Guest notes** gains the hide and restore control for Tea Table items, beside the offered photographs it already reviews.
- **Sales, Waiting** already receives inquiries. Tea house inquiries land there like any other, marked by kind.
- **Settings, Platform** is already where a new account is made. A finished tea house's account is made there.

Not proposed: a "Houses" room to track builds. A build is tracked as an inquiry, a customer and a tag until there are enough at once to need more.

### Home, About and the small pages

- **Home** keeps its plates. Its four grounding lines become the new four. It gains one strip, "On the tea table", showing the latest three items, and the consult plate leads to Tea Houses.
- **About** stays thin and gains links to the four sections and to "work with Adrian". Reached from the phone menu and the footer.
- **Discover** (`/discover`) stays, linked from home and Your Table.
- **Start** (`/start`): nothing links to it today. Recommendation: forward it to `/discover`.
- **Phone menu** shrinks to search, bag, about, work with Adrian, and the Manage rooms for staff. Sessions, People, Places and Tea Wisdom leave it because each is now under a word.
- **Footer** keeps privacy, photographs, MCP.

## Route map, old to new

Every view below is an address, so back and forward work. A tab or a view is a step and pushes a history entry. A filter or a sort is a refinement and replaces the entry.

| Today | Proposed | Kind of change |
|---|---|---|
| `/read`, `/read/*`, `/article/:slug` | unchanged | none |
| `/craft`, `/craft?v=...` | unchanged address; lights "read" | section only |
| `/learn` | forwards to `/craft` as today | none |
| `/wisdom/*` | unchanged address; lights "read" | section only |
| `/tea-feed` | forwards to `/tea-table` | new address, old one forwards |
| (none) | `/tea-table`, `/tea-table?show=tastings` or `sessions` (refinement), `/tea-table?before=<date>` (step) | new |
| `/events`, `/event/:slug`, `/event/:slug/recap`, `/sits/casual/:slug`, `/session/:id` | unchanged address; lights "table" | section only |
| `/people`, `/people/:slug`, `/people/:slug/favorites`, `/people/:slug/pay` | unchanged address; lights "table" | section only |
| `/community` | forwards to `/tea-table` (today it forwards to `/find-a-table`) | forward changes |
| `/advise` | unchanged address; lights "houses"; design row leads to `/tea-houses/build` | section only |
| `/consult` | forwards to `/advise` as today | none |
| `/advise?v=projects`, `?pid=` | forwards to `/tea-houses/work` and `/tea-houses/work/:slug` | forward |
| `/for-your-space` | forwards to `/tea-houses/build?for=space` | forward |
| `/spaces` | forwards to `/tea-houses/visit` | forward |
| `/find-a-table` | forwards to `/tea-houses/visit` | forward |
| `/store-launch-playbook` | unchanged; linked from `/tea-houses/build` and from Settings | none |
| `/store/:slug` | unchanged; lights "houses" | section only |
| (none) | `/tea-houses`, `/tea-houses/build`, `/tea-houses/work`, `/tea-houses/work/:slug`, `/tea-houses/visit` | new |
| `/shop`, `/shop/product/:id` | unchanged | none |
| `/account` (opens the panel) | `/account` (a page) | same address, real page |
| panel views `journal`, `cellar` | `/account/journal`, `/account/cellar` (both exist) | one copy kept |
| panel view `events` | `/account/sessions` | new address |
| panel view `location-switcher` | `/account/tea-houses` | new address |
| `/journey` | forwards to `/account/journey` after sign-in | forward |
| `/start` | forwards to `/discover` | forward |
| `/admin/*` | unchanged | none |

Keyboard keys 1 to 5 become home, read, table, houses, shop.

## What changes in the standing rules

The rules against feeds are written in several places. This is exactly what changes and what does not.

**What changes.** One thing. Teajia may have one public page that lists, in time order, what people chose to share. Until now any feed was refused.

**What does not change.** Everything that makes a feed a social network stays refused: likes, comments, followers and following, counts of any kind, streaks, badges, ranking, recommendations, notifications, and anything that tells a person how their post is doing. Human curation stays. The phone still does not sit at the tea table: the Tea Table is read before or after tea, and capture during a tasting stays one tap with no prompt, as the family plan decided.

**The proposed line for CLAUDE.md**, already added there and marked as proposed:

> **Second exception, the Tea Table (proposed by Adrian, 2026-11-25; not in force until he confirms the wording).** One public page may show, newest first, what people have chosen to put on the tea table: shared tastings with their words and photographs, and published session recaps. Time order is the whole of it: no likes, comments, follows, follower or view counts, scores, streaks, ranking, recommendations or notifications, and it is never called a feed on the site. A person can take their own item off and the owner can hide any item. The plan is `todo/plans/tea-table.md`; the section map is `docs/SECTIONS.md`. Build nothing under it until he says yes.

**Where the old wording lives, to be brought into line once Adrian says yes:**

| File | Line today | Becomes |
|---|---|---|
| `CLAUDE.md`, "DO NOT build" | "social feeds/likes/followers" | Stays, with the second exception under it (added as proposed) |
| `AGENTS.md` | A link to `CLAUDE.md`, so it already carries the same text | Nothing to do |
| `docs/CONSOLIDATED_DIRECTION.md`, guardrails | "Do not add feeds, follows, likes..." | Rewritten in this change, pointing here |
| `docs/TEAJIA_WORKING_BRIEF.md` | "Do not add feeds..." and "The community does not need a feed." | Add the exception by name |
| `docs/VISION.md` | "Human Curation Over Algorithms" | No change needed. The Tea Table has no algorithm |
| `docs/PILLAR.md` | "No streaks, no scores, no feed." and "not a social network" | Reword when the Tea Table ships, in the same commit |
| `todo/plans/teajia-family.md`, "Not building" | "No likes, followers, counts, streaks, comments or feed." | A pointer was added. The family decisions themselves are not reopened |
| `PRODUCT.md` | "Editorial, not gamified" | No change needed |

**The navigation rule.** CLAUDE.md says navigation links and labels never change without explicit confirmation. This file changes two of the four bar words, the rail foot and the phone menu. It is therefore a proposal and no more, until Adrian answers the first two decisions below.

## Open decisions for Adrian

Seven, each with a recommendation. The first two unlock everything else.

1. **The four words.** Recommended: **read, table, houses, shop**, with Craft as the second shelf of Read. The other honest choice: keep **read, craft, houses, shop**, and give the Tea Table the home page and the phone menu instead of a word. The first puts the living part of the site on the bar. The second keeps Craft where you named it. A fifth word does not fit the phone bar or the Narrow B rail without redrawing both.
2. **The two new labels.** Recommended: "table" and "houses" on the bar, "The Tea Table" and "Tea Houses" as page titles. The existing words are verbs (read, craft, advise, shop), so "gather" and "build" are the alternative if you want to keep that pattern.
3. **Advise leaves the bar.** Recommended: yes. The page stays at `/advise` as "work with Adrian" and is reached from Tea Houses, Sessions, Shop and About. Tea house building takes the word because it is the offering you want seen.
4. **Sharing and the Tea Table.** Recommended: one choice, not two. "Share to my page" becomes "Share to my page and the Tea Table". Things shared before that wording existed do not appear on the Tea Table unless the person shares them again.
5. **Review or hide.** Recommended: family items go onto the Tea Table without waiting for review, as family pages already do, and you hide with one tap. The alternative is a review queue in Guest notes before anything appears, which is safer and makes you the bottleneck.
6. **Your Table becomes a page.** Recommended: yes, at `/account`, same glyph, same tiles, grouped.
7. **The tea house offering itself.** The site needs your facts, and nobody should guess them: the stages as you actually run them, what a client receives at each, whether any price or price range is shown, and which of the ten case studies in the code are real projects you may name and show. A draft of the stages is in [tea-houses.md](../todo/plans/tea-houses.md) for you to correct.

## Build order

Each stage is useful by itself and leaves the site whole. The bar words change late, on purpose: the working plan and the closeout plan both say to keep the four-section navigation through the current releases and to decide on the Tea Table from the evidence of a real sit.

| Stage | What | Needs from Adrian | Touches the bar |
|---|---|---|---|
| 0 | Adrian answers decisions 1 to 3. The rule exception is confirmed or reworded | Yes | No |
| 1 | **Tea Houses pages.** `/tea-houses` with Build, Work and Visit, built from what exists (the Advise design copy, the inquiry, the project data, the network directory). Old addresses forward. Reached from Advise and home | The offering facts and photographs (decision 7) | No |
| 2 | **Tea Table, first form.** `/tea-table` with the three views, showing published recaps as `/tea-feed` does now. Reached from home and the menus | One real sit, as the closeout plan asks | No |
| 3 | **Tastings on the Tea Table.** Shared tastings join the stream, with the new share wording, the hide control, and the consent and withdrawal gates in the plan | Decisions 4 and 5 | No |
| 4 | **The bar changes.** One change: bar, rail, phone menu, home lines, keyboard keys, page titles. `npm run test:mobile` before and after | The explicit yes on the words | Yes |
| 5 | **Your Table as a page.** Same tiles, grouped, with share lines. The panel retires | Decision 6 | Glyph only |
| 6 | **Read's three shelves.** The shelf row on Read, Craft and Wisdom, and the one rename in Craft | The new word for "Shared Wisdom" | No |
| 7 | **Truth-up.** PILLAR, SITE_MAP, the layout notes and the rule wording brought into line, each in the commit that changes the site | No | No |

Stages 1 and 2 can run side by side. Nothing in this order waits on the Manage rebuild, and nothing in it changes a Manage room.

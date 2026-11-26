# Teajia sections: the proposed overhaul

> **Status: proposal, 2026-11-25. Nothing here is built and no navigation word has changed.** Adrian asked for a section overhaul that brings in the Tea Table, Your Table, tea houses as an offering, and every other section. This is the one map of that. The site as it runs today is described in [PILLAR.md](PILLAR.md). Nothing in this file is to be built until Adrian says yes to the words in "Open decisions".

> **Second pass, 2026-11-25.** Adrian answered five questions the same day, and the answers put two roles at the centre: guests and tea masters. The section called "The centre" below is new, and Home, Tea Table, Tea Houses, the decisions and the build order were revised to fit it. The full reasoning, the gaps found in the code, and the stages are in [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md).

Plans that hang off this file: [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md), [tea-table.md](../todo/plans/tea-table.md), [your-table.md](../todo/plans/your-table.md), [tea-houses.md](../todo/plans/tea-houses.md). Where every other plan sits: [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md).

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

## The centre: guests, tea masters, and the loop

**Everyone is a guest. A session has a host, and may have other tea masters pouring.** Adrian, 2026-11-25: "Master is like master of ceremonies. Many people in the audience may be that, but there is only one that is that in the moment." And: "At one event I may be a master, at another event I may be a guest."

So the roles belong to a session, not to an account. Anyone can join. A tea master invites people into a session, "not into the site as much". A tea house is "a physical space, somewhere that people can sit down and drink tea", where tea masters, travelling ones included, can pour. A tea master's own place is a **table**: private, usually their home, shown to the public by area only (Adrian, 2026-11-26). The creator of a session is its host, and others may serve beside them.

The sections are the parts of one circle:

| Step | What happens | Where on the site |
|---|---|---|
| 1. Invite | A host opens a session and sends its invitation, before the day | Tea Table, Sessions |
| 2. Sit | People meet at a private table or a tea house. The app asks for nothing | Tea Houses, Your Table |
| 3. Put on the table | The host sends a thank-you. Guests add words, photographs and what they thought of the teas | Tea Table |
| 4. Keep | Favourite articles, teas the shop has, teas in your own Tea Chest | Your Table, and your page |
| 5. Find the tea | A favourite or a tasting leads to the tea | Shop |
| 6. Host | A guest opens their own session and is its tea master | Home, Your Table |

Read runs through all of it: it is how people sharpen their skill, and where articles show who people are and why they love tea. Someone who is only ever online has steps 3 to 5 in full.

One rule governs the phone. **The app never asks during a session:** it sends nothing, prompts nothing and shows nothing to scroll while people are sitting. A photograph is one tap. A tasting is the one kind of session where writing is the point, and the host chooses it. Adrian, 2026-11-26: "We're not trying to control people, but we don't want people in their mind or on the app."

Two more things from the second round, both in the plan: **quiet acknowledgement** (active people are respected only through things one person gives another, never numbers or titles for volume), and **everything by voice or agent** (each screen ships with its tool, so a host need not use the screens at all).

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

**What it is.** The section for places. A tea house is a public place where people sit down and drink tea: a name, where it is, a photograph, its keeper, and the sessions held there. A shop is optional. A tea master's own table is not a tea house: it is private and lives in Your Table. A house comes to exist in one of three ways: it is already there, its keeper adds it, or it is built with Adrian. The section answers four questions, in this order:

| View | Address | The question it answers |
|---|---|---|
| Overview | `/tea-houses` | What is a Teajia tea house, and what can I do here |
| Build | `/tea-houses/build` | I want one. What happens, in what order, and how do I start |
| Work | `/tea-houses/work`, `/tea-houses/work/:slug` | Show me ones Adrian has built |
| Visit | `/tea-houses/visit`, then the house's own page | Where can I sit down at one, and who pours there |

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

- **Home** is the same page for everyone and gains the job it lacks today: saying what this is and what a person can do here. Read from the code, it shows no people, no sessions and no shared tastings, and its four links still name the old sections. Proposed order: one sentence and the four grounding lines (learn tea, sit at a table, find a tea house, find good tea); two doors, "Come to a table" and "Host a table"; up to four fresh strips, each shown only when it has something real (the next session with its tea master and house, the latest three things on the tea table, one person from an article, the selected tea); the three plates it has now, with the consult plate leading to Tea Houses; and the closing house section with 佳 家 嘉, kept in full. Detail in [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md), "Home".
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

**From the second pass, all answered on 2026-11-26**: the words, private tables, the Tea Chest's states, the phone rule, anyone may host with reach decided by hand, and quiet acknowledgement. They are recorded in [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md), "Decisions". The same file's "Blind spots and ideas" holds a review of the whole plan and five new questions.

**From the first pass, seven**, each with a recommendation. The first two unlock everything else. Decision 7 is narrower now: Adrian has said what a tea house is, and what remains is his facts for the build offering.

1. **The four words.** Recommended: **read, table, houses, shop**, with Craft as the second shelf of Read. The other honest choice: keep **read, craft, houses, shop**, and give the Tea Table the home page and the phone menu instead of a word. The first puts the living part of the site on the bar. The second keeps Craft where you named it. A fifth word does not fit the phone bar or the Narrow B rail without redrawing both.
2. **The two new labels.** Recommended: "table" and "houses" on the bar, "The Tea Table" and "Tea Houses" as page titles. The existing words are verbs (read, craft, advise, shop), so "gather" and "build" are the alternative if you want to keep that pattern.
3. **Advise leaves the bar.** Recommended: yes. The page stays at `/advise` as "work with Adrian" and is reached from Tea Houses, Sessions, Shop and About. Tea house building takes the word because it is the offering you want seen.
4. **Sharing and the Tea Table.** Recommended: one choice, not two. "Share to my page" becomes "Share to my page and the Tea Table". Things shared before that wording existed do not appear on the Tea Table unless the person shares them again.
5. **Review or hide.** Recommended: family items go onto the Tea Table without waiting for review, as family pages already do, and you hide with one tap. The alternative is a review queue in Guest notes before anything appears, which is safer and makes you the bottleneck.
6. **Your Table becomes a page.** Recommended: yes, at `/account`, same glyph, same tiles, grouped.
7. **The tea house offering itself.** The site needs your facts, and nobody should guess them: the stages as you actually run them, what a client receives at each, whether any price or price range is shown, and which of the ten case studies in the code are real projects you may name and show. A draft of the stages is in [tea-houses.md](../todo/plans/tea-houses.md) for you to correct.

## Build order

Revised in the second pass. The order follows the loop, so that the first stages are exactly what one real sit needs, and the bar words still change late. Each stage is useful by itself and leaves the site whole. What each stage closes, and what it needs from Adrian, is in [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md), "Build stages".

| Stage | What | Touches the bar |
|---|---|---|
| 0 | **Repairs.** The tea master invite address, which appears to land on the wrong page, and the profile screen wording | No |
| 1 | **The words.** Guest, host, tea master, session, table, tea house, used one way everywhere | No |
| 2 | **Before: invite to a session.** One link per session, a seat without signing up, the host and who else pours, a private table or a tea house, seats | No |
| 3 | **After: the thank-you.** The host's note, the teas poured, the playlist, and one screen for the guest's answer | No |
| 4 | **During.** The one-tap camera, and a tasting as the host's choice | No |
| 5 | **The Tea Table, first form**, with its consent and withdrawal gates | No |
| 6 | **Tables (private) and tea houses (public)**, then Build and Work | No |
| 7 | **Favourites in three kinds, and the Tea Chest's three states** | No |
| 8 | **Home in full, and the bar words** in one change. `npm run test:mobile` before and after | Yes |
| 9 | **Quiet acknowledgement, who pours on the people list, the first people articles** | No |
| 10 | **Every tool**: anything on a screen can be said to an agent | No |
| 11 | **Your Table as a page, Read's three shelves, truth-up** of PILLAR, SITE_MAP and the rule wording | Glyph only |
| Later | Short video. The tea tasting box. An app | |

From stage 2 on, each stage ships its voice and agent tools with its screens.

Nothing in this order waits on the Manage rebuild, and nothing in it changes a Manage room.

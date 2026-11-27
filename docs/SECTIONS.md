# Teajia sections: the overhaul, what is built and what is proposed

> **Tea spaces (2026-11-27).** Every switch is on, and the bar's third word is **Tea spaces** (was "Tea house"): a tea house holds one or more tea spaces, anyone can own a space, and a host's own place is "Your tea space". Plan: `todo/plans/tea-spaces.md`. Where "tea house" names the bar word below, read "tea spaces".

> **Craft removed (2026-11-27).** Adrian: "we're removing craft completely", then "the things inside of craft I don't wanna lose", and chose "Read: Stories, Lessons, Wisdom". The bar today reads **read, advise, shop**. Read carries three shelves on every page of it: Stories (`/read`), Lessons (`/read/lessons`, Craft's lessons) and Wisdom (`/wisdom`, now with the glossary). Tea Spaces and Playlists go to Tea house and Shared Wisdom to Tea table when those pages take them. Where Craft appears below, read it as history.

> **Launch 4 branch status (2026-11-26).** The feature sections below describe what is in this checkout. Built and off: the bar words, Home in full and Read's three shelves (`HOME_BAR_OPEN`), and Tea Houses with Visit, Build and Work (`TEA_HOUSES_OPEN`). The bar reads **read, advise, shop** until `HOME_BAR_OPEN` opens. Adrian has not settled the words "Tea table" and "Tea house". See [SITE_MAP.md](SITE_MAP.md) for routes and flag states. The switch for the bar is in `src/lib/homeBar.ts`. Adrian's words of 2026-11-26 are "Read", "Tea table", "Tea house" and "Shop", one line in `src/components/navSections.ts`, and he has said he doubts the middle two.

> **Second pass, 2026-11-25.** Adrian answered five questions the same day, and the answers put two roles at the centre: guests and tea masters. The section called "The centre" below is new, and Home, Tea Table, Tea Houses, the decisions and the build order were revised to fit it. The full reasoning, the gaps found in the code, and the stages are in [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md).

**The order to build in is [guests-and-tea-masters-build.md](../todo/plans/guests-and-tea-masters-build.md)**: five launches, numbered work packages, and the rules for a build run across several agents. Plans that hang off this file: [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md), [tea-table.md](../todo/plans/tea-table.md), [your-table.md](../todo/plans/your-table.md), [tea-houses.md](../todo/plans/tea-houses.md). Where every other plan sits: [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md).

## The proposed section layout

The pillar already says what Teajia is for: a place to source tea, study it, and share it with the people who gather around the cup. Add the thing Adrian has always done and the site never showed properly, building the rooms where that happens, and the site has four jobs. One word each.

| Section | Word on the bar | What it is | Who it is for | Routes | What it replaces |
|---|---|---|---|---|---|
| **Read** | read | Everything you study: the magazine, Craft (how to make and serve tea), and Tea Wisdom (the reference) | Readers, learners, anyone looking something up | `/read`, `/article/:slug`, `/craft`, `/wisdom/*` | Read and Craft as two words, and Wisdom with no door on desktop |
| **Tea Table** | tea table | What people have put on the tea table, newest first: tastings, photographs, notes, sessions poured. With it, the sessions calendar and the people | Family members, guests, visitors who want to see the life of the place | `/tea-table`, `/events`, `/event/:slug`, `/people`, `/people/:slug` | The switched-off `/tea-feed`, Sessions and People hidden in menus |
| **Tea Houses** | tea house | Building a tea house with Adrian, the houses already built, the houses you can visit, and working with Adrian in general | Founders, hotels and retreats, tea masters with a room, travellers looking for a table | `/tea-houses`, `/tea-houses/build`, `/tea-houses/work`, `/tea-houses/visit`, `/store/:slug`, `/advise` | Advise as a word, `/for-your-space`, `/spaces`, `/find-a-table`, the gated portfolio |
| **Shop** | shop | Tea and teaware, by inquiry | Buyers and collectors | `/shop`, `/shop/product/:id` | Nothing. Stays as it is |
| **Your Table** | the person glyph | Your own table: journal, photographs, Tea Chest, favourites, orders, journey, your page, your tea houses | Anyone signed in | `/account` and `/account/*` | The overlay panel. Same door, a real page behind it |
| **Manage** | manage (staff only) | The seven working rooms | Adrian, shop owners, staff | `/admin/*` | Nothing. Seven rooms stay |

The bar and the rail stay four words, in the same slots as today: **read, tea table, (emblem), tea house, shop** (Adrian, 2026-11-26). "Tea table" takes Craft's place and "tea house" takes Advise's. Under 340 wide the letters go one size smaller. The rail's foot becomes exactly the "Narrow B" drawing Adrian picked on 2026-11-25: search, account, bag, and manage for staff. People and Places leave the foot because each now lives under a word.

Three words to hold apart from now on:

- **Table** is people. The Tea Table is everyone's, Your Table is yours.
- **House** is a place. A tea house is a room with an owner, and on Teajia it is an account.
- **Session** is a time. People sit at a table, in a house, at a session.

## The centre: guests, tea masters, and the loop

**Everyone is a guest. A session has a host, and others may pour beside them.** A session uses “hosted by” and “pouring”. Adrian can grant a separate word on a person’s page. Tea Table entries record what has happened.

So the roles belong to a session, not to an account. Anyone can join. A tea master invites people into a session, "not into the site as much". A tea house is "a physical space, somewhere that people can sit down and drink tea", where tea masters, travelling ones included, can pour. A tea master's own place is a **table**: private, usually their home, shown to the public by area only (Adrian, 2026-11-26). The creator of a session is its host, and others may serve beside them.

The sections are the parts of one circle:

| Step | What happens | Where on the site |
|---|---|---|
| 1. Invite | A host opens a session and sends its invitation, before the day | Tea Table, Sessions |
| 2. Sit | People meet at a private table or a tea house. The app asks for nothing | Tea Houses, Your Table |
| 3. Put on the table | The host sends a thank-you. Guests add words, photographs and what they thought of the teas | Tea Table |
| 4. Keep | Privately keep articles, shop teas or your own Tea Chest teas | Favourites, behind `FAVOURITES_OPEN` |
| 5. Find the tea | A favourite or a tasting leads to the tea | Shop |
| 6. Host | A guest opens their own session and becomes its host | Built: "Host a table" on Home, the Your Table panel and Your Table's sits, shown only while hosting is open, behind `FEW_HOSTS_OPEN` |

Read runs through all of it: it is how people sharpen their skill, and where articles show who people are and why they love tea. Proposed on 2026-11-26: Read is the third leg beside the tea and the tables. An invitation may carry one piece to read, the thank-you links each tea to its reading, sessions become articles, and experienced hosts may offer pieces that Adrian edits. What a regular host gains, and how to explain Teajia in one sentence, is in the plan under "What this is worth to someone who already hosts". The order to build in, as a first version and four widenings, is in the plan under "The first version, and how it grows". Someone who is only ever online has steps 3 to 5 in full.

One rule governs the phone. **The app never asks during a session:** it sends nothing, prompts nothing and shows nothing to scroll while people are sitting. A photograph is one tap. A tasting is the one kind of session where writing is the point, and the host chooses it. Adrian, 2026-11-26: "We're not trying to control people, but we don't want people in their mind or on the app."

A tea master's page is also their shelf: their own tea, sold by them or only shown, and Teajia's tea that they pour without holding stock. Tea a guest buys through a tea master is recorded as theirs from the start, and earns them credit under a rule Adrian will set later (Adrian, 2026-11-26).

A session is built around **six core functions**, each usable without the others (Adrian, 2026-11-26): invitations and arrival, with a walkthrough of the way to the house shown once a guest is confirmed; sharing the tea; sharing the playlist; selling the tea; guests tasting and building their profile; and photographs put together. The first alone is a complete product.

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

**Built behind `TEA_TABLE_OPEN` (off by default).** `/tea-table` lists the tastings members share under the Tea Table wording and the published public network recaps their hosts put there. A tasting can show the words and shared photographs from the time it was placed, with links to the tea and the person. Older profile shares need to be shared again. Casual sits are outside this list. All, Tastings and Sessions filter the list. Earlier opens an older page in browser history, and no piece is lost or repeated between pages. Sessions and People are ordinary links. The page names nothing that is still to come. Sharing a tasting again does not move it forward. Six held pieces at most sit at the top; a held piece beyond that stays in its place below. With the switch off, `/tea-table` is not found, like any address that does not exist.

A host may hold a recap from their own shop at the top for one to fourteen days. Adrian may hold any piece. Otherwise the list is newest first by placement time. Members can keep pieces privately. With `FAVOURITES_OPEN` also on, kept pieces appear under “From the Tea Table” at `/account/favourites`. Adrian alone sees keep totals in Manage under Publish, Guest notes.

An author’s “Take off the table” preserves the profile share when they had put the tasting on their page by itself before; when the table was the only reason it was public, it goes private everywhere. “Remove from my page” withdraws the tasting from both. Taking down, hiding or unpublishing a piece removes it from the Tea Table list, holds and saved copies shown there. A recap its host took off the table remains at its own address; one the platform owner hid is gone from every public place. Its public photo endpoint checks the photo permission and recap publication independently of Tea Table placement. With the flag on, `/tea-feed` forwards to `/tea-table`. With it off, both send visitors Home.

Full plan: [tea-table.md](../todo/plans/tea-table.md).

### Tea Houses

**Built behind `TEA_HOUSES_OPEN` (off).** Overview, Build, Work and each house's page, with Visit. A tea house is a public place where people sit down and drink tea. The plan gives each house a name, a location, a photograph, a keeper and a record of sessions. A shop is optional. A host’s own table is private and belongs in Your Table. A house can already exist, be added by its keeper or be built with Adrian. The section answers four questions.

| View | Address | The question it answers |
|---|---|---|
| Overview | `/tea-houses` | The tea spaces page (tea spaces, step 3): shown houses with their spaces, then hosts' own spaces by area with who serves there; Adrian's house as a marked placeholder until it is shown; then the doors below |
| Build | `/tea-houses/build` | I want one. What happens, in what order, and how do I start |
| Work | `/tea-houses/work`, `/tea-houses/work/:slug` | Show me ones Adrian has built |
| Visit | `/tea-houses/visit`, then `/store/:slug` | Where can I sit down at a house |

`/advise` stays as "work with Adrian": his biography, sourcing for a collection, sessions and guidance, sourcing journeys, the testimonial, the inquiry. It is reached from Tea Houses, from Sessions, from Shop and from About. Its design row points into `/tea-houses/build`.

**Visit opens with `TEA_HOUSES_OPEN`, with the rest of Tea Houses.** With the switch off, `/tea-houses/visit` is not found and `GET /api/network/stores` answers as it did before Visit, with no photograph and no next session. It uses `GET /api/network/stores`, which returns active public accounts with an active public product. Listings show the name and any city, country, cover photo, tagline and next public session. They open the storefront. The directory uses public accounts as its source, keeping private saved tables and arrival details out. The list has no map or distance sort. `/spaces` and `/find-a-table` still have their own pages.

**What the full proposal would gather.**

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
- A proposed connection would lead from family photographs on a tea page to the person’s tasting on the Tea Table.
- Teaware gets one line leading to Tea Houses for someone fitting out a room.

The names around collections are tangled (`/collection`, `/c/:slug`, `/account/collection`, `/account/collections`, `/u/:slug`). That is worth a tidy one day. It is not part of this overhaul.

### Your Table

**Built behind `YOUR_TABLE_PAGE_OPEN` (off by default).** The same person glyph opens the page at `/account` when enabled. The existing tiles are grouped, and empty groups are omitted. Journal and Tea Chest open their existing pages. Sessions opens `/account/sessions` and the house switcher opens `/account/tea-houses`. With the switch off, `/account` opens the overlay, and the two new addresses and journal share lines are unavailable.

| Group | Tiles when available |
|---|---|
| On your table | Journal |
| Your tea | Tea Chest, remember, orders |
| Your path | Sessions, journey, discover |
| Your page | Profile |
| Your tea houses | Switch, manage |

Tea Atlas, library and fixes sit below the groups for those who have them. In the journal, eligible shop teas show “Private”, “On your page” or “On your page, photographs offered to Teajia”. The line opens the existing Share step. The line describes the profile sharing state. Tea Table placement has a separate consent record, and removing a tasting from the Tea Table can leave it on the profile.

**Favourites is independently gated by `FAVOURITES_OPEN` (off by default).** The signed-in page at `/account/favourites` has private lists for kept articles, shop-heart teas and marked Tea Chest teas. Each nonempty group is shown and items can be removed. It also shows kept pieces from the Tea Table when `TEA_TABLE_OPEN` is on. The article Keep and Tea Chest favourite controls share the favourites switch. Existing public profile favourites are separate. The “remember” tile still opens `/account/collection`. With Favourites on, the chest calls a private tea “Kept” and a visible sale offer “Offered”. A separate “Shown” state label is absent.

Full plan: [your-table.md](../todo/plans/your-table.md).

### Manage

The seven rooms stay: Curate, Stock, Sales, People, Sessions, Publish, Settings. The Manage rebuild is in flight and this overhaul does not disturb it. Three small additions inside existing rooms, no new room:

- **Publish, Guest notes** has a platform-owner section for Tea Table hide, restore and keep totals behind `TEA_TABLE_OPEN`. The host’s recap placement and hold controls use the same switch.
- **Sales, Waiting** already receives inquiries. Tea house inquiries land there like any other, marked by kind.
- **Settings, Platform** is already where a new account is made. A finished tea house's account is made there.

Not proposed: a "Houses" room to track builds. A build is tracked as an inquiry, a customer and a tag until there are enough at once to need more.

### Home, About and the small pages

- **Home** is the same page for everyone and gains the job it lacks today: saying what this is and what a person can do here. With `HOME_BAR_OPEN` off it shows no people, no sessions and no shared tastings. With it on, Home has the new opening lines, the "Come to a table" door, "Host a table", a strip of the latest three things on the Tea Table, a next-session strip, and the consult plate leading to Tea Houses (`src/pages/home/HomeLaunchFour.tsx`). The order planned was: one sentence and the four grounding lines (learn tea, sit at a table, find a tea house, find good tea); two doors, "Come to a table" and "Host a table"; up to four fresh strips, each shown only when it has something real (the next session with its tea master and house, the latest three things on the tea table, one person from an article, the selected tea); the three plates it has now, with the consult plate leading to Tea Houses; and the closing house section with 佳 家 嘉, kept in full. Detail in [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md), "Home".
- **About** stays thin and gains links to the four sections and to "work with Adrian". Reached from the phone menu and the footer.
- **Discover** (`/discover`) stays, linked from home and Your Table.
- **Start** (`/start`): nothing links to it today. Recommendation: forward it to `/discover`.
- **Phone menu** (built behind `HOME_BAR_OPEN`) shrinks to search, bag, about, work with Adrian, and the Manage rooms for staff. Sessions, People, Places and Tea Wisdom leave it because each is now under a word.
- **Footer** keeps privacy, photographs, MCP.

## Launch 5 and the rest

These switches are built, and all but the first are off. Each answers as absent while closed. The opening order is in `todo/plans/guests-and-tea-masters-review-run.md`.

- `FIRST_TABLE_OPEN` (on): the thank-you page, "Keep this tea" and bought tea into the Tea Chest.
- `FEW_HOSTS_OPEN`: approved hosts at `/account/host`. `ANYONE_HOSTS_OPEN` stands on it.
- `KNOW_THIS_TEA_OPEN`: "Does anyone know this tea?" on the Tea Table. It also needs `TEA_TABLE_OPEN`.
- `HOST_CREDIT_OPEN`: tea credit, at `/account/tea-credit` and in Manage, Sales, Waiting.
- `CIRCLES_OPEN` and `HOST_TOKENS_OPEN`: circles and the host's assistant key on `/account/host`. Both need `FEW_HOSTS_OPEN`.
- `TABLE_CARD_OPEN`: the printed card at `/admin/events/:slug/card`.
- `TOP_TEAS_OPEN`: a host's top teas on their page.
- `HOST_ARTICLES_OPEN`: article offers, reviewed in Publish.
- `YOUR_TABLE_PLACE_OPEN`: "Add your table". It also needs `FEW_HOSTS_OPEN`.

## Route map, old to new

For the new routes, a tab or a view is a step and pushes a history entry. A filter or a sort is a refinement and replaces the entry. Rows marked proposed or section only describe the navigation proposal.

| Previous address | Launch 4 branch or proposal | Status |
|---|---|---|
| `/read`, `/read/*`, `/article/:slug` | unchanged | none |
| `/craft`, `/craft?v=...` | unchanged address; lights "read" | section only |
| `/learn` | forwards to `/craft` as today | none |
| `/wisdom/*` | unchanged address; lights "read" | section only |
| `/tea-feed` | forwards to `/tea-table` when enabled, otherwise Home | `TEA_TABLE_OPEN` |
| (none) | `/tea-table`, `/tea-table?show=tastings` or `sessions` (refinement), `/tea-table?before=<date>` (step) | `TEA_TABLE_OPEN` |
| `/events`, `/event/:slug`, `/event/:slug/recap`, `/sits/casual/:slug`, `/session/:id` | unchanged address; lights "tea table" | section only |
| `/people`, `/people/:slug`, `/people/:slug/favorites`, `/people/:slug/pay` | unchanged address; lights "tea table" | section only |
| `/community` | forwards to `/tea-table` (currently forwards to `/find-a-table`) | proposed |
| `/advise` | unchanged address; lights "tea house"; design row leads to `/tea-houses/build` | section only |
| `/consult` | forwards to `/advise` as today | none |
| `/advise?v=projects`, `?pid=` | forwards to `/tea-houses/work` and `/tea-houses/work/:slug` | forward |
| `/for-your-space` | forwards to `/tea-houses/build?for=space` | forward |
| `/spaces` | existing page | proposed forward to Visit is pending |
| `/find-a-table` | existing page | proposed forward to Visit is pending |
| (none) | `/account/tea-credit` | `HOST_CREDIT_OPEN` |
| (none) | `/account/host`, `/account/host/:id` | `FEW_HOSTS_OPEN` |
| (none) | `/admin/events/:slug/card` | `TABLE_CARD_OPEN` |
| `/store-launch-playbook` | unchanged; linked from `/tea-houses/build` and from Settings | none |
| `/store/:slug` | unchanged; lights "tea house" | section only |
| (none) | `/tea-houses/visit` | `TEA_HOUSES_OPEN` |
| (none) | `/tea-houses`, `/tea-houses/build`, `/tea-houses/work`, `/tea-houses/work/:slug` | `TEA_HOUSES_OPEN` |
| `/shop`, `/shop/product/:id` | unchanged | none |
| `/account` (opens the panel) | `/account` (grouped page) | `YOUR_TABLE_PAGE_OPEN` |
| panel views `journal`, `cellar` | page-mode tiles use the existing `/account/journal` and `/account/cellar` | `YOUR_TABLE_PAGE_OPEN` |
| panel view `events` | `/account/sessions` | `YOUR_TABLE_PAGE_OPEN` |
| panel view `location-switcher` | `/account/tea-houses` | `YOUR_TABLE_PAGE_OPEN` |
| (none) | `/account/favourites` | `FAVOURITES_OPEN` |
| `/journey` | forwards to `/account/journey` after sign-in | forward |
| `/start` | forwards to `/discover` | forward |
| `/admin/*` | unchanged | none |

Keys 1 to 5, section highlighting and the navigation labels follow the new words and are built behind `HOME_BAR_OPEN`; the words are Adrian's to confirm.

## The standing rules

The Tea Table is the one exception to the rule against social feeds. One public page may show, newest first, what people have chosen to put there: shared tastings with their words and photographs, and published session recaps. It shows what has happened. A host may hold their own recap at the top for a while by hand, and Adrian may hold any piece. Nothing rises by itself. A person may keep a piece in their own favourites. Only Adrian can see the number of keeps, in Manage. There are no likes, comments, follows, follower or view counts, scores, streaks, rankings, recommendations or notifications on the Tea Table. The site calls it the Tea Table. A person can take off their own item, and the owner can hide any item.

The Launch 4 run sheet records Adrian’s yes to this exception on 2026-11-26. `CLAUDE.md` now carries it as in force, under "The Tea Table", with his wider words of the same day: a classy, curated social page is welcome, never a Facebook-style network, and any further social part waits for him to name it. The implementation stays behind `TEA_TABLE_OPEN`, off by default.

Quiet acknowledgement comes from one person to another: a host’s thank-you, being quoted by name, “Photograph by”, “Poured with”, or a word Adrian grants by hand on a person’s page. No numbers, levels, titles for volume or nudges. Adrian may decide a host’s reach by hand and that standing stays private. Photo credit, recap credit (“Poured with”) and “Pours at tables” open with `TEA_TABLE_OPEN`: with it off no public answer carries `photograph_by`, `poured_with` or `pours`, and the photographer’s credit choice cannot be changed. The granted word has no switch of its own. The photo credit depends on the family photographer’s explicit first-name choice. A published recap may name public co-hosts and guest hosts, linking any published page. The Tea Table’s tasting photos use the tasting byline and have no separate photographer credit line. “Pours at tables” comes from public credit on a completed or archived session whose date has passed. It does not change the list’s order.

Tea scores and score-like verdicts are personal. Public and ordinary shared views omit them. Words can be shared by choice, and a tea-page excerpt requires the writer’s permission and manual placement. The structured tasting host’s authenticated live screen still receives guest ratings, verdicts and purchase intent. The score changes have no flag of their own.

The same guardrails are recorded in [PILLAR.md](PILLAR.md), [CONSOLIDATED_DIRECTION.md](CONSOLIDATED_DIRECTION.md) and [TEAJIA_WORKING_BRIEF.md](TEAJIA_WORKING_BRIEF.md). [VISION.md](VISION.md) retains human selection over algorithms. The family plan’s order-only exception still applies separately. New navigation labels still require Adrian’s explicit approval.

## Open decisions for Adrian

**From the second pass, all answered on 2026-11-26**: the words, private tables, the Tea Chest's states, the phone rule, anyone may host with reach decided by hand, and quiet acknowledgement. They are recorded in [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md), "Decisions". The same file's "Blind spots and ideas" holds a review of the whole plan and five new questions.

The bar words (read, tea table, tea house, shop) and the tea house offering were answered on 2026-11-26. What remains is switching on what is built, each switch on Adrian's word. The first-pass decisions below record the original recommendations and where the branch implements them.

1. **The four words.** Answered 2026-11-26: **read, tea table, tea house, shop**. The original recommendation was **read, table, houses, shop**, with Craft as the second shelf of Read. The other honest choice: keep **read, craft, houses, shop**, and give the Tea Table the home page and the phone menu instead of a word. The first puts the living part of the site on the bar. The second keeps Craft where you named it. A fifth word does not fit the phone bar or the Narrow B rail without redrawing both.
2. **The two new labels.** Answered 2026-11-26 with the two-word labels above. The original recommendation was "table" and "houses" on the bar, "The Tea Table" and "Tea Houses" as page titles. The existing words are verbs (read, craft, advise, shop), so "gather" and "build" are the alternative if you want to keep that pattern.
3. **Advise leaves the bar.** Answered yes on 2026-11-26. The page stays at `/advise` as "work with Adrian" and is reached from Tea Houses, Sessions, Shop and About. Tea house building takes the word because it is the offering you want seen.
4. **Sharing and the Tea Table.** Built behind `TEA_TABLE_OPEN`. The Share step asks for Tea Table consent under the combined wording. Older shares need a fresh choice.
5. **Review or hide.** Behind `TEA_TABLE_OPEN`, eligible tastings appear on explicit share. The platform owner can hide or restore a piece in Guest notes.
6. **Your Table becomes a page.** Built at `/account` behind `YOUR_TABLE_PAGE_OPEN`, off by default pending approval to enable it.
7. **The tea house offering itself.** Answered by Adrian on 2026-11-26: meet the person, find the purpose (many people, social or meditative), see what they already have or rebuild with his aesthetic, then provide only what the house needs, including training the staff to train. Price follows the conversation. Written up in [tea-houses.md](../todo/plans/tea-houses.md), "The offering, as Adrian runs it".

## Build order

The original build order follows the loop. The feature sections above record what is in this checkout, and the bar proposal still needs approval. Each stage is useful by itself and leaves the site whole. What each stage closes, and what it needs from Adrian, is in [guests-and-tea-masters.md](../todo/plans/guests-and-tea-masters.md), "Build stages".

| Stage | What | Touches the bar |
|---|---|---|
| 0 | **Repairs.** The tea master invite address, which appears to land on the wrong page, and the profile screen wording | No |
| 1 | **The words.** Guest, host, tea master, session, table, tea house, used one way everywhere | No |
| 2 | **Function 1, invitations and arrival.** One kind of session, one link, a seat without signing up, the host's door, seats, and the arrival walkthrough on the host's yes | No |
| 3 | **Functions 2 to 4: the tea, the playlist, what is for sale,** and the thank-you that carries them | No |
| 4 | **Functions 5 and 6: tasting, and photographs put together** | No |
| 5 | **The Tea Table, first form**, with its consent and withdrawal gates | No |
| 6 | **Tables (private) and tea houses (public)**, then Build and Work | No |
| 7 | **Favourites in three kinds, and the Tea Chest's three states** | No |
| 8 | **Home in full, and the bar words** in one change. `npm run test:mobile` before and after | Yes |
| 9 | **Quiet acknowledgement, who pours on the people list, the first people articles** | No |
| 9b | **A tea master's shelf and credit** for tea sold through them, tracked from stage 3 | No |
| 10 | **Every tool**: anything on a screen can be said to an agent | No |
| 11 | **Your Table as a page, Read's three shelves, truth-up** of PILLAR, SITE_MAP and the rule wording | Glyph only |
| Later | Short video. The tea tasting box. An app | |

From stage 2 on, each stage ships its voice and agent tools with its screens.

Nothing in this order waits on the Manage rebuild, and nothing in it changes a Manage room.

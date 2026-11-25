# Tea houses: building them as an offering, and the section that shows it

Status: proposal, 2026-11-25. Nothing built. This is the first plan anywhere in the repo for building tea houses as an offering. Until now it was one service row on Advise, one line in the vision ("Designs tea spaces") and one persona. The section shape is in [docs/SECTIONS.md](../../docs/SECTIONS.md).

> **Revised 2026-11-25, second pass.** Adrian: a tea house is "a physical space, somewhere that people can sit down and drink tea. The tea master can create it themselves and host people there." So a house is a place first and a shop is optional, and building one with Adrian is one of three ways a house comes to exist. See [guests-and-tea-masters.md](guests-and-tea-masters.md), "Tea houses, lighter than before". Where this file says a house is an account, read: a house that also wants a shop gets an account.

Adrian, 2026-11-25: "building tea house is an important part for me so it's important to have that as an offering."

## What this plan covers

Two things that belong together:

1. **The offering.** What it means to build a tea house with Adrian, stage by stage, and what the client has at the end.
2. **The section.** A place on the site, with its own word, that shows the offering, the houses already built, and the houses a traveller can visit, and that carries a finished house onto Teajia as an account of its own.

Everything about the offering below is a draft made from what the site already says. Adrian's own facts replace it. The parts that need him are gathered under "What only Adrian can supply".

## Who it is for

Taken from the personas, the vision and the Advise copy already on the site:

- **A founder opening a dedicated tea house.** Knows tea, has often never run a room. Wants to open faster and run better than they could alone.
- **A hotel, retreat, studio, office or private home** making tea part of its daily welcome. A room inside a larger place. This is what `/for-your-space` speaks to today.
- **A tea master who already has a room** and wants the tools, the sourcing and the company of the network, without anyone redesigning their house.
- **A traveller or guest** who is not building anything and only wants to find a table. They use the Visit view.

Someone making a corner at home is not a client of this offering. Craft's "Tea Spaces" and the "Guided Practice Setup" session serve them, and each should link to the other.

## The offering, stage by stage (draft for Adrian to correct)

The Advise page describes the service today as "From concept through opening. Design, curation, tea selection, training, and operations," ending in "a coherent place to share tea, with the people and practical systems to keep it working after opening." The stages below spell that sentence out.

| Stage | What happens | What the client has at the end | What on Teajia serves it |
|---|---|---|---|
| 1. The first conversation | The client says where they are: an idea, a planned space, or an existing room. Adrian listens and says honestly whether and how he can help | A clear next step, and useful starting advice even if they go no further | The guided inquiry that exists today (two questions, advice, contact last), landing in Sales, Waiting |
| 2. The concept | Who the house is for and what welcome they should feel. The site's own advice already says: begin with the people, and the room, menu and training follow | A short written concept: the guests, the feeling, the kind of service, the size | A page of the concept shared privately with the client |
| 3. The room | Layout from arrival to the tea table, atmosphere, light, where water is boiled, where tea and teaware are stored, how service moves | A plan of the room and a list of what to make or buy | Craft's Tea Spaces for vocabulary. Photographs of earlier houses from Work |
| 4. Tea and teaware | A tea menu sourced for these guests and this staff, and the teaware to serve it | A first menu with a reason for every tea, and a teaware set for the room | Shop teaware. The network catalogue and wholesale orders (Curate, Network). Sourcing as Advise describes it for a space |
| 5. The people | Training the team: brewing, service, how to talk about the tea, the daily rhythm | A team that can open the doors and pour with confidence | Craft's Six Foundations as the shared base. Brewing guides when written. Sessions for the training days |
| 6. The opening | The first sessions, hosted together. The house's account on Teajia is made and its shelf, sessions and page are set up | An open house, a first calendar, and a working system from day one | Sessions and RSVP. The store launch playbook. The opening stock guide |
| 7. Afterward | The house runs on Teajia's tools. Tea is restocked through the network. Adrian stays in reach for seasons, new staff and questions | A house that keeps working, and a place in the lineage | Manage for the house's own account. Visit, where it is listed. The Tea Table, where its sessions and people appear. Read, where its story can run |

A client may want all seven, or only some. A tea master with a room may want only stages 6 and 7. A hotel may want 2 to 5 and never open an account. The page should say so plainly.

## What only Adrian can supply

Nothing below should be guessed or written for him.

1. **The stages as he really runs them.** Whether the seven above are right, their order, and how long a build tends to take.
2. **What is included and what is not.** For example whether he draws plans or works beside an architect, and whether teaware and furniture are bought through him.
3. **Price.** Whether the page shows a price, a starting figure, or says that price follows the first conversation. Recommendation: say it follows the conversation, the way the shop says every order is a conversation.
4. **Where he will work.** Bali only, the region, or anywhere, and whether travel is charged apart.
5. **The case studies.** The code holds ten entries in `src/data/adviseProjects.ts`: five spaces (Intaaya Resort, Private Tea Room, The Office, The Living Room, The Art Studio), two events, and three sourcing journeys. For each space: is it a real project, may it be named, and are there photographs he owns. The portfolio has stayed switched off waiting for exactly this.
6. **How many builds at once.** If the honest answer is one or two a year, the page should say that too. Scarcity told plainly suits Teajia better than a sales funnel.
7. **What carrying the Teajia name asks of a house.** The vision calls it a lineage and not a franchise. A sentence or two from him on what a house commits to, and what it never has to give up.

## How it shows on the site

The section has four views. Each is an address, so back and forward work, and each can be linked to directly.

### Overview, `/tea-houses`

One screen. What a Teajia tea house is, in Adrian's words: independent, its own character, part of a lineage. Then three doors: build one, see ones Adrian has built, visit one. One photograph of a real room.

### Build, `/tea-houses/build`

- The stages above, as a calm numbered ledger in the style Advise already uses. No cards grid, no accordion.
- The kinds of client, each with a line: a dedicated house, a room inside your space, a house joining with its own room. `?for=space` opens on the second, which is where `/for-your-space` forwards.
- One primary action, on the right: "Start the conversation". It opens the existing guided inquiry with the design service chosen.
- A second, quieter line for WhatsApp, as `/for-your-space` composes today.

### Work, `/tea-houses/work` and `/tea-houses/work/:slug`

- The houses and rooms Adrian has built: each a photograph, a place, a line.
- Each case study opens on its own address with the three parts the data already holds: what the client wanted, what Teajia did, what came of it. Then photographs, and a link to the house's own page when it is on the network.
- It opens only when at least three case studies are real, named with permission, and photographed with pictures Adrian owns. Until then the Build page stands without it and says nothing about it. No "coming soon" plates.
- The two event entries move to Sessions as recaps if they were real. The three journeys stay on `/advise` under sourcing.

### Visit, `/tea-houses/visit`

- The network directory: every house that chose to be public, each with its place, its line, and a door to its own page at `/store/:slug`.
- This replaces two pages that do the same job today, `/spaces` (rooms with a WhatsApp line) and `/find-a-table` (the storefront directory). Both forward here.
- Its words change from "Find a table" to "Find a tea house", so that "table" is left for people and "house" for places.
- An "ask for an introduction" line, as the working brief suggests, in place of anything that looks like a store locator.
- The connections plan noted that `/spaces` was reported erroring on the live site and could not be reproduced locally. Check it on teajia.com, signed in and signed out, before forwarding it.

### Where Advise goes

`/advise` stays as "work with Adrian": biography, sourcing for a collection, sessions and guidance, sourcing journeys, the testimonial, the inquiry. Its first service row becomes a short pointer into `/tea-houses/build`. The inquiry form, its questions and its advice are shared by both pages; there is one inquiry path.

## The inquiry path

1. A visitor taps "Start the conversation" on Build, or the design row on Advise, or the consult plate on home.
2. The existing guided inquiry opens with "Tea House Design & Curation" chosen. Its two questions stand: where are you in the process, and what needs attention first. It gives the matching advice, then asks for contact details last.
3. It posts to `/api/inquiries` and appears in Sales, Waiting, marked as a tea house inquiry.
4. Adrian replies himself. Nothing is automated. The worker never messages him; he sees it in Manage like any other waiting request.
5. If a build begins, the person becomes a customer in People with a tag for the build, and their notes live on that record.

One addition worth making: a third optional question, "Where is the space?", since place decides so much. It is one line and can be skipped.

## How a finished house becomes an account on the network

Every piece of this exists. What is missing is doing it once, for real, in order. The working plan calls that N1, "second store and wholesale", and puts it after the first operator's sale is proven. The Australia store is the first run.

1. **The account.** Adrian makes an account of kind "location" for the house in Settings, Platform. Accounts are made by hand, on purpose.
2. **The owner.** The founder is invited as its owner and adds staff with the roles in the members guide.
3. **The shelf.** Opening stock comes in by the CSV guide, or tea is carried from the network catalogue through a wholesale order. Prices and currency are the house's own.
4. **The launch walk.** The store launch playbook (`/store-launch-playbook`) is the checklist the owner follows.
5. **The front door.** The house's page is live at `/store/:slug`, or on its own subdomain. It shows its shelf, its sessions and the people at its table.
6. **The directory.** When the owner chooses, the house appears under Visit. The working brief's rule is a good one: a house is part of the network once it has a real profile and a real contribution, with no badge needed.
7. **The life of it.** Its public sessions join the sessions directory. Its hosts have pages under People. What its people share shows on the Tea Table, if the house opted in. Its case study in Work links to it.

A house that was built with Adrian and a house that only joined are the same kind of account. The difference is a line on its page and a case study, never a tier.

## How it connects to every other section

| Section | The connection |
|---|---|
| Read | A finished house can have its story in the magazine. Craft's Six Foundations is the base of staff training. Craft's Tea Spaces links here |
| Tea Table | A house's sessions and its people's tastings appear there. Opening sessions are the first things a new house puts on the table |
| Shop | Teaware for the fit-out. The sourcing that fills the first menu |
| Your Table | "Your tea houses" lists the houses a person belongs to, with the one door into Manage |
| Manage | Inquiries in Sales. The client in People. The account in Settings. The wholesale flow in Curate, Network. Venues in Sessions: a network house is a venue |

## Build stages

No new backend is needed for stages 1 to 3. They are pages, copy, photographs and forwards.

1. **Adrian's facts.** The list under "What only Adrian can supply", gathered in one sitting. The page is written from his answers, in his words.
2. **Overview and Build.** `/tea-houses` and `/tea-houses/build`, in the immersive frame Advise uses, with the inquiry wired. `/for-your-space` forwards. Advise's design row points here. Reached from Advise and the home consult plate. No bar change.
3. **Visit.** `/tea-houses/visit` from the existing network directory. `/spaces` and `/find-a-table` forward. The wording moves from table to house.
4. **Work.** Opens when three case studies are ready. `/advise?v=projects` forwards.
5. **The first real house on the network.** N1 in the working plan, run with the Australia playbook, written down as the model for the next.
6. **The bar word**, as stage 4 of [docs/SECTIONS.md](../../docs/SECTIONS.md), if Adrian chose it.

## Not building

- A franchise kit, a brand template, or anything a house must look like. The vision says lineage, and that stands.
- Tiers, badges, "verified" or "certified" marks on houses.
- Ratings, reviews or rankings of houses.
- A self-serve sign-up that makes an account with no conversation. Every house begins with Adrian saying yes.
- A price calculator or a quote form.
- A project management tool in Manage for builds. An inquiry, a customer record and a tag are enough until several builds run at once.
- A map with pins as the Visit page. A list with places and introductions comes first.
- "Coming soon" plates for case studies that are not ready.
- Stock photographs of rooms Adrian did not build.

## Related files

- The service copy and inquiry: `src/pages/advise/AdviseIndex.tsx`, `src/components/advise/serviceGuidance.ts`, `src/components/advise/InquiryForm.tsx`, `src/pages/advise/adviseLive.ts`.
- The case study data: `src/data/adviseProjects.ts`.
- The pages this section gathers: `src/pages/ForYourSpacePage.tsx`, `src/pages/SpacesPage.tsx`, `src/components/storefront/FindATable.tsx`, `src/pages/StoreLaunchPlaybookPage.tsx`.
- The account model: [docs/MULTI_STORE_PLAN.md](../../docs/MULTI_STORE_PLAN.md), [docs/AUSTRALIA_LAUNCH_PLAYBOOK.md](../../docs/AUSTRALIA_LAUNCH_PLAYBOOK.md), [docs/MEMBERS_AND_ACCESS_GUIDE.md](../../docs/MEMBERS_AND_ACCESS_GUIDE.md), [docs/OPENING_STOCK_CSV_GUIDE.md](../../docs/OPENING_STOCK_CSV_GUIDE.md), [tea-master-onboarding.md](tea-master-onboarding.md).
- The photographs still owed: [launch-photo-upload.md](launch-photo-upload.md) and [docs/OWNED_MEDIA_INVENTORY.md](../../docs/OWNED_MEDIA_INVENTORY.md).
- The people it is for: [docs/brief/PERSONAS.md](../../docs/brief/PERSONAS.md), persona 3, and [docs/VISION.md](../../docs/VISION.md), "Tea House Operators" and "The Lineage, Not Franchise".

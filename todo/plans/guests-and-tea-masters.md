# Guests and tea masters: the two roles everything hangs on

Status: proposal, 2026-11-25. Nothing here is built under these words. It is the second pass of the section overhaul in [docs/SECTIONS.md](../../docs/SECTIONS.md), written from Adrian's answers to five questions on 2026-11-25 and from a full read of the documents and the code that day. The first pass drew the sections. This one says what they are for.

## Adrian's words (2026-11-25)

- "Anyone can join. Tea masters invite people into their event, not into the site as much."
- "This is something that operates digital, which is my own connection, but then physical. Eventually I would like this to be an app as well."
- "Tea house is a physical space, somewhere that people can sit down and drink tea. The tea master can create it themselves and host people there." Tea masters "can serve in other people's houses. There are many masters who might be traveling and not have a room, and some of the rooms may just be me hosting multiple tea masters for an event."
- "At one event I may be a master, at another event I may be a guest. Master is like master of ceremonies. Many people in the audience may be that, but there is only one that is that in the moment."
- Favourites are "favorite articles, favorite tea that's available, their own favorite teas that they've added into their tea chest."
- "This site should have great value to those people who are online only but it should also encourage people to host other people. I think many people won't know what this is when they arrive or what they can do here or what this is all about. We need some interconnectedness but also some freshness on the homepage."
- "This would never become a place that people are scrolling while they are on a tea table."
- "The role is to bring people in connection with others, in deeper connection with themselves, while sharpening their skills, finding ways to dive deeper into the world of tea, finding ways to learn from each other and find these really good teas."
- "Six months to a year off, a tea tasting box would be amazing. Beyond that, I would see many articles showcasing who people really are and why they love tea."
- "This should be all doable very quickly. So if someone does use their phone at a tea table they can put it away right away."

## The model in one screen

**Everyone is a guest. At a session, one person is its tea master.**

| Word | What it means from now on | What it is not |
|---|---|---|
| **Guest** | Anyone at a session who is not pouring. Away from a session, everyone: you read, you put things on the tea table, you keep favourites, you find tea. | A lower rank. A signed-out visitor is called a visitor, not a guest. |
| **Tea master** | The one who pours and leads a given session: its master of ceremonies. There is exactly one per session. The same person is a guest at the next one. | A permanent class of account. |
| **Session** | A time when people sit down for tea. It names its tea master, its tea house (or "a private table"), and its teas. | A place. |
| **Tea house** | A physical place where people can sit down and drink tea. It has a keeper. Tea masters pour there, including travelling ones who have no room of their own. | A shop. A house may also have a shop, and many will not. |
| **The Tea Table** | What people chose to share after sitting or tasting, in time order. | A feed to scroll at the table. |

Three things were tangled and are now apart: **who a person is** (the word on their page), **what they are doing at this session** (tea master or guest), and **where it happens** (a tea house or a private table).

The word on a person's page stays as Adrian decided on 2026-11-19: Teajia family for anyone, tea creator and tea master granted by him. Pouring one session does not change that word. It adds the session to the person's page under Sessions.

## The loop

The whole site is one circle, and every section is a part of it.

1. **Invite.** A tea master opens a session and sends its invitation to people they know. The invitation is to the session, not to the site.
2. **Sit.** People meet in a tea house or at a private table. The phone stays away.
3. **Put on the table.** Afterward, a guest adds a note, a photograph or a tasting of what was poured. Each takes one screen.
4. **Keep.** Guests and tea masters keep favourites: articles, teas the shop has, teas in their own Tea Chest.
5. **Find the tea.** A favourite or a tasting leads to the tea itself, in the shop or from the person who holds it.
6. **Host.** A guest who wants to pour opens their own session and invites people. They are its tea master.

Someone who is only ever online still has steps 3 to 5 in full: read, taste at home, share, keep, find tea. The site should be worth their time without a single session, and should keep quietly showing them step 6.

## How the sections serve the loop

| Section | For a guest | For a tea master |
|---|---|---|
| **Home** | What this is, what is fresh, and two doors: come to a table, host a table | The same page. Nothing changes by role |
| **Read** | Learn tea; meet the people through articles about who they are | Be written about; point guests at the course before a session |
| **Tea Table** | Find a session, see what people shared, meet the people | Open a session, invite, publish its recap |
| **Tea Houses** | Find a place to sit down | Add your house, pour in someone else's, or build one with Adrian |
| **Shop** | Find the teas you tasted or saw chosen | Your chosen teas carry your name on their pages |
| **Your Table** | Journal, favourites, Tea Chest, your seats | The same, plus the sessions you pour and your houses |
| **Manage** | Not seen | The working rooms, when you run a shop or public sessions |

## What is built already (read from the code, 2026-11-25)

- Anyone can sign up, by email or Google. The first shared tasting makes a live family page.
- The page tier exists: family, tea creator, tea master (`contributors.page_tier`), and the printed word comes from it.
- Sessions with RSVP and approval, a plus-guest link for an attending guest, an after-sit link, and a Guest Book entry per verified guest.
- A member can hold a private sit, invite one person by link, and publish it as a casual recap.
- Public hosts are credited on a session by role (lead host, co-host).
- Public favourites with notes for any page, nameable as one collection. Private favourites ("remember"). The Tea Chest.
- The tasting journal, the Share step, family photographs on tea pages and on the person's page.
- Venues in Manage, Sessions. Store pages at `/store/:slug` with "the people at this table".

## The gaps

Each gap has a number. The build stages below refer to them.

| # | Gap | What is there today |
|---|---|---|
| G1 | **The tea master invite link looks broken.** The worker sends `/invite/<token>` for account and tea master invites, and the site reads that address as a session plus-guest invite, so it would answer "Invite not found". Read from both sides of the code; not yet tried on the live site | `/invite/:token` renders `GuestInviteClaimPage`, which only looks in `guest_invites` |
| G2 | **A tea master cannot invite guests to a session in one move.** There is no single link or code a tea master can send to a group | RSVP on the public page, a plus-guest link per attendee, one invite per member sit |
| G3 | **A session does not name its tea master and its house as two separate things** that a visitor can open | Hosts by role, venues in Manage |
| G4 | **A tea house cannot exist without a shop account, and a tea master cannot add one.** Only Adrian makes accounts | Venues (private to Manage), accounts of kind location |
| G5 | **No place shows what guests shared.** Shared tastings appear per person and per tea only | `/tea-feed`, switched off, formal recaps only |
| G6 | **After a sit, "put on the table" is several doors.** Guest Book, tasting, excerpt and photograph each start somewhere else | All four exist |
| G7 | **Favourites are three lists that do not meet**, and none holds articles or Tea Chest teas in public | `user_favorites`, `profile_favorites`, `saved_collections`; the saved-story question is open in track 1 |
| G8 | **Home does not say what this is, shows no people or sessions, and offers no way to host.** Its four links still read shop, read, craft, advise | `HomeV2Page`: opener, three plates, approved tasting quotes, the house section |
| G9 | **The people list does not show who pours.** Tea creators and tea masters share one group | "This season", "Founding members", "The family" |
| G10 | **The words are crossed.** The profile screen tells everyone to "prepare your Tea Master profile". Opening a Tea Chest gives a person an account of kind "master". "Guest" means three things | See "The words" below |
| G11 | **Nothing invites a guest to host.** The private sit is reachable only from Journey | `/account/journey/sit-invite` |
| G12 | **Few articles show who people are.** Five published pieces, one batch | A completed session can already become a magazine draft |

## The quick rule

Adrian's test, and the one rule that settles the old disagreement between "the app never sits at the tea table" and "capture at the table is allowed":

> **Thirty seconds, then away.** Anything a person might do with a phone at a tea table is one screen and one action, saves by itself, and asks nothing afterward. Everything that takes longer, and everything that scrolls, belongs to before or after.

What follows from it:

- Taking a seat from an invitation: open the link, give a name, done. No account needed to sit down.
- A photograph or a one-line note during a sit: one tap to open, one to save. Words, crop and sharing wait until later.
- The Tea Table, Read, the shop and the people list are never linked from a screen meant for the table.
- The after-sit link arrives after the session ends, not during it.
- No screen meant for the table shows a list longer than the session's own teas.

This is a proposal for the standing rules. It would replace the phrase "never during (no phone-at-the-table features)" in `CLAUDE.md` once Adrian confirms the wording.

## The words

Fix once, then use everywhere:

- **Visitor**: someone not signed in.
- **Guest** and **tea master**: roles at a session, as above.
- **Teajia family, tea creator, tea master** on a page: unchanged from 2026-11-19. Where a sentence could mean either the page word or the session role, write "pouring this session" for the role.
- **Keeper**: the person who looks after a tea house. A new word, and Adrian may prefer another.
- **Member** stays the word for staff of an account in Manage, and stops being used for "anyone signed in".
- In the data, a Tea Chest account stops being kind "master" in what a person is shown. Whether the stored value changes is a build question, since a rename touches money and stock tables.

## Favourites, as Adrian described them

One idea in three kinds, the same for a guest and a tea master:

| Kind | What it is | Today |
|---|---|---|
| Articles | Pieces you want to keep or recommend | Saved stories exist but are the open question in track 1. This answers it: make them real |
| Teas the shop has | Teas you chose, each with a line on why | Built, private and public |
| Teas in your own Tea Chest | Teas you hold and love, whether or not the shop has them | The Tea Chest is private. Showing one as a favourite is new |

Each favourite is private until its owner shows it on their page, as now. A shown shop tea keeps "Selected by" on the tea's page. A shown Tea Chest tea says plainly that it is from the person's own chest and leads to "ask about this tea", never to a price, unless the person has offered a pack through their own storefront.

The four personal records stay separate, as the pillar requires. A favourite is a pointer to an article, a tea or a chest tea. It does not merge the journal, the chest and the journey.

## Tea houses, lighter than before

The first pass treated a tea house as an account with a shop. Adrian's answer makes it a place first.

- **A house is a place**: a name, where it is, a photograph, a line, its keeper, and the sessions held there. Nothing else is required.
- **A tea master can add their own**, from Your Table. It shows on their page at once. It joins the public list under Visit when Adrian says yes, which keeps the list honest without a badge.
- **A session picks its house** from the tea master's own, from a house whose keeper agreed, or "a private table" with the place shown only to confirmed guests, as sessions do now.
- **Tea masters pouring in other houses** is simply sessions: the house page lists who has poured there, taken from its sessions.
- **A shop is a branch.** A house that wants a shelf gets an account as today, by Adrian's hand. The onboarding plan already says "the person is the trunk and the shop is a branch". The same now holds for a house.
- **Building a house with Adrian** stays the offering in [tea-houses.md](tea-houses.md). It is one of three ways a house comes to exist: you already have one, you make one yourself, or you build one with him.

## Home

Adrian asked whether it is true that Home needs more connection and more freshness. From the code: yes. Home has no people, no sessions, no shared tastings and no favourites on it, its links name two sections this overhaul retires, and its only living content is the approved tasting quotes.

Proposed order, top to bottom. The closing house section, with 佳 家 嘉 and its copy, is kept in full.

1. **What this is.** One sentence, then four plain lines that are also the four bar words: learn tea, sit at a table, find a tea house, find good tea.
2. **Two doors.** "Come to a table" (the next sessions and the houses) and "Host a table" (open a session and invite people). The second door is how the site keeps encouraging people to host.
3. **Fresh, from the loop.** Up to four quiet strips, each shown only when it has something real: the next session with its tea master and house, the latest three things on the tea table, one person from an article about who they are, and the selected tea. An empty strip is not shown and is never filled with made-up items.
4. **The three plates** it has now, kept: the lead story, the selected tea, the consult plate leading to Tea Houses.
5. **The house section**, unchanged.

Home is the same for everyone. What is yours stays in Your Table. Until sessions and shared tastings flow on their own, the pillar's rule holds: the living signal is written by a person.

## Later, and worth preparing for

- **The tea tasting box, six to twelve months out.** A set of teas sent to many people, tasted at home or poured by a host for friends, with everyone's tastings gathered on the Tea Table under that box. Three things prepare for it without building it: sets that can actually be bought (a line in `TODO.md` today), tastings gathered per tea, and the session invitation. It gives online-only people a table of their own.
- **Articles about people.** A standing series in Read: who someone is and why they love tea. One per person, linked from their page and from Home. A completed session can already become a magazine draft, which is one easy source.
- **An app.** Nothing in this plan blocks it. Every step is an address, every table screen is one action, and the invitation is a link. The first form is the site added to a phone's home screen. A store app is its own decision later.
- **Ideas from the August working brief that now have a place**: Open Tables (a public session anyone may ask to join), Table Record (what a session leaves behind, which is the recap and Guest Book), Introductions, not profiles (the people articles), Second Table in a Box (the tasting box poured by a new host).

## Build stages

Each stage leaves the site whole and is useful by itself. None changes a bar word until stage 8. The standing priority in the working plan (one real shop loop, one real editorial item, one real sit) is not displaced: stages 1 to 4 are exactly what a real sit needs.

| Stage | What gets built | Closes | Needs from Adrian |
|---|---|---|---|
| 0 | **Repairs.** Confirm G1 on the live site and fix the invite address so account and tea master invites land on a page that accepts them. Correct the profile screen wording. No new idea in either | G1, part of G10 | Nothing |
| 1 | **The words.** Vocabulary above applied to copy, the plans, the pillar and the standing rules. No code beyond labels | G10 | Decisions 1 and 5 |
| 2 | **Invite to a session.** A tea master gets one invitation for a session: a link and a short code to send on WhatsApp. A guest opens it, gives a name, and has a seat, with the tea master's approval where the session asks for it. Signing up is offered afterward, never required. A private sit may invite more than one person | G2, G11 | Decision 2 |
| 3 | **A session names its tea master and its house.** Both open from the session page. A person's page lists the sessions they poured. A "Host a table" door in Your Table and on the Sessions view | G3, G11 | Nothing |
| 4 | **After the sit, one screen.** The after-sit link opens "put on the table": a note, a photograph, or a tasting of any tea poured, each one action. It reuses the Guest Book, the tasting screen and the photo editor that exist | G6 | Nothing |
| 5 | **The Tea Table, first form.** `/tea-table` with sessions poured and what guests shared, as [tea-table.md](tea-table.md) stages 1 to 4 describe, including its consent and withdrawal gates | G5 | The Tea Table rule exception; one real sit |
| 6 | **Tea houses as places.** A public house page, "add your tea house" in Your Table, the Visit list, and who has poured there. Then Build and Work from [tea-houses.md](tea-houses.md) | G4 | Decision 3; his facts for the build offering |
| 7 | **Favourites in three kinds.** Articles, shop teas and Tea Chest teas on one favourites page per person, private until shown | G7 | Decision 4 |
| 8 | **Home, and the bar words.** The new Home order, then the one change to bar, rail, phone menu and keyboard keys. Home's first two parts can ship earlier, with stage 3, since they need no new data | G8 | The explicit yes on the words |
| 9 | **The people list and the people articles.** The list shows who pours (a "pouring" line and the next session beside a person, no counts). The first three people articles | G9, G12 | Three people to write about |
| 10 | **Your Table as a page, Read's three shelves, truth-up.** As [docs/SECTIONS.md](../../docs/SECTIONS.md) had them | none new | Decision 6 of the first pass |
| Later | The tea tasting box. The app | | |

## Decisions for Adrian

Five. Each has a recommendation, and "yes" to all five is a complete answer.

1. **The words.** Everyone is a guest; the one pouring a session is its tea master; the word on a person's page stays your grant. Recommended: yes.
2. **Who may host.** Recommended: anyone may host a private sit by invitation. A session listed publicly, on the calendar or under a tea house, is for tea creators, tea masters and houses, as now.
3. **A tea house is a place first.** A tea master adds their own, it shows on their page at once, and it joins the public Visit list when you say yes. A shop is optional and still made by you. Recommended: yes.
4. **Tea Chest teas as public favourites.** This opens family decision 8 by one notch: a chest tea may be shown as a favourite with a line of words, and still may not carry a public tasting. Recommended: yes.
5. **The quick rule** as written above, replacing "never during" in the standing rules. Recommended: yes.

Still open from the first pass and unchanged by this one: the four bar words (read, table, houses, shop), the Tea Table rule exception, the share wording, review or hide, Your Table as a page, and your facts for the build offering. They are listed in [docs/SECTIONS.md](../../docs/SECTIONS.md).

## Not building

- Ranks, levels or badges for guests or tea masters. No count of sessions poured or attended on anyone's page.
- A public list of who attended a session. The events decision stands: no attendee directories.
- Following a tea master, or being told when they open a session.
- A sign-up wall in front of an invitation.
- Any screen at the table that scrolls.
- A rating of tea masters, houses or sessions.
- An application form to become a tea master. The word on the page stays Adrian's to give.

## Related files

- The sections: [docs/SECTIONS.md](../../docs/SECTIONS.md). The other three plans of the overhaul: [tea-table.md](tea-table.md), [tea-houses.md](tea-houses.md), [your-table.md](your-table.md).
- People: [teajia-family.md](teajia-family.md), [tea-master-onboarding.md](tea-master-onboarding.md), [creator-profiles.md](creator-profiles.md), `worker/src/familyPages.ts`, `worker/src/peopleList.ts`, `src/pages/ContributorProfilePage.tsx`.
- Sessions: [docs/superpowers/specs/2026-08-10-events-platform-rebuild-design.md](../../docs/superpowers/specs/2026-08-10-events-platform-rebuild-design.md), `worker/src/eventDomain.ts`, `src/pages/GuestInviteClaimPage.tsx`.
- Home: `src/pages/HomeV2Page.tsx`.
- Favourites: `src/components/profile/ProfileFavoritesEditor.tsx`, [docs/tracks/01-launch-integrity.md](../../docs/tracks/01-launch-integrity.md).
- The broader ideas: [docs/TEAJIA_WORKING_BRIEF.md](../../docs/TEAJIA_WORKING_BRIEF.md), [docs/VISION.md](../../docs/VISION.md).

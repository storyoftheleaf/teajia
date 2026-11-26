# Guests and tea masters: the two roles everything hangs on

Status: proposal, 2026-11-25, revised 2026-11-26 from Adrian's second round of answers. Nothing here is built under these words. It is the second pass of the section overhaul in [docs/SECTIONS.md](../../docs/SECTIONS.md), written from Adrian's answers to five questions on 2026-11-25 and from a full read of the documents and the code that day. The first pass drew the sections. This one says what they are for.

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

## Adrian's words, second round (2026-11-26)

- On the words: "Under one. Yes. One event can also have multiple tea masters." And: "The creator of the event is the main host usually and there can be other people who serve there. Anyone may also sit in."
- On what a session page is for: "to make it easier for them to understand who is coming to it and which seats are filled, as well as connect with people after so they can understand what was drunk, how much it was, that was actually for sale, and have a place for photos so other people can look in and get excited about the future ones."
- On before and after: "A lot of times the invitation will happen before they arrive there and the follow-up will happen after to keep people engaged, almost like a thank you note."
- On during: "people may take random photos, this is semi-common, sometimes even videos, and then I often post them on Instagram. Sometimes they will take notes of what tea they like, what they didn't, flavors, all that."
- On the follow-up: the tea master "can ask them for their feelings around the teas if they remember. As well as show them if there was a playlist going, links to the teas that were actually drunk, and asking if they could put photos about the little event or gathering if they took any. It should be a really cool UI, UX like that. And there needs to be a clear why the person does this."
- On words: "it can get words from people who said what it was like, what it meant to them." And: "Me as a master hosting the event can state something."
- On acknowledgement: "It's a slight bit of gamification without being obvious." And: "You don't want to have to feel like you post a lot or have to show up to a lot of events to have a big title," while "simultaneously you want to acknowledge and respect the people who are active and develop these things as well."
- On place: "A tea master never had a physical location that's publicly viewable. Those are only privately viewable and location based, like area-based. They're adding a table. They're inviting someone to their home."
- On the Tea Chest: "A tea chest tea may be a favorite tea. It may also be something that a tea master occasionally allows people to purchase. It can also be something not served, meaning it's not available for sale."
- On the phone: "30 second rule isn't quite true because sometimes this will happen during or the end or the beginning." And: "We're not trying to control people, but we don't want people in their mind or on the app as much unless that's what the specific set is around. For example, a tea tasting. We might all be writing it down. Either on paper or in our app."
- On the tools: "On the admin side, I want all of the aspects of the teas to be MCP'd so that I might not even have to go through the interface to do this. Eventually I can help people hook this up to their ChatGPT to do the same."

## The model in one screen

**Everyone is a guest. A session has a host, and may have other tea masters pouring.**

| Word | What it means from now on | What it is not |
|---|---|---|
| **Guest** | Anyone at a session who is not pouring. Away from a session, everyone: you read, you put things on the tea table, you keep favourites, you find tea. | A lower rank. A signed-out visitor is called a visitor, not a guest. |
| **Tea master** | Someone pouring at a given session. The one who created it is its **host**, the master of ceremonies. Others may serve beside them. The same person is a guest at the next one. | A permanent class of account. |
| **Session** | A time when people sit down for tea. It names its host, anyone else pouring, where it is, its seats and its teas. It is either an ordinary sit or a tasting. | A place. |
| **Table** | A tea master's own place to pour, usually their home. Private. The public sees only the area, and a confirmed guest sees the address. | Something listed or searchable. |
| **Tea house** | A public place where people can sit down and drink tea. It has a keeper and chose to be seen. Tea masters pour there, including travelling ones who have no table of their own. | A tea master's home. A shop: a house may also have one, and many will not. |
| **The Tea Table** | What people chose to share after sitting or tasting, in time order. | A feed to scroll at the table. |

Three things were tangled and are now apart: **who a person is** (the word on their page), **what they are doing at this session** (tea master or guest), and **where it happens** (a public tea house or someone's private table).

The word on a person's page stays as Adrian decided on 2026-11-19: Teajia family for anyone, tea creator and tea master granted by him. Pouring one session does not change that word. It adds the session to the person's page under Sessions.

## The loop

The whole site is one circle, and every section is a part of it.

1. **Invite.** A host opens a session and sends its invitation to people they know, before the day. The invitation is to the session, not to the site.
2. **Sit.** People meet at a table or in a tea house. The app asks for nothing. Someone may take a photograph.
3. **Put on the table.** Afterward the host sends a thank-you. Guests add their words, their photographs, and what they thought of the teas.
4. **Keep.** Guests and tea masters keep favourites: articles, teas the shop has, teas in their own Tea Chest.
5. **Find the tea.** A favourite or a tasting leads to the tea itself, in the shop or from the person who holds it.
6. **Host.** A guest who wants to pour opens their own session and invites people. They are its tea master.

Someone who is only ever online still has steps 3 to 5 in full: read, taste at home, share, keep, find tea. The site should be worth their time without a single session, and should keep quietly showing them step 6.

## A session: before, during, after

This is the heart of the build. One session page carries all three, and it changes with the clock.

| When | The host | A guest | What the page shows |
|---|---|---|---|
| **Before** | Opens the session, names who else is pouring, sets the seats, sends one invitation link | Opens the link, gives a name, has a seat. No sign-up needed | To the public: the day, the area, the host, seats open. To confirmed guests: the address and who is coming |
| **During, an ordinary sit** | Pours. May add the teas as they are served | Nothing is asked. The camera is one tap for the space, a pot, the mess at the end. A video now and then | Nothing new. The app sends nothing and asks nothing |
| **During, a tasting** | Has chosen "this is a tasting", so writing is the point | Notes each tea, on paper or in the app | The teas in order, one at a time |
| **After** | Sends the thank-you: their own words, the teas poured with links, the playlist, and three asks | Answers any, all or none: how the teas felt, a few words on what it was like, photographs they took | The session's record, for those who were there. What each person chose to share appears on the Tea Table |

**Why a guest answers the thank-you.** They get something first: the list of what they drank, each tea with its page, its price and whether any is for sale, the playlist, everyone's photographs, and the host's note. Their own words and pictures complete a record that is theirs to keep in Journey. It is a gift exchanged, never a form.

**Why a host sends it.** They get their guests' words about what it meant, photographs of their own session, and a page that lets the next guests "look in and get excited about the future ones".

**Seats.** The host and confirmed guests see who is coming. The public sees how many seats are open and never a list of names. The events decision stands: no public attendee lists.

**What is already built for this:** RSVP and approval, the after-sit link, the Guest Book entry, the post-event form with the session's teas, the tasting screen, a host's recap, and a structured tasting the host opts into. A playlist appears in the post-event views. What is missing is one invitation for a group, more than one tea master on a session, the thank-you as a single composed message, and one screen for the guest's answer.

## How the sections serve the loop

| Section | For a guest | For a tea master |
|---|---|---|
| **Home** | What this is, what is fresh, and two doors: come to a table, host a table | The same page. Nothing changes by role |
| **Read** | Learn tea; meet the people through articles about who they are | Be written about; point guests at the course before a session |
| **Tea Table** | Find a session, see what people shared, meet the people | Open a session, invite, publish its recap |
| **Tea Houses** | Find a public place to sit down | Pour in a house, keep one, or build one with Adrian. Your own table stays private, in Your Table |
| **Shop** | Find the teas you tasted or saw chosen | Your chosen teas carry your name on their pages |
| **Your Table** | Journal, favourites, Tea Chest, your seats | The same, plus the sessions you pour, your table and your houses |
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
| G13 | **A session cannot be run by voice or agent end to end.** Invitation, who is pouring, the thank-you, the answers, recap, tables, favourites and the Tea Chest have no tools | 125 tools, strong on teas, stock and sales, thin on sessions and people |
| G14 | **There is no thank-you.** Nothing composes the host's note, the teas poured with price and availability, the playlist and the three asks into one message | After-sit link, post-event form, recap, each separate |
| G15 | **A session has one host in the plan and no way to show others pouring as tea masters**, and a private table does not exist apart from a venue | Host roles on a session, venues in Manage |
| G16 | **Video.** People take short videos and nothing accepts them | Photographs only, shrunk on the phone before upload |

## The phone at the table

The first draft of this rule said "thirty seconds, then away". Adrian corrected it on 2026-11-26: people take a picture of the room midway, of a pot they liked, of the mess at the end, and some sessions are tastings where everyone writes. "We're not trying to control people, but we don't want people in their mind or on the app."

> **The app never asks during a session.** It sends nothing, prompts nothing and shows nothing to scroll while people are sitting. What a person chooses to do is quick: the camera is one tap and saves by itself. A tasting is the one kind of session where writing is the point, and the host chooses it.

What follows from it:

- Taking a seat from an invitation: open the link, give a name, done.
- A photograph during a sit: one tap to open, one to save. Words, crop and sharing wait until later.
- The thank-you is sent after the session ends, by the host's hand, not on a timer during it.
- The Tea Table, Read, the shop and the people list are not linked from a screen meant for the table.
- In a tasting, each tea is one screen, and paper is as welcome as the app. A host can enter a guest's paper notes afterward, or the guest can.

This is a proposal for the standing rules. It would replace the phrase "never during (no phone-at-the-table features)" in `CLAUDE.md` once Adrian confirms the wording.

## Quiet acknowledgement

Adrian wants active people respected without anyone feeling they must post often or attend often to earn a title. He calls it "a slight bit of gamification without being obvious". The rules against gamification stand, so this is a proposed third exception, and it is made only of things one person gives another.

| What | Who gives it | What it is not |
|---|---|---|
| A thank-you after a session | The host, to each guest | Automatic |
| Being quoted: your words on the session's page and the host's page, with your name | The host chooses the words | A count of how often |
| "Photograph by" on a picture that is used | Whoever uses it | A tally |
| "Poured with" on a session, when you served beside the host | The host | A rank |
| The word on your page: tea creator, tea master, founding member | Adrian, by hand, for what a person has grown | A threshold reached |
| A place nearer the top of the family list | Order only, as decided 2026-11-21 | Explained anywhere |
| Your own Journey: the tables you sat at, the teas you met | Yourself, privately | Shown to anyone else |

Nothing here counts, levels up, expires or nudges. No number of sessions, posts or photographs appears on anyone's page.

## Everything by voice or agent

Adrian wants every part of this workable without the screens, and later wants to help other tea masters connect their own assistant.

What exists (read from `worker/src/mcpTools/`, 125 tools): teas, stock, sourcing, purchases, orders, payments, customers, collections, articles, and for sessions: create, update, read, list, RSVPs, approve an RSVP, lifecycle, and a magazine draft from a session. Tasting excerpts and offered photographs can be reviewed.

What is missing for this plan, each a new module in `worker/src/mcpTools/`, with preview and confirm on every write as the rule requires:

| Tool group | What it lets a host say |
|---|---|
| Session invitation | "Make the invitation for Saturday and give me the link" |
| Who is pouring | "Add Mei as pouring with me on Saturday" |
| Teas poured | "We drank these four, in this order" |
| The thank-you | "Draft the thank-you for Saturday's guests", then "send it" |
| What came back | "What did people say about Saturday", "show me the photographs offered" |
| Recap and the Tea Table | "Publish Saturday's recap", "hide that item" |
| People | "Make Mei a tea creator", "show me who shared this month" |
| Tables and tea houses | "Add my table in Penestanan", "list the tea houses" |
| Favourites and the Tea Chest | "Show my chest tea as a favourite", "offer 50 grams of it" |

Two rules for this. Every new screen in this plan ships with its tool in the same stage, so the tools never fall behind again. And a tea master's own token is scoped to their own sessions, table and teas, which is what makes it safe to connect someone else's assistant later. `/mcp` is a standard connection, so it is not tied to one assistant.

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

Each favourite is private until its owner shows it on their page, as now. A shown shop tea keeps "Selected by" on the tea's page.

A Tea Chest tea has three states, in Adrian's words of 2026-11-26, and its owner picks one: **kept** (private, the default), **shown** as a favourite and not for sale ("not served"), or **offered**, when a tea master lets people buy some for a while. Offered uses the pack and storefront that exist, with the full payment going to that person. Shown says plainly that the tea is from the person's own chest and has no price.

The four personal records stay separate, as the pillar requires. A favourite is a pointer to an article, a tea or a chest tea. It does not merge the journal, the chest and the journey.

## Tables and tea houses

Two kinds of place, and they must never be confused.

- **A table is private.** A tea master adds their table: a name, an area, a photograph if they wish. It is usually their home. It is never listed, never searchable and never on a map. A session at a table shows the area to the public and the address only to confirmed guests, as sessions do now. A travelling tea master may have no table at all.
- **A tea house is public.** It is a place that chose to be seen: a name, where it is, a photograph, a line, its keeper, and the sessions held there. It joins the Visit list when Adrian says yes.
- **A session picks its place** from the host's own table, a table or house whose keeper agreed, or a place named only for that day.
- **Tea masters pouring in other houses** is simply sessions: a tea house page lists who has poured there, taken from its sessions. A private table shows no such list.
- **A shop is a branch.** A house that wants a shelf gets an account as today, by Adrian's hand.
- **Building a house with Adrian** stays the offering in [tea-houses.md](tea-houses.md). It is one of three ways a public house comes to exist: it is already there, its keeper adds it, or it is built with him.

## Home

Adrian asked whether it is true that Home needs more connection and more freshness. From the code: yes. Home has no people, no sessions, no shared tastings and no favourites on it, its links name two sections this overhaul retires, and its only living content is the approved tasting quotes.

Proposed order, top to bottom. The closing house section, with 佳 家 嘉 and its copy, is kept in full.

1. **What this is.** One sentence, then four plain lines that are also the four bar words: learn tea, sit at a table, find a tea house, find good tea.
2. **Two doors.** "Come to a table" (the next sessions and the houses) and "Host a table" (open a session and invite people). The second door is how the site keeps encouraging people to host.
3. **Fresh, from the loop.** Up to four quiet strips, each shown only when it has something real: the next session with its host and its area or tea house, the latest three things on the tea table, one person from an article about who they are, and the selected tea. An empty strip is not shown and is never filled with made-up items.
4. **The three plates** it has now, kept: the lead story, the selected tea, the consult plate leading to Tea Houses.
5. **The house section**, unchanged.

Home is the same for everyone. What is yours stays in Your Table. Until sessions and shared tastings flow on their own, the pillar's rule holds: the living signal is written by a person.

## Later, and worth preparing for

- **The tea tasting box, six to twelve months out.** A set of teas sent to many people, tasted at home or poured by a host for friends, with everyone's tastings gathered on the Tea Table under that box. Three things prepare for it without building it: sets that can actually be bought (a line in `TODO.md` today), tastings gathered per tea, and the session invitation. It gives online-only people a table of their own.
- **Articles about people.** A standing series in Read: who someone is and why they love tea. One per person, linked from their page and from Home. A completed session can already become a magazine draft, which is one easy source.
- **An app.** Nothing in this plan blocks it. Every step is an address, every table screen is one action, and the invitation is a link. The first form is the site added to a phone's home screen. A store app is its own decision later.
- **Ideas from the August working brief that now have a place**: Open Tables (a public session anyone may ask to join), Table Record (what a session leaves behind, which is the recap and Guest Book), Introductions, not profiles (the people articles), Second Table in a Box (the tasting box poured by a new host).

## Build stages

Each stage leaves the site whole and is useful by itself. None changes a bar word until stage 8. The standing priority in the working plan (one real shop loop, one real editorial item, one real sit) is not displaced: stages 1 to 4 are exactly what a real sit needs. From stage 2 on, every stage ships its voice and agent tools with its screens.

| Stage | What gets built | Closes | Needs from Adrian |
|---|---|---|---|
| 0 | **Repairs.** Confirm G1 on the live site and fix the invite address so account and tea master invites land on a page that accepts them. Correct the profile screen wording | G1, part of G10 | Nothing |
| 1 | **The words.** Vocabulary applied to copy, the plans, the pillar and the standing rules. No code beyond labels | G10 | His yes on the phone rule wording |
| 2 | **Before: invite to a session.** One invitation link and code per session. A guest opens it, gives a name, has a seat. A session names its host and anyone else pouring, and its place: a private table (area only) or a tea house. Seats open shown to the public, who is coming shown to confirmed guests. A private sit may invite more than one person | G2, G3, G11, G15 | Decision 2 |
| 3 | **After: the thank-you.** The host composes one message from the session: their words, the teas poured with links, price and what is for sale, the playlist, and the three asks. The guest answers on one screen: how the teas felt, what it was like, photographs. It reuses the Guest Book, the tasting screen and the photo editor | G6, G14 | Nothing |
| 4 | **During.** The one-tap camera for a session, and "this is a tasting" as the host's choice with one screen per tea. Paper notes can be entered afterward | part of G6 | Nothing |
| 5 | **The Tea Table, first form.** `/tea-table` with sessions poured, the words people shared and their photographs, as [tea-table.md](tea-table.md) describes, with its consent and withdrawal gates. A "Host a table" door | G5 | The Tea Table rule exception; one real sit |
| 6 | **Tables and tea houses.** "Add your table" in Your Table, private. Public tea house pages, the Visit list, who has poured there. Then Build and Work from [tea-houses.md](tea-houses.md) | G4 | His facts for the build offering |
| 7 | **Favourites in three kinds, and the Tea Chest's three states.** Articles, shop teas and chest teas on one favourites page, private until shown | G7 | Nothing |
| 8 | **Home, and the bar words.** The new Home order, then the one change to bar, rail, phone menu and keyboard keys. Home's first two parts can ship earlier, with stage 2 | G8 | The explicit yes on the words |
| 9 | **Quiet acknowledgement, the people list, and the people articles.** Quoted words and "poured with" on pages, who pours on the people list, the first three people articles | G9, G12 | Decision 3; three people to write about |
| 10 | **Every tool.** A sweep so that anything a host or keeper can do on a screen can be said to an agent, and a scoped token a tea master can connect themselves | G13 | Nothing |
| 11 | **Your Table as a page, Read's three shelves, truth-up.** As [docs/SECTIONS.md](../../docs/SECTIONS.md) had them | none new | Decision 6 of the first pass |
| Later | Short video. The tea tasting box. The app | G16 | |

## Decisions for Adrian

**Answered on 2026-11-26.** The words: yes, with the host and other tea masters pouring. A tea master's place is a private table, never public. A Tea Chest tea may be kept, shown as a favourite, or offered for a while. The thirty-second rule was wrong and is rewritten above.

**Still open, three.** Each has a recommendation, and "yes" to all three is a complete answer.

1. **The phone rule as now written:** "The app never asks during a session," with a tasting as the host's choice. Recommended: yes. It replaces "never during" in the standing rules.
2. **Who may host.** Recommended: anyone may host a private sit by invitation. A session listed publicly, on the calendar or under a tea house, is for tea creators, tea masters and houses, as now.
3. **Quiet acknowledgement as a third exception** to the rule against gamification, exactly as the table above: only things one person gives another, and no numbers anywhere. Recommended: yes.

Still open from the first pass and unchanged: the four bar words (read, table, houses, shop), the Tea Table rule exception, the share wording, review or hide, Your Table as a page, and your facts for the build offering. They are listed in [docs/SECTIONS.md](../../docs/SECTIONS.md).

## Not building

- Ranks, levels or badges for guests or tea masters. No count of sessions poured or attended on anyone's page.
- A public list of who attended a session. The events decision stands: no attendee directories.
- Following a tea master, or being told when they open a session.
- A sign-up wall in front of an invitation.
- Anything that prompts, notifies or scrolls during a session.
- A public address, map or listing for a tea master's own table.
- A thank-you sent by a timer, or a reminder to a guest who did not answer one.
- A rating of tea masters, houses or sessions.
- An application form to become a tea master. The word on the page stays Adrian's to give.

## Related files

- The sections: [docs/SECTIONS.md](../../docs/SECTIONS.md). The other three plans of the overhaul: [tea-table.md](tea-table.md), [tea-houses.md](tea-houses.md), [your-table.md](your-table.md).
- People: [teajia-family.md](teajia-family.md), [tea-master-onboarding.md](tea-master-onboarding.md), [creator-profiles.md](creator-profiles.md), `worker/src/familyPages.ts`, `worker/src/peopleList.ts`, `src/pages/ContributorProfilePage.tsx`.
- Voice and agent tools: [docs/claude/mcp.md](../../docs/claude/mcp.md), `worker/src/mcpTools/events.ts`.
- Sessions: [docs/superpowers/specs/2026-08-10-events-platform-rebuild-design.md](../../docs/superpowers/specs/2026-08-10-events-platform-rebuild-design.md), `worker/src/eventDomain.ts`, `src/pages/GuestInviteClaimPage.tsx`.
- Home: `src/pages/HomeV2Page.tsx`.
- Favourites: `src/components/profile/ProfileFavoritesEditor.tsx`, [docs/tracks/01-launch-integrity.md](../../docs/tracks/01-launch-integrity.md).
- The broader ideas: [docs/TEAJIA_WORKING_BRIEF.md](../../docs/TEAJIA_WORKING_BRIEF.md), [docs/VISION.md](../../docs/VISION.md).

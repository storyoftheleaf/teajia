# Guests and tea masters: the build

**Status: ready to hand to the build thread, 2026-11-26.** Nothing here is built. This file is the order of work, cut into launches and work packages, with the rules for running it across several agents. The reasons behind every choice are in [guests-and-tea-masters.md](guests-and-tea-masters.md); read that first and this second.

Adrian, 2026-11-26: "Let's break this into the totality of the plan. Update all the documents and interconnect them... I want to have the multi-step plan of how to build this. Definitive phase launches."

## The documents, and what each is for

| Document | Read it for |
|---|---|
| [guests-and-tea-masters.md](guests-and-tea-masters.md) | The why: Adrian's words, the model, the loop, the six functions, the gaps G1 to G19, blind spots B1 to B13, ideas I1 to I10, what each person gets, the first version |
| This file | The how and the order: launches, work packages, who builds what, the gates |
| [docs/SECTIONS.md](../../docs/SECTIONS.md) | The section map: read, table, houses, shop, Your Table, Manage, Home |
| [tea-table.md](tea-table.md) | The Tea Table in detail (Launch 4) |
| [tea-houses.md](tea-houses.md) | Tea houses and the build offering (Launch 4) |
| [your-table.md](your-table.md) | Your Table as a page (Launch 4) |
| [teajia-family.md](teajia-family.md) | The people list and family pages this builds on |
| [CLAUDE.md](../../CLAUDE.md) | The standing rules every agent obeys. `AGENTS.md` is the same file |
| [docs/PILLAR.md](../../docs/PILLAR.md) | What the site is today. Kept true in the same commit that changes the site's shape |
| The whiteboard | The same plan as one picture: https://claude.ai/artifact/VmvoJCULgNWbmerUqiVY5i |

## What is decided, and what is still Adrian's to say

**Decided, build on these.** Everyone is a guest; a session says "hosted by" and "pouring"; tea master means master of ceremonies and is a word Adrian grants on a page. A table is private, a tea house is public. The app never asks during a session. Quiet acknowledgement only. The Tea Table is the past, in time order, held up by hand, with a private keep. Three doors on a session. Anyone can host, with reach decided by hand and never shown. Hosting needs only a day and a time. Six functions, each usable alone. Credit to a tea master is tracked from the start; the rule comes later. Money never moves through Teajia.

**Not yet said. Each one blocks only the package named.**

| # | Question | Blocks |
|---|---|---|
| Q1 | Is Launch 1 the right first version (his own tables only)? | Launch 1 as a whole. Treated as the working assumption until he says otherwise |
| Q2 | The one sentence for Home | L1-08 |
| Q3 | Which coming session to run by hand | L1-00 |
| Q4 | Any tea from anyone, shown properly | L2-04 |
| Q5 | Free to host and a host can take their record away, said on the site | L2-01 copy |
| Q6 | The Tea Table exception wording in CLAUDE.md | All of Launch 4's Tea Table work |
| Q7 | The four bar words: read, table, houses, shop | L4-05 only. No navigation label changes without his explicit yes |
| Q8 | The credit rule: how much, on which teas, for how long | L5-01 (tracking itself is not blocked) |
| Q9 | The wrapper reader opened to hosts | L5-02 |
| Q10 | A small host's box brought forward | L5-07 |
| Q11 | May hosts offer articles | L4-07 |

## How the build is run

### The people and the agents

- **Adrian** decides, answers the questions above, sees every page that changes stored data before it runs, and says "ship".
- **The orchestrator** is the Fable build thread. It owns this file, writes each package's contract before anyone builds, does the packages marked A itself, reviews every other package, and does all wiring into the shared files. It does not hand a package out until the package can be described in a page.
- **Builders** are lower-cost agents, one package each, in their own subthread and their own branch.
- **An independent reviewer** is an agent from a different model family from the one that wrote the work. It reads the diff cold, with the package's contract and nothing else.

### One package, one branch, one pull request

Every package below is written so an agent with only the repository and its package text can do it. A package's text, when the orchestrator hands it out, always carries these seven things:

1. The goal in one sentence, as something a person can do.
2. The files it may create or change.
3. The files it must not touch.
4. The contract it builds to: the types, the route shapes, the column names, already written by the orchestrator.
5. The standing rules that bite for this package, quoted from `CLAUDE.md`, not just pointed at.
6. The commands that prove it: which tests, which lint, which sandbox check.
7. What to report back: the branch, what was verified and how, and anything it could not do.

A builder that finds the contract wrong stops and says so. It does not improvise around it.

### The shared files, which only the orchestrator touches

Two agents editing the same file at once is the main way a multi-agent build goes wrong, and this repository has a few files everything passes through:

- `worker/src/index.ts` (32,592 lines, every route)
- `src/App.tsx` (every public route)
- `src/lib/store.ts`, `src/lib/api.ts`, `src/types.ts`
- `src/styles/tokens.css`
- `worker/migrations/` (numbers must not collide; the last is 0127)
- `CLAUDE.md`, `docs/PILLAR.md`, this file

A builder puts its work in **new modules** (`worker/src/<name>.ts`, `src/pages/<Name>.tsx`, `worker/src/mcpTools/<name>.ts`) and exports functions. The orchestrator adds the few lines that wire them into the shared files, in one small commit per package, after review. This keeps builders from colliding and keeps `index.ts` from growing.

### Tiers: which kind of agent gets which package

| Tier | What it is | Who |
|---|---|---|
| **A** | Changes what is stored, who can see what, how money or credit is recorded, sign-in, or navigation. Or needs a decision made while building | The orchestrator itself. Never handed down |
| **B** | A whole feature inside its own new files, with real logic, to a written contract | A strong builder |
| **C** | Bounded and checkable: a screen from existing parts, a tool module copying an existing one, tests, wording, documents | A lower-cost builder |
| **R** | Review of someone else's finished package | A different model family from the builder |

Every A package and every package touching privacy gets an R review before it is merged.

### Branches and the flag

- One integration branch per launch, for example `build/launch-1`. Package branches open pull requests into it, not into `main`.
- `main` publishes to the live site on every push, so nothing reaches `main` until the launch gate.
- Everything new sits behind one flag per launch, in the same style as `BREWING_EXPERIENCES_OPEN` in `src/lib/brewingExperiences.ts`. A launch is the flag turning on.
- Builders verify with `npm run sandbox`, never `npm run dev`, which edits the real shop.

### The launch gate, the same for every launch

1. Every package merged into the integration branch and reviewed.
2. `npm run lint`, `npm run lint:worker-types`, `npm run lint:colors`, the unit tests, and `npm run test:mobile` pass on the integration branch, run by the orchestrator, not taken on a builder's word.
3. The orchestrator walks the whole launch in the sandbox as a guest and as a host, on a phone-sized screen, and writes down what it saw.
4. Any migration that changes existing rows has been shown to Adrian as a page with before and after.
5. `docs/PILLAR.md`, `docs/CHANGELOG.md` and `docs/STATE_OF_THE_SITE.md` say what is now true.
6. Adrian has seen it on the preview link and says "ship".
7. After shipping, the "done when" for the launch is checked against real use before the next launch starts.

### What the orchestrator keeps doing between packages

It keeps a short ledger at the bottom of this file: each package, its branch, its state, who built it, who reviewed it. It runs no more than three or four builders at once; more than that and review becomes the bottleneck and the cost rises without the work going faster.

## Launch 1: the first table

> **Launch 1 is cut for running in [guests-and-tea-masters-launch-1-run.md](guests-and-tea-masters-launch-1-run.md) (2026-11-26):** twelve slices with one owner each (Opus 5.5, GPT-6.2 Sol, GPT-6.2 Astra), the contract, the worker messages, and the journey that proves it. Where it differs from the table below it is the newer one; the differences are listed there.

**What a person can do when it launches.** A guest gets one link to one of Adrian's sessions, with the teas and one thing to read. Afterward they get one thank-you link with the teas, the playlist, the reading and the photographs. They can keep a tea in their own Tea Chest, a tea they buy lands there, a gift can be added, and any tea in their chest can be tasted. Home says what this is.

**Hosts in this launch:** Adrian only, using the sessions that already work in Manage.

| # | Package | Where | Tier | After | Done when |
|---|---|---|---|---|---|
| L1-00 | Run one session entirely by hand: invitation and thank-you as plain WhatsApp messages. Note what guests open and answer | No code | Adrian | Q3 | Notes written into the main plan |
| L1-01 | **The contract.** One migration adding columns only: a reading on a session; where a Tea Chest tea came from (bought, gift, session, own), who gave it, and the session or order it came from; the host an order came through. Types and route shapes. The launch flag | `worker/migrations/0128_*`, `src/types.ts`, `src/lib/teaChestTypes.ts`, new `src/lib/firstTable.ts` | A | None | Migration applies clean on the sandbox; shapes written into each package below |
| L1-02 | Repair the invite address (G1). Confirm in the sandbox, then make account and tea master invites land on a page that accepts them, leaving session plus-guest invites working | `GuestInviteClaimPage`, the four places `index.ts` builds `/invite/<token>` | A | None | Both kinds of link accepted in the sandbox; `tests/` spec added |
| L1-03 | A session carries one article. The host picks from published pieces in the session editor; it shows on the public session page | `worker/src/eventDomain.ts`, the session editor in `src/admin/`, `EventLanding` | C | L1-01 | Picked, saved, shown, removable |
| L1-04 | **The thank-you page.** One page per session, opened by link with no account: the host's note, the teas poured each opening onto its reading, the playlist, the article, the photographs, and three asks (how the teas felt, a few words, a photograph). Built from what `EventRecapPage`, `AfterSitPage` and `sessionTeas.ts` already hold | New `worker/src/sessionThanks.ts`, new `src/pages/SessionThanksPage.tsx` | B | L1-01 | A guest with no account opens it on a phone and can answer; a session with no teas still makes a good page |
| L1-05 | **Keep this tea.** One tap from the thank-you or from a tea's page puts the tea in the person's Tea Chest with where it came from. Asks them to sign in only at that tap | New `worker/src/chestKeep.ts`, a button component, `CellarView` | B | L1-01 | Kept tea appears in the chest with its session; no cost is invented for it |
| L1-06 | A bought tea arrives in the buyer's Tea Chest. Offered on the order, one tap, with its grams. Never written without the tap | Order pages, `chestKeep.ts` | A | L1-05 | A signed-in buyer's paid order offers it; the chest shows it as bought |
| L1-07 | "Where it came from" when adding a tea by hand, including a gift and who gave it. "Taste this" from a chest tea into the journal with the tea filled in | `CellarView`, `JournalPage` | C | L1-01 | A gift is added and tasted without retyping its name |
| L1-08 | Home's first sentence and the door "come to a table" | `src/pages/HomeV2Page.tsx` | C | Q2 | His sentence, his yes. No bar word changes |
| L1-09 | Tools for everything above: set a session's reading, read the thank-you, keep a tea. Preview then confirm on every write | New module in `worker/src/mcpTools/` | C | L1-03 to L1-05 | Each screen action above can be said to an agent |
| L1-10 | **Credit is tracked from day one.** An order begun from a thank-you records the session and host it came through. No credit is paid and nothing is shown | Order request path, the L1-01 column | A | L1-01, L1-04 | An order from a thank-you carries its session; one from the shop does not |
| L1-11 | Browser checks for the whole launch, written by an agent that built none of it | `tests/first-table.spec.ts` | C | All above | Passes against the sandbox on phone and desktop sizes |
| L1-12 | Six short readings, one per family of tea, written to be sent before a session. Drafts only; Adrian edits and publishes | Article drafts | C, writing | None | Six drafts waiting in Manage, none published |
| L1-13 | Truth-up: pillar, changelog, state of the site, the tools page | `docs/` | C | All above | The documents describe what shipped |
| L1-R | Independent review of L1-01, L1-02, L1-06 and L1-10, and of who can open a thank-you link | Read only | R | Those | Findings answered or fixed |

**Can run side by side once L1-01 is merged:** L1-03, L1-04, L1-05, L1-07, L1-12. **Must be in order:** L1-01, then L1-05, then L1-06; L1-04, then L1-10.

**Launch 1 is done when** one real session has run through it and a few guests opened the thank-you and kept or tasted a tea.

## Launch 2: a few hosts

> **Launch 2 is cut for running in [guests-and-tea-masters-launch-2-run.md](guests-and-tea-masters-launch-2-run.md) (2026-11-26).** Where it differs from the table below it is the newer one.

**What changes.** Three to five people Adrian trusts host their own tables with the same thing he used. They are set up by him.

| # | Package | Tier | Closes |
|---|---|---|---|
| L2-01 | A small host's account, made by Adrian by hand, with the wording that it is free and their record is theirs. The profile screen stops telling everyone to prepare a tea master profile | A | G10, Q5 |
| L2-02 | Hosting on one screen: a day and a time required, everything else optional | B | G11 |
| L2-03 | One invitation link and code per session, with the host's door: by request, by link, or open. A guest gives a name and has a seat | A | G2 |
| L2-04 | Any tea on a session: from anywhere, no price, where it came from if the host wishes. "A tea from my shelf" with a photograph is complete | B | Q4, B4 |
| L2-05 | **The arrival walkthrough.** Photographed steps to the house, kept per table and reused, shown only to confirmed guests, only until the session ends, never public, and readable without signal | A | G18 |
| L2-06 | The host's private guest book: who came, what they drank, one private line. Only the host sees it. Contact details stay in the host's WhatsApp (B12) | B | New |
| L2-07 | A session names who it is hosted by and who is pouring, each opening onto their page | B | G3, G15 |
| L2-08 | One line on every invitation about photographs, and a guest's "please not me" the host can see | B | B7 |
| L2-09 | Tools for all of it; browser checks; truth-up | C | G13 in part |
| L2-R | Independent review of L2-03 and L2-05: can anyone who is not a confirmed guest see an address or a walkthrough | R | B1 |

**Done when** each of those hosts has run a session without asking Adrian how.

## Launch 3: anyone can host

> **Launch 3 is cut for running in [guests-and-tea-masters-launch-3-run.md](guests-and-tea-masters-launch-3-run.md) (2026-11-26).** Five of its slices can start before Launch 2 is merged. Where it differs from the table below it is the newer one.

**What changes.** "Host a table" opens to everyone. This holds the one large piece of engineering.

| # | Package | Tier | Closes |
|---|---|---|---|
| L3-01 | **One kind of session.** The design, then the migration that gives every host a small private account and carries the earlier private sits over. Adrian sees the before and after page first. See "Recommendation on B5" in the main plan | A | B5 |
| L3-02 | "Host a table" in Your Table and on Home | C | G8, G11 |
| L3-03 | The floor for strangers in homes: a seat at a private table always needs the host's yes, the address only after it, a report on every session and person, and what Adrian sees when one arrives | A | B1 |
| L3-04 | A host reviews what appears on their own session | B | B8 |
| L3-05 | A session's gallery for the people who were there, and the one-tap photograph | B | G19 |
| L3-06 | "This is a tasting" as the host's choice, one screen per tea, and paper notes entered afterward | B | Function 5 |
| L3-07 | A waiting list and a released seat. "Same table again" | C | I5 |
| L3-08 | Reach, set by hand in Manage per host: invitation only, open to Teajia, listed. Never shown to anyone else | A | Covert curation |
| L3-09 | A session can say free, by contribution, or a price paid to the host directly | B | B11 |
| L3-10 | Tools, browser checks, truth-up | C | |
| L3-R | Independent review of L3-01 and L3-03 | R | |

**Done when** someone Adrian has never met hosts a session that goes well.

## Launch 4: what happened becomes visible

> **Launch 4 is cut for running in [guests-and-tea-masters-launch-4-run.md](guests-and-tea-masters-launch-4-run.md) (2026-11-26).** Most of it waits on Adrian's answers; five slices can start today. Where it differs from the table below it is the newer one.

**Needs first:** Q6 for the Tea Table, Q7 for the bar words.

| # | Package | Tier | Closes |
|---|---|---|---|
| L4-01 | The Tea Table, first form, at `/tea-table`: sessions poured, shared words and photographs, newest first, with its consent and withdrawal gates. See [tea-table.md](tea-table.md) | B | G5 |
| L4-02 | Hold a piece at the top by hand (host, or Adrian for the whole table). A private keep. Keep counts in Manage for Adrian only | A | Decided 2026-11-26 |
| L4-03 | "Add your table", private. Tea house pages, the visit list, who has poured there. See [tea-houses.md](tea-houses.md) | A | G4 |
| L4-04 | Favourites in three kinds on one page, private until shown. The Tea Chest's three states: kept, shown, offered | B | G7 |
| L4-05 | Home's full order, then the bar, rail, phone menu and keyboard keys in one change | A | G8, Q7 |
| L4-06 | Quiet acknowledgement on pages, who pours on the people list, the first three people articles | B | G9, G12 |
| L4-07 | A host can offer an article; Adrian edits and decides | B | Q11 |
| L4-08 | Your Table as a page; Read's three shelves. See [your-table.md](your-table.md) | B | |
| L4-09 | Tools, browser checks, truth-up | C | |

**Done when** the Tea Table has had something new on it each week for a month without Adrian writing it.

## Launch 5: the wider service

> **Launch 5 is cut for running in [guests-and-tea-masters-launch-5-run.md](guests-and-tea-masters-launch-5-run.md) (2026-11-26).** Each package ships alone; three can start today. Where it differs from the table below it is the newer one.

Each of these stands alone and can ship when ready. The order is by value.

| # | Package | Tier | Needs |
|---|---|---|---|
| L5-01 | A tea master's shelf with no stock held, their private view of what came through them, and credit in tea | A | Q8 |
| L5-02 | The wrapper reader for hosts: photograph a tea, be told what it is | A | Q9 |
| L5-03 | A card for the table: the evening's teas on one printed page with a code for afterward | C | |
| L5-04 | Circles (a named table that meets again) and series (several sessions under one name) | B | |
| L5-05 | A tea for the table, shared between a host and their guests | A | |
| L5-06 | Every action as a tool, and a scoped token a host can connect to their own assistant | A | G13 |
| L5-07 | The host's box, then the tasting box | A | Q10 |
| L5-08 | "Does anyone know this tea?" on the Tea Table | B | Q6 |
| L5-09 | Short video. The app | Later | G16 |

## Everything at once: what can run today, and what waits

Adrian, 2026-11-26: "I want to do all the build out... Better to run multiple simultaneously." This is the one map across all five launches. Each row's detail and its worker message are in that launch's run sheet.

**Running today, side by side, with no answer needed from Adrian.** Three lanes, so the Mac is never asked for more than four GPT workers at once.

| Lane | Work | Who |
|---|---|---|
| Repair, ships alone | L2 H0: the public session answer stops carrying the address | Opus |
| Launch 2 spine | L2 H1 contract, then H2 beside H3, then H4, then H8, H9, H10, H6 | Opus, Sol |
| Read-only audits on `main` | L2 A1 (address doors), L3 J9 (waiting list), L4 K0 (sharing and taking back), L5 M1 audit (credit history) | Astra, one after another |
| Independent builds | L3 J5 reports, J7 gallery, J8 tasting, J11 contribution line; L4 K3 favourites, K5 Visit, K6 acknowledgement; L5 M3 the card | Sol, and a second Opus builder for overflow |
| Opus's own, independent | L4 K8, Your Table as a page | A second Opus builder |
| Cloud helpers | L5 M6 inventory of actions without tools; first reads of every GPT pull request | Haiku, Sonnet |

**Waits on an earlier launch's contract, not on Adrian.** L3 J1, J2, J3, J6, J10, J12 wait for Launch 2's H1 and H2. L4 K4 and K9 wait for Launch 2. L5 M4 and the host's token in M6 wait for Launch 3. Each integration branch is brought up to date from the launch before it, not from `main`, until that launch ships.

**Waits on Adrian.** One answer each; none of them stops the lanes above.

| His answer | Unlocks |
|---|---|
| "ship" for the address repair | L2 H0 reaching the live site |
| Q4, any tea from anyone, and his teas linked from a host's session | L2 H6 |
| Q5, "free, and your record is yours" | L2 H11's wording and export |
| Where "Host a table" is found | The door in L2, and L3 J4 |
| Old private sits stay where they are | L3 J3 |
| Q6, the Tea Table rule | L4 K1, K2; L5 M8. Nothing under the Tea Table is built before it |
| Q7, the four bar words | L4 K7, K10 |
| Your Table as a page | L4 K8 reaching people |
| His seven facts about building a tea house | L4 K5's Build and Work pages |
| Q11, hosts may offer articles | L4 K9 |
| Three people for the first articles | L4 K6's articles |
| Q8, the credit rule | L5 M1 |
| Q9, the wrapper reader for hosts | L5 M2 |
| Q10, the host's box | L5 M7 |
| Q12, a tea for the table | L5 M5 |

**Three rules for running many at once.** One owner per file: a shared file is edited only by the launch's Opus owner, and two launches never edit the same shared file in the same hour without one rebasing on the other. One migration number per launch, taken in launch order (0129 Launch 2, 0130 Launch 3, 0131 Launch 4, then one per Launch 5 package), so numbers never collide. And a launch is switched on only in order: a later launch's code may be merged behind its flag early, but its flag turns on after the launch before it has shipped.

## Who builds what

Adrian, 2026-11-26: "You pick which models for what job", and "build everything in the plan". So the whole plan is built, launch by launch, in the order above. Each launch is built on its own integration branch behind its own flag, and a launch reaches people only at its gate, with his "ship". Building a later launch does not wait for the one before to be used, but turning it on does. A package blocked by one of his questions (Q4 to Q11) is built last in its launch or left out until he answers, and no navigation word changes without his explicit yes.

| Model | Kind of work |
|---|---|
| **Opus 5.5** | Owns the build: contracts, shared files, anything touching what is stored, who sees what, sign-in or navigation, integration, each launch gate |
| **GPT-6.2 Sol** | Settled, bounded features and screens in their own files, with a stated check. Run through Codex on Adrian's Mac |
| **GPT-6.2 Astra** | Settled behaviour where details are easy to get wrong, and every audit of privacy or of older data carried over. Run through Codex on Adrian's Mac |
| **Sonnet 5.5** | Opus's helpers in the cloud: fixtures, agent tools, browser checks, documents, drafts of readings and articles, a first read of every GPT pull request |
| **Haiku 5.5** | Mechanical errands: running suites, finding call sites, wording and colour checks, the ledger |
| **Fable** | The approach, where it is still uncertain, and the run sheet for each launch |

Two rules hold throughout. No model's work on privacy, sign-in or stored data is merged on a read from its own family alone. And Launch 1's exact slices and worker messages are in [guests-and-tea-masters-launch-1-run.md](guests-and-tea-masters-launch-1-run.md); each later launch gets the same kind of run sheet from Fable once the launch before it has merged its contract, because the messages quote names that do not exist until then.

**Launch 2**

| Package | Builds | Checks |
|---|---|---|
| L2-01 a small host's account | Opus | Astra: what a host account can reach in the shop that made it |
| L2-02 hosting on one screen | Sol | Sonnet |
| L2-03 one invitation link, the three doors, a seat by name | Opus | Astra: a seat claimed twice, a full table, a door changed after links went out |
| L2-04 any tea on a session | Sol | Sonnet |
| L2-05 the arrival walkthrough | Opus | Astra: can anyone not confirmed, or anyone after the session, read an address or a step |
| L2-06 the host's private guest book | Sol | Astra: host-only, across two hosts of one session |
| L2-07 hosted by and pouring | Sol | Sonnet |
| L2-08 the photograph line and "please not me" | Sol | Sonnet |
| L2-09 tools, browser checks, truth-up | Sonnet | Opus |

**Launch 3**

| Package | Builds | Checks |
|---|---|---|
| L3-01 one kind of session | Fable settles the design, Opus writes the migration and shows Adrian the before and after page | Astra: every older private sit carried over, none lost, none made visible |
| L3-02 "Host a table" | Sol | Sonnet |
| L3-03 the floor for strangers in homes | Opus | Astra: the address before the host's yes, and reports |
| L3-04 a host reviews their session | Sol | Sonnet |
| L3-05 the session gallery and one-tap photograph | Sol | Astra: a photograph withdrawn after others have seen it |
| L3-06 "this is a tasting" | Sol | Sonnet |
| L3-07 waiting list, released seat, same table again | Astra | Opus |
| L3-08 reach, set by hand | Opus | Astra: reach is never readable outside Manage |
| L3-09 free, contribution, or paid to the host | Sol | Sonnet |
| L3-10 tools, browser checks, truth-up | Sonnet | Opus |

**Launch 4**

| Package | Builds | Checks |
|---|---|---|
| L4-01 the Tea Table, first form | Sol, from the existing `/tea-feed` page | Astra: consent and withdrawal, things shared before the wording existed |
| L4-02 hold at the top, the private keep | Opus | Astra: keep counts readable only by Adrian |
| L4-03 "add your table", tea house pages | Opus | Astra: a private table never appears beyond its area |
| L4-04 favourites in three kinds, the chest's three states | Sol | Sonnet |
| L4-05 Home in full and the bar words | Opus, only after Q7 | Sonnet, `npm run test:mobile` before and after |
| L4-06 quiet acknowledgement, people articles | Sol, Sonnet drafts the articles | Opus |
| L4-07 a host offers an article | Sol | Sonnet |
| L4-08 Your Table as a page, Read's three shelves | Opus for the page and routing, Sol for the shelves | Sonnet |
| L4-09 tools, browser checks, truth-up | Sonnet | Opus |

**Launch 5**

| Package | Builds | Checks |
|---|---|---|
| L5-01 the shelf and credit in tea | Fable settles the approach once Q8 is answered, then Opus | Astra: credit counted once, refunds, orders with two sources |
| L5-02 the wrapper reader for hosts | Opus | Sonnet |
| L5-03 a card for the table | Sol | Sonnet |
| L5-04 circles and series | Sol | Sonnet |
| L5-05 a tea for the table | Fable settles the approach, then Opus | Astra |
| L5-06 every action as a tool, a host's own token | Opus | Astra: what a host's token can reach |
| L5-07 the host's box, the tasting box | Fable settles the approach once Q10 is answered | |
| L5-08 "does anyone know this tea?" | Sol | Sonnet |
| L5-09 short video, the app | Later | |

## The ledger

The orchestrator keeps this current.

| Package | Branch | State | Built by | Reviewed by |
|---|---|---|---|---|
| Launch 1 run sheet | `claude/project-thread-nks12x` | Written 2026-11-26, nothing built | Fable | |
| Launch 1 integration | `build/launch-1` | Open, from `main` on 2026-11-26 | Opus 5.5 | |
| S1 the contract | `build/launch-1` | Done 2026-11-26: migration 0128, flag, types, routes, test table, three checks | Opus 5.5 | S9 (Astra) |
| S2 invite repair | `build/l1-s2-invite` | Merged, PR 481 | Opus 5.5 | Opus (sandbox) |
| S3 the thank-you teas, playlist, reading | `build/l1-s3-thanks` | Merged, PR 483 | Sol (gpt-5.6-sol) | Opus |
| S4 a reading for each session | `build/l1-s4-reading` | Merged, PR 484 | Sol (gpt-5.6-sol) | Opus |
| S5 keep a session tea | `build/l1-s5-keep` | Merged, PR 482 | Sol (gpt-5.6-sol) | Opus |
| S6 a bought tea in the chest | `build/l1-s6-bought` | Merged, PR 487. Decided in review: a deleted chest tea can be kept again, once | Astra (gpt-6-astra) | Opus |
| S7 where a chest tea came from, taste this | `build/l1-s7-chest` | Merged, PR 485 | Sol (gpt-5.6-sol) | Opus |
| S8 order source | `build/launch-1` | Written with S1 and S3 | Opus 5.5 | S9 (Astra) |
| S9 audit | read only | Done: five findings. Fixed: hidden product details copied on keep, replay gaining a source, a reload reviving a used reference, party links unable to keep. Answered: the invoice join goes through `inquiries.converted_invoice_id` | Astra (gpt-6-astra) | Opus |
| S10 agent tools | `build/l1-s10-tools` | Merged, PR 486 | Sonnet 5.5 | Opus |
| S11 browser journey | `build/l1-s11-checks` | Merged, PR 488: 14 of 14 at phone and desktop after three fixes | Sonnet 5.5 | Opus |
| S9 fixes | `build/l1-s9-fixes` | In review | Opus 5.5 | |

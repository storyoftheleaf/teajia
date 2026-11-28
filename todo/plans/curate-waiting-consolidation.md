# Curate and Waiting: one list of what needs you, and Curate version 2 removed

Planned 2026-11-28 from the code on `main` at `41b6693`. Slice 1 is built (PR 663); the rest waits on the questions in section 5. Nothing here is built without Adrian's yes where a slice says so.

## For Adrian, in short

Today nine places tell you "this needs you", each with its own rule. Waiting knows a tea's next step. The Manage Today page knows orders and payments, and keeps a second list of teas with no cost. Only Curate version 2 shows what your agent found and its to-dos. Your agent's "what's waiting" tool knows nothing about teas. So one tea can get two answers, and some things show nowhere you look.

The plan is one list with one set of rules, read by three windows:

- **Waiting** in the Library shows the tea half: arrivals, what your agent found, to-dos, each tea's next step, suppliers you cannot reach.
- **Today** in Manage shows orders and payments as now, plus one line per Waiting group that opens Waiting there. Its own "Teas waiting on an answer" list goes.
- **Your agent** hears the same list.

Waiting gets better in four ways. It stops saying "Nothing is waiting" while it is still loading. Each tea becomes one slim line with one action, done in place. It can be linked to and browser back works. It catches Stock teas that never had a Library card.

Curate version 2 is deleted, about 15,700 lines. Three things are rescued first: agent finds and to-dos move into Waiting, and the Google Drive line moves to Settings. Old version 2 links land on the live Curate.

Twelve small slices, seven needing your yes. Twelve questions are at the end, each with my recommendation.

## 1. The dynamics today

### How a tea moves

1. It comes in through Source, the Bring in sheet, Import, a package scan, or an agent (`curate_add_tea`). Two doors skip the Library: Bulk intake and the agent's `create_tea`.
2. It is a card in the Library, under its supplier.
3. A sample in hand waits to be tasted. A tasted tea waits for Want or Reject.
4. A wanted tea is ordered. The order lives in Orders ("In process") and in Purchases.
5. When it comes, an arrival waits for approval.
6. Add to Stock makes the Stock tea. The card then asks the amount and the cost.
7. Write-up, price, main photo, public, Tea Wisdom entry.

Each step works. The trouble is that "what is waiting on me" is answered in nine places.

### Every place that says "this needs you"

| # | Place | What it shows | Its rule lives in | Trouble |
|---|---|---|---|---|
| 1 | Library, Waiting tab (`/admin/compass?tab=library`) | Each Library tea once under its next step: arrivals to approve, samples to taste, tasted want it, chosen not in Stock, how much, what it cost, to write up, public with no Tea Wisdom entry | `src/components/curate/teaPath.ts`, run in the browser | See "What is wrong with Waiting" below |
| 2 | The tea's own page in the Library | The path line with the next step (`TeaPathLine`) | Same `teaPath` | Good. This is the model to copy |
| 3 | Manage Today (`/admin/dashboard`), "What needs you" | Order requests, orders to price, payments to check, paid orders to send, refunds, oldest first | `handleGetAttention` in `worker/src/index.ts` | Sales only. No teas |
| 4 | Manage Today, "Teas waiting on an answer" | Stock teas with no cost, or no bag weight | `teaQuestions` in `src/admin/lib/dashboardSignals.ts` | A second rule for "needs a cost". It asks the bag weight, which Waiting never asks. It links to Stock, never to the Library tea |
| 5 | Your Table panel (`LaunchpadView`) | The same sales items as 3 | Same endpoint | Fine. A third window on the sales half |
| 6 | Curate version 2, Today (`/admin/compass/v2`) | Agent finds, to-dos, To decide, Needs a cost, Vendors to reach, On the way, To shelve, the Drive line | `todaySections` in `curateV2Model.ts` plus `useAgentLists` | The only screen for agent finds and to-dos, and you do not open it. Its tea rules disagree with Waiting |
| 7 | Curate, Orders tab, In process (`InProcess.tsx`) | Each supplier order with its step and a "Receive" word | Order status | "Receive" approves every pending arrival of that order with no look |
| 8 | Arrival approval, four more doors | Manage delivery on the card (`LibraryReceiptActions`), the capture card, Stock "Received & incoming" (`/admin/stock?incoming=1`), the Ledger line | Each door calls `acceptReceiptProposal` its own way | Five ways to say yes to one parcel |
| 9 | Agent tools | `whats_waiting`: the sales items. `curate_whats_missing`: Library teas with missing facts, suppliers with no WeChat, to-dos, a count of finds. `curate_list_arrivals`, `curate_list_suggestions`, `list_orders_in_process` | `gatherAttention` in `worker/src/mcp.ts`, and `curateIntake.ts` | `whats_waiting` is a hand copy of the rule in 3, because the two files cannot import each other. It says "nothing is waiting" while ten samples sit untasted |

Smaller signals that also say "needs you": the "(2)" on the Library tab for teas shared with you, the imports still in review listed in the Library, and "Checking orders" on a card.

### Where they overlap

- **"Needs a cost" has three rules.** Waiting: the Stock tea has no cost. Today: the Stock tea has no cost or no bag weight. Version 2: the Library tea was saved with no price.
- **"To decide" has two.** Waiting splits it into taste and want. Version 2 joins them.
- **Arrivals have five doors** (rows 7 and 8) and two lists (Waiting and version 2's "On the way").
- **The sales rule is written twice** (rows 3 and 9), kept the same by hand.

### What nothing shows

- **Agent finds and to-dos.** An agent can leave teas for you to pick (`curate_suggest_teas`) and reminders (`curate_todo`). The live Curate never shows them.
- **Google Drive.** Connect and Reconnect exist only in version 2. If the link breaks, the live Curate cannot say so or fix it. The worker even sends you back to `/admin/compass/v2` after Google.
- **Stock teas with no Library card.** Bulk intake and `create_tea` make them. Waiting walks Library teas only, so their missing amount, cost and write-up never reach Waiting.
- **The bag weight.** A tea with a cost and no weight bought still has no price. Only the Today page asks.
- **Suppliers you cannot reach.** Shown only in version 2.
- **Teas in your agent's ear.** `whats_waiting` has no tea kinds.

### What is wrong with Waiting itself

1. **It says "Nothing is waiting on you" while Stock is still loading, and when the Stock read fails.** The code returns an empty list in both cases and the empty words follow. This is the worst fault: a calm answer that is not true.
2. **The tab is not in the address.** It is kept in the browser's saved state (`browseFilter` in `teaCompassStore`). You cannot link to Waiting, an agent cannot send you there, and browser back does not leave it. This breaks the "every step is in the address" rule.
3. **Each row is the full Library card.** A list of work wants one line and one action. The full card has a dozen controls, so twenty samples to taste is a very long page.
4. **Inside a group the order follows the Library's sort**, newest first by default. Teas from one supplier are scattered.
5. **Group headings carry a count** ("3 teas").
6. **It knows nothing of agents, suppliers, imports or shares.**
7. **The rules live in the browser only**, so agents and Today cannot read them.

## 2. The better Waiting

### The idea

One question, "what is waiting on me", has one answer. The answer is a list of groups. Each group is one kind of thing. Each row names its subject and carries the one action it needs. Waiting, Today and your agent all read that list. Nothing rises by itself, nothing is counted at you, and nothing is sent.

### What it holds, in this order

The order is: the parcel on your table first, then what someone handed you, then each tea's own next step in the order of its path, then housekeeping. An empty group is not shown.

| # | Group title | What is in it | New? |
|---|---|---|---|
| 1 | Arrivals to approve | A tea with an arrival waiting for your yes | As now |
| 2 | **[P1] "Found for you"** | Each find an agent left, one row per find | From version 2 |
| 3 | **[P2] "Shared with you"** | Teas another shop shared, not yet taken or dismissed | Moves from the Library tab's "(2)" |
| 4 | **[P3] "Imports to finish"** | An import still in review | Moves from the Library list |
| 5 | **[P4] "To do"** | Open to-dos, yours and your agent's, with "+ A to-do" as the last line | From version 2 |
| 6 | Samples to taste | A sample in hand, not tasted | As now |
| 7 | Tasted, want it? | Tasted, no Want or Reject yet | As now |
| 8 | Chosen, not in Stock yet | Wanted or bought and here, no Stock tea yet | As now |
| 9 | In Stock, how much is there? | Stock tea with no counted amount | As now, plus Stock teas with no Library card |
| 10 | In Stock, what did it cost? | Stock tea with no cost, or a cost with no bag weight | As now, plus the bag weight, plus Stock-only teas |
| 11 | To write up | Stock tea with no description | As now, plus Stock-only teas |
| 12 | Public, no Tea Wisdom entry yet | On the site with no approved entry | As now |
| 13 | **[P5] "Suppliers to reach"** | A supplier with a live Library tea and no WeChat, WhatsApp or phone | From version 2 |
| 14 | **[P6] "Google Drive needs connecting again"** | One row, only when the link is broken | From version 2 |

[P1] to [P6] are placeholders. The names are yours.

Inside a tea group, rows are ordered by supplier name, then oldest first. So one supplier's samples sit together, which is how you taste them.

A group longer than six rows shows six and a line "Show the rest". The fold lives in the address as a refinement.

### One row

One shared row for every kind, built on the shared `TeaCard` parts (`src/components/tea/TeaCard.tsx`), in a new `WaitingRow.tsx`. No copy of the Library card.

```
phone, 390 wide, 16 gutter

 Samples to taste
 ┌──────────────────────────────────────────────┐
 │ [ph] Old Bush Shui Xian                Taste │
 │      Wang · V1T12 · 40 g sample              │
 ├──────────────────────────────────────────────┤
 │ [ph] 2019 Liu Bao                      Taste │
 │      Wang · V1T14 · 25 g sample              │
 └──────────────────────────────────────────────┘
 Tasted, want it?
 ┌──────────────────────────────────────────────┐
 │ [ph] Honey Orchid Dancong                    │
 │      Li · V2T3 · scored 8                    │
 │                              Reject     Want │
 └──────────────────────────────────────────────┘
```

- **Left:** the tea's photo at 44 by 44, or the type illustration (`TeaPlaceholder`). A supplier row shows the supplier's face (`VendorFace`). A find, a to-do, an import and Drive show no picture.
- **Line 1:** the tea's name as you gave it. It may wrap to two lines. It is never cut to "Old Bush Sh…".
- **Line 2:** supplier, short code, and the one fact this step needs. Secondary text colour, never dimmer.
- **Right:** one action, a word. When the word does not fit beside a two-line name, it drops to its own line, right-aligned. No sideways scroll.
- **Minimum height 64**, every target at least 44.

The one fact per group:

| Group | Fact on line 2 | Action word | What one tap does |
|---|---|---|---|
| Arrivals to approve | what came: "200 g" or "2 cakes" | Review | Opens the arrival sheet over the list. Approve or Reject there |
| Found for you | who found it, the supplier, the first tea names | Pick | Opens the find sheet (`AgentFindsSheet`). Tick and add, or Not now |
| Shared with you | who shared it | Open | Opens the share |
| Imports to finish | how many teas wait to be confirmed | Continue | Opens the import review |
| To do | the tea or supplier it is about | Done | Ticks it. The row says "Done" with "Undo" until you leave |
| Samples to taste | the sample's grams, when known | Taste | Opens the one tasting (`TastingSession`) over the list. Afterwards the leaf-used question as now |
| Tasted, want it? | your score | Want, Reject | Saves in place |
| Chosen, not in Stock yet | the quote: "¥380 for 357 g" | Add to Stock | Makes the Stock tea, then opens the amount and cost sheet (`StockFromQuote`) |
| How much is there? | the quote's grams, when known | Count | Opens the same sheet at the amount |
| What did it cost? | "no cost yet" or "cost in, no bag weight" | Add cost | Opens the same sheet at the cost. Cost keeps its currency rule |
| To write up | nothing | Write it up | Goes to `/admin/products/:id/story` |
| No Tea Wisdom entry yet | what the Wisdom Base still needs, from `WisdomNeedsList` | See | Opens the Stock panel at that list |
| Suppliers to reach | "no way to reach them yet" | Add contact | Opens the supplier sheet (`SupplierSheet`) at contacts |
| Drive | the account's email | Reconnect | Starts the Google link |

**Tapping the row itself** (not the action) opens the thing: a tea opens its Library page with the path line, a supplier opens `/admin/vendors/:id`, a to-do opens its tea or supplier.

**After a tap, the row stays where it is.** It does not jump to another group under your thumb. It shows what happened and the tea's new next step in the same place: "Tasted. Next: Want it?" with Want and Reject. So you can carry one tea from sample to Stock without hunting for it. The list re-sorts when you leave and come back.

**A failed save** says so on the row in plain words (`plainFailure`) with "Try again". Never a browser popup.

### Layout

**Phone (390).** One column. The Library's tab line stays as it is: All, To taste, Chosen, Waiting, Rejected, with the gold dot on Waiting. Search and sort hide on Waiting, since the order is fixed. Group titles are the Library's supplier-heading style, without a count. Rows run edge to edge inside the 16 gutter. The page keeps `pb-nav-gap` above the bottom bar.

**Desktop.** The Library already splits into a list and the opened tea. Waiting uses that: the list on the left at about 480 wide, the tea you tapped on the right with its full card and path line. With nothing opened, the list sits in one column of at most 720, not a grid: this is a list to work down, not a shelf to browse. At `lg` and up, a short list of the group titles sits at the top of the column as plain links that jump down the page.

```
desktop, a tea opened

 Source  Library  Orders  Samples
 All  To taste  Chosen  Waiting•  Rejected
 ┌───────────────────────────┬────────────────────────────────────┐
 │ Arrivals to approve       │  Old Bush Shui Xian        V1T12   │
 │  Dancong · Li      Review │  ✓ Tasted  › Want it?  · Add to…   │
 │ Samples to taste          │  Next: Want it?     Reject   Want  │
 │ ▸Old Bush Shui Xian Taste │  (the tea's full Library card)     │
 │  2019 Liu Bao       Taste │                                    │
 └───────────────────────────┴────────────────────────────────────┘
```

### In the address

- The Library tab becomes a step: `?tab=library&show=waiting` (`useStepParam('show')`), for all five tabs. Back leaves it.
- A group can be linked to: `&group=taste` scrolls to it and opens its fold. Today and agents use this.
- An opened tea stays `&entry=<id>` as now. An open sheet is a step too: `&arrival=<id>`, `&find=<batch>`.
- The old saved `browseFilter` is read once to choose the first tab when the address names none, then the address wins.

### States

| State | What shows |
|---|---|
| Loading (teas, Stock, orders or agent lists not read yet) | `SectionSkeleton` rows. No dot on the tab. Never the empty words |
| Empty, everything read | One line: "Nothing is waiting on you." |
| One read failed | The groups that could be worked out still show. One line above them names what is missing with "Try again": "Stock could not be read, so teas in Stock are not listed." or "What your agent left could not be loaded." (`LoadFailed`) |
| Every read failed | `LoadFailed` alone, with "Try again" |
| Not saved to the shop yet | The existing sync line. Rows work from what is on the phone |
| A tab's dot | On only when the list was fully read and is not empty |

### How it links to the rest

- **Source.** After a tea is saved, the result line says where it went, as a link: "Waiting, under Samples to taste" (`CapturePurchaseResult`).
- **The tea's page and card.** The path line there and the row here come from the same function, so they can never disagree.
- **Orders.** "Receive" on an order opens the same arrival sheet for that order's lines, in place of approving them all unseen. An arrival row in Waiting names its order and links to it.
- **Stock.** The Stock panel shows the same path line for a tea with a Library card, with "Open in Library". Stock's "Received & incoming" opens the same arrival sheet.
- **Suppliers.** Every row's supplier name opens the supplier's page.

### Waiting and the Manage Today page: one list, two windows

Recommended: **one list, read in two places. Not two lists.**

- **Waiting** is where the tea work is done. It shows the tea half only. Orders and payments do not belong inside the Library.
- **Today** is the whole shop at a glance. It keeps "What needs you" with the sales rows as now, oldest first. Under them it gets one row per Waiting group that has something in it: the group's title, the first two or three names, and a link to Waiting at that group. For example "Samples to taste · Old Bush Shui Xian, 2019 Liu Bao and others". No per-tea rows on Today, and no numbers.
- **"Teas waiting on an answer" on Today is deleted.** Its two questions (cost, bag weight) are now the cost group.
- Today's "On the shelf" (recheck, low, incoming) stays. Those are facts about the shelf, not steps of a tea.

### Deliberately left out

- Numbers on tabs, on headings and on the Curate word in the nav. The dot is the whole signal.
- How long a tea has waited. Days on a tea read as pressure. Orders and payments keep theirs on Today, since a person is waiting there.
- Teas waiting on the supplier: ordered, on the way, a sample asked for. They are in Orders. They are not yours to move.
- Price, main photo and going public. They are your choice for each tea, as you said on 2026-11-27.
- Missing facts such as origin, year or type. Your agent asks those with `curate_whats_missing`. They are not steps.
- Low stock, and anything about sales.
- Any notification, reminder, streak or ranking.
- Version 2's one-tap "Arrived" and "Shelf". Each skipped the look at what came and the amount and cost. The arrival sheet and Add to Stock replace them.

## 3. Structure

### One source for the list

```
shared/needsYou/                 pure rules: no React, no database, read by the site and the worker
  teaPath.ts        moved from src/components/curate/teaPath.ts, with its own small input types
  kinds.ts          every kind once: its group title, its order, its action word
  needsYou.ts       needsYou(input) gives the groups, each tea once
  needsYou.test.ts  teaPath.test.ts moves here and grows

src/components/curate/           the live Curate's new parts
  useNeedsYou.ts        reads the phone's teas, Stock, orders, agent lists, suppliers; calls needsYou()
  LibraryWaiting.tsx    the tab's body: groups, folds, states
  WaitingRow.tsx        the one row, on TeaCard
  waitingActions.tsx    for each kind, what one tap does
  ArrivalReview.tsx     the one arrival sheet (slice 9)
  DriveLine.tsx         moved from CurateV2
  AgentInbox.tsx        stays; AgentFindsSheet is mounted by Waiting

worker/src/
  attention.ts          the sales half, moved out of index.ts and mcp.ts, so the hand copy ends
  needsYouRead.ts       reads D1 rows, calls the same needsYou()
  mcpTools/whatsWaiting.ts   whats_waiting, moved out of mcp.ts, reading both halves
```

Who reads what:

| Reader | Sales half | Tea half |
|---|---|---|
| Library Waiting | not shown | `useNeedsYou` in the browser, so a tap shows at once, even before it is saved to the shop |
| Manage Today | `GET /api/attention` as now | the same request, with a `teas` part from `needsYouRead` |
| Your Table panel | `GET /api/attention` as now | not shown |
| `whats_waiting` | `attention.ts` | `needsYouRead` |
| `curate_whats_missing` | none | stays for missing facts; its to-dos, finds and supplier rule come from `needsYou` |

The browser and the worker build the same input from different places, so one test feeds the same teas through both and expects the same groups (`needsYouParity.test.ts`).

Two honest differences, written into `kinds.ts` and the tool's description:

- An order still being drafted on the phone is not in the shop's database. For the worker such a tea reads as "Chosen, not in Stock yet".
- The Tea Wisdom entries are a large file. The worker leaves the "no Tea Wisdom entry yet" group out until the wisdom build writes a small list of entry ids. That is a later, optional step.

The worker cost is small: `needsYou` is plain functions, and the reads are one query per table.

### What gets deleted

- **All of `src/components/CurateV2/`**: 85 files, about 15,700 lines, with its tests.
- **Its route** in `src/admin/AdminApp.tsx`: `CurateV2WithMode`, the lazy import, `compass/v2`.
- **Its browser tests**: `tests/curate-v2-tea-record.spec.ts`, `curate-v2-requests.spec.ts`, `curate-v2-journeys.spec.ts`, `curate-v2-ar-create.spec.ts`, and the v2 opener in `tests/helpers/compassHarness.ts`. The v2 half of the loops in `curate-selected-undo.spec.ts`, `curate-structured-fields.spec.ts` and `admin-incoming-demand.spec.ts`.
- **What only version 2 used inside `src/components/curate/`**: in `curateV2Model.ts` the names `todayItems`, `todaySections`, `TODAY_ACTION_LABEL`, `TodayItem`, `TodayAction`, `TodaySections`, `daysSince`, `costPerGramUsd`, `quotedUnit`, `QUOTE_UNITS`, `readLinePrice`, `LinePrice`, and `FAST_TASTING` with `FastOption` unless question 6 keeps it. In `sampleUse.ts`: `tastablePortion`, `gramsToUse`, `SampleUseFailure`. In `AgentInbox.tsx`, `useAgentLists` stays, because Waiting uses it.
- **`teaQuestions`** in `src/admin/lib/dashboardSignals.ts`, with the Today block that shows it (slice 8).
- **`gatherAttention`** in `worker/src/mcp.ts`, the hand copy (slice 7).
- **Old plans**, moved to `todo/plans/archive/`: `curate-one-home.md` (it planned the opposite switch), `curate-next.md`, `curate-v2-journeys.md`. The Curate version 2 line in `TODO.md` is rewritten.

Kept on purpose: the `.curate-v2-*` styles in `src/styles/card-utilities.css`. About twenty live files use them. Only the rules nothing uses after the delete are pruned. Renaming the class is its own later tidy.

### Old links

| Old address | Lands on |
|---|---|
| `/admin/compass/v2` and `/admin/curate/v2` | `/admin/compass`, query kept |
| `...?tab=today` | `/admin/compass?tab=library&show=waiting` |
| `...?tab=table` | `/admin/compass?tab=sourcing` |
| `...?tab=teas` | `/admin/compass?tab=library` |
| `...?tab=vendors` | `/admin/compass?tab=library` |
| `...?tab=orders` | `/admin/compass?tab=buying` |
| `entry`, `arSource`, `arPair`, `sampleOrder`, `set`, `drive` | carried across untouched |

The worker's Drive return (`handleDriveConnect` and `finishDriveConnect` in `worker/src/index.ts`) stops defaulting to `/admin/compass/v2` and defaults to where the Drive line lives.

### What moves where

| From | To |
|---|---|
| `curate/teaPath.ts` and its test | `shared/needsYou/` |
| The Waiting block inside `TeaCompass/BrowseView.tsx` | `curate/LibraryWaiting.tsx`. `BrowseView` gets shorter |
| `CurateV2/DriveLine.tsx` | `curate/DriveLine.tsx`, shown in Settings |
| To-do rows and the supplier rule in `CurateV2/TodayView.tsx` | rewritten as `WaitingRow` kinds. Not copied |
| The sales rule in `index.ts` and `mcp.ts` | `worker/src/attention.ts` |
| `whats_waiting` in `mcp.ts` | `worker/src/mcpTools/whatsWaiting.ts`, as the MCP rule asks |

### Guards and tests to update

- `src/admin/guards/curateFoldersFrozen.test.ts`: remove `CURATE_V2_FILES` and its `guardFolder` line. The `TeaCompass` list is unchanged, since no file is added there.
- `src/admin/guards/onePhotoEditor.test.ts`: remove the three `CurateV2` lines.
- `src/admin/guards/driftCeilings.test.ts`: remove the `CurateV2/index.tsx` line. **`TeaCompass/index.tsx` is 1,836 lines against a ceiling of 1,843.** No slice may add to it. Slice 11 takes lines out.
- `src/admin/components/adminHistory.test.ts`: drop `/admin/compass/v2` from the list of pages.
- `src/admin/guards/historySteps.test.ts`: must pass with `show`, `group`, `arrival` and `find` as steps.
- New: `shared/needsYou/needsYou.test.ts`, `needsYouParity.test.ts`, `curate/LibraryWaiting.test.tsx` (the four states), `curate/WaitingRow.test.tsx`.
- New guard, small: `src/admin/guards/oneNeedsYouRule.test.ts`. It fails if a file outside `shared/needsYou/` and `worker/src/attention.ts` writes its own "needs you" rule, by name: `teaQuestions`, `todaySections`, `gatherAttention`.
- Browser: `tests/compass-library.spec.ts` gains Waiting cases. `tests/admin-history.spec.ts` gains back and forward through Waiting.
- Docs in the same commit as each slice: the step rows in `docs/agents/TEA-SYSTEM-MAP.md` (and its "Aside" on version 2), `docs/COMPONENTS.md` (the new parts, and "Known second copies" loses CurateV2), `docs/agents/CURATE-AGENTS.md` for the tool, `docs/CHANGELOG.md`.

## 4. Build sequence

Every slice ships alone, behind `npm run preflight`, as a draft pull request with `review-pr`. Every slice is a two-way door unless it says otherwise. Admin checks are done in `npm run sandbox` at 390 wide and at desktop width.

| # | Slice | Files touched | The check that proves it | Adrian's yes? |
|---|---|---|---|---|
| 1 | **Done (PR 663).** Waiting says "Reading Stock…" while loading and offers Try again when the read fails; its dot waits for a full read; the five Library tabs are `?show=`. Moving the Waiting block into `LibraryWaiting.tsx` joins slice 9, so that file changes once | | `BrowseView.scope.test.tsx` and `compass-library.spec.ts` ("Library Waiting in the address") | |
| 2 | **The rules move to `shared/needsYou/`** with their own input types. No change to what shows | `shared/needsYou/*` (new), `curate/teaPath.ts` (gone), its importers | The moved tests pass unchanged. `npm run lint:worker-types` shows no new error | No |
| 3 | **Stock teas with no Library card, and the bag weight.** They join the amount, cost and write-up groups. A cost with no bag weight stays in the cost group | `shared/needsYou/needsYou.ts`, `curate/useNeedsYou.ts` (new), `LibraryWaiting.tsx` | Unit cases: a Stock-only tea with no cost is listed once; a typed 0 cost is an answer and is not listed; teaware is never asked a weight | No |
| 4 | **Agent finds, to-dos and suppliers to reach come into Waiting.** `AgentFindsSheet` opens from its row. To-dos tick and can be added | `shared/needsYou/*`, `useNeedsYou.ts`, `LibraryWaiting.tsx`, `curate/AgentInbox.tsx` | Sandbox: an agent suggests two teas, the row shows, Pick adds one as a sample and the row goes. A to-do ticks and undoes. Agent read fails: its line shows, the tea groups still show | **Yes: the three names [P1] [P4] [P5]** |
| 5 | **The Drive line gets a home.** `DriveLine` moves to `curate/` and shows in Settings. A broken link is one row in Waiting. The worker returns there after Google | `curate/DriveLine.tsx`, the account settings view, `worker/src/index.ts` (two lines), `useNeedsYou.ts` | Worker test: a connect with no return path comes back to the new place. Sandbox: the line shows in Settings | **Yes: where it lives, and [P6]** |
| 6 | **Curate version 2 is deleted.** Needs 4 and 5 first. Redirects as in the table above. Guards, tests, docs and old plans updated | `src/components/CurateV2/` (gone), `admin/AdminApp.tsx`, the three guards, `adminHistory.test.ts`, the test files named above, `curateV2Model.ts`, `sampleUse.ts`, `card-utilities.css`, `COMPONENTS.md`, `TEA-SYSTEM-MAP.md`, `TODO.md` | `npm run preflight` green. `rg CurateV2 src tests` finds nothing. Browser test: each old address in the table lands where it says. `npm run build` output is smaller | **Yes. A one-way door: deleted files wait for the `owner-approved` label** |
| 7 | **Your agent hears the same list.** `attention.ts` ends the hand copy. `needsYouRead.ts` reads D1. `whats_waiting` gains the tea kinds, sales first | `worker/src/attention.ts`, `needsYouRead.ts`, `mcpTools/whatsWaiting.ts` (new), `worker/src/index.ts`, `mcp.ts` (both shorter), `docs/agents/CURATE-AGENTS.md` | `needsYouParity.test.ts`. A worker test: ten untasted samples make `whats_waiting` say so. `wrangler deploy --dry-run` passes and the bundle size is noted in the pull request | No. Reads only |
| 8 | **Today reads the one list.** One row per Waiting group, linking to Waiting at that group. "Teas waiting on an answer" and `teaQuestions` go | `admin/components/DashboardView.tsx`, `admin/lib/dashboardSignals.ts`, `lib/api.ts` (the type), `worker/src/index.ts` | Sandbox: Today's row "Samples to taste" opens Waiting scrolled to that group. `oneNeedsYouRule.test.ts` added and green | **Yes: the Today page changes** |
| 9 | **The slim row and one tap.** The Waiting block leaves `BrowseView` for `LibraryWaiting.tsx` (left from slice 1). `WaitingRow` on `TeaCard`, the action per kind, the row that stays in place after a tap | `curate/WaitingRow.tsx`, `waitingActions.tsx` (new), `LibraryWaiting.tsx`, `docs/COMPONENTS.md` | `WaitingRow.test.tsx`. `compass-library.spec.ts` at 390: Taste opens the tasting; after saving, the same row offers Want and Reject. No sideways scroll. `npm run test:mobile` | **Yes: the look changes from full cards to lines. Show him both in the sandbox first** |
| 10 | **One arrival sheet for every door.** `ArrivalReview.tsx` opened by `?arrival=`. The card's Manage delivery, Orders' Receive, Stock's Received & incoming and the Waiting row all open it. Nothing is approved unseen | `curate/ArrivalReview.tsx` (new), `shared/InProcess.tsx`, `TeaCompass/LibraryReceiptActions.tsx`, `TeaCompass/LedgerView.tsx`, `admin/components/InventoryView.tsx`, `TEA-SYSTEM-MAP.md` step 5 | `compass-receipt-possession.spec.ts`: Receive on an order with two pending lines opens the sheet with both; approving one leaves the other pending. A rejected arrival is still rejected, never deleted | **Yes: "Receive" no longer approves a whole order in one tap** |
| 11 | **Shares and imports join Waiting, and the "(2)" leaves the Library tab** | `shared/needsYou/*`, `useNeedsYou.ts`, `TeaCompass/index.tsx` (lines come out) | Unit cases. Sandbox: a pending share shows as a row and the tab carries no number | **Yes: a tab's label changes, and [P2] [P3]** |
| 12 | **The joins.** The Stock panel shows the tea's path line with "Open in Library". Source's saved line links to Waiting | `admin/components/ProductEditPanel.tsx`, `curate/CapturePurchaseResult.tsx`, `TEA-SYSTEM-MAP.md` | Sandbox: a Stock tea with a Library card shows the same next step in both places | No |

If slice 9 is not wanted, everything else still stands: the list is right, complete and shared, in the cards he knows.

## 5. Questions only Adrian can answer

1. **Delete Curate version 2 once agent finds, to-dos and the Drive line have a home in the live Curate?** Recommended: yes. Nothing else in it is in use.
2. **The names for the new groups.** Placeholders: [P1] "Found for you", [P2] "Shared with you", [P3] "Imports to finish", [P4] "To do", [P5] "Suppliers to reach", [P6] "Google Drive needs connecting again". Recommended: these, unless you hear a better word.
3. **Waiting as slim lines with one action each, in place of the full Library cards?** Recommended: yes. The full card is one tap away on the row. I will show you both in the sandbox before it ships.
4. **Today and Waiting as one list in two windows?** Today keeps orders and payments, shows one row per Waiting group, and loses its own "Teas waiting on an answer". Recommended: yes.
5. **Take the numbers off?** The "3 teas" beside each Waiting heading, and the "(2)" on the Library tab for shared teas, which becomes a group in Waiting. Recommended: yes to both. The gold dot stays the only signal.
6. **The fast tasting from version 2: six questions, one tap each.** Keep it, or let it go? Recommended: keep it, later, as the first screen of the one shared tasting, never as a second tasting sheet. It suits a table of twelve samples. If you would not use it, it is deleted with version 2.
7. **"Receive" on an order approves every arrival on it without showing them. Should it open the arrival sheet first?** Recommended: yes. One parcel, one look, one way to say yes.
8. **Where does the Google Drive line live?** Recommended: Settings, with only "needs connecting again" showing in Waiting.
9. **Version 2 also has a Compare screen, a Vendors tab and the Table list. Let all three go?** Recommended: yes. Supplier pages and the Library's supplier groups cover Vendors, and Source covers the Table. Compare has no twin in the live Curate. Say so if you want it rebuilt later.
10. **Should your agent's "what's waiting" read out teas as well as orders?** Recommended: yes, orders and payments first, then teas by group.
11. **Which suppliers count as "to reach"?** Version 2 showed the first three of every supplier with no WeChat, WhatsApp or phone. Recommended: only suppliers with a tea in the Library that is not rejected, and all of them, not three.
12. **Should the gold dot also show on the word Library, or on Curate in the nav?** Recommended: no. It stays on the Waiting tab only. Today already tells you from outside Curate.

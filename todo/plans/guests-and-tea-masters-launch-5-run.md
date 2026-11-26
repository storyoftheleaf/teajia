# Launch 5, the wider service: the run sheet for Opus 5.5

**Status: ready to run where it is not waiting on Adrian, 2026-11-26.** Written by the Fable build thread from `main` at the Launch 1 ship (`234c312`). Launch 5 is not one launch. Each package below stands alone, has its own flag and ships when it is ready, in order of value. It was read less deeply in the code than Launches 1 and 2, and three of its packages need the approach settled with Adrian before anything is built. The why is in [guests-and-tea-masters.md](guests-and-tea-masters.md), "A tea master's shelf, and credit for tea sold through them" and "Step 5: the wider service".

## What can start today

| Package | Why it is independent |
|---|---|
| M3, a card for the table | A printed page for a session's teas. Works for Adrian's own sessions now and is mounted on a host's page after Launch 2 |
| M1 audit, is the order history fit to carry credit | Astra reads what Launch 1 records, on `main`, before any rule is chosen |
| M6 inventory, which screen actions have no tool | Haiku lists them; Sonnet groups them. No code |

Everything else waits on an answer from Adrian or on Launch 3.

## What waits on Adrian

| His answer | Package | What he is asked, with a starting proposal to react to |
|---|---|---|
| **Q8, the credit rule** | M1 | **Answered 2026-11-26: tea credit first, cash later.** The rule M1 builds: credit in tea worth 10 percent of the tea lines of an order, on all teas, only for orders that began from that host's thank-you or page, counted when the order is Filled and removed if it is made Void, with no time window and no expiry (he dropped the 30 days: "ongoing bank"), held under the rules in "Credit is held securely" below, spent only on tea from the shop, never paid out, never shown to guests. Every "after Q8" below now means "free to start" |
| **Q9, the wrapper reader for hosts** | M2 | May a host photograph a tea and be told what it is. It runs on paid analysis, so it needs a limit. Proposal: approved hosts only, ten readings a month each |
| **Q10, the host's box** | M7 | Whether a small box for hosts comes before the tasting box. This is a shop product and a session to go with it, more than software. Nothing is built until he describes the box |
| **Q6, the Tea Table rule** | M8 | Answered yes on 2026-11-26 |
| **Q12, new: a tea for the table** | M5 | See hard question 3 |

### Credit is held securely (Adrian, 2026-11-26)

His words: "Make sure this is security held so no one can hack an order and anything that uses the percentage has to be approved or verified when the order comes in to make sure if a hacker does get at it, it doesn't clear it out." These bind M1 and Astra's audit of it.

1. **Nothing about credit is ever taken from the browser.** No amount, percentage, host or balance is read from a request. Earned credit is worked out in the worker from the stored order, its stored tea lines and `order_session_sources`.
2. **Earning waits for a hand.** An order's credit is written as `pending` when the order is made and becomes `earned` only when Adrian marks that order Filled, which he already does by hand. Void removes it. An order nobody has verified earns nothing.
3. **Spending waits for a hand too.** A host asking to use credit makes a `spend_requested` entry that holds the amount; it leaves the balance only when Adrian approves it on that order in Manage. There is no path that spends credit without his approval, and none through `/mcp` without the usual preview and confirm.
4. **The balance is a sum, never a stored number.** It is the total of the ledger rows, entries are only ever added (a correction is a new row), and each row carries who, when and which order. One order can earn once: a unique key on order and kind.
5. **It cannot go below zero or be spent twice.** The approval is one guarded statement that fails if earned minus spent minus held is less than the amount, so two requests at once cannot both pass.
6. **A ceiling by hand.** One setting on the account, the most credit a single order may use without a second look, default low. Above it the approval page says so in words.
7. **Oddities go to the builder.** A host earning from their own order, many orders from one device, or credit earned and requested the same day are recorded with `recordHealthProblem`, shown on `/account/fixes`, never on a page.
8. **Hosts never earn on their own orders.**

## The hard questions

### 1. Credit: the tracking is live, the ledger is the work, and it must be right the first time.

**Evidence.** Since Launch 1, an order request that began from a thank-you writes one row to `order_session_sources` (`inquiry_id`, `account_id`, `event_id`, `host_user_id`). It joins to an invoice through `inquiries.converted_invoice_id`, because `invoices.source_inquiry_id` is empty for a converted bag request. Order statuses are Draft, Pending, Filled and Void. Nothing reads the table yet. Refunds are recorded in `invoice_refunds`.

**Recommendation.** Credit is a ledger of entries, never a stored balance: one earning entry per order line when its order is Filled, one reversing entry if the order is made Void or refunded, one spending entry when credit is used. The balance is always the sum, so it can be recomputed and audited. Credit is in tea value in USD at the price sold, stated with its currency as every number must be. It is spent as a line on an order to the shop that Adrian applies by hand in Sales in the first version; nothing automatic touches a price. This keeps "money never moves through Teajia".

**Before any of it,** Astra's read-only audit (M1 audit, today) answers: can an order have two sources, can a source point at an order that was replaced, what happens to a source when a request is converted twice, and which orders so far would earn under the proposal. That gives Adrian real history to set the rule on, as the plan intended.

**What only Adrian sees and what the host sees.** The host: privately, which teas guests went on to buy and their credit. Adrian: every host's figures in Manage. A guest: nothing. No figure on any public page.

### 2. Every action as a tool, and a host's own token: the tools exist per launch; the new thing is whose token it is.

**Evidence.** `/mcp` already has scoped tokens minted at `/admin/mcp-tokens` by an owner, an OAuth connector flow, preview then confirm on every write, and tool modules under `worker/src/mcpTools/`. Each launch here ships its own module (`firstTable.ts`, `fewHosts.ts`, and so on).

**Recommendation.** M6 is two things. First, close the gaps: a list of every screen action from Launches 1 to 4 without a tool, then the missing tools. Second, a host's own token: a new scope set that reaches only their own tables, guests, teas, notes and chest, minted from Your Table, so a host can connect their own assistant (Adrian named ChatGPT). A host's token must never reach Manage, another host, or the shop's books. Opus builds it; Astra tries to climb out of it. It waits for Launch 3, when hosts exist in number.

### 3. A tea for the table: the approach is not settled, so here is the smallest whole version to put to Adrian.

The plan lists "a tea for the table, shared between a host and their guests" with no detail. Proposal for Q12: after a session, the host marks one tea from the shop as the table's tea. On the thank-you, each guest may add their name and the grams they would like. The host sees the list and sends it to Adrian as one ordinary order request with every name in its note, one delivery, the host as the buyer. Who pays whom between the host and their guests stays between them, outside Teajia. No split payments, no group checkout, no new money path. If Adrian wants more than that, it is designed again before it is built.

### 4. The wrapper reader for hosts is the existing reader with a second door and a meter.

**Evidence.** The Curate package scanner is owner-only, runs on the server, and Adrian decided on 2026-11-23 to keep it on Claude (`worker/src/curateAnalysisProvider.ts`, `worker/src/labelScan.ts`). Photographs it reads are among the stated exceptions to the photo editor rule, because the analysis reads them whole.

**Recommendation.** One new route for an approved host that returns a suggestion only (a name, a type, a year, a place), writes nothing to Curate or the shop, and fills the host's "add a tea" field for them to accept or change. A monthly count per host, refused calmly when used up. Worker bundle size is a standing constraint, so it reuses the existing provider code and adds no new one.

## The contract, per package

Each package writes its own small migration when it starts. None touches existing rows.

```sql
-- M1, only after Q8:
CREATE TABLE IF NOT EXISTS host_credit_entries (
  id           TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL REFERENCES users(id),
  kind         TEXT NOT NULL CHECK (kind IN ('earned','reversed','spent','adjusted')),
  amount       REAL NOT NULL,
  currency     TEXT NOT NULL,
  invoice_id   TEXT,
  invoice_line_id TEXT,
  event_id     TEXT,
  note         TEXT,
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_host_credit_once
  ON host_credit_entries(kind, invoice_line_id) WHERE invoice_line_id IS NOT NULL AND kind IN ('earned','reversed');

-- M4:
CREATE TABLE IF NOT EXISTS session_series (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, host_user_id TEXT NOT NULL,
  name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('circle','series')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE events ADD COLUMN series_id TEXT;
```

The rule itself (the rate, the window, which teas) lives in one file, `worker/src/hostCredit.ts`, read at use time and never copied into rows, as the shop's markup is.

## The packages

| # | Package | Owner | Starts | Needs |
|---|---|---|---|---|
| M1 audit | Is the order history fit to carry credit | Astra, findings | **Today**, on `main` | |
| M1 | A host's shelf with no stock held; their private view of what came through them; credit in tea as a ledger; Adrian's view in Manage | Opus; Astra audits the ledger | After Q8 and Launch 2 | Q8 |
| M2 | The wrapper reader for hosts, metered | Opus | After Q9 and Launch 2 | Q9 |
| M3 | A card for the table: the evening's teas on one printed page, with a code for afterward | Sol | **Today** | |
| M4 | Circles (a named table that meets again) and series (several sessions under one name) | Sol; Opus for the contract | After Launch 3 | |
| M5 | A tea for the table | Opus | After Q12 and Launch 2 | Q12 |
| M6 | Every action as a tool; a host's own token | Haiku and Sonnet for the inventory **today**; Sonnet for missing tools; Opus for the token; Astra audits it | Token after Launch 3 | |
| M7 | The host's box, then the tasting box | Nobody yet | After Q10 | Q10, and his description of the box |
| M8 | "Does anyone know this tea?" on the Tea Table | Sol | After Launch 4's K1 | Q6 |
| M9 | Short video. The app | Later | | |

## The messages to send

Each ends with the standing rules block from the Launch 2 run sheet; paste it in full. Each package has its own branch `build/l5-<name>` from `main` and its own pull request into `main`'s integration branch for that package, `build/launch-5-<name>`. For every package not written out here, Opus writes the message once its "Needs" is met.

### Astra, M1 audit: is the order history fit to carry credit (findings, today)

```
Repository storyoftheleaf/teajia, branch main. Read only. Findings with a failing test or exact reproduction each. Do not fix.

Since Launch 1, an order request that began from a session's thank-you writes one row to order_session_sources (inquiry_id primary key, account_id, event_id, host_user_id), through recordOrderSessionSource in worker/src/orderSessionSource.ts. Later, credit in tea will be earned by the host on those orders. Nothing reads the table today. Prove whether the history it holds can be trusted to pay on.

1. The join from a source to money. An order request becomes an invoice. The known path is inquiries.converted_invoice_id; invoices.source_inquiry_id is empty for a converted bag request. Show every way a request becomes an invoice (website checkout, conversion in Sales, the agent tools, a request converted twice, an invoice voided and re-made) and whether the join finds exactly one invoice each time, none, or two.
2. Statuses are Draft, Pending, Filled, Void. Payment is resolved by resolveInvoicePayment, not by one column. Define, with evidence, the one moment an order is truly sold, and the events that undo it (Void, cancelled_at, refund_required, rows in invoice_refunds, a partial refund).
3. Lines. Which invoice_line_items would earn: tea lines only, a teaware line, a custom line with no product, shipping. A line whose quantity was edited after the sale.
4. host_user_id on a source row: where it came from for each row shape (a session with a lead host contributor, one without, one whose host later left). Can it be NULL, and can it name someone who was not the host.
5. One guest, one session, two orders; one order begun from two different sessions' thank-yous on the same phone within the 14 days the site holds the reference. Which session each row names and whether that is defensible.
6. A host buying their own tea through their own thank-you.
7. Orders from before Launch 1: none should have a source. Confirm.
8. Whether anything already written would have to change shape to support "credit is earned when Filled and reversed when Void", and what the smallest change is.

Return: numbered findings with severity (credit would be paid wrongly, would be missed, or cosmetic), the evidence, and a short table of the orders-to-source shapes you found.
```

### Sol, M3: a card for the table

```
Repository storyoftheleaf/teajia. Branch from main as build/l5-m3-card; pull request into build/launch-5-card, never main.

Goal: a host prints one page for the table: the evening's teas in pouring order, and a code a guest can use afterward to find the session again. The phone stays in the pocket.

Approved behaviour:
- A print view of a session's teas. Page src/pages/SessionCardPage.tsx, opened from the session in Manage by one button "Print a card for the table" (the build owner adds the route and the button's mount line; you export the button component).
- The card: the session's name and day; "Hosted by" and the host's name; the teas in pouring order, each with its name and, when it has them, year and place. No prices. No stock. A tea that is only a name is printed as a name.
- At the foot: the words "Afterward" and the session's own link as a QR code and as short text beneath it. Use the session's public address; never a guest's personal link and never any secret. Generate the QR code in the page with no outside service and no new dependency over 20 kB; if no small one is already in package.json, draw the short link as text only and report that.
- One A5 page, portrait, black on white, sized by print CSS (@media print), with the site's chrome hidden when printing. On screen it shows a plain preview and one button, "Print".
- An empty tea list prints the name, day and host only.
- Nothing about this page asks anything of a guest during the session.

You own: src/pages/SessionCardPage.tsx, src/components/events/PrintCardButton.tsx, tests/session-card.spec.ts.
Do not touch: worker/, src/App.tsx, src/lib/api.ts, src/styles/tokens.css. Read the session and its teas through the existing public session and tea-menu calls.

Acceptance check: tests/session-card.spec.ts with mocked routes: three teas print in order; a name-only tea prints; an empty list prints; emulating print media, the page has no navigation, no horizontal overflow and fits one A5 page.

Then the standing rules. Report back: the branch, what you ran, and what you did about the QR code.
```

### Haiku then Sonnet, M6 inventory: which actions have no tool

```
Repository storyoftheleaf/teajia, branch main. Read only. No code changes.

List every thing a person can do on a screen in these areas that changes or reads their own data: sessions and guests (src/admin/components/EventForm/, AttendeeTable.tsx, src/components/events/), the thank-you (src/pages/AfterSitPage.tsx), the Tea Chest (src/components/AccountPanel/CellarView.tsx), the journal (src/pages/JournalPage.tsx), orders (src/pages/OrderDetailPage.tsx), favourites, and a person's page. For each action give: the screen, the route it calls, and the name of the agent tool that does the same thing, or "none". Tools are defined in worker/src/mcp.ts and the modules under worker/src/mcpTools/ (registry.ts lists them).

Return one table sorted by area, then a second list of the actions with no tool, grouped by who would use them: a host, a guest, Adrian. Do not propose designs.
```

## The journey for each package

Each package is walked alone when it is ready, in the sandbox, on a phone-sized screen.

- **M3, the card.** Open a session with three teas in Manage, print the card, read it at arm's length, scan the code with a phone and land on the session.
- **M1, credit.** A guest orders a tea from a host's thank-you. Adrian fills the order: the host sees the tea and their credit, privately. Adrian makes the order Void: the credit is gone and both entries remain in the ledger. The guest sees no figure anywhere. Adrian applies credit to the host's own order in Sales by hand.
- **M2, the reader.** An approved host photographs a wrapper while adding a tea and is offered a name to accept or change. The eleventh reading in a month is refused calmly. Nothing was written to Curate.
- **M4, circles and series.** A host names a circle, makes "the same table again" inside it, and a guest of the first is offered the second.
- **M5, a tea for the table.** Three guests add their grams on the thank-you; the host sends one order request naming all three; Adrian sees one ordinary request in Sales.
- **M6, the host's token.** A host connects their own assistant, makes a table by saying one sentence, and is refused every tool that reaches Manage, another host or the shop's books.

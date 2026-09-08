# Teajia Work Intake

> This is a small inbox, not the roadmap. The authoritative priorities are [docs/CONSOLIDATED_DIRECTION.md](docs/CONSOLIDATED_DIRECTION.md), and the only active build checklists are in [docs/tracks/](docs/tracks/).

## Prime-time audit — the ten that matter (2026-09-09)

Ranked in [docs/AUDIT-2026-09.md](docs/AUDIT-2026-09.md). Each line is one root cause; the ids point at the verified findings.

- [ ] Every new tea ships free and carries the old markup through five of six doors, because the live table still defaults to 0 and 2.5 _(band: agent-runnable)_ _(effort: deep)_ → Plan: [freight-default-lives-in-the-table.md](todo/plans/freight-default-lives-in-the-table.md)
- [ ] Nothing on a push to main runs the type check, the build or the full test suites; add the gate that would have caught the two-day outage _(band: agent-runnable)_ _(effort: moderate)_
  TEST-1, TEST-2: `deploy-frontend.yml` is manual, `playwright.yml` runs 2 of 48 specs, no hooks.
- [ ] A blank cost becomes zero at four client doors (CSV, xlsx, sample graduation, Tea Compass), and the agent-door guard test cannot go red _(band: agent-runnable)_ _(effort: moderate)_
  MONEY-4, JOBO2-1, MONEY-12.
- [ ] 21 live teas carry a currency label the admin cannot resolve; canonicalise once in the admin, stop `update_tea_pricing` uppercasing, and correct the rows _(band: agent-runnable)_ _(effort: moderate)_
  JOBO-2, MONEY-5, MONEY-10. The row correction moves prices in admin readouts, so it goes to Adrian as a page first.
- [ ] The shop grid price omits the handling fee the ladder charges; use one quote for both _(band: you-required)_ _(effort: quick)_
  JOBC-1. Recommendation: the grid uses `quoteGrams()` for its default weight. Adrian decides whether that is the number he wants shown.
- [ ] Rate-limit and length-cap the inquiry and newsletter endpoints, and make an absent limiter binding refuse rather than allow _(band: agent-runnable)_ _(effort: moderate)_
  SEC-1, SEC-2, SEC-5.
- [ ] Draft articles are readable at their direct URL; gate the fourteen article pages on publish status _(band: agent-runnable)_ _(effort: moderate)_
  JOBC-2.
- [ ] Give `create_tea` a real tea type default _(band: agent-runnable)_ _(effort: quick)_
  MONEY-8.

Everything below the ten is in the report's "Later" bucket: false-success deletes, the unfiltered wisdom read, eager home imports and the 2 MB admin chunk, the unpaginated customers list, duplicated slug and sha256 helpers, 99 orphan files, the 36 px AccountPanel controls, the off-scale radius, three High npm advisories, the 57-day-old docs index.

## Untriaged

- [ ] A wholesale listing with no recorded quantity can be added to a draft order at a unit price of zero _(band: agent-runnable)_ _(effort: quick)_
  `WholesaleOrderDraft.tsx` reads `profile.wholesale_price_per_gram_caller ?? 0`. The catalogue now returns null for a cost-based listing whose `quantity_purchased` is missing (it used to quote the total cost as a per-gram price), so that null reaches the draft as a free tea. Nothing entered is NULL, and a null price should refuse to be added, not become 0. Found by the item 8 reviewer on 2026-09-09.

- [ ] An agent price edit leaves the partner listing quoting the old cost currency _(band: agent-runnable)_ _(effort: quick)_
  `commitUpdateTeaPricing` in `worker/src/mcp.ts` stamps `products.cost_currency_source` but writes no `cost_amount`, `cost_currency` or `cost_currency_source` to `product_listings`, so after `update_tea_pricing` the listing row still carries the old cost with a NULL mark. Found by the item 5 reviewer on 2026-09-09; `set_cost_currency` handles the same mirror correctly and is the pattern to copy. No backlog risk, because `list_unstated_costs` reads `products`.

- [ ] **The new MCP modules had to copy three things out of `index.ts`, because `index.ts` cannot be imported from them.** _(band: agent-runnable)_ _(effort: moderate)_
  `index.ts` imports `mcp.ts`, which imports the modules under `worker/src/mcpTools/`, so a module importing back is a cycle. Three helpers got copied rather than shared, which is one fact with two homes and the exact shape migrations `0010` and `0013` exist to undo: `EVENT_STATUS_BY_LIFECYCLE` (a test parses `index.ts`'s source and fails on drift, which is a splint and not a fix), and `slugify` plus `articleToApi` in `writing.ts` — a slug is an article's public address, and two functions producing different ones is a link that works from one door only.

  The fix is to hoist each into a domain module both sides can import: the event map into `eventDomain.ts`, the article helpers into a module of their own. While hoisting the event map, move `cascadeWaitlist` too: it is unexported in `index.ts`, and three RSVP tools (deny, waitlist, cancel) were deliberately NOT built because a second copy of a promotion rule means a guest promised a seat and never told.

- [ ] **A fifth freight rate still exists, on the import batch, and it cannot mean "nobody said".** _(band: agent-runnable)_ _(effort: moderate)_
  `curate_import_batches.shipping_rate_per_kg` was added by migration `0001` as `REAL NOT NULL DEFAULT 10.0`, from before freight moved onto the account as 85 yuan. `schema.sql` declares the same column `DEFAULT 12.0`, so the test fixtures and the live database disagree about it, which is its own small drift.

  Nothing updates it and nothing reads it onto a product, so it is inert, and as of 2026-09-07 the route neither writes nor trusts it: the INSERT omits the column and the finalize payload reports the shop rate instead. What remains is to remove it. `NOT NULL` on a policy number is the shape this whole sequence exists to delete, because a column that cannot record absence can never be trusted to record presence. Dropping it also changes the finalize payload, so check no client reads `shippingRatePerKg` from it first (nothing under `src/` does today).

- [ ] **Most teas on the shelf have a cost currency nobody ever stated, and Adrian's own reading is that most were not paid for in dollars.** _(band: you-required)_ _(effort: moderate)_
  Migration `0014` added `cost_currency_source`, so a row nobody answered is now findable: every write that states a currency is stamped `'stated'` server-side, and what stays NULL is the backlog. It cannot be repaired by reading, because a defaulted `'USD'` and a chosen `'USD'` are the same three letters.

  The work is one answer per VENDOR, not per tea. `list_unstated_costs` groups the unanswered rows with the count and what any intake receipt recorded; `set_cost_currency` applies one answer to a whole vendor behind preview/confirm. Both need a session connected to the MCP (`TEAJIA_MCP_TOKEN` in the environment plus `api.teajia.com` on its network allowlist; `npm run mcp:check` says which of the two is missing, and whether the token carries `catalog:write`, which `set_cost_currency` needs and which is unticked by default at mint). Without that, the inventory CSV carries a **Cost currency stated?** column and the backlog is the block of noes.

- [ ] **A cost of zero means a free tea, and the column still defaults to it.** _(band: agent-runnable)_ _(effort: moderate)_
  `products.cost_amount` is `REAL DEFAULT 0`, and on money a default of 0 is the dangerous one precisely because it is a plausible figure: it does not read as "nobody said", it reads as free, and the shelf prices it at zero times three. Registered as DEBT in `MONEY_DEFAULTS` in `worker/tests/schema-defaults-are-decisions.test.ts`.

  **Already unreachable through the code**, as of 2026-09-06: the Add Product form, the bulk create and `create_tea` all REQUIRE a cost (absence refused, a typed 0 kept, since a gift is real), and the three doors that genuinely cannot know one — a receipt proposal, a cellar placement, an inbound import — name the column explicitly as NULL. `worker/tests/a-tea-arrives-with-its-cost.test.ts` holds all six. So the default now only reaches a row inserted straight from `schema.sql`. Removing it means a table rebuild, same constraint and same caution as the tenant defaults above.

- [ ] **Four tables default their tenant to Bali, so a row inserted without an account silently belongs to one shop.** _(band: you-required)_ _(effort: moderate)_
  **Guarded 2026-09-06, not yet removed.** The default is only reachable by an INSERT that does not name `account_id`, so that is the actual failure and `worker/tests/schema-defaults-are-decisions.test.ts` now fails any insert into these four tables that omits it. Every existing insert names it. Removing the defaults means rebuilding four tables, which is what SQLite requires for a default change, and the live column shape cannot be verified from a cloud sandbox — a blind `INSERT INTO new SELECT *` against a table of articles is how articles get lost. Do it with the MCP connected, or from a machine that can read the live schema: confirm each table's real columns first, then rebuild, then drop.

  Found 2026-09-06 while auditing every column default. `articles`, `story_content`, `story_content_versions` and `story_photos` carry `account_id TEXT NOT NULL DEFAULT 'acc_teajia_bali'`, from before the platform was multi-tenant. In a system whose entire tenancy model is "every row carries `account_id`", that is the one default capable of putting one shop's content inside another, and it fails silently because the row is perfectly valid. Nothing is known to be misfiled today; what is missing is the refusal. The fix is to drop the default so an insert without an account errors, which needs each insert path checked first, and SQLite cannot alter a default in place so it needs a table rebuild per table. `worker/tests/schema-defaults-are-decisions.test.ts` stops a fifth table joining them in the meantime.

- [ ] **Three schema defaults still guess a unit, and three still copy a policy number.** _(band: agent-runnable)_ _(effort: moderate)_
  Registered as DEBT in `worker/tests/schema-defaults-are-decisions.test.ts` with the reason each is carried. The unit guesses are `cost_currency`, `purchase_currency`, `price_currency` (which guesses NT) and `currency`: a figure whose unit was invented prices wrong by whatever the exchange rate is. The copied policy numbers are `markup_multiplier`, `shipping_rate_per_kg` and `low_stock_threshold`: a shop-wide decision written onto every row, free to drift. The code paths for markup and freight already write NULL and read the one source at use time, so these defaults now only reach a row created straight from `schema.sql`; `low_stock_threshold` has had no such pass. Fixing each properly means a table rebuild, since SQLite cannot alter a column default in place.

- [ ] **Connections link inside Your Table, and a connections page that holds people and the places that supply.** _(band: you-required)_ _(effort: deep)_ → Plan: [connections-page.md](todo/plans/connections-page.md)
  Decided 2026-09-06 during the desktop sidebar redesign: the old "Our spaces" link in the sidebar foot now reads "connections" but still opens the spaces page. Adrian wants connections to mean people, profiles and the suppliers and places the shop works with, reachable from the sidebar foot and from inside Your Table. Needs a design call on what the page shows before it is built. Adrian also reported the spaces page erroring on the live site; it did not reproduce locally in dev, sandbox or a production build, so check it on teajia.com itself.

- [ ] **A column added to the live database by hand jams every deploy until someone records it.** _(band: agent-runnable)_ _(effort: moderate)_
  Measured 2026-08-31: the worker could not deploy between 09:35 and 12:37, and five commits sat behind it, two of them fixes for bugs live on the public event page at the time. Cause both times was the same. A session added a column straight to the live database to unblock itself, wrote the migration afterwards, and never recorded that it had run, so the deploy tried to add a column that was already there and stopped. It took two rounds to clear because the failure only ever names the first migration it trips on, so the second was invisible until the first was fixed. The pipeline was right to refuse and right to fail loudly, which is the June fix working as intended, so this is not about loosening it. What is missing is anything that catches the mistake at the moment it is made rather than hours later in someone else's deploy: the session that applies a column by hand is the only one who knows they did it. Worth noting alongside it, same root cause of sessions working in parallel: the folder now holds two migrations numbered 0001, two numbered 0002 and two numbered 0004, so which one runs first is decided by the rest of the filename rather than by anyone.


- [ ] **Two places now decide whether a tea master can be paid.** _(band: agent-runnable)_ _(effort: moderate)_
  Left for whoever is building tea master onboarding. That work adds a check asking whether an account has a published payment method, to stop a shop opening with nowhere to send money. The order path already answers a version of that question when it decides whether to put a pay link on an invoice, and the two are not the same shape: one is a yes or no for a whole shop, the other is a link for a single order. So this is not a duplicate to delete, it is a pair to keep honest. It is worth naming because the order code carried exactly this problem until 2026-08-31, when the same money rule was written in two files and the screen and the voice quietly disagreed about what counted as paid. If both checks stay, say in each one that the other exists and how it differs.

  Measured 2026-08-31, and only true while it is: that branch has 786 lines of work saved nowhere but its own folder, no commit, and is 17 changes behind. It was test-applied against main as it stood after the order work landed and it fits with no conflicts, so rebasing is safe whenever it is picked back up. Commit before anything else touches it.

- [ ] **There is no way for someone to set themselves up as a tea master.** _(band: you-required)_ _(effort: deep)_ → Plan: [tea-master-onboarding.md](todo/plans/tea-master-onboarding.md)
  A tea master is one thing to you and two unconnected things to the system: an account you create by hand, and a profile they create themselves that holds their payment links. Nothing walks anyone from one to the other, and nothing can even submit an application, though the inbox to review them exists. Decided 2026-08-31: invitation only for now, and a tea master does not need a shop. That makes the person the trunk and the shop a branch, and it means the one genuinely new piece is an invitation that can make someone a tea master with no shop at all. Nothing today does that: the join code is for tea session guests, and the team invite adds a member to a shop that already exists.

- [ ] **A saved inventory view can be created but never deleted.** _(band: you-required)_ _(effort: quick)_
  The view rail was redesigned into four purpose lenses plus a Flagged menu, and the per-view delete control did not come across. `deleteView` is still in the store and still wired into InventoryView, so only the affordance is missing. Two tests in `tests/inventory-purpose-views.spec.ts` are skipped against this and name it, so they turn back on when the control returns. Where it belongs in the new rail is a design call.

- [ ] **An admin boot fetches the sample list four times and sample sets three times.** _(band: agent-runnable)_ _(effort: moderate)_
  `sampleRepository.hydrate()` and `sampleRepository.sync()` each call `sampleSets.list` and `samples.list`, a third call sits further down the same file, and `teaCompassSync` pulls `samples.list` again. Two admin boots measure 41 API reads where the guard in `tests/admin-chunk-failure-production.spec.ts` was written expecting 24. Nothing is looping; the same two endpoints are simply requested by several callers that do not share a result. Worth one deliberate pass to give them a shared read.

- [ ] **The Curate sourcing surface now carries three type sizes where it was specified as two.** _(band: you-required)_ _(effort: quick)_
  `curate-floating-label` sets its uppercase field labels at 10px, and they are everywhere in Source, so the scale is 10/12/16 rather than the 12/16 the surface was built to. The browser guard in `tests/compass-capture.spec.ts` has been updated to what is true today so it keeps working, with the reason written beside it. Whether a 10px label belongs there, or should be 12, is a design call.

Add only genuinely new observations here. During triage, move each accepted item into exactly one owning track or discard it. Do not duplicate track items here.

<!-- Use: - [ ] **Short outcome.** Why it matters and the evidence that it is not already covered. -->

- [ ] **The admin browser specs fail about one run in four, on timing, and nobody sees it.** _(band: agent-runnable)_ _(effort: moderate)_
  Measured 2026-08-31 against origin/main's own copy of `OrdersView.behavior.test.ts`, with no local changes in the file: four consecutive runs gave three greens and one failure, always a 5-second test timeout rather than a wrong assertion. Running several of these browser-backed files at once makes it worse: four together failed three of four, one at a time all four passed. They also never run in CI. A suite that fails at random and is watched by nobody teaches everyone to ignore it, so either the waits need to stop racing the default 5s timeout or the files need to run serially with a longer one. Separately from whether they belong in CI at all.

- [ ] **Events have no seat price, so every close-out lands as a pile of zero-priced orders.** _(band: you-required)_ _(effort: moderate)_
  Measured 2026-08-31. Closing an event writes one `EVT-` invoice per attendee who came, with one line per tea on the menu, and every line is priced at zero because there is nowhere in the schema to put what a seat costs: the events table has no price, fee or contribution column. Those orders are real and ledger-backed, so the money flow itself is fine, but Adrian prices each attendee by hand afterwards and until he does they all sit on Your Table as unpriced. Deciding what an event charges for, per seat or per tea poured, is a product call before it is a schema one.

- [ ] **A dead attendee payment column is waiting to be mistaken for the real thing.** _(band: agent-runnable)_ _(effort: quick)_
  `event_attendees.payment_status` carries a five-value CHECK constraint and a test guarding it, and nothing in the worker reads or writes it. Verified 2026-08-31 across the worker, the frontend and the tests: the only reference is the constraint test. Event money runs through the `EVT-` invoices instead. It was already read once as the live record of what an attendee owes, which sent a piece of the order-process handoff after a problem that did not exist. Either drop it or annotate it, but do not leave it looking authoritative.

- [ ] **Only 3 of 120 shop products say what physical form they are.** _(band: you-required)_ _(effort: moderate)_
  Measured 2026-08-29 against the live public catalogue. The shop now offers a whole pressed piece as its own amount (Cake 357 g, Brick 250 g, Tuo and Ball 100 g), read from each product's `form` field, but 117 of the 120 public products have `form` empty so the option never appears for them. Across the whole products table 55 rows are marked Cake and 124 are blank, so most of the missing values are on records that exist but were never filled in. Filling the field in the admin is what turns the option on; no code change is needed.

- [ ] **Most of the mobile browser suite is red because a few admin calls are not faked.** _(band: agent-runnable)_ _(effort: moderate)_
  Measured 2026-08-27 on this branch: 56 of 336 mobile tests fail across 20 files. The inventory scroll file was failing all 7 for a single reason. Two admin sample calls were not faked, so they reached the real live API, came back refused, and the app signed itself out; every assertion then ran against a signed-out shell. Adding those two fakes turned all 7 green with no product change. The remaining failures look like more of the same across other files. Worth one pass to fake what each file actually loads, so a red run means something again. One of them costs more than its own result: in `account-panel-mobile.spec.ts` the "orders tile closes the panel" test waits for a tile that never appears, and because it fails the 29 tests after it never run at all, so that file reports on a third of what it covers. Confirmed pre-existing 2026-08-27 against the commit before that day's shop work, so it is not a regression from those changes.
- [ ] **Every set on the live shop lists "Unavailable item" and its buy button does nothing.** _(band: you-required)_ _(effort: moderate)_
  Measured on teajia.com 2026-08-28: the Sets tab shows 8 priced sets carrying 29 "Unavailable item" lines between them, because the product ids hardcoded in `STARTER_TEA_SETS` / `STARTER_TEAWARE_SETS` (src/constants.ts) match nothing in the catalogue any more. Clicking "Add Set to Cart" was tested directly: the cart held 0 items before and 0 after, so a customer can press a $52 buy button and receive nothing, with no error shown. Remapping needs Adrian to say which teas belong in each set; the alternative, hiding the Sets tab until then, is one line but is a product decision.

- [ ] **The shop still opens on two rows of tabs where one would do.** _(band: you-required)_ _(effort: quick)_
  The shop cleanup landed everything except this: "All teas / My selection / Find a tea" still sits as its own band under the four section tabs, which is why the first tea starts 286px down rather than the ~158px the design targets. Folding those three into the Filter control is the last 128px, but it changes a tab row, and CLAUDE.md says nav and tab labels are never changed without asking. Needs a yes, then it is a small change in `TeaInventory.tsx`.

- [ ] **Teaware rows have no material or capacity to show, so they fall back to restating their own group heading.** _(band: agent-runnable)_ _(effort: quick)_
  The teaware line prefers what a piece is made of and how much it holds, then falls back to its category. Live on 2026-08-28 every row lands on the fallback and reads "POT" under a name that already says teapot, because `material` and `capacity_ml` are empty across the catalogue. Filling either turns the line into something worth reading ("Clay - 200ml"); no code change needed.

- [ ] **Nobody knows how much of the catalogue has a vintage or a full origin.** _(band: agent-runnable)_ _(effort: quick)_
  The shop ledger now leads every row with the tea's year on its liquor ground, and narrows the origin from village to province underneath. Both read fields that are optional in the schema and were empty in every local database checked, so the real coverage across the 139 products is unmeasured. If `year` is thin the left column is mostly blank blocks, and if `origin` is a single word the provenance line has nothing to narrow. Count both against production before deciding whether the design needs a different fallback or the data needs filling.

- [ ] **Five admin test files are red on main and nobody is watching them.** _(band: agent-runnable)_ _(effort: moderate)_
  Measured on a clean main 2026-08-22, with the worktree folders gone so the count is honest: 1015 pass, 3 fail, and five files fail to load at all — the orders view, quick invoice, settlement ledger and order attribution behaviour specs, plus the Helmet title scan. None of these run in CI (the Playwright job covers browser journeys, the worker job covers the API), so they have been failing unnoticed. Either they cover something real and belong in CI, or they are stale and should go; leaving them red teaches everyone to ignore a red run.

- [ ] **Two ways to lose an invoice edit, both still open.** _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [sales-rebuild-salvage.md](todo/plans/sales-rebuild-salvage.md)
  Saving an order, and splitting or re-linking its lines, both read the invoice and then write it as two separate steps with nothing holding it in between. Two people on the same order — or one person double-clicking Save — race, and the loser's edit disappears with no error shown. Fulfilling and voiding were fixed this way already and the same lease pattern applies here; the work is knowing which handlers need it, not inventing anything. Verified still open on main 2026-08-22.

- [ ] **An invoice can be attached to a customer belonging to another account.** _(band: agent-runnable)_ _(effort: quick)_ → Plan: [sales-rebuild-salvage.md](todo/plans/sales-rebuild-salvage.md)
  None of the three invoice write paths check that `customer_id` belongs to the account writing it, and there is no database constraint behind them either — the column was added by a bare ALTER. Nothing is known to have crossed accounts, but nothing stops it. While in there: payment status and status take any string on update, shipping cost is unchecked for type or sign, and a custom line item is allowed to have no name at all.

- [ ] **Mobile inventory rows are hard to tap, and a low-stock row only signals in the number.** Salvaged from `wip/inventory-mobile-sheet` before that branch was dropped 2026-08-21 (it had drifted 160+ commits behind main and would have reverted newer inventory work). Two small changes, verified absent from main today: widen the name / stock / vendor-source tap targets from fit-content to full-width, and let the product name itself carry the low-stock tint rather than only the stock figure. Re-implement against current `InventoryRow.tsx`, do not resurrect the branch.

- [ ] **On mobile, Adjust and the overflow menu are two separate sheets that could be one.** Also from the dropped `wip/inventory-mobile-sheet`. The concept is sound and is still unbuilt on main, but the branch's code is unusable — `InventoryView.tsx` has since gained wisdom-entry filtering, an inventory-summary endpoint and tasting-journal wiring that the branch predates. Treat this as a fresh build from the idea, not a merge.

## Later — the tasting notes loop

Shipped 2026-09-05: the shop's tasting and a customer's tasting are two separate
records, and the only bridge is the Tasting Notes room, where the shop reads
every note anyone wrote and chooses what a tea carries. These four are the rest
of that loop. None of them blocks it working; the first one gates telling
anybody about it.

- [ ] **A customer is not told that what they write can be published.** _(band: you-required)_ _(effort: quick)_
  Tasting Notes now shows the shop every note anyone has written, and publishing one puts their sentence on a public product page under a name the shop types. Nothing in the tasting screen says so. That is a consent question, not a screen: it wants a line where someone writes, and a decision about whether they can ask for a published note to come down.


- [ ] **The old offer-led review queue is still wired up and now contradicts the new one.** _(band: agent-runnable)_ _(effort: quick)_
  The queue inside the Add Product window reads only notes a customer put forward themselves, which is the model that was just replaced. Customers no longer put anything forward, so it will sit empty and mislead whoever finds it. Its editing controls are good and worth keeping somewhere; the list behind it is the part that is now wrong.


- [ ] **A published customer note names a person who has no page to go to.** _(band: you-required)_ _(effort: moderate)_
  Promoted notes carry a name and a line of detail, both typed by hand at the moment of publishing rather than read from the person. Contributor profiles already exist for tea makers, so the shape is there. Whether a customer becomes a public profile, and what appears on it, is a decision about the shop's relationship to its customers, not a wiring job.


- [ ] **No tea in the shop has a tasting entered, so the record never renders on the live site.** _(band: you-required)_ _(effort: moderate)_
  Measured 2026-09-05: all 133 public products carry an empty tasting record, and none names a source. What shows today is the old free-text tag list falling back into the taste line. Everything downstream of a tasting is therefore invisible in production: the feel line, the shop's starred note, the potential-profile qualifier. The structured tasting can be written from the admin panel or spoken through the agent tools; what is missing is the sitting-down and doing it, tea by tea.


## Historical queue

The pre-consolidation root queue is preserved at [docs/_archive/session-artifacts-2026-07/ROOT_TODO.md](docs/_archive/session-artifacts-2026-07/ROOT_TODO.md). Its valid work was reconciled into the July tracks; it is not an active checklist.

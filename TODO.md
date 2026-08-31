# Teajia Work Intake

> This is a small inbox, not the roadmap. The authoritative priorities are [docs/CONSOLIDATED_DIRECTION.md](docs/CONSOLIDATED_DIRECTION.md), and the only active build checklists are in [docs/tracks/](docs/tracks/).

## Untriaged

- [ ] **There is no way for someone to set themselves up as a tea master.** _(band: you-required)_ _(effort: deep)_ → Plan: [tea-master-onboarding.md](todo/plans/tea-master-onboarding.md)
  A tea master is one thing to you and two unconnected things to the system: an account you create by hand, and a profile they create themselves that holds their payment links. Nothing walks anyone from one to the other, and nothing can even submit an application, though the inbox to review them exists. The first decisions are yours, not an agent's: whether this is invitation-only, and whether someone can be a tea master without a shop.

- [ ] **Events, wholesale and sample orders still cannot take a payment the way shop orders can.** _(band: agent-runnable)_ _(effort: deep)_ → Plan: [order-process-handoff.md](todo/plans/order-process-handoff.md)
  Four ways to be owed money, one of them modernised. An event seat is tracked in a bare column with no history and no pay link, and wholesale writes invoices already marked paid that the ledger cannot see. Route event money through the invoices the close-out already creates rather than adding a second payments table.

- [ ] **The pay page never says what it is being paid for.** _(band: you-required)_ _(effort: moderate)_ → Plan: [order-process-handoff.md](todo/plans/order-process-handoff.md)
  A customer sees an amount, a code and transfer details, but not their order. Someone with two open orders cannot tell which one they are paying. The page is public and reachable by URL, so how much it may show is a privacy call worth making deliberately before building.

- [ ] **A sample request is only recorded when the sample matches a tea in the shop.** _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [order-process-handoff.md](todo/plans/order-process-handoff.md)
  Every inquiry line must resolve to a real product, so sample requests for anything else stay a plain WhatsApp message with no record. Letting a line be a named custom line would close it, but that loosens validation on a public write path and needs its own thought.

- [ ] **An order can still be sent carrying a line priced at nothing.** _(band: agent-runnable)_ _(effort: quick)_ → Plan: [order-process-handoff.md](todo/plans/order-process-handoff.md)
  A retired tea converts to a zero-priced line on purpose, so nothing is silently dropped. It now shows up in the attention list, but nothing refuses to send it. A draft carrying one should not become pending without an explicit acknowledgement.

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

## Historical queue

The pre-consolidation root queue is preserved at [docs/_archive/session-artifacts-2026-07/ROOT_TODO.md](docs/_archive/session-artifacts-2026-07/ROOT_TODO.md). Its valid work was reconciled into the July tracks; it is not an active checklist.

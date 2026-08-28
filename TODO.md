# Teajia Work Intake

> This is a small inbox, not the roadmap. The authoritative priorities are [docs/CONSOLIDATED_DIRECTION.md](docs/CONSOLIDATED_DIRECTION.md), and the only active build checklists are in [docs/tracks/](docs/tracks/).

## Untriaged

Add only genuinely new observations here. During triage, move each accepted item into exactly one owning track or discard it. Do not duplicate track items here.

<!-- Use: - [ ] **Short outcome.** Why it matters and the evidence that it is not already covered. -->

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

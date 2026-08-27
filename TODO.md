# Teajia Work Intake

> This is a small inbox, not the roadmap. The authoritative priorities are [docs/CONSOLIDATED_DIRECTION.md](docs/CONSOLIDATED_DIRECTION.md), and the only active build checklists are in [docs/tracks/](docs/tracks/).

## Untriaged

Add only genuinely new observations here. During triage, move each accepted item into exactly one owning track or discard it. Do not duplicate track items here.

<!-- Use: - [ ] **Short outcome.** Why it matters and the evidence that it is not already covered. -->

- [ ] **Most of the mobile browser suite is red because a few admin calls are not faked.** _(band: agent-runnable)_ _(effort: moderate)_
  Measured 2026-08-27 on this branch: 56 of 336 mobile tests fail across 20 files. The inventory scroll file was failing all 7 for a single reason. Two admin sample calls were not faked, so they reached the real live API, came back refused, and the app signed itself out; every assertion then ran against a signed-out shell. Adding those two fakes turned all 7 green with no product change. The remaining failures look like more of the same across other files. Worth one pass to fake what each file actually loads, so a red run means something again.

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

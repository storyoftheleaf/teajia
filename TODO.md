# Teajia Work Intake

> This is a small inbox, not the roadmap. The authoritative priorities are [docs/CONSOLIDATED_DIRECTION.md](docs/CONSOLIDATED_DIRECTION.md), and the only active build checklists are in [docs/tracks/](docs/tracks/).

## Untriaged

Add only genuinely new observations here. During triage, move each accepted item into exactly one owning track or discard it. Do not duplicate track items here.

<!-- Use: - [ ] **Short outcome.** Why it matters and the evidence that it is not already covered. -->

- [ ] **Make the public order reference unguessable.** _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [sales-rebuild-salvage.md](todo/plans/sales-rebuild-salvage.md)
  `GET /api/inquiries/:ref` is public and takes a reference the browser builds as `TJ-YYYYMMDD-NNN` with three digits, so 900 requests walk a whole day of orders. As of 2026-08-21 that no longer exposes anyone — the route stopped returning the customer name, email and phone — but what was ordered and for how much is still enumerable. The fix is a tracking token stored only as a SHA-256 hash, which exists on `codex/sales-system-rebuild` along with its migration and test; the migration needs renumbering to 130 because main has since taken 127. Existing `/order/TJ-...` links stop working when this lands, so it needs a word about customers mid-order.

- [ ] **Re-land the remaining thirteen security and correctness fixes stranded on `codex/sales-system-rebuild`.** _(band: agent-runnable)_ _(effort: deep)_ → Plan: [sales-rebuild-salvage.md](todo/plans/sales-rebuild-salvage.md)
  Three of the sixteen are done (the admin inbox now signs its own requests; the public lookup no longer returns customer identity). The rest are unlanded: public carts bound to one store, checkout contacts kept with their cart, inquiry retries and delivery integrity, account isolation and fencing during account switches, currency conversion on customer orders, and the invoice family — validating writes, preserving validated legacy edits, fencing concurrent edits, fulfillment and void, and invoice splitting. Take each as intent and rebuild against current main; the branch itself is 162 commits behind and must not be merged. Delete the branch and its worktree once this is through.

- [ ] **Mobile inventory rows are hard to tap, and a low-stock row only signals in the number.** Salvaged from `wip/inventory-mobile-sheet` before that branch was dropped 2026-08-21 (it had drifted 160+ commits behind main and would have reverted newer inventory work). Two small changes, verified absent from main today: widen the name / stock / vendor-source tap targets from fit-content to full-width, and let the product name itself carry the low-stock tint rather than only the stock figure. Re-implement against current `InventoryRow.tsx`, do not resurrect the branch.

- [ ] **On mobile, Adjust and the overflow menu are two separate sheets that could be one.** Also from the dropped `wip/inventory-mobile-sheet`. The concept is sound and is still unbuilt on main, but the branch's code is unusable — `InventoryView.tsx` has since gained wisdom-entry filtering, an inventory-summary endpoint and tasting-journal wiring that the branch predates. Treat this as a fresh build from the idea, not a merge.

## Historical queue

The pre-consolidation root queue is preserved at [docs/_archive/session-artifacts-2026-07/ROOT_TODO.md](docs/_archive/session-artifacts-2026-07/ROOT_TODO.md). Its valid work was reconciled into the July tracks; it is not an active checklist.

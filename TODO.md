# Teajia Work Intake

> This is a small inbox, not the roadmap. The authoritative priorities are [docs/CONSOLIDATED_DIRECTION.md](docs/CONSOLIDATED_DIRECTION.md), and the only active build checklists are in [docs/tracks/](docs/tracks/).

## Untriaged

Add only genuinely new observations here. During triage, move each accepted item into exactly one owning track or discard it. Do not duplicate track items here.

<!-- Use: - [ ] **Short outcome.** Why it matters and the evidence that it is not already covered. -->

- [ ] **Re-land the remaining twelve security and correctness fixes stranded on `codex/sales-system-rebuild`.** _(band: agent-runnable)_ _(effort: deep)_ → Plan: [sales-rebuild-salvage.md](todo/plans/sales-rebuild-salvage.md)
  Four of the sixteen are done and live: the admin inbox signs its own requests, the public order lookup takes an unguessable token instead of a three-digit reference and returns nothing identifying, a public cart is bound to one store, and checkout contacts stay with their cart. The twelve left are inquiry retries and delivery integrity, inbox isolation per account and fencing during account switches, currency conversion on customer orders, and the invoice family — validating retail writes, preserving validated legacy edits, hardening edit safety, fencing concurrent edits, fencing fulfillment and void, invoice split and line linking, validating split requests, and the retail sales safety tests. Take each as intent and rebuild against current main; the branch is 162 commits behind and must not be merged. Delete it and its worktree once this is through.

- [ ] **The frontend test run scans the worktree folders and double-counts its own failures.** _(band: agent-runnable)_ _(effort: quick)_
  Running vitest over `src/` from the repo root also picks up `.worktrees/**`, so every failure appears once per checked-out worktree and the suite reports a state that is not the repo's. `test:worker` already excludes `.claude/worktrees/**` but nothing excludes `.worktrees/**`. Separately, three admin behaviour specs and the helmet-title scan fail on plain main today and nobody is tracking that.

- [ ] **Mobile inventory rows are hard to tap, and a low-stock row only signals in the number.** Salvaged from `wip/inventory-mobile-sheet` before that branch was dropped 2026-08-21 (it had drifted 160+ commits behind main and would have reverted newer inventory work). Two small changes, verified absent from main today: widen the name / stock / vendor-source tap targets from fit-content to full-width, and let the product name itself carry the low-stock tint rather than only the stock figure. Re-implement against current `InventoryRow.tsx`, do not resurrect the branch.

- [ ] **On mobile, Adjust and the overflow menu are two separate sheets that could be one.** Also from the dropped `wip/inventory-mobile-sheet`. The concept is sound and is still unbuilt on main, but the branch's code is unusable — `InventoryView.tsx` has since gained wisdom-entry filtering, an inventory-summary endpoint and tasting-journal wiring that the branch predates. Treat this as a fresh build from the idea, not a merge.

## Historical queue

The pre-consolidation root queue is preserved at [docs/_archive/session-artifacts-2026-07/ROOT_TODO.md](docs/_archive/session-artifacts-2026-07/ROOT_TODO.md). Its valid work was reconciled into the July tracks; it is not an active checklist.

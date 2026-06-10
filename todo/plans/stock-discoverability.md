# Stock screen — make adding products findable (and template the fix)

This is the first screen in a wider effort to make the admin learnable. Fix Stock end-to-end, lock the pattern, then propagate the same shape to the other admin screens. Do NOT try to redesign all ~45 admin routes in one move — that's how a week gets burned.

## Before touching anything

`InventoryView.tsx` had **uncommitted changes from another editing session** when this plan was written (2026-06-10), plus new untracked files `src/components/shared/AnchoredMenu.tsx` and `tests/_menu-debug.spec.ts`. The Columns toolbar had already been refactored into an `AnchoredMenu` render-prop component. **Check `git status` first.** If that work is a menu-unification in progress, build Import out through the new `AnchoredMenu` rather than the old inline menus. Never `git restore` the working tree — `git stash push -u` if it needs setting aside.

## What's wrong on Stock (verified 2026-06-10)

1. **Import is buried.** "New" (one product) is a prominent gold button in the toolbar. "Import CSV" (bulk — the higher-value path) is a dim 11px row three items down inside a "More" (⋯) overflow menu. The least-guessable path is the least discoverable. Backwards.
2. **The More menu exists twice and has drifted.** A mobile sheet (`md:hidden`) and a desktop portal render the same actions from hand-duplicated markup — and they've already diverged (desktop has Content Links + batch filter that mobile lacks). Maintenance hazard.
3. **The empty state doesn't teach.** Every empty state says "No products match the current filter" — even at zero total products. A first-run operator sees a leaf icon and a dead end, with no "add your first product" on-ramp. On mobile, BOTH add-paths (New and Import) are buried in the options sheet, so the empty state is the only place that can surface them.

## The three fixes (this becomes the template for every screen)

**Rule 1 — entry actions are siblings.** Import sits beside New in the toolbar. New stays gold (primary, one product). Import becomes an outline button right next to it (secondary, bulk). Both obvious, same altitude. Suggested markup: `border border-tea-border text-tea-text-sec ... <FileSpreadsheet/> Import`.

**Rule 2 — one "More" menu, one source of truth.** Export, Enrich Wisdom, Maintenance, Content Links, batch filter stay in the overflow (genuinely secondary). Extract the menu items into ONE shared array so mobile and desktop render the same list — kills the drift. Import comes OUT of both menus (it's now a toolbar button). If the in-progress `AnchoredMenu` already does this, route through it.

**Rule 3 — empty state is the on-ramp.** Distinguish two cases:
- Zero products total → "No products yet" + two buttons: **Add one** (`onAddClick`) and **Import a CSV** (`onImportClick`). This is the first-run teacher, and the only add-path on mobile.
- Filter miss (products exist, none match) → keep "No products match this filter" + a **Clear filter** action.

## After Stock

Lock the pattern with Adrian, then propagate to the other admin screens: one toolbar placement rule (primary verbs are buttons, everything else is one labelled More menu, no second copy of an existing button), empty states that teach, and a pass on the redirect graveyard (`inventory`/`teaware`/`personal`→`stock`, `customers`/`sources`→`people`, etc.) — each old name either becomes the real name or gets removed; keeping both is what makes the app feel like it has no ground truth.

## Modal usability (separate, lower priority)

`CsvImportModal.tsx` — not yet read. When Stock's discoverability is done, check whether the modal already offers a downloadable template, column hints, and a preview-before-commit. Don't rebuild what's there.

# Fix Queue — Autonomous Pre-Launch Run

> The work queue the `teajia-prelaunch-fix.sh` runner consumes. Ordered, batched for parallel execution, model-tiered to save cost.

**Created:** 2026-05-16
**Source:** `FRICTION_REVIEW.md` (friction IDs) + `UI_CONSISTENCY.md` (consistency fixes).
**Runner:** `~/builds/teajia-prelaunch-fix.sh`

---

## How the runner reads this

- The queue runs in **batches**, top to bottom. Batches are sequential; **fixes within a batch run in parallel** (separate Claude CLI agents) because they touch disjoint files.
- Each fix names a **model tier** — the runner passes it to `claude --model`:
  - **haiku** — mechanical, pattern-level edits (label changes, class swaps, adding a confirm wrapper).
  - **sonnet** — moderate edits spanning a component's logic + markup.
  - **opus** — only where real design judgment is needed (the add-tea reorganization).
- After each batch the runner gates: `npm run lint` + `npm run lint:colors` + `npm run build`. A batch only commits fixes that pass.
- Each fix = one commit on the `prelaunch/autofix` branch. Re-running skips fix IDs already committed (idempotent).
- **[needs Adrian]** items from `FRICTION_REVIEW.md` are deliberately absent — they are not automated.

---

## Batch 1 — Consistency foundation (sequential within batch: order matters)

Run these in order — later steps depend on earlier ones.

| ID | Model | Fix | Files | Verify |
|---|---|---|---|---|
| CON-1 | sonnet | Add a unified input/label/focus-ring style (one shared style, per `UI_CONSISTENCY.md` §3). Export from `card-utilities.css` or a shared module | `src/styles/card-utilities.css` | `npm run build` passes; style is referenceable |
| CON-2 | haiku | Codebase-wide `rounded-*` consolidation: `rounded-sm`/`rounded-lg` → `rounded-md` or `rounded-xl` by context (control vs container); `rounded-2xl` → `rounded-xl`. Directional forms too | all `src/**/*.tsx` | `grep -rE 'rounded(-(t\|b\|l\|r))?-(sm\|lg\|2xl)' src/` returns nothing |
| CON-3 | haiku | Add lint Rule 8 (off-scale radius, blocking) + Rule 9 (`.pill-*` action class, notice) to `lint-colors.sh`, exactly as specced in `UI_CONSISTENCY.md` | `scripts/lint-colors.sh` | `npm run lint:colors` passes (CON-2 already clean) |

## Batch 2 — P0 launch-blockers (parallel: disjoint files)

| ID | Model | Fix | Files | Verify |
|---|---|---|---|---|
| O-P0-3 | sonnet | Route every destructive action (collection-item remove, article delete, event delete, customer delete) through the existing shared `ConfirmModal`. One consistent pattern | `CollectionEditView.tsx`, `MagazineView.tsx`/`ArticleEditorModal.tsx`, `EventsManager.tsx`, `PeopleView.tsx` | Each delete now shows a confirm; `npm run build` passes |
| O-P0-1 | opus | Add-tea modal reorganization per `FRICTION_REVIEW.md` § Add-Tea Reorganization Spec — 6 essentials visible, 3 collapsed expanders, label fixes, vendor-create confirm. Single form, all ~45 fields preserved, no API change | `src/admin/components/AddProductModal.tsx`, `src/styles/card-utilities.css` | Every current field still present; `npm run lint` + `build` pass; `npm run test:mobile` add-product path green |
| C-P0-1 | sonnet | Add a customer-facing order-confirmation screen after WhatsApp send — shows order reference + "we'll reply on WhatsApp" copy | `src/components/shared/PublicCart.tsx` | Confirmation renders after send; `build` passes |
| C-P0-2 | sonnet | Build a minimal read-only `/order/:ref` status page, OR remove the dead link if data isn't available | `src/pages/OrderStatusPage.tsx`, route in `App.tsx` (no nav-label change) | Link no longer dead; `build` passes |

## Batch 3 — P1 high friction (parallel: disjoint files)

| ID | Model | Fix | Files | Verify |
|---|---|---|---|---|
| C-P1-2 | haiku | Add a result-count line above the shop grid | `TeaInventory.tsx` | Count renders |
| C-P1-3 | haiku | Cap the product quantity control at available stock | `AlcoveCard.tsx` | Slider/input max ≤ stock |
| C-P1-4 | haiku | Standardize customer-facing "inquiry" → "order" wording | `PublicCart.tsx`, `CartPanel.tsx`, `whatsapp.ts` | No "inquiry" in customer copy |
| C-P1-5 | sonnet | Add basic shipping-location validation | `PublicCart.tsx` | Empty/invalid location blocked |
| O-P1-1 | sonnet | Add a "step N of 6" progress indicator + completion ticks to the launch playbook | `StoreLaunchPlaybookView.tsx` | Progress visible |
| O-P1-2 | haiku | Add a "Create new vendor 'X'?" confirm before silent vendor-contact creation | `AddProductModal.tsx` (vendor picker) | Confirm appears; **runs after O-P0-1, not parallel to it (same file)** |
| O-P1-3 | sonnet | Surface the 8 inventory views as visible tabs; preserve selection on switch | `InventoryView.tsx` | Tabs visible; selection persists |
| O-P1-4 | sonnet | Wire product autocomplete into the invoice line-item name field | `QuickInvoiceModal.tsx` | Autocomplete works |
| O-P1-6 | haiku | Add inline status actions on the order row | `OrdersView.tsx` | Inline "Mark filled" present |
| O-P1-9 | sonnet | Replace generic error toasts with specific, actionable messages | admin components with `'… failed'` toasts | Messages name the failure |

> **Conflict note:** O-P1-2 touches `AddProductModal.tsx`, same as O-P0-1. The runner must run O-P1-2 *after* O-P0-1 commits, not in the same parallel group. The runner's batch logic groups by file ownership — see the script.

## Batch 4 — P1/P2 remaining (parallel: disjoint files)

| ID | Model | Fix | Files | Verify |
|---|---|---|---|---|
| O-P1-5 | sonnet | "Repeat last order" — copy line items from a customer's most recent invoice | `QuickInvoiceModal.tsx` (after O-P1-4) | Copy action works |
| O-P1-7 | sonnet | Article editor: add a preview pane; surface paste-parse errors instead of silent drop | `ArticleEditorModal.tsx` | Preview + error visible |
| O-P2-4 | sonnet | Add a `?draft=` prefill link to the outbound WhatsApp message (OrdersView already reads `?draft=`) | `whatsapp.ts`, `OrdersView.tsx` | Link prefills the invoice |
| C-P2-1 | haiku | Hide the store picker when only one store is in scope | `Shop.tsx` | Picker hidden for single-store |
| C-P2-2 | haiku | Add helper text per shop filter group | `TeaInventory.tsx` (after C-P1-2) | Helper text present |
| C-P2-4 | haiku | Show exchange rate / converted total on currency selection | `PublicCart.tsx` (after Batch 2/3 cart fixes) | Rate shown |
| C-P2-6 | haiku | Add helper text to signup contact-platform / username fields | `SignUpPage.tsx` | Helper text present |
| C-P3-3 | haiku | Extend cart remove-undo window to ~10s | `PublicCart.tsx` | Window extended |

> **Conflict note:** several Batch 4 cart fixes touch `PublicCart.tsx`. The runner serializes fixes that share a file within a batch (same logic as the O-P1-2 case).

---

## Excluded from this queue (not automated)

Per `FRICTION_REVIEW.md`, these need Adrian's judgment and stay out of the run:

- **C-P1-1 / C-P3-1** — homepage CTA placement + value-prop copy (brand-protected editorial reveal).
- **O-P2-5** — full collection-flow reflow (9 steps → fewer).
- **O-P1-8** — vendor/customer merge tool (scope undecided).
- Anything touching nav links, tab labels, or routing (`CLAUDE.md` rule).
- The 🟡 partial items in `AUDIT_2026-05.md` B (`requireBundle()` verification, Compass sync, mood/flavor seed data) — these are human-led, not friction fixes.

---

## Run summary the script must produce

At the end, the log gets a block: per fix ID — `committed` / `failed (reverted)` / `skipped (already done)`, the model tier used, and the final `npm run test:mobile` result. Adrian reads that block + `git log main..prelaunch/autofix` and decides what to merge.

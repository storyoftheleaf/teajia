# Overnight Design System Integration — Run Log

Branch: `claude/fix-template-spacing-9jJ1X`
Started: 2026-05-12

## Phase 0 — Baseline

`npm run lint:colors` against starting branch:

- Rule 1 (border-tea-border opacity): 4 hits — 3 real in `src/components/TeaCompass/PhotoCapture.tsx`; 1 intentional demo in `src/pages/DesignSystemShowcase.tsx`
- Rule 2 (border-tea-gold dividers): 14 hits — most are §6-canonical active tabs (`border-b border-tea-gold`) that the linter mis-flags (regex can't tell tab from divider). Real divider misuses: `src/components/shared/GlobalSearch.tsx:342`, `src/admin/AdminApp.tsx:42`
- Rule 7 (text-[Npx] banned sizes): 2 hits — both intentional demos in `DesignSystemShowcase.tsx`

Baseline total real violations to address: **5**. Pre-existing linter false positives on active tabs: 12 — leaving alone (matches §6 canonical spec).

Dev server: backgrounded on port 7777, log at `/tmp/teajia-dev.log`.

---
Phase 3j skipped: segmented-pill structural rewrite is invasive; shadow-sm already removed from active-state pills in Phase 3i. Remaining: 2 grid-based tab containers in CollectionShareSheet + CollectionEditView. Design-debt: convert to underline tabs in a follow-up branch.

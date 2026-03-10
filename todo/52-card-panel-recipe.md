# TODO 52: Create Consistent Card/Panel Recipe

**Priority:** Medium
**Impact:** Visual consistency, maintainability
**Effort:** 2–3 hours
**Category:** UI Consistency / Layout

---

## Problem

Cards and panels inconsistently combine border-radius, shadow, and border. Some have shadows, others don't. Some have borders, others rely on background contrast alone.

## Examples

- `src/admin/components/DashboardView.tsx:100` — `rounded-2xl border border-tea-border` (no shadow)
- `src/admin/components/TeaTable.tsx:227` — `rounded-2xl border border-tea-border shadow-2xl`
- `src/components/shared/PopupModal.tsx:257` — `shadow-2xl rounded-sm`
- `src/components/shared/CardContainer.tsx:21` — `rounded-[1px]` (no shadow, no border)
- `src/components/shared/ConfirmDialog.tsx:66` — No border radius on background

## Proposed Fix

Define 3 card tiers per COLOR_RULES.md Rule 5:

| Tier | Use case | Pattern |
|---|---|---|
| **Flat** | Inline sections, subtle grouping | `bg-tea-surface rounded-lg` |
| **Standard** | Cards, panels, content blocks | `bg-tea-surface border border-tea-border rounded-lg` |
| **Elevated** | Modals, popovers, floating UI | `bg-tea-surface border border-tea-border rounded-lg shadow-lg` |

Sweep all card-like elements and assign the appropriate tier.

## Acceptance Criteria

- [ ] All cards/panels fit into one of the 3 tiers
- [ ] Shadow usage is consistent (only elevated tier gets shadows)
- [ ] Border usage is consistent (standard + elevated tiers get borders)

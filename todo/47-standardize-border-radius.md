# TODO 47: Standardize Border-Radius Scale

**Priority:** Low
**Impact:** Visual consistency
**Effort:** 1–2 hours
**Category:** UI Consistency / Styling

---

## Problem

Cards, modals, and inputs use `rounded-[1px]`, `rounded-sm`, `rounded-lg`, `rounded-xl`, and `rounded-2xl` interchangeably with no clear semantic meaning.

## Examples

- `src/components/shared/CardContainer.tsx:21` — `rounded-[1px]` (hardcoded, unusual)
- `src/components/Shop.tsx:91` — `rounded-[1px]` for set cards
- `src/components/shared/PopupModal.tsx:257` — `rounded-sm` for modal image
- `src/components/shared/PopupModal.tsx:317` — `rounded-t-2xl` for mobile sheet
- `src/components/shared/ConfirmDialog.tsx:65` — `rounded-sm` for dialog
- `src/admin/components/AuthModal.tsx:62` — `rounded-xl` for modal
- `src/admin/components/DashboardView.tsx:100` — `rounded-2xl` for dashboard cards
- `src/admin/components/TeaTable.tsx:227` — `rounded-2xl` for table container

## Proposed Fix

Define a 3-tier border-radius scale and apply consistently:

| Element type | Radius |
|---|---|
| Cards, panels, modals | `rounded-lg` |
| Buttons, inputs, pills | `rounded-md` |
| Avatars, tags, badges | `rounded-full` |

Sweep all components and normalize.

## Acceptance Criteria

- [ ] No hardcoded `rounded-[Npx]` values remain
- [ ] All cards/panels use the same radius
- [ ] All modals use the same radius
- [ ] All buttons/inputs use the same radius

# TODO 53: Normalize Spacing/Padding Scale

**Priority:** Low
**Impact:** Visual consistency
**Effort:** 1–2 hours
**Category:** UI Consistency / Layout

---

## Problem

Components use inconsistent padding/margin values. Section padding jumps between `p-4`, `p-6`, `p-8`, `p-12` with no clear rationale. Cell padding varies between `py-3` and `py-4`.

## Examples

- `src/admin/components/TeaTable.tsx:160` — `p-4 md:p-12` for section padding
- `src/admin/components/DashboardView.tsx:90` — `p-6 md:p-12`
- `src/admin/components/TeaTable.tsx:108,272` — Cell padding `py-4 px-4` vs `py-3 px-4`

## Proposed Fix

Define a spacing scale and apply consistently:

| Context | Mobile | Desktop |
|---|---|---|
| Page padding | `p-4` | `p-8` |
| Card internal padding | `p-4` | `p-6` |
| Table cell padding | `py-3 px-4` | `py-3 px-4` |
| Section gaps | `gap-4` | `gap-6` |

## Acceptance Criteria

- [ ] All page-level containers use the same padding scale
- [ ] All card internals use consistent padding
- [ ] Table cells have uniform padding

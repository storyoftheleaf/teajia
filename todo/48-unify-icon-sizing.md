# TODO 48: Unify Icon Sizing System

**Priority:** Low
**Impact:** Visual consistency
**Effort:** 2–3 hours
**Category:** UI Consistency / Styling

---

## Problem

Icons use a mix of lucide `size=` prop (10, 12, 16, 20, 22) and Tailwind classes (`w-5 h-5`, `w-[22px] h-[22px]`, `w-3.5 h-3.5`) with no consistent scale.

## Examples

- `src/admin/components/TeaTable.tsx:102-105` — Icons use `size={10}`, then `size={12}`, then `size={10}`
- `src/admin/components/TeaTable.tsx:277-287` — Mixed `size={12}`, `size={10}` in table rows
- `src/admin/components/Sidebar.tsx:109-112` — Nav icons use `className="w-5 h-5"`
- `src/components/shared/PageHeader.tsx:85-99` — Button icons `w-[22px] h-[22px]`, back icon `w-3.5 h-3.5`

## Proposed Fix

Standardize on Tailwind classes with a 3-tier scale:

| Context | Size | Class |
|---|---|---|
| Inline / table cells | 16px | `w-4 h-4` |
| Buttons / nav items | 20px | `w-5 h-5` |
| Headers / hero areas | 24px | `w-6 h-6` |

Use Tailwind classes everywhere (not lucide `size=` prop) for consistency with the rest of the styling system.

## Acceptance Criteria

- [ ] All icons use Tailwind size classes, not lucide `size=` prop
- [ ] No hardcoded `w-[Npx]` icon sizes remain
- [ ] Icon sizes are consistent within similar contexts (all nav icons same size, all table icons same size, etc.)

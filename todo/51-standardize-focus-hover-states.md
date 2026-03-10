# TODO 51: Standardize Focus and Hover State Patterns

**Priority:** Medium
**Impact:** Interaction consistency, accessibility
**Effort:** 2–3 hours
**Category:** UI Consistency / Interaction

---

## Problem

Interactive elements have inconsistent hover and focus patterns. Some have focus rings, others don't. Hover states vary between background changes, border changes, and opacity shifts.

## Examples

- `src/admin/components/TeaTable.tsx:185-215` — Filter buttons use `hover:border-tea-muted hover:text-tea-text` but no focus ring
- `src/admin/components/Sidebar.tsx:56` — Nav buttons use `hover:bg-tea-elevated/50` with no focus ring
- `src/components/shared/CategoryPills.tsx:27-31` — Pills have `focus-visible:ring-2 focus-visible:ring-tea-gold/50` and `hover:bg-tea-text/10`
- `src/components/shared/Button.tsx:27` — Has focus ring but hover behavior varies by variant

## Proposed Fix

Define standard interactive state patterns:

| State | Pattern |
|---|---|
| Hover (buttons) | `hover:bg-tea-elevated` or `hover:bg-tea-text/10` |
| Hover (nav items) | `hover:bg-tea-elevated/50` |
| Focus visible | `focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none` |
| Active | `active:scale-[0.98]` (subtle press feedback) |
| Disabled | `opacity-50 cursor-not-allowed` |

Apply the focus ring pattern to ALL interactive elements (buttons, links, pills, nav items, table headers).

## Acceptance Criteria

- [ ] Every clickable element has a `focus-visible` ring
- [ ] Hover patterns are consistent within each component category
- [ ] Disabled states are uniform

# TODO 55: Add Missing Accessibility / ARIA Attributes

**Priority:** Medium
**Impact:** Accessibility, screen reader support
**Effort:** 2–3 hours
**Category:** UI Consistency / Accessibility

---

## Problem

Several interactive and structural components lack ARIA labels, roles, or proper semantic markup.

## Examples

- `src/admin/components/Sidebar.tsx:56` — Nav buttons have no `aria-current="page"` for active state
- `src/admin/components/TeaTable.tsx:108-117` — Sort button headers lack `aria-sort` attributes
- `src/components/shared/CategoryPills.tsx:22` — Pills container has no `role="tablist"` semantic
- `src/admin/components/DashboardView.tsx:99-122` — KPI cards lack headings with proper roles
- `src/components/shared/PopupModal.tsx:254` — Desktop modal lacks `role="dialog"` (mobile has it)

## Proposed Fix

- Add `aria-current="page"` to active nav items in Sidebar
- Add `aria-sort="ascending"|"descending"|"none"` to sortable table headers
- Add `role="tablist"` to CategoryPills container, `role="tab"` to each pill
- Add `role="dialog"` and `aria-modal="true"` to all modal variants
- Add proper heading hierarchy (`h2`, `h3`) to card sections instead of styled divs

## Acceptance Criteria

- [ ] All modals have `role="dialog"` and `aria-modal="true"`
- [ ] All nav items indicate active state via `aria-current`
- [ ] Sortable columns announce sort direction
- [ ] Tab-like components use proper ARIA roles
- [ ] Heading hierarchy is semantic (no skipped levels)

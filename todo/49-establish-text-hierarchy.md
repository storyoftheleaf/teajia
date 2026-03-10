# TODO 49: Establish Text Size Hierarchy

**Priority:** Low
**Impact:** Visual consistency, readability
**Effort:** 2–3 hours
**Category:** UI Consistency / Typography

---

## Problem

Labels and secondary text jump between `text-[10px]`, `text-xs`, `text-sm` without clear semantic meaning. Some use hardcoded pixel values.

## Examples

- `src/admin/components/TeaTable.tsx:165-166` — Filter buttons use `text-xs md:text-[10px]` (gets smaller on desktop?)
- `src/admin/components/DashboardView.tsx:104,113,119` — KPI card labels use `text-[10px]` (hardcoded)
- `src/admin/components/Sidebar.tsx:40` — Nav text uses `text-sm` while similar elements use `text-xs`
- `src/components/shared/PageHeader.tsx:33,54` — Title uses `text-base lg:text-5xl`, label uses `text-xs`

## Proposed Fix

Define a semantic text hierarchy and apply consistently:

| Role | Class | Usage |
|---|---|---|
| Page title | `text-2xl` / `text-3xl` | Route-level headings |
| Section heading | `text-lg` / `text-xl` | Card titles, panel headers |
| Body | `text-sm` / `text-base` | Main content |
| Label | `text-xs` | Form labels, filter buttons, badges |
| Caption | `text-[11px]` | KPI subtitles, timestamps (if needed) |

Eliminate all arbitrary `text-[10px]` hardcodes.

## Acceptance Criteria

- [ ] No hardcoded `text-[Npx]` values remain (or at most one defined caption size)
- [ ] Similar elements (filter buttons, nav items, table headers) use the same text size
- [ ] Text hierarchy is visually clear and consistent across admin and public

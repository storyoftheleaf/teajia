# TODO 54: Unify Animation and Transition Patterns

**Priority:** Low
**Impact:** Polish, perceived performance
**Effort:** 1–2 hours
**Category:** UI Consistency / Motion

---

## Problem

Components use `transition-all` and `transition-colors` interchangeably with varying durations. No unified easing or duration standard.

## Examples

- `src/components/Card.tsx:69` — `transition-all duration-300`
- `src/admin/components/Sidebar.tsx:56` — `transition-all duration-300`
- `src/admin/components/DashboardView.tsx:100` — `transition-colors` (only colors, not all)
- `src/components/shared/PopupModal.tsx:247` — `transition-all duration-300`

## Proposed Fix

Define standard transition patterns:

| Type | Pattern |
|---|---|
| Color/state changes | `transition-colors duration-200 ease-out` |
| Layout/position | `transition-all duration-300 ease-out` |
| Opacity (fade) | `transition-opacity duration-200 ease-out` |

Avoid `transition-all` when only colors change (causes unnecessary GPU work).

## Acceptance Criteria

- [ ] No unnecessary `transition-all` where `transition-colors` suffices
- [ ] Duration is consistent (200ms for fast, 300ms for layout)
- [ ] Easing is consistent (`ease-out` everywhere)

# T4-16: Add Skeleton Loading Screens

**Status:** [ ] Not started
**Priority:** Polish
**Group:** F (Visual Polish)
**Files:** `src/components/shared/SectionSkeleton.tsx`, section components

## Problem
Section transitions show no loading state. Content appears instantly or "pops in" on slow connections. No visual continuity between sections.

## Requirements
- Show content placeholder skeletons when transitioning between sections
- Skeletons should match the layout of the incoming content (grid for shop, list for articles, etc.)
- Fade from skeleton to real content
- Also use for initial page load before API data arrives

## Implementation Notes
- SectionSkeleton.tsx may already exist — check and extend
- React Query's `isLoading` state can trigger skeletons
- Common pattern: pulse animation on gray rectangles matching content layout
- Keep skeletons simple — they should feel fast, not add visual noise

## Acceptance Criteria
- [ ] Shop shows product card skeletons while loading
- [ ] Magazine shows article card skeletons while loading
- [ ] Smooth fade transition from skeleton to content
- [ ] Skeletons match approximate layout of real content

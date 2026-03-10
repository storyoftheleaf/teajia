# T2-06: Add Global Search Bar

**Status:** [ ] Not started
**Priority:** High
**Group:** A (Routing & URLs)
**Files:** New `src/components/shared/GlobalSearch.tsx`, `src/components/LeftSidebar.tsx`, `src/components/BottomTabBar.tsx`

## Problem
Search is section-specific (Shop has product search, Learn has curriculum search). No way to search across all content from any page. Users arriving with a specific intent must navigate first.

## Requirements
- Persistent search icon in navigation (sidebar on desktop, accessible on mobile)
- Opens search overlay/modal with unified results
- Searches across: products (teas + teaware), articles/stories, glossary terms, services
- Results grouped by category with "View all" links
- Keyboard shortcut (Cmd/Ctrl+K or /) to open

## Implementation Notes
- fuse.js already used for shop search — extend to all content types
- Build a unified search index on app load (products + stories + glossary)
- Use cmdk (already in dependencies for admin) or a custom overlay
- Route results: product → shop with product param, article → reader, glossary → learn

## Acceptance Criteria
- [ ] Search accessible from any page
- [ ] Returns results across all content types
- [ ] Results are clickable and navigate to correct destination
- [ ] Keyboard shortcut works (desktop)

# T4-38: Add Breadcrumb Navigation to Learn Hub

**Status:** [ ] Not started
**Priority:** Polish
**Group:** D (Content & Navigation)
**Files:** `src/components/LearnHub.tsx`

## Problem
Learn Hub has 10 sub-sections with no persistent wayfinding. Users get lost navigating between Glossary, Playlists, Videos, etc. Back button is the only escape.

## Requirements
- Add a breadcrumb trail at the top of Learn Hub sub-views
- Format: "Learn > Glossary" or "Learn > Curriculum > Module 3"
- Each segment is clickable to navigate up
- Persistent across all sub-views
- Compact on mobile (show last 2 levels only)

## Implementation Notes
- Learn Hub already uses URL query params for sub-views — breadcrumbs can read from these
- Sub-views: Overview, Course, Glossary, Playlists, Videos, Visual Guides, Reading List, Journeys, Community Wisdom, Tea Spaces
- Breadcrumb component could be reusable for other deep sections

## Acceptance Criteria
- [ ] Breadcrumb visible on all Learn sub-views
- [ ] Each segment navigates to that level
- [ ] Mobile shows condensed version
- [ ] Overview shows just "Learn" (no breadcrumb needed)

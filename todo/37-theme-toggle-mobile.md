# T4-37: Surface Theme Toggle on Mobile

**Status:** [ ] Not started
**Priority:** Polish
**Group:** D (Content & Navigation)
**Files:** `src/components/BottomTabBar.tsx`, `src/components/AccountPanel/index.tsx`

## Problem
On mobile, theme toggle is only accessible via long-pressing the center home button — completely undiscoverable. Most users will never find it.

## Requirements
- Add a visible theme toggle in an accessible mobile location
- Options: Account panel header, or a small icon in the bottom tab bar area
- Keep the long-press as an Easter egg but don't rely on it
- Toggle should show current mode (sun/moon icon)

## Implementation Notes
- Desktop sidebar already has a visible theme toggle — match the pattern
- Account panel is a natural location (already shows user preferences)
- BottomTabBar could add a small moon/sun icon if space allows
- ThemeContext.tsx handles the toggle logic — just need a new UI trigger

## Acceptance Criteria
- [ ] Theme toggle visible and tappable on mobile without long-press
- [ ] Current theme indicated by icon (sun = light, moon = dark)
- [ ] Toggle works and persists across sessions
- [ ] Long-press Easter egg still works

# T1-05: Add Network/Offline Error Indicator

**Status:** [ ] Not started
**Priority:** Critical
**Group:** C (Checkout & Trust)
**Files:** `src/App.tsx` or new `src/components/shared/NetworkStatus.tsx`

## Problem
API failures and network issues fail silently. Products may not load and the user sees no explanation.

## Requirements
- Detect when API calls fail or network is offline
- Show a non-intrusive toast or banner: "Connection issue — some content may be unavailable"
- Auto-dismiss when connectivity is restored
- Don't block the UI — allow cached/offline browsing

## Implementation Notes
- Can use `navigator.onLine` for basic detection + `window.addEventListener('online'/'offline')`
- React Query's error states can trigger the banner for API-specific failures
- Shop already has error boundary with retry — this is for global, persistent network issues
- Consider adding to the App.tsx shell level so it's visible on all pages

## Acceptance Criteria
- [ ] Banner appears when network goes offline
- [ ] Banner disappears when network recovers
- [ ] API failures show contextual retry options
- [ ] Cached data remains accessible during outage

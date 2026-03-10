# T4-19: Handle JWT Expiration Gracefully

**Status:** [ ] Not started
**Priority:** Polish
**Group:** E (Data & Accounts)
**Files:** `src/hooks/useAuth.ts`, `src/lib/api.ts`

## Problem
JWT token expiration is handled silently. When it expires, the next API call fails with no user-facing explanation. Users think the site is broken.

## Requirements
- Detect token expiration before it happens (existing 60s buffer)
- Show notification: "Your session has expired. Please sign in again."
- Redirect to sign-in prompt (not a full page reload)
- Preserve user's current location for post-auth redirect
- Clear stale auth state immediately on detection

## Implementation Notes
- `isTokenExpired()` already checks with 60s buffer in api.ts
- `authHeaders()` already cleans up expired tokens silently
- Need to add a proactive check (setInterval or before each API call)
- Could use React Query's `onError` callback to detect 401 responses globally
- Show a non-blocking modal/toast, not a page redirect

## Acceptance Criteria
- [ ] User notified when session expires
- [ ] Re-auth prompt appears (not silent failure)
- [ ] User returns to their previous location after re-auth
- [ ] No stale token persists after detection

# T3-35: Sync Favorites & Reading Progress to Account

**Status:** [ ] Not started
**Priority:** Medium
**Group:** E (Data & Accounts)
**Files:** `src/lib/store.ts`, `src/hooks/useAuth.ts`, API worker (backend)

## Problem
Favorites and reading progress are stored only in localStorage. Clearing browser data loses everything. No cross-device sync for authenticated users.

## Requirements
- When authenticated, sync favorites to backend on change
- On login, merge local favorites with server-stored favorites
- Sync reading progress (watched stories, page positions) similarly
- Keep localStorage as cache/fallback for offline and unauthenticated users

## Implementation Notes
- `favoriteTeas` in Zustand store — add sync middleware or effect
- New API endpoints: `GET/PUT /api/user/favorites`, `GET/PUT /api/user/progress`
- Merge strategy: union of local + server favorites (don't lose either)
- Debounce sync calls (don't call API on every single toggle)
- Reading progress keys: `teajia_progress_*`, `teajia_saved_stories`, `teajia_watched_stories`

## Acceptance Criteria
- [ ] Favorites sync to backend when user is authenticated
- [ ] Login merges local and server favorites
- [ ] Reading progress persists across devices
- [ ] Unauthenticated users still get localStorage behavior

# Sol, Launch 3 slice J4: two "Host a table" doors

Repository: teajia. Base: origin/build/launch-3 (at or after ffc2d8e). Work on a new branch `build/l3-j4-doors`. Read CLAUDE.md first and follow it (tokens only, shared Button, no new raw <button>, no horizontal scroll, steps in the address, never the em dash character, never the word "curated").

## What Adrian approved (2026-11-26, his words)
- "Host a table" appears in two places: in Your Table (the AccountPanel launchpad, `src/components/AccountPanel/LaunchpadView.tsx`) and once on Home.
- The line beside it: "Free to host, and your record is yours."
- Nothing else in navigation changes: no bar, rail, tab label or menu item changes. These are a tile and a plate, not nav.

## The rule for showing the doors
- Only when both `FEW_HOSTS_OPEN` (Launch 2) and `ANYONE_HOSTS_OPEN` (`src/lib/anyoneHosts.ts`) are on, and the person may host. Reuse the existing decision: `src/components/account/MemberSitsJourney.tsx` already shows "Host a table" only to a person who may host (stopped hosts see nothing), using `/api/me/hosting`. Pull that decision into one shared hook (for example `src/hooks/useMayHost.ts`) and use it in all three places. Do not write a second rule.
- Signed out on Home: the plate still shows when both flags are on, and leads to sign in with `return=/account/host`.
- Both doors link to the existing page `/account/host` (`src/pages/HostTablePage.tsx`). Do not build a new creation path.
- With either flag off, Home and Your Table render exactly as today (test this).

## Where
- Your Table: one launchpad tile in the same shape as the existing tiles (see "Share pay link" around line 563): title "Host a table", italic line "Free to host, and your record is yours."
- Home: find the public Home page from `src/App.tsx` (the `/` route). Add one quiet plate in the page's existing card style, below the first section, same two lines. Do not reorder anything else on Home.

## Tests
- Unit/component tests for the hook (flag off, flag on and may host, stopped host, signed out).
- Playwright spec `tests/host-a-table-doors.spec.ts` at 390x844 with mocked routes: Home plate, Your Table tile, stopped host sees neither, flags off shows neither, no horizontal overflow. Codex cannot bind ports: write the spec, and the session that runs you will run it.
- `npm run lint`, `npm run lint:colors`, `npx vitest run src/styles src/admin/guards` (two known failures from launch-2 files may show: VenueGuide h-12 and the raw button ceiling; do not add to them).

## Hand back
A short report: files changed, tests, anything you guessed. Do not open a PR. Do not push to any other branch.

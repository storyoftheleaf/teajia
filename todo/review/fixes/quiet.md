Fixed by Opus 5.5 (cloud).

Branch `review/fix-quiet`. Closed parts stay quiet and failed loads offer a way on, for A10-2, A10-3, A10-8, W1-13, W1-16, W5-1, W5-2, W5-4, W5-5, W5-6, W5-7, W5-8 and W5-10.

## The contract, as built

One shared helper, `src/lib/closedPart.ts` (unit test `src/lib/closedPart.test.ts`), and one shared failed-load block, `src/components/shared/LoadFailed.tsx`.

- `PART_QUERY` goes into a part's `useQuery` options: a 404 is never retried, a 408 or 5xx is tried once more, nothing else is.
- `partView(query, accept?)` gives the door one of five states: `off` (not asked), `loading`, `closed` (its own route answered 404), `failed` (any other failure, with `retry`) and `ready`. `accept` turns an answer of the wrong shape into `failed`, never a crash.
- `closed`: a section renders nothing; a whole page renders the site's own not-found page, which is what the address showed before the launch.
- `failed`: one plain sentence and a Try again button (`LoadFailed`), never the server's words. The failure already goes to the incident ledger from `handleResponse`; there is no banner.

## What changed, by finding

| Finding | Where | Now |
|---|---|---|
| A10-3 | `HostTablePage`, `HostedTablePage`, `TeaTablePage`, `FavouritesPage`, `TeaCreditPage`, `TeaHousesBuildPage`, `TeaHousesWorkPage` | A 404 from the page's own route gives the not-found page |
| A10-3 | `MyHostArticleOffers` (Profile), `TeaTableManage`, `KnowThisTeaManage`, `ReportsAndRequests` session reports (Guest notes), host parts (`HostCircles`, `HostAssistant`, `YourTablePlace`, `GuestBookPrivate`, `WalkthroughEditor`) | A 404 shows nothing of the part; a failure gives a sentence and Try again |
| A10-8, W1-16 | `HostTablePage`, `HostedTablePage` | Closed on the site: the not-found page, never blank |
| A10-2 | `TastingShareStep.tsx` | The line after a share follows `on_tea_table` in the answer: "On your page. The Tea Table could not take it just now." when the worker did not record it (`shareLine`, tested) |
| A10-2 | `worker/src/index.ts` `updateEvent`, `EditForm.tsx` | The worker answers `not_kept: [...]` when it drops tasting or contribution fields; the form then says they could not be kept, not "Event updated" |
| W1-13 | `HostCircles.tsx` | A 404 from `/api/me/circles` (not a host of circles yet) shows nothing; making a first table reads the circles again |
| W5-1 | `SessionCardPage.tsx` | One retry at most, then "Could not load the session card just now." with Try again |
| W5-2 | `SessionCardPage.tsx` | A body without a title, slug and day is a failed load; a menu that is not a list is no teas |
| W5-4 | `AccountJourneyPage.tsx` | A failed read says "We could not open your Journey just now." with Try again, and does not show the empty-Journey button |
| W5-5 | `AccountJourneyPage.tsx` | Signed out goes to sign-in, returning to `/account/journey` |
| W5-6 | `HostTablePage`, `HostedTablePage`, `TeaCreditPage` | "Reload to try again" is gone; each failure has Try again |
| W5-7 | `TeaHousesVisitPage`, `TeaHousesWorkPage`, `TeaHousesBuildPage` | Try again added |
| W5-8 | `TeaHousePortfolioPage.tsx` | Only a 404 says "This house has no page here."; a 5xx says it could not be loaded, with Try again |
| W5-10 | `AfterSitPage.tsx` | The sign-in link returns to `/after-sit`. The recap's credential stays in memory (`afterSitAccess.ts`), so a sign-in inside the app comes back to the recap; after a full reload the page asks for the host's link again, as its sentence says |

Also: `KnowThisTea.tsx` question page tells a failed load from a gone question; `useMyTeaCredit` now also returns `error` and `refetch` (additive).

## Tests changed

- `tests/review/half-open.spec.ts`: the owner's walk to the Tea Table pieces now expects the section only when both sides are open (with the worker closed it stays quiet, which is the fix).
- `tests/few-hosts.spec.ts:538`: a guest opening a host's table sees the not-found page, not "This table was not found."
- `tests/review/guest-walk.spec.ts` step 10: `test.fail` for W1-13 and W1-16 taken off (see Evidence).
- New: `src/lib/closedPart.test.ts`, `src/pages/quietDoors.test.tsx`.

## Evidence

All on the review rig, desktop 1280, `--trace off`, the container's Chromium.

- Half-open, slot 5 (`--set all --site-set all --worker-set live`), `half-open.spec.ts`: every door now has no error sentence, no blank page and no page error (`test-results/review/half-open.json`). Host a table, a hosted table, the Tea Table, Favourites, Tea credit, Tea Houses work and build show the not-found page; Profile, Guest notes and the host parts show nothing of the closed part. 32 of 36 passed before the walk test was corrected, then that walk passed; the three left (Journal, Profile, Jun's own page) fail only on the lazy-page loader timing noted below, and fail the same on the base code.
- Slot 6 (`--set all`), `empty-and-failing.spec.ts` for the 14 W5 pages: 56 of 56 ran. Every `error` state now has a Try again button (`retry_offered: true`) except `/journey`, whose request the spec's mock does not reach (as W5 noted). Session card: empty body and 500 both settle in about 5.6 s on "Could not load the session card just now." with Try again, no crash text. Journey: 500 gives "We could not open your Journey just now." with Try again; signed out goes to `/signin?returnTo=%2Faccount%2Fjourney`. Tea house page: 500 gives "This house's page could not be loaded just now." with Try again; 404 keeps "This house has no page here." No raw server text anywhere.
- Slot 6, `guest-walk.spec.ts` step 10 with `test.fail` removed: passes (W1-13: no circles error for Mei).
- W1-16 and A10-8 (the site's FEW_HOSTS closed) are covered by `src/pages/quietDoors.test.tsx`, which renders both hosting pages with the switch closed and finds "Page not found". No live-set rig was run (slots 5 and 6 only).
- `npm run lint`, `npm run lint:colors`, `npm run lint:worker-types` (no drift): clean.
- Unit tests: `closedPart.test.ts`, `quietDoors.test.tsx`, `src/admin/components/EventForm`, `src/admin/components/guestNotes`, `src/components/tasting`, `launch3FlagsOff.test.tsx`, `hostCreditScreens.test.tsx`, `src/admin/guards`, `src/styles`, `src/lib`: all pass. The whole `npm run test:src` took more than 15 minutes on the shared container and was stopped by its timeout; the files touched were run as above.
- Worker: `a3-flags-off-audit` (now asserts `not_kept: ['is_tasting']`), `session-tasting`, `review-open-then-close` (36 pass, 1 expected fail, which is A10-1, not mine).
- `npm run test:mobile` (port 7777 free): 40 of 40, run with a local config pointing at the container's Chromium, since the pinned browser is not installed here.

## Conflicts and notes for Opus

- `useMyTeaCredit.ts` (tea credit owner's file): two fields added to its return, nothing else.
- `worker/src/index.ts` `updateEvent`: the answer gains `not_kept` only when fields were dropped; the drop itself is unchanged.
- `/account/host` and `/account/host/:id` now render `SiteNotFound` while closed instead of `null` and "This table was not found." Routing in `App.tsx` is unchanged.
- W5-9 (a next link under "Hosting opens by invitation") and W5-11 were not in this brief and are left.
- The half-open doors Journal, Profile and Jun's own page are soft-failed on "a loader is still turning" on this rig: the route's lazy page fallback is still up 400 ms after network idle and gone a few seconds later. It is the same on the base code (checked with the change stashed), so it is the dev server's timing, not an error state.

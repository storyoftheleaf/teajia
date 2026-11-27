Fixed by Opus 5.5 (cloud), in place of Astra.

# Seats and session time: one seat each, and a table knows when it is on

Findings fixed: A9-1, A9-2, A9-3, A9-4, A9-5, A9-6, A9-7, A9-11, A9-12, A9-14, A6-4, W1-1, W1-2.
Left as they are: A9-8, A9-9, A9-10, A9-15 (questions for Adrian) and A9-13 (a tap count, for the layout pass). Their cases still fail.
No migration. 0148, 0149 and 0150 are untouched.

## The contract, and where each part now lives

- **One person, one seat at a table**, through the request door, the link door, a circle's ask back, a companion's invitation and the agent tools. All of them write through `reservePartySeats` (`worker/src/eventDomain.ts`), which now refuses:
  - a new row for a person who already holds a live seat here (`onePersonGuard`, inside the INSERT's WHERE)
  - confirming a row while another row of the same person here is confirmed (`confirmedOnceGuard`, inside the final UPDATE)

  A person is the same signed-in account, the same email (any case) or the same phone. A row written before party seats existed is an `event_attendees` row like any other, so it counts. The refusal is the new code `already_seated`.
  - The request and link doors (`handleRSVP`) look up a signed-in guest's own seat before reserving and hand it back (200, `repeat: true`).
  - When the match was by contact only, the doors give the neutral "if an RSVP already exists" answer, so a typed email never hands out a private link.
  - The companion door (`handleClaimGuestInvite`) now records a signed-in claimer's account, so the rule sees them.
- **Older confirmed seats count once** in the allocator's read, its guarded write and its fallback read. This is the same `OLDER_CONFIRMED_SEATS_SQL` that the host's `seatsTakenSql` uses (`worker/src/hostTableGuests.ts`).
- **A table's now is an instant.** `sessionMoment(session, now)` in `shared/sessionEnd.ts` gives `before`, `during` (from start to end, in the table's own zone) or `after`. `sessionCancelled` says whether the host cancelled. The worker and the guest's phone read the same rule.
- **Nothing asks a guest anything during the session.**
  - The guest page (`GuestManagement/index.tsx`) opens the briefing only before tea.
  - `ConfirmedView` hides the calendar entry, +1, dietary notes and the guest-list choice from the start. The way in, the teas and the tasting door stay.
  - `WaitlistView` offers no claim from the start.
  - Offers are capped at the start (`offerDeadline(..., startsAt)`).
  - The ticket shows no deadline once tea has begun (`offerShownUntil`).
  - The claim route refuses once tea has begun, even for an offer made before this fix (410 `offer_expired`).
  - Manage refuses to prepare a coming-up reminder from the start (409 `reminder_window_closed`), and `NotificationPanel` hides Generate Reminders.
- **A table completes only after its end.** `markWhoCame` needs `sessionMoment === 'after'`, using `event_end_date` and the four-hour default (409 `hosted_table_not_ended` before that). The host's After part shows "Mark who came" from the end, reading the `event_end_date` the detail answer now carries.
- **A cancelled table says so.** The guest page shows "This table is cancelled" for any seat status, with no booking actions (`CancelledView tableCancelled`).
- **The briefing reaches the guest** (A9-11): the hook reads the cards from the mapped event (`event.briefing_cards`), with the older top-level field still read first.
- **Times are in the table's zone, with the zone named.** `shared/sessionClock.ts` `sessionClock(value, timeZone)` gives "11:30 PM, Makassar time". It is used by every guest ticket view (`GuestManagement/helpers.ts`) and the invite page (`EventLanding.tsx`). With no zone stated it names the viewer's own clock ("10:30 AM, New York time").
- **Upcoming lists use the instant rule, and apply eligibility before the limit** (A6-4). `upcomingListedSessions` reads a window from a day before now in wall-clock order, a page at a time. It keeps only published sessions whose moment is `before`, then sorts by start instant and cuts to 20. This covers both `/api/events` and `/api/me/sessions`.
- **The scheduler honours its clock** (A9-14). `lapseExpiredOffers`, `offerFreedSeats` and `advanceWaitingLists` read every deadline at one operation time (`sqlNow(now)`), and the comparison stays inside the guarded SQL.
- **A guest who asked while signed out finds her request once signed in** (W1-1). When the account has no seat here, `EventLanding` falls back to the token this device saved, so she sees "You asked for a seat" and "Open your page", not the form.

## Evidence

Worker cases (`NODE_OPTIONS=--experimental-sqlite node_modules/.bin/vitest run ...`, TZ=America/New_York):

- `worker/tests/review-seats-and-time.test.ts` with `A9_DOM=1` (jsdom 25.0.1 through NODE_PATH): 29 pass, 5 fail. The five are exactly A9-8, A9-9, A9-10, A9-13 and A9-15. Before the fix it was 19 pass and 15 fail.
- `worker/tests/review-older-data.test.ts`: the A6-4 case passes, both switch states. The three other failures are other fixers' and fail the same way on the base revision.
- New `worker/tests/seats-one-each.test.ts`, 11 cases, all pass:
  - the old row shape first (a confirmed guest with no party row, then the same email again and the count)
  - a signed-in guest on a second phone
  - a signed-in companion at the invitation door
  - the host's yes for a second row of the same person
  - the instant rule
  - the shared clock
  - the offer cap
  - a claim on an older offer after the start
  - no offer after the start
  - reminders before and attendance after the end
  - the upcoming list with thirty begun wall-time rows and a registration-closed one
- 29 related worker files (allocator, doors, waiting list, host guests, circles, privacy, Launch 2 and 3 audits): 459 pass. The 6 failures are the 5 listed above plus nothing of mine.
- Two existing tests were changed for the new rule: `worker/tests/host-guests.test.ts` marks who came five hours after the start, past the four-hour end. `worker/tests/public-privacy-boundaries.test.ts` seeds its listed session as `published`, since a draft takes no seat and is no longer listed.

Browser:

- `tests/review/guest-walk.spec.ts`, slot 9 rig, `--set all`, phone-390, `--trace off`, own Chromium, output in /tmp/claude-0/seats-rig.log.
  - Step 1 (W1-2) passes, and its `test.fail` mark is removed.
  - Step 2 (W1-1) passes in full. Its `W1-3` soft check also held on this rig without a change from this fix, so that step carries no mark now. Whoever owns W1-3 should confirm.
  - The rig's own processes were stopped by PID.
- `tests/host-guests.spec.ts` (After now reads "When the table has ended"): 2 of 2 on this checkout's vite, port 7787, VITE_FEW_HOSTS_OPEN=true.

Checks:

- `npm run lint` passes.
- `npm run lint:worker-types` passes (27 known, no drift).
- `npm run lint:colors` passes.
- `npm run test:mobile` could not run as written: port 7777 is held by another fixer's vite (`/home/claude/teajia-fix-quiet`), which was left alone. Run instead against this checkout's own vite on 7787, with the container's Chromium through a scratch config: 40 of 40. One payment-page case timed out under load and passed on its own rerun.

## Conflicts and notes for Opus

- **Shared interfaces.** `src/lib/api.ts`, `src/types.ts` and `mcp.ts` are unchanged. `src/lib/hostingApi.ts` gained one optional field, `HostedTableSummary.event_end_date?: string | null`, because the host's After part needs the table's end. It is additive; say if it should live elsewhere.
- **Agent tools** (`worker/src/mcpTools/events.ts`, `fewHosts.ts`, not mine) call the allocator and now may receive `already_seated`. They fall through to their generic refusal; a plain sentence for it would be theirs to add.
- **Linking a signed-out seat to the account on sign-in** (the "ideally" in W1-1) would need a new route and an `api.ts` call, for example `POST /api/rsvp/:token/link` signed in, returning `{ linked: boolean }`. Not done; the device fallback covers what the walk checks.
- **The seat door stays open until the end, not the start.** The upcoming list stops at the start. A direct link still takes a request during the session, as before (A2 F6). Whether a request during tea should be refused is Adrian's call.
- `mapEvent` in `useEventPolling.ts` still defaults a missing zone to Asia/Taipei, while the worker reads a missing zone as UTC. This only matters for a wall time stored with no zone, and the label now names whichever zone is used.

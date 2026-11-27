Fixed by Opus 5.5 (cloud), in place of Astra.

# Review fixes: every way in follows the page's rule (A11-1, 2, 3, 6, 8, 12)

Findings are in [todo/review/findings/A11.md](../findings/A11.md). Each tool now calls the check the page's route calls. Every write tool still previews, then confirms, with tickets from `worker/src/mcpTools/tickets.ts`. `worker/src/mcp.ts` and `tickets.ts` are unchanged. There is no migration, and tools/list shows the same names behind the same switches.

Run it: `NODE_OPTIONS=--experimental-sqlite node_modules/.bin/vitest run worker/tests/review-three-ways-in.test.ts` gives 39 tests: 31 pass and 8 fail. The 8 that fail are the other ids (A11-4 x2, A11-5, A11-7 x2, A11-9, A11-10, A11-11), left as they were.

## A11-1: approve_event_rsvp seated a guest at a stopped host's table

- What changed: `accountHostingStopped` moved out of `worker/src/index.ts` into `worker/src/hostApproval.ts` and is exported. It now takes the database, and the shop's two approve routes call it from there. The words a stopped host is told moved there too, as `HOSTING_STOPPED_SAYS`. `approve_event_rsvp` (`worker/src/mcpTools/events.ts`) calls the same check before its preview and its confirm, and answers `hosting_stopped` with the route's own words.
- Also `record_event_rsvp`: it seats a guest too (the finding said it likely needed the same check), so it calls the same check and refuses a stopped host's new guest.
- Tests: "FINDING A11-1" now passes. New case: "A11-1: record_event_rsvp takes no one new at a stopped host's table, and a yes previewed before the stop is refused at the confirm".
- Not changed: answer_guest's `not_available` for a stopped host on a scoped token belongs to A11-5 and to `fewHosts.ts`, which are not mine.

## A11-2: same_table_again made a draft no host could open

- What changed: I chose the first option. The host's copy is made ready the way `POST /api/me/tables` makes a new table: `status 'active'`, `lifecycle_status 'published'`, and `requires_approval` following the door. The change is in the host branch of `duplicateEvent` (`worker/src/index.ts`), which is the code `same_table_again` already called. The preview now says "published and open by its link at once, the same as a new table". The confirm answers `table_id`, `slug` and `lifecycle_status`. The tool's description and docs/claude/mcp.md now say the same.
- Why the first option: nothing in the code needs a host's copy to wait. A new table from the form opens at once. Adding an "open this table" route would leave a draft step that the form does not have.
- Tests: "FINDING A11-2" now passes. The old case in `worker/tests/mcp-launch-3-tools.test.ts` asserted the draft. It now asserts that the host's copy is published, with its day stored as an instant, and that the shop's copy route still makes a draft.
- Not changed: the shop's own `POST /api/admin/events/:id/duplicate` (no host) still makes a draft for its Sessions room to publish. This is the shop's existing flow, not a host's.

## A11-3: the copy took a day already past and kept a by-link door the host had lost

- What changed: `tableInstant` in `worker/src/hostTable.ts`, which `createHostedTable` uses, is exported. A new `tableWallTime` reads the day as written on the table's own clock (`2030-02-01T16:00`), or reads a date with a zone on that clock. The host branch of `duplicateEvent` sends the day through `tableInstant`. So a past day is refused with `hosted_table_past_day`, as on the form, and the day is stored as an instant in the table's zone. The door comes from `hostedTableAccess`, the same check the host's page routes use. If the host may not give the source table's door now, the copy opens by request, and the preview says so ("The table it copies was by link, a door you cannot give a new table now."). The check runs again at the confirm, so a host stopped or unapproved after the preview gets what the form would give them now.
- Why lower the door rather than refuse: the host still gets their table on the door they may give, and the preview says what changed before they confirm.
- Tests: both "FINDING A11-3" cases now pass. New case: "A11-2 and A11-3: an approved host's by-link table copies by link, a day given with a zone is read on the table's clock, and the preview names a door it lowered" (it also covers a day that is not a date).

## A11-6: a shop owner who did not host could put a recap on the Tea Table

- What changed: `set_my_recap_on_tea_table` (`worker/src/mcpTools/launch4.ts`) now checks, in both the preview and the apply, what the route's `hostOf` checks: `isTeaTablePlatformOwner` or `hostedTeaTableSession`. Both functions already existed in `teaTable.ts` and are called as they are, with no second copy of the rule. The tool refuses with `not_host`, the page's code.
- Tests: "FINDING A11-6" now passes. New case: "fix A11-6: the tool refuses a shop owner who did not host at the confirm too, and the host still takes the recap off". The fixture in `worker/tests/launch4-tools.test.ts` made a shop owner who was not credited on the session, so it relied on the old gap. It now credits that person as the session's lead host.
- Not changed: I did not edit `teaTable.ts`. Lifting `hostOf` into one shared function would mean editing a file next to the keeps and favourites work that another fixer owns. Calling the two functions the route calls keeps one rule. As before, the tool works on the token's own account. The platform owner's cross-shop path stays on the page.

## A11-8: the preview said the tasting stays on the person's page, then took it off

- What changed: the preview of `take_my_tasting_off_tea_table` reads `page_alone_at`, the same column `takeTastingOffTeaTable` decides on. With it set, the preview says "It stays on your page." Without it, the preview says "It was public only for the Tea Table, so it goes private everywhere, your page too." The tool's description no longer promises that it stays.
- Tests: "FINDING A11-8" now passes. New case: "fix A11-8: a tasting the person chose for their page by itself is told it stays there, and it does".

## A11-12: make_circle made a circle when no kind was given

- What changed: `make_circle` (`worker/src/mcpTools/circles.ts`) passes the kind to `readSeriesInput`, the page's own reader, with no default. With no kind it refuses with `series_kind`, as the page does. The schema now requires `name` and `kind`.
- Why the tool follows the page and not the other way round: the brief's contract is that the tool calls the route's rule. Making the page default to circle would change the host's form, which is outside these files.
- Tests: "FINDING A11-12" now passes. New case: "A11-12: make_circle asks for the kind in its schema, as the page does". A case in `worker/tests/circles.test.ts` that sent no kind now sends `kind: 'circle'`, so it still tests the stopped host.

## Evidence

- `worker/tests/review-three-ways-in.test.ts`: 31 pass, 8 fail, and the 8 are the other ids only.
- 26 test files that touch these tools, routes and modules (circles, host-token, mcp-launch-3-tools, launch4-tools, launch4-closed, mcp-events, few-hosts-tools, host-table, hosted-session-doors, event-contract-routes, anyone-hosts, auth-boundaries and the other MCP suites): all pass. Under a full parallel run, a few slow stock and curate suites time out, and each one passes when run alone.
- `npm run lint:worker-types` shows 27 known errors with no drift. `npm run lint` and `npm run lint:colors` pass.

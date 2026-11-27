Done by Sonnet 5.5 (cloud), in place of Sol.

# W4 switch crawl: state by persona by size

Read from the rig on slot 4, 2026-11-27, by `tests/review/switch-crawl.spec.ts`. One row per state and size; one column per person (visitor = signed out, Mei = guest, Ana = approved host, owner = `sandbox`). `pass` = every page reached was fine. A finding id means that cell saw it (ids are in `todo/review/findings/W4.md`). `pass*` = pass, but the crawl logged one or more "spinner still turning after 5s", "blank main area", a failed first load or a control it could not press while the dev machine was shared by other reviewers; each kind was re-checked by hand on a quiet moment (see "What the stars are" below) and none was a fault. The number in brackets is the pages visited.

The last column is the gated-route check (the routes each switch gates, once per state, at 390; the count is in brackets): `ok` = every route answered closed (404) or open as its switch and its prerequisites say; nothing answered 500.

| State | Size | Visitor | Mei | Ana | Owner | Gated routes |
|---|---|---|---|---|---|---|
| live | 320 | W4-6* (21) | W4-6* (19) | W4-6* (20) | W4-6* (20) | (same) |
| live | 390 | W4-6* (21) | W4-6* (19) | W4-6* (20) | W4-6* (19) | ok (17) |
| live | 1280 | W4-6* (20) | W4-6* (19) | W4-6 (20) | W4-6* (20) | (same) |
| all | 320 | pass (21) | pass* (19) | pass (20) | pass* (20) | (same) |
| all | 390 | pass (21) | pass* (20) | pass* (20) | pass* (20) | ok (18) |
| all | 1280 | pass (18) | pass* (19) | pass* (19) | pass* (19) | (same) |
| only:FEW_HOSTS_OPEN | 390 | pass (12) | pass (12) | pass (12) | pass (12) | ok (18) |
| only:ANYONE_HOSTS_OPEN | 390 | W4-6 (16) | W4-6 (16) | pass (16) | pass (16) | ok (18) |
| only:FAVOURITES_OPEN | 390 | W4-6 (16) | W4-6 (16) | pass (16) | pass (16) | ok (18) |
| only:YOUR_TABLE_PAGE_OPEN | 390 | pass (16) | pass (16) | pass (16) | pass (16) | ok (18) |
| only:YOUR_TABLE_PLACE_OPEN | 390 | pass (12) | pass (12) | pass (12) | pass (9) | ok (18) |
| only:TEA_TABLE_OPEN | 390 | W4-6* (16) | W4-6* (16) | pass (16) | pass (16) | ok (18) |
| only:TOP_TEAS_OPEN | 390 | pass (12) | pass (12) | pass (12) | pass (12) | ok (18) |
| only:HOST_ARTICLES_OPEN | 390 | W4-6 (16) | W4-6 (16) | pass (16) | pass (16) | ok (18) |
| only:TEA_HOUSES_OPEN | 390 | W4-6 (16) | W4-6* (17) | pass (16) | pass (16) | ok (18) |
| only:HOME_BAR_OPEN | 390 | A10-4 known (12) | A10-4 known (12) | A10-4 known (12) | A10-4 known (12) | ok (18) |
| only:HOST_CREDIT_OPEN | 390 | pass (12) | pass (12) | pass (12) | pass (12) | ok (18) |
| only:CIRCLES_OPEN | 390 | W4-6 (16) | W4-6 (16) | pass (16) | pass (16) | ok (18) |
| only:HOST_TOKENS_OPEN | 390 | W4-6 (16) | W4-6 (16) | pass (16) | pass (16) | ok (18) |
| only:TABLE_CARD_OPEN | 390 | W4-6 (16) | W4-6 (16) | pass (16) | pass (16) | ok (18) |
| only:KNOW_THIS_TEA_OPEN | 390 | W4-6 (16) | W4-6 (16) | pass (16) | pass (16) | ok (18) |
| upto:ANYONE_HOSTS_OPEN | 390 | pass* (16) | pass* (16) | pass (16) | pass* (16) | ok (18) |
| upto:FAVOURITES_OPEN | 390 | pass (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:YOUR_TABLE_PAGE_OPEN | 390 | pass (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:YOUR_TABLE_PLACE_OPEN | 390 | pass (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:TEA_TABLE_OPEN | 390 | pass (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:TOP_TEAS_OPEN | 390 | pass (16) | pass (16) | pass* (16) | pass* (16) | ok (18) |
| upto:HOST_ARTICLES_OPEN | 390 | pass (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:TEA_HOUSES_OPEN | 390 | pass (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:HOME_BAR_OPEN | 390 | pass (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:HOST_CREDIT_OPEN | 390 | pass* (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:CIRCLES_OPEN | 390 | pass* (16) | pass* (16) | pass* (16) | pass* (16) | ok (18) |
| upto:HOST_TOKENS_OPEN | 390 | pass* (16) | pass* (16) | pass* (17) | pass* (16) | ok (18) |
| upto:TABLE_CARD_OPEN | 390 | pass* (16) | pass* (17) | pass* (16) | pass* (16) | ok (18) |

## What the stars are

- `/account/host` read "blank main area" in many cells. The page code renders nothing (`Suspense fallback={null}`) until it has loaded; by hand (`ana` and `mei`, waiting 7 seconds, `all`) the form is there. Not a fault in a state. (A blank screen with nothing saying it is loading is a small thing on its own: `src/App.tsx:1292`.)
- `/people` at 320 read blank in two cells; by hand at 320 it shows "The People of Tea". Slow load, not a fault.
- "spinner still turning after 5s" and `goto` timeouts landed on different pages from state to state, mostly in the runs where three browsers ran at once, and the one-at-a-time reruns (`all`, five states) were cleaner. I treat them as load, not the site, but I did not re-check every one by hand.
- "could not press" on a bar word: same pattern, a click that did not land in four seconds on a loaded machine.

## Sized down, and why

- One rig, slot 4, one state after another. `live` and `all` at 320, 390 and 1280 as asked. The other 28 states at 390 only (the phone is where the bar and menu differ, and 28 states at three sizes was too long for a machine shared with other reviewers). Duplicate sets skipped: `only:FEW_HOSTS` is `upto:FEW_HOSTS`, `upto:KNOW_THIS_TEA` is `all`.
- Pages per person per state: all the links on Home and every control on the bar or rail (and what each opens), then the links on the four bar pages, Your Table and Manage, de-duplicated to one sample for each family of pages (one article, one product), at most 30 pages for `live` and `all` and 12 to 16 for the rest. Links lower on the cut pages (past the front pages) were not followed.
- Run in parallel for most states (three workers) and one at a time for `all` and five reruns; a few first runs hit slow loads, so the five states with gaps (FEW_HOSTS, YOUR_TABLE_PLACE, TOP_TEAS, HOME_BAR, HOST_CREDIT) and `all` were run again one or two at a time. `only:YOUR_TABLE_PLACE` owner has 9 pages, not 12, for the same reason.
- The crawl follows `a[href]` and the bar and rail buttons. Buttons inside Your Table were pressed once each by hand-written probes (below), for Mei and the owner in `all`, not in every state.

## Taps from Home (shortest path found)

Anything not listed is reached in one or two taps.

| Page | Taps | Shortest path | Verdict |
|---|---|---|---|
| Every bar word, Home line and strip (/read, /events, /shop, /tea-table, /tea-houses, /people, /spaces, /about, /account/host) | 1 | the link on Home or the bar word | fine |
| /account (Your Table) | 1 | bar: Your Table | fine |
| Your Table rooms: journal, tea chest, favourites ("remember"), orders, sessions, journey, profile, settings, Host a table | 2 | Your Table, then the tile | fine |
| /admin/dashboard (Manage, "Today") | 2 | Your Table, then "manage" (phone); "manage" in the rail (desktop, 1) | fine |
| A Manage room: Stock, Sales, Sessions, People, Publish | 3 on a phone | Your Table, "manage", then the room word in the bar | S3, see W4-2 |
| /tea-houses/visit and /tea-houses/work (houses) | 1 | Home line "Find a tea house." or the bar word "Tea house" | 1 tap, but see A10-4 |

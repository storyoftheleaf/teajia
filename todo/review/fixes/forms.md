Fixed by Sonnet 5.5 (cloud), in place of Sol.

# Forms ask only what the site cannot know

Rule (Adrian): a form asks only what the site cannot already know, and fills in the rest as a default the person can change. Counts are taps and typed fields, before then after.

| Id | Where | Before | After |
|---|---|---|---|
| W1-7 | Order form, signed-in guest | 4 fields typed (town, country, name, email) | town and country as last saved, name and email (or saved number for WhatsApp) prefilled from the account, still editable: 2 typed on a first order, 0 on a repeat. Taps unchanged (tea link, Add to order, View order, Place order request); the 3-tap path needs the cart sheet to open on Add to order, a layout call not made here |
| W2-1, W6-4 | Make a table | Seats, door and Area asked afresh each time | Seats and door open as the last table had them (door only if still allowed); Area opens as the area of "your table", else the last table's area. Only Day and Time are asked: 2 fields, 0 for the rest |
| W2-2 | Table ready screen | 3 taps and 1 field to make a second table (Back, door, Make) | "Make another table": 1 tap to a fresh form (day and time empty, seats, door, area as before), then Make the table |
| W2-5, A6-6 | Your Table, choose a place | Area kept the previous place's text | Area is the chosen place's own area or empty; the host form's Area and "your table" agree, so the area is typed once in all, not three times |
| W6-7 | Assistant key name | Name typed (1 field) | Opens as "My assistant" and selected: Connect, Make the key, Done = 3 taps, 0 fields |
| W1-14 | Guest Book "Send for review" | words, name tick, share tick, send: 3 taps, 3 fields | words, name tick, send: 2 taps, 1 field. The share tick is gone; a line beside the button says sending shares with the host. A photograph still has its own "I have permission" tick |
| W2-10 | Key shown once | Back then Forward wiped the key | The key lives in the history entry `?assistant=made` and in page memory only (never storage, never fetchable again); Done clears it |
| W6-2 | Favourites Back | bare navigate(-1) | Site back with fallback to Your Table (`/account`) |
| W3-7 | Card for a table | no Back at 320 and 390 | top-left Back (`useAdminBack`, fallback to the table), hidden in print with the controls |
| W6-1 | Photograph zoom | state only; Back left the page | `PhotographZoom` puts the open photograph in the address (`?zoom=`) once, so all callers follow; PersonTastings keeps its own `photograph` step (`ownHistory`). Reload or Forward does not reopen the zoom |
| W6-9 | Credit ceiling message | "ceiling of 0.00 USD" with no terms | "the shop has not set a ceiling" |
| W6-10 | Freight edit | `Number(val) \|\| 0` | `enteredNumber()`; an unreadable entry changes nothing, a blank still clears |
| W6-11, W6-12 | ProductEditPanel | toggles without tap-target; em dashes shown | `tap-target` on the toggles; a plain `-` for a missing currency (Adrian's rule says a dash; the finding preferred "Not stated", one word to change) |

## Needs and caveats
- Added `area_hint` to the host's own table list (`worker/src/index.ts` list select, optional field on `HostedTableSummary` in `src/lib/hostingApi.ts`, not `api.ts` or `types.ts`) so a new table can start from the last table's area.
- W2-5 as filed (offer "Make this your table" on the "keep for next time" screen) is not built; the area part is handled by the default from the place.
- Unit tests: `src/lib/tableDefaults.test.ts`. Walk updates: guest-walk (W1-7 no longer known-failing; W1-14 no second tick), host-walk (uses "Make another table", W2-1 finding, key name), `todo/review/findings/W6-clicks.spec.ts` (W6-2, W6-7, new W6-h).

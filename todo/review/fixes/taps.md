Fixed by Sonnet 5.5 (cloud). Taps counted as in `todo/review/tap-ledger.md` (the walk's own count, from the page the thing belongs to).

| Row | Before | After | What was done | Files |
|---|---|---|---|---|
| U1-1 | not reachable by tapping | "Open your page" is a tap (1) | Already fixed on this branch by the seats fix (`todo/review/fixes/seats.md`, W1-1): signed in with no seat on the account, the device's saved seat token finds it. Here the lookup rule is pulled into `usableSeat()` so it has a unit test; behaviour unchanged. Linking the device seat to the account on sign-in still needs a new route (not done) | `src/lib/mySeat.ts`, `src/components/events/EventLanding.tsx` |
| U1-2 | 4 via Manage, only after the recap exists | 1 | On the table's After part, a line "Write the recap and share it on the Tea Table" (owner: opens that table's Post-Session tab in Manage) and "See the Tea Table" (anyone hosting). Shown only while TEA_TABLE is open (wording drops the Tea Table while closed; "Write the recap" stays for the owner). A host who is not the owner is not given a Manage address | `src/components/host/HostTableLinks.tsx`, `hostTableParts.ts` (`tableLinks`), `HostTableAfter.tsx` |
| U1-5 | 8 (9 on phone) | 1 from the People list ("Let host by link" on the person's row); reach starts as "by their link only" and is widened in the Hosting panel (+2) | Row button runs the existing approve call. Default reach is the existing default (`invitation`), the narrowest | `src/admin/hostingRowActions.ts`, `src/admin/views/PlatformAdminView.tsx` |
| U1-6 | 6 (7 on phone) | 2 from the People list (Stop all hosting, then its confirm; "Let host again" is 1) | The same row carries the stop with the existing two-stage confirm. Only while ANYONE_HOSTS is open (the stop is its part) | same |
| U1-7 | 4 (After, Mark who came, Save, Copy) | 2 (After, Copy their thank-you link) | A link sits beside every confirmed guest not marked absent once the table has ended. For a guest not yet marked, the tap marks as the Mark screen opens (everyone not marked absent counts as came), then copies; a line says so, and Mark who came still changes it. The worker is unchanged: it still issues a link only to a guest marked as having come | `src/components/host/HostTableAfter.tsx` |
| U1-8 | 4 taps, name and email asked | 3 (tea link, Add to order, Place order request); name and email from the account | Name and email prefill was already done (forms fix W1-7, `PublicCart.tsx`). New here: a guest who came from a thank-you (an unspent order reference is held, FIRST_TABLE open) has the order sheet open at once on Add to order, no toast to tap. Everyone else keeps the toast | `src/lib/orderVia.ts` (`addOpensOrder`), `src/App.tsx` (`handleAddToCart`) |
| U1-14 | 3 (4 on phone), no Back | 1 from the table's page | Back was already added (forms fix W3-7, `SessionCardPage`). New: "Print a card for the table" link on the table's own page, owner only, while TABLE_CARD is open and the table is public and not cancelled or archived | `src/components/host/HostTableLinks.tsx`, `HostTableHeader.tsx` |

## Tests
`src/lib/fixTaps.test.tsx` (vitest, 10 cases) covers every row. The review walks (`tests/review`) were not re-run in this container; their selectors (`hosting-open`, `host-approve`, "Mark who came", "Copy their thank-you link") still exist. The owner walk's counts for U1-5 and U1-6 can now use `host-approve-row` and "Stop all hosting" on the list row.

## Not done, and why
- No navigation component was touched (BottomTabBar, manageNav.ts, rail). Guest notes on the phone (U1-3) is another builder's.
- U1-8: opening the order from the thank-you with no product page at all (teas listed with Add to order beside them) would need the thank-you answer to carry the sizes and prices; not built.
- U1-1: a device seat is not linked to the account when she signs in (needs a new route and an `api.ts` call).

U1-7 (merged with A9-13): the implicit marking from fix-taps was replaced by fix-tables' ticks on the guest list with one Save; Save then Copy is 2 taps, and nobody is marked as having come without the host saving it.

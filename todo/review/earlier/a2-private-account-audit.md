# A2: a private account stays private (findings)

Read-only audit of `origin/build/launch-2` at `0b7b5829`, in a detached worktree (`/tmp/a2-audit`, removed afterwards). Nothing was changed, committed or pushed in the repo. Scratch tests lived in `worker/tests/zz-a2-scratch.test.ts` and `src/lib/zz-keptWay-scratch.test.ts` inside the worktree. They used the helpers at the top of `worker/tests/hosted-session-doors.test.ts` (lines 1 to 143, copied), and all 11 + 1 passed, with each test asserting the behaviour reported. The existing guards also pass: `hosted-session-doors`, `host-guest-notes`, `host-table-teas`, `host-table-way` and `few-hosts-contract`, 58/58.

Severity scale: **stranger** (private data readable by someone with no seat), **member** (readable by another member or a former guest), **cosmetic**.

## Findings that break a contract

### F1 (Contract C, item 7). Step photographs of the way in are served to anyone who has the address, for ever. Severity: stranger (anyone the address reaches, such as a removed guest, a guest after the end, or a person they forward it to)
- `worker/src/index.ts:32982-33008`: `/api/media/<key>` reads R2 with no seat, token or session check. `isWalkthroughMedia` (`worker/src/sessionWalkthrough.ts:44-63`) changes only the `Cache-Control` header (`private, max-age=300`) and the `Referrer-Policy`.
- The guest page hides `venue_guide` after a removal or after the end (`index.ts:13030-13039`, `13111-13113`). But the step photograph URLs a guest has already received (shown on the page, kept in the phone's Cache Storage by `src/lib/keptWay.ts:118-127`, or left in history) keep working.
- Proof (scratch F1): Mei is confirmed and reads the guide. She is set to `cancelled`, and her page then gives `venue_guide: null`. An unsigned `GET /api/media/accounts/ana-personal/venue-guide/gate.jpg` still returns `200 private, max-age=300` with the bytes. After the session is completed, the launch is closed and Ana's approval is withdrawn, the same GET still returns 200.
- Key note: the key is a random UUID (`index.ts:17397`), so a stranger must be given the address. Once given, nothing ends it.

### F2 (Contract C, item 8). A reused guide gives an old table's guests the current way in. Severity: member (a former guest of the same host)
- `worker/src/hostTableWay.ts:162-193` (`keepTableWay`) and `src/components/host/WalkthroughEditor.tsx:97-99` reuse a saved place by copying its `venue_guide` JSON, photograph URLs included, into the new table.
- Through the API, a guest of table A cannot read table B's guide text: `saved_locations` is read only at `index.ts:14884` (staff) and `hostTableWay.ts:68-73` (host). That part holds.
- But the photographs are the same objects, so with F1 a guest of any earlier table at that house keeps working addresses for the current table's step photographs.
- Proof (scratch F2): the first table is completed, and its guest's page gives `venue_guide: null`. The second table's guide names the identical `image_url`, and `/api/media/...` answers 200.

### F3 (Contract C, the guide's own guard). The admin event route takes a guide that the host page refuses, so a guest's phone can be pointed at any server. Severity: member (low; it is the host's own guests)
- `hostTableWay.ts:43-51,136-138` (`isOwnWayPhoto`) refuses any step photograph that is not this account's `venue-guide/` or `venues/`.
- `PUT /api/admin/events/:id` (`index.ts` `handleUpdateEvent`, where `EVENT_ALLOWED_COLS` includes `venue_guide` and `address_text`) is open to the owner of the personal account in their own account, and it does no such check. This works even while the launch is closed or the approval is withdrawn.
- The guest's phone then loads the photo (`VenueGuide.tsx`), and `keepWay` fetches it (`keptWay.ts:126`).
- Proof (scratch F11): `PUT /api/me/tables/ana-table/way` with `https://tracker.example.test/pixel.gif` returns 400. `PUT /api/admin/events/ana-table` with the same guide returns 200 `{"success":true}`, and the confirmed guest's page then carries the tracker URL.

### F4 (Contract A, item 2). The public tea list and the guest page carry private-account identifiers and the Tea Chest product's own photograph. Severity: cosmetic (no price, stock or cost)
- `GET /api/events/:slug/tea-menu` (`index.ts:14697-14716`) returns `product_id = COALESCE(own.id, shop.id)`. For a tea from the host's Tea Chest this is the private product's id, and `product_image_url` falls back to `own.image_url`, which is the product's photograph from the private account.
- The guest page (`index.ts:13053-13064`) also returns `etm.account_id`, the private account's id.
- The public answer (`index.ts:12443-12446`) returns `id` (the event id) and `venue_id`.
- None of these opens anything: store and product reads need `public_enabled = 1` (`index.ts:725-733`, `24073-24074`). The brief asked for "no id", though.
- Proof (scratch F3): the tea list has `"product_id":"chest-1"` and `"product_image_url":"https://media.teajia.co/accounts/ana-personal/products/chest.jpg"`. The guest page's tea row has `"account_id":"ana-personal"`. The public answer holds no email and no `ana-personal` string.

### F5 (Contract A, item 3). After the approval is withdrawn, or the launch flag is closed, the thank-you link and the guest's own page still open. Severity: cosmetic (a decision for Adrian)
- `afterSitAccess.ts:49-53,66-80`: `findEligibleSeat` checks only `shop.status = 'active'`, never the host's door or `FEW_HOSTS_OPEN`.
- `PUT /api/rsvp/:token` (`index.ts:13136`) has no door check, so a guest can still edit their seat.
- Proof (scratch F5), the same in both modes. Withdraw: every slug door returns 404, the guest page returns 200 with `address_text: null` and `venue_guide: null`, the edit returns 200, the thank-you `/api/after-sit/recap` returns 200, and the host's `/notes` returns 404. Close: identical.
- No new seat can be taken (`rsvp` 404, `claim` 404). The way is never shown.

### F6 (Contract C, item 7). A by-link door still seats a guest after the session's end time, until the host marks who came. Severity: cosmetic (the way is not shown)
- `handleRSVP` (`index.ts:12720-12725`) checks `e.status = 'active'`, and the allocator (`eventDomain.ts:196`, `279`) checks `lifecycle_status = 'published'`. Neither checks `sessionHasEnded`.
- Proof (scratch F6): a table that started 10 hours ago at the by-link door. `POST /rsvp {full_name}` returns 201 `status: confirmed`, and the guest's page has `address_text: null`.

### F7 (the kept copy on the phone). It is removed only when a guest page is opened again, and a copy with an unreadable date is never removed. Severity: cosmetic
- `src/lib/keptWay.ts:73-102`: `readKeptWay` and `sweepEndedWays` run only from `GuestManagement/index.tsx:65-72`. A phone that never opens a guest page again keeps the address and step photographs in localStorage and Cache Storage after the end.
- `ends_at: null` (from `sessionEndsAt` when `event_date` cannot be parsed) is never swept (`keptWay.ts:79`, `100`).
- The offline view (`GuestManagement/index.tsx:118-131`) also opens on any fetch error (`isError`), not only on no signal. Before the end, a removed guest whose request fails (for example a 5xx or 429) is shown the kept way.
- Proof (`src/lib/zz-keptWay-scratch.test.ts`): `sessionEndsAt({event_date:'26/11/2026 16:00'})` is null. `keepWay` then `sweepEndedWays(now + 1 year)` still returns the address. A dated copy past its end stays in localStorage until `readKeptWay` or `sweepEndedWays` runs.
- Hosted tables always store an ISO date (`hostTable.ts:96`), so the null case needs an admin-edited date.

### F8 (item 10). "Hosted by", the order credit and the guest links agree on `host_user_id`, but not on a lead host whom the public page does not name. Severity: cosmetic
- `orderSessionSource.ts:47-58` and `guestLinkHolders.ts:11-16` use `COALESCE(host_user_id, any lead_host contributor with a user)`.
- `publicSessionHost` (`index.ts:12537-12554`) falls back only to a lead host that `is_public = 1` and is published.
- Proof (scratch F7). With `host_user_id = ana` and Lee as public lead_host: the credit is `ana`, `host` is `{"name":"Ana"}` while `hosts` lists `["Lee","lead_host"]`, and Lee holds no guest links. With no `host_user_id` and Lee as a non-public lead_host: the credit is `lee`, Lee holds the guest links, and the public `host` is `null`.
- The hosted-table path holds. `recordOrderSessionSource` names Ana for an order in the platform owner's shop (`hosted-session-doors.test.ts:324-329`, passing). The thank-you carries `thanks_ref` and shop paths with `?store=shop` (scratch F4).

### F9 (item 6). Tea search lists out-of-stock shop teas that the shop's browse list leaves out. Severity: cosmetic
- `hostTableTeas.ts:47-53,86-108`: `crossShopTeaSql` does not require stock, while the browse list does (`index.ts:24031-24034`). Such a tea still opens by address, so nothing hidden is exposed.
- Proof (scratch F8): searching `shou` as Ana returns `shop-empty` (0 g), `shop-ok` and `ana-chest`, while `/api/s/shop/products` lists only `shop-ok`. Draft, hidden, third-account and Bo's chest teas are absent. Bo searching Ana's table gets 404.

## Items that hold (one line of proof each)

1. **Every query that used PUBLIC_EVENT_HOST.** Main had 5, at `index.ts` 3890, 12423, 12621, 12650 and 12843; the recap and the tea list used the same rule inline.
   - Product events (`3902`) keeps it, and scopes to `e.account_id = BALI` for anonymous callers. Correct.
   - Session page (`12455`), seat (`12724`) and availability (`12969`) are now `sessionLinkHostSql`. A private approved host's hosted table opens. Intended.
   - Public events list (`12695`) keeps it plus `is_platform_owner`. Correct.
   - Tea list (`14687-14688`) is opened only for personal-account tables by the same door. Intended.
   - Recap (`12569-12580`) keeps `public_enabled = 1`. Correct.
   - Newly guarded by `privateHostDoorSql`: guest-page `door_open` (13004), claim (13251), find-rsvp (13567), interest (19691) and guest invite read and claim (19556, 19679). Each closes for a stopped host. Correct.
   - Proof: `hosted-session-doors.test.ts` "is found by no list, store page, profile, recap or public agent tool" passes.
2. **What a stranger learns.** No email, no account slug or store page, no other session, and no guest name without `show_in_guest_list = 1` (`index.ts:12474-12479`; the seat form sends it only when ticked, `src/lib/api.ts:2925`). The tea list carries no price, stock or cost. Proof: scratch F3 asserts no `ana@test.dev` or `ana-personal` in the answer. Exceptions: F4.
3. **Withdraw and close.** Every slug door returns 404, no seat or claim can be taken, and the way is gone at once. Proof: scratch F5. Exceptions: F5.
4. **A host who is not a seller.** No tea of theirs is buyable or priced, even with their Tea Chest account turned public. Proof (scratch F9): the tea list has no `price|_usd|stock`, the thank-you path is `null`, and `/api/s/ana-personal/products` returns 404 (`sessionTeas.ts:110-117`, `personalSellerApproval.ts:10`, `index.ts:24073`).
5. **Foreign ids on the menu.** A draft, hidden or archived shop tea, a third account's tea, a missing id and Bo's chest each resolve to a plain name, with no `product_id`, `shop_path` or `product_name`, on the public list, the guest page and the thank-you. Proof: scratch F4 (`menuProductJoins`, `hostTableTeas.ts:68-71`).
6. **Tea search** returns public, shown, active shop teas and the caller's own chest, and nothing else. Proof: scratch F8. Exception: F9.
7. **Removed or ended guest, through the API.** Removed: `venue_guide` and `address_text` are null on the next read. After the end: null. Proof: scratch F1 and F6, and `hosted-session-doors.test.ts:376-421`. Exceptions: F1, F6, F7.
8. **One session's guide through the API.** A guest reads only their own event's `venue_guide`, and no guest-facing read touches `saved_locations`. Exception: F2 (shared photo addresses).
9. **host_guest_notes.** It is named only in `worker/src/hostGuestNotes.ts:49,67,78`, which is reached only by `handleHostedTableNotes` behind `requireOwnHostedTable` (`index.ts:17290-17305`). There is no MCP tool, no export and no recap join. Proof: `grep -rn host_guest_notes worker/src src shared` finds only that module, and `host-guest-notes.test.ts` (another host, Adrian, the guest and the co-host all get 404) passes.
10. **Order credit.** An order from a hosted table's thank-you names the host. Proof: `hosted-session-doors.test.ts:324-346` passes. Exception: F8.

## Media caching (asked)
- `accounts/<id>/venue-guide/` and `venues/` are served `private, max-age=300` with `no-referrer`.
- `accounts/<id>/host-teas/<table>/` is served `public, max-age=31536000, immutable`, so a tea photo the host removes, or one belonging to a stopped host, stays at the edge for a year. Cosmetic; these photos are shown on the public tea list.
- Proof: scratch F10.

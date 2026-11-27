# A3: privacy review of a stranger's table (Launch 3, anyone can host)

Reviewed `origin/build/launch-3` at `77f2711`. Fixes are on `build/l3-a3-privacy`. The reading throughout: anyone signed in can now host, so the host may be a stranger to the shop and may be hostile. A host owns their private account, and an owner holds every bundle there (`resolveBundles`, `worker/src/index.ts`). So a host can call not only `/api/me/tables/*` but every shop admin route (`/api/admin/events/*`, `/api/admin/attendees/*`) on their own account.

Severity: **stranger** (someone the shop never vetted reads what they should not), **member** (another guest or a former guest), **flag** (a Launch 3 door open with `ANYONE_HOSTS_OPEN` off), **cosmetic**.

Guard for every fix: `worker/tests/a3-launch-3-privacy.test.ts`, plus updated existing tests.

## Findings fixed

### F1. A host could read a phone's sitting history across all of Teajia. Severity: stranger
- `GET /api/admin/events/:id/attendees` and `GET /api/admin/pending-attendees` built `journey_preview` / `sessions_attended` from every `event_attendees` row on the platform with that phone or email, with no account filter.
- Attack: a host asks for a seat at their own table, giving someone else's phone number. Their attendee list then says how many sessions that person attended anywhere (Adrian's shop included) and the date of the last one.
- The same lists joined `customers` (name, tags) and `invoices` (favourite tea types) by `customer_id` alone, and `PUT /api/admin/attendees/:id` accepted any `customer_id`.
- Fix: journeys count only the caller's account. The customer join and the invoice read are scoped to the account. A guest can be linked only to a customer of the same account (404 otherwise).

### F2. A table's tasting could be joined by anyone who knew the event id. Severity: stranger
- The tasting a guest's first open makes has the fixed id `event-tasting-<event id>` (`sessionTasting.ts`). Every guest page (`GET /api/rsvp/:token`) carries `event.id`, including the page of a seat that is only asking, was said no to or is waiting.
- `POST /api/sessions/:id/join` let any signed-in person join any active session by its id. A member then read `GET /api/sessions/:id`: every member's full name, username and user id, the teas, and the session's `invite_token`.
- Membership never ended when the seat did.
- Fix:
  - An event's session can no longer be joined by its id. Guests join from a confirmed seat (`POST /api/rsvp/:token/tasting`) or with the host's join code. Someone already in it can still open it.
  - A table's own tasting is read only while the reader holds a confirmed seat (`holdsEventTastingSeat`). The host still reads it.
  - Guests reading an event's session see one another by first name only, with no username, no other member's user id and no `invite_token`.

### F3. With `ANYONE_HOSTS_OPEN` off, several Launch 3 doors were open. Severity: flag
- `POST /api/rsvp/:token/tasting` (J8) and `POST /api/after-sit/gallery` (J7) were not gated.
- `PUT /api/me/tables/:id/guests/:attendeeId/release` and `GET /api/admin/events/:id/seat-notices` (J9) were not gated, and the host page answer carried `notices`.
- The MCP tools `release_my_seat`, `release_guest_seat` and `same_table_again` needed only Launch 2's switch.
- `PUT /api/admin/events/:id` wrote `is_tasting`, `contribution_kind` and `contribution_note`. The public answer returned `contribution_*` and `is_tasting`, the guest page returned `is_tasting` and `tasting_session_id`, and the after-sit recap returned `is_tasting` and `journal_teas`.
- The session editor showed the tasting tick, and the host page showed "Release seat".
- Fix: each answers 404 or leaves the field out while the switch is off. The admin update drops those three columns without writing them, because the shop's form may still send them. The client hides the tick and Release, and does not ask for seat notices.

### F4. A photograph its taker kept unnamed was grouped under their signed note. Severity: member
- In the guest book's photo list (`serveGuestBookPhotos`, `photos-read`), every photograph carried the taker's `entry_key`. The client groups a photograph with the note that has the same key, and the note is signed with the guest's name. So `show_name = 0` still put the photograph under "Mei Lin".
- Fix: a photograph carries the entry key only when its taker chose to show their name.

### F5. The session lists carried a person's table's id. Severity: cosmetic (A2 F4 keeps it known by link only)
- `GET /api/events` and `GET /api/me/sessions` returned `e.id` for a host's open table (J10).
- Fix: rows of a person's private account carry no `id`. Shop rows keep theirs. The list and search key rows by slug.

### F6. A stopped host's table offered a seat the guest could not take. Severity: cosmetic
- `offerFreedSeats` offered a freed seat at a stopped host's by-link table. The claim route then refused it with 404, and the guest's page showed an offer that led nowhere.
- Fix: no seat is offered or asked for while the host is stopped. Once they host again, the next change moves the list on.

### F7. Through the admin routes, a host held every guest's private link and email. Severity: stranger (built as a guess, G2)
- On their private account, the host is owner, so `withoutForeignGuestLinks` gave them `magic_token`, `email` and `user_id` for every guest. The host's own page deliberately carries none of these.
- Whoever holds the link reads the guest's page (name, phone, email, their invites), edits or cancels the seat, and writes in the guest book as them.
- Fix: on a person's private account (platform staff aside), staff answers carry no guest link, no email and no user id. The approve route's WhatsApp text then carries no ticket link.

### F8. A host kept the phone of a guest they said no to, or whose seat was given back. Severity: stranger (built as a guess, G3)
- `hostTableGuests` returned `phone` whatever the guest's status.
- Fix: the phone is shown only for confirmed, asking and waiting guests.

## Findings not changed (low, or for Adrian)

- **F9. Reports are an existence oracle.** The `report` MCP preview and `POST /api/session-reports` with `target_id` say whether any event or contributor id exists, including a draft or a private one. They say nothing else, ids are random UUIDs and filing is rate limited, so this is left as is. Reports reach Adrian alone, and `openReports` is called without the reporter fields.
- **F10. The staff guest book routes on a host's own account** (`/api/admin/events/:eventId/guest-book/photos`, `/guest-book`) give the host full names and entry keys, bypassing J6's host view. The host already sees every guest's full name on their own page, so nothing new is learned about other guests.
- **F11. A host-made tasting session** (`POST /api/sessions` with `event_id`) keeps members who joined by the host's join code after their seat goes. That is the host's own invitation, and F2 covers the session made from a seat.
- **F12. `POST /api/sessions` `member_ids`** adds any user id as a member of the host's own session. This is older than Launch 3. The added person learns nothing until they open the session, but it lets a host put a stranger on a session list. Worth closing later.
- **F13. A host may still copy a guest's link for a seat they entered themselves** (`record_event_rsvp`, MCP). That seat has no other way to reach its guest.

## What holds

- **Public session answer** (`GET /api/events/:slug/public`): no id, account name or country for a person's table, no address, map or way in. Guest first names appear only when the guest opted in. `door` reads `open` as `request`, so no guest learns a host's reach. Caching is `private, no-store` for a person's table.
- **Reach:** `host_reach` is read only in SQL (`reachListedSessionSql`) and sent only to the platform owner's Manage (`handlePlatformListUsers`). A host's first session, a stopped host, a past or finished table and a closed account are never listed.
- **Waiting list** (`waitingList.ts`): a guest reads only their own position and offer. Seat notices go to the host's own table page and the shop's Manage. Nothing is sent to anyone.
- **Reports:** only the platform owner lists and resolves them. A reported host is never told, and the id of a person's table is never sent back.
- **The gallery:** a signed-in seat link for that session is needed, and it is re-checked after each read. Other guests' photographs carry no user id and a first name only when chosen. Bytes are served only for included, current photographs.
- **Host review (J6):** gated, on the host's own table only. Host photo rows carry no entry key.
- **MCP:** `available` is checked on both `tools/list` and `tools/call`. Tickets bind the user, and `ownTable` requires the token's own personal account.
- **Stop:** a stopped host keeps reading their tables, and cannot make a table, change one or seat anyone (host routes, shop approve and batch approve, claim, guest invite claim).

## Guesses for Adrian

- **G1. Stopping a host stays with Launch 2's switch.** It only takes something away, so it works with `ANYONE_HOSTS_OPEN` off, as `PUT /api/platform/users/:id/hosting-stopped` already did. The J9 seat engine also stays on for every session, because it replaced the old cascade. Only the new doors (release, notices) close with the switch.
- **G2. A person's table: guest links stay with the guest.** No staff answer on a private account carries the guest's private link, email or account id (F7). The host contacts guests by the phone shown on their page and sends thank-you links from it.
- **G3. A host keeps a guest's phone only while the guest is coming, asking or waiting** (F8). A guest said no to, or whose seat was given back, disappears from the host's contacts. Their name and what they wrote stay in the host's record.
- **G4. Guests of a table's tasting see one another by first name.** This is the same rule as the gallery: no full name and no username.
- **G5. A photograph its taker kept unnamed stands on its own in the guest book** (F4). That holds even when the same guest signed a note.
- **G6. Turning Launch 3 off hides the stored tasting and contribution choices** and does not erase them. They come back when the switch is on.

## Tests

- New: `worker/tests/a3-launch-3-privacy.test.ts` (11 tests). It covers each fix with the switch on and off.
- Updated for the switch and the fixes: `host-reach`, `mcp-launch-3-tools`, `session-tasting`, `session-gallery`, `session-guest-book-photos`, `launch-3-early-contract`, `waitlist-released-seat`, and the browser spec `tests/session-tasting.spec.ts` (which now turns the switch on in the page).
- 47 focused worker files pass, 561 tests. `npm run lint` passes, `npm run lint:worker-types` shows 27 known errors and no drift, and `npm run lint:colors` passes.

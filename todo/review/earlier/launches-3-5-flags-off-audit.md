# Launches 3 to 5 with every switch off: how live would differ from main

Read-only review, 2026-11-26. Compared `origin/build/launch-5` (tip a49bed21) with `origin/main` (13143c89) using `git diff origin/main...origin/build/launch-5` (280 files, merge base 5740132f). Main is 6 commits ahead of the merge base, including the score-giver fix 29306ea2. `git merge-tree` merges the two cleanly, and launch-5 adds no new callers of the score code main changed. Line numbers point into launch-5.

Assumed off, which is also the default in code: ANYONE_HOSTS_OPEN, TEA_TABLE_OPEN, FAVOURITES_OPEN, YOUR_TABLE_PAGE_OPEN, HOST_ARTICLES_OPEN, TOP_TEAS_OPEN, TEA_HOUSES_OPEN, YOUR_TABLE_PLACE_OPEN, HOME_BAR_OPEN, HOST_CREDIT_OPEN, CIRCLES_OPEN, HOST_TOKENS_OPEN, TABLE_CARD_OPEN, KNOW_THIS_TEA_OPEN and FEW_HOSTS_OPEN. Neither wrangler.toml nor any workflow sets any of them.

**Gated as intended (no difference with the switches off).** The routes for favourites, Tea Table, Know this tea, tea houses (public part), circles, host tokens, host articles, top teas, host credit, session reports, `/api/me/sessions`, host reach and hosting-stopped, Your Table place and tasting-on-a-hosted-table all answer 404. Every new MCP tool in `launch3.ts`, `launch4.ts` and `circles.ts` uses `available` or `unavailable`, so `/mcp tools/list` is unchanged. `/mcp/public` is untouched. Host-self token auth refuses. All the new front-end entry points render nothing: Home "Host a table", Launchpad credit tile, cart credit choice, Your Table page, favourites marks, Tea Table links, Print card, ReportLink and contribution line.

---

## Leaks and regressions (fix or accept before shipping)

### 1. The Guest Book still names a photo's taker who chose not to be named (privacy)
`worker/src/sessionGuestBookPhotos.ts:84-102` (`photos-read`) now sends `display_name` only when `show_name = 1`. But it still runs the rows through `guestBookEntryKeys`, so every photo keeps an `entry_key` made from the taker's `user_id`. `src/lib/groupGuestBookEntries.ts` puts that photo in the same entry as the taker's note. `GuestBookPhotos.tsx:33` then prints the note's `display_name` above it, and that name is `COALESCE(signed_name, full_name)`, the full name. **A guest who left a note and did not choose to be named is still named, in full, beside their photo, for every other guest of the session.** The host review path drops the key for exactly this reason (`:252-257`). The guest path and the party-link path need the same treatment.

### 2. A guest with a live seat offer who cancels: the seat is offered to nobody (regression from main)
- `waitingList.ts:157` (`cancelGuestSeat`) and `index.ts:14468` (admin Cancel) call `offerFreedSeats` only when `released.seats > 0`.
- A waitlisted guest holding a live offer has no held or confirmed party seat, so `seats` is 0.
- The offer, which counted as a taken seat, is cleared, and nobody is offered the seat. The scheduled run only moves expired offers on, so the seat stays free while others wait.
- On main, every cancel ran the cascade.

This applies to shop sessions on live today. The fix is to offer whenever the guest held a live offer, or to always call `offerFreedSeats`, which is guarded anyway.

### 3. Public seat counts disagree with the allocator after J9
- `SEAT_OF_A_GUEST_STILL_COMING` (`hostTableGuests.ts:63`, used in `eventDomain.ts` capacityGuard and reservePartySeats, and in `seatsTakenSql`) stops counting held and confirmed party rows of guests who are `cancelled` or `denied`.
- Main's cancel never released those rows, so live has stale ones, and booking now treats those seats as free.
- The public counts still count the stale rows: `/api/events/:slug/public` (`index.ts:12580`), `/api/events/:slug/availability` (`:13172`), `/api/events` (`:12839`), and the admin lists at `:13947`, `:13975` and `:24748`.

A visitor can see "full" or too few seats left while an RSVP goes through, and Manage counts disagree with the waiting list. Either apply the same predicate to those counts, or repair the stale rows once, with a preview page for Adrian.

### 4. The scheduled run rewrites historical rows on its first runs, and there is no preview
- `index.ts:34259` → `advanceWaitingLists` → `lapseExpiredOffers` (`waitingList.ts:169`) runs on every scheduled run, behind no switch and with no date filter.
- Main's cascade left many waitlisted rows with an old `claim_expires_at`. Up to 500 per run will get `offer_lapsed_at` set, an `offer_lapsed` row in `event_seat_notices`, and then (for future published sessions only) new offers plus `event_notifications` rows.
- That is a bulk UPDATE and INSERT on live data. CLAUDE.md requires a preview page for row writes, and this is not a migration, so nobody sees one.
- The lapsed guests are also never offered again by themselves. On main the same guest was offered again.

Either add a cutoff by event date, or show Adrian the affected rows first.

### 5. Launch 3 J7 session gallery is live with no switch
`AfterSitPage.tsx:101` mounts `<SessionGallery>` for any signed-in guest, and `POST /api/after-sit/gallery` (`afterSitAccess.ts:306`) has no switch. Guests of shop sessions will see "Photographs from the table" on `/after-sit`, with photos other guests offered and the host included. They can also add their own photos from there (they are kept privately first, then offered). The taker's first name appears only with their consent. This is a new feature that ships on, not an off-state no-op. If it is meant to ship, say so. If not, gate it (ANYONE_HOSTS_OPEN, or a switch of its own).

### 6. Launch 3 J8 tasting is live for shop sessions with no switch
- **Where:** the admin EditForm checkbox "This is a tasting…" (`BasicInfoSection.tsx:334`, wired in `EditForm.tsx`) is shown to every shop. `PUT /api/admin/events/:id` accepts `is_tasting` with no switch.
- **What follows:** `GET /api/rsvp/:token` then returns `is_tasting` and `tasting_session_id`. `ConfirmedView` shows "Open the tasting" on the day (TastingDoor). `POST /api/rsvp/:token/tasting` creates `tasting_sessions` rows. The after-sit page shows PaperNotesLine.
- **Only the hosted-table side is gated:** `/api/me/tables/:id/tasting`, the `set_session_tasting` tool and `is_tasting` on the host's own table.
- **Side effect:** every event save from the new form now sends `is_tasting`.

If the shop side should wait for Launch 3, gate the checkbox and the RSVP fields.

### 7. Tea house portfolio in Manage is live, and so are its writes
`AccountSettingsView.tsx:447` shows "Tea Houses: your part in them" to the platform owner. `/api/admin/tea-houses*` (`teaHouses.ts:227` and nearby) is not behind TEA_HOUSES_OPEN, as designed ("works while the public pages are closed"). So Adrian can write `tea_house_pages` and `tea_house_contributions` rows now. It is harmless publicly, because the public pages stay closed, but it is a new surface on his Settings page with the switch off.

### 8. New public page `/tea-houses/visit`, and redirects for `/tea-houses*`
`teaHouseRoutes.tsx:26` mounts Visit with no switch, and `/tea-houses`, `/build`, `/work` and `/work/:slug` all redirect to it. On main these paths showed the not-found page. Nothing links to it, but it can be reached and indexed. It lists every public store with its new `cover_image_url` and "Coming session" (see the intended list).

### 9. "Pours at tables" on `/people` may break the "nothing automatic" rule
`peopleList.ts:46` (`PEOPLE_LIST_POURS_COLUMN`) computes `pours`, and `ContributorsIndexPage.tsx:26-30` prints "Pours at tables" under anyone publicly credited on a completed session. It is live with no switch. The third exception (quiet acknowledgement) allows "poured with" and "the word on a page that Adrian grants by hand", and says "nothing automatic". This line is worked out automatically from history. **Adrian should confirm the wording is allowed before it ships.**

### 10. Smaller regressions
- **Reports count:** `ReportsAndRequests.tsx:137,155`. For non-owner staff the "N reports waiting" count is gone, and only the "Hiding takes it off…" line is left.
- **RSVP sheet button:** `RSVPFormSheet.tsx:643`. A pasted `<div><h3>You're on the waiting list…` block is rendered inside the submit `<button>` when the answer is `waitlist`. It is only reachable on by-request tables, so it is not live with the switches off, but it is a markup bug.
- **Cancel by a denied guest:** `PUT /api/rsvp/:token` with cancel by a guest whose status is `denied` (or anything other than confirmed, requested or waitlist) now answers 409 `state_conflict`. On main it set the status to cancelled.
- **Status through `PUT /api/admin/attendees/:id`:** a status other than `cancelled` is now 409 `status_needs_its_route`. The shop UI only sends `cancelled` there (`AttendeeTable.tsx:375-386`), so nothing visible breaks, but other API clients would.
- **Deny and waitlist admin routes:** these now refuse a confirmed guest (409), and deny also refuses a waitlisted guest with a live offer. On main both were allowed, and the seats leaked.
- **Host credit on invoices:** `settleHostCredit` runs on every invoice path, REST and MCP (pay, record, confirm, fulfil, ship, void, cancel, split, convert, claim, checkout). With credit off it reads one invoice row. When the buyer is linked to a user, it also reads `order_session_sources` (`hostCreditLedger.ts:158`). It writes nothing unless earned rows exist, which they do not on live. If its SQL fails (for example, migration 0135 missing), it files a `host_credit_settle_failed` incident. The cost is extra D1 reads on every order action.

### 11. Live queries now depend on new columns (migrations must apply before the worker)
Migrations 0130 to 0147 only add tables and columns, and write no rows. But these live, unswitched paths read new columns:
- `users.hosting_stopped_at` (0141): every RSVP, guest-link claim, invite claim, admin approve and approve-batch, and the platform users list (which also reads `users.host_reach`).
- `events.contribution_kind`, `contribution_note`, `is_tasting` (0130): the public event page, RSVP, guest page, after-sit, duplicate.
- `events.tea_table_hidden_at` (0133): every published-recap query (`RECAP_NOT_HIDDEN`, `publicSitConnections.ts:18`).
- `events.series_id` (0146): duplicate.
- `event_attendees.offer_lapsed_at` and `event_seat_notices` (0134): claim, waitlist, cancel and cron.
- `personal_cellar_items.favourite` (0131): read through the cellar row.
- `member_photographs.credit_name_shown` (0132) and `session_guest_book_photos.show_name` (0130): family photographs and the Guest Book.
- `host_credit_entries` (0135): invoices.

`deploy-worker.yml` applies migrations before `wrangler deploy`, so this holds unless that step fails. Two things to confirm in the first release log:
- 0130 to 0135 sort below 0136, which is already applied. Wrangler applies unapplied files by name, but check that they were all applied.
- Pages deploys main on its own, so the new front end can run against the old worker for a few minutes. Every new call is gated or degrades.

---

## Intended changes that are live with the switches off

- **Waiting list rework (J9, `waitingList.ts`).**
  - Seats are offered only when one is truly free, oldest first, for the claim window, and no offers are made once a session has begun or is not `published`.
  - A lapsed offer is marked and not offered again.
  - Cancel releases every party seat and expires pending companion invites.
  - `spot_claimed` notifications are no longer written.
  - Manage › Notifications gains "What happened to the seats" (`GET /api/admin/events/:id/seat-notices`).
  - Claim answers 410 `offer_expired`.
  - Deny and waitlist are guarded writes, and waitlist positions are taken inside the write.
  - Problems with this rework are items 2 to 4 above.
- **Privacy of family photographs (A4 finding 3).**
  - A placed or lead tea-page photo whose author made it private is no longer public (`familyMedia.ts:77`, public tea family SQL in `familyRoutes.ts`).
  - Setting a tasting private sets `shop_use` back to `none` (`tastingWithdrawal.ts`).
  - A hidden tasting now hides photos matched by author and tea (`PHOTO_TASTING_NOT_HIDDEN`), and quotes (`QUOTE_TASTING_NOT_HIDDEN`, `index.ts:21494`).
- **Quiet acknowledgement (third exception, in force).**
  - Public tea and person photographs name the photographer only with their consent, as a first name (`photograph_by`), and `author` is null otherwise (`familyRoutes.ts:182`). **Every existing photo credit on tea pages disappears until each photographer opts in.**
  - New route `PUT /api/family/photographs/:id/credit`, with a "Show my first name with it" choice on your own photo.
  - Guest Book photos show the taker's first name only if they chose it.
  - Recaps gain `poured_with` ("Poured with …"), which names unpublished co-hosts by first name (`publicSessions.ts:89`).
  - Creator and master pages show the granted word ("Tea creator" or "Tea master") and, for masters, "The true master is one who is forever learning.", in place of the role kicker (`ContributorProfilePage.tsx:385`).
- **Cache headers (A4 finding 4).**
  - `no-store` on `/api/events/:slug/recap` (including 404s) and `/api/people/:slug`.
  - `no-store` on every `/api/family/*` JSON answer.
  - Family media is now `private, no-cache` (was `public, max-age=60` and `private, max-age=3600`) (`index.ts:33990`).
  - The client re-reads recaps, person pages and tea family photos on every mount and focus (`REVOCABLE_QUERY`).
  - The cost is more worker and D1 hits on product and person pages.
- **Recaps.** A recap hidden via `tea_table_hidden_at` is gone everywhere. No row is hidden today.
- **New public fields.**
  - `/api/network/stores`: `cover_image_url` and `next_session` (slug, title, date of the next public session).
  - `/api/events/:slug/tea-menu`: `product_year`, `product_origin_region`, `product_origin_country`.
  - `/api/events/:slug/public`: `contribution_kind` and `contribution_note` (always null today); `is_tasting` for personal tables only.
  - `/api/people`: `pours`.
  - `/api/me/cellar`: `favourite`.
- **Duplicate event.** A copy now keeps `host_user_id`, `door` and `is_tasting` (shop sessions have none of these), and the source event and its menu are written in one batch.
- **Brewing experiences.** Renamed to the Tea Table. `/tea-feed` still sends people to `/`, and `/tea-table` sends them to `/` while the Tea Table is off.
- **Back and forward.** These steps now live in the address: EventDetail tabs, Guest Book review page, guest-book photo preview, person-page photo zoom.
- **Styling.**
  - Tap targets on the ReaderView buttons, the alcove dock and the tasting plate.
  - Toasts span the width up to `max-w-sm`, with no slide-in.
  - The EventDetail tab row wraps instead of scrolling.
  - Bottom-nav CSS gets a minimum button width and a sub-360px inset in `tokens.css`. This is styling only, but it is in a nav component.
- **Article guard.** Host-offered articles (by id prefix) can only be edited or published by the platform owner, and the MCP writing tools refuse them. No such articles exist with the switch off.
- **Incidents.** `recordHealthProblem` and `clearHealthProblem` take an optional account. Existing callers behave as before.

Not measured: the size of the worker bundle. About 6k lines of `worker/src` are added. Run `wrangler deploy --dry-run` and compare with main before shipping.

# Launch 3, anyone can host: the run sheet for Opus 5.5

**Status: ready to run, 2026-11-26.** Written by the Fable build thread from a read of `main` at the Launch 1 ship (`234c312`), before Launch 2 is built. It stands on [the Launch 2 run sheet](guests-and-tea-masters-launch-2-run.md): a host's sessions live in their own private account, `events.host_user_id`, `events.door`, host approval, `/account/host`. Names from that launch's contract are written here as they are proposed there. If they changed while building, change them here before sending any message. The why is in [guests-and-tea-masters.md](guests-and-tea-masters.md), "Step 3: anyone can host" and "Recommendation on B5".

**What a person can do when it launches.** Anyone signed in can host a table. A seat at a stranger's private table always needs the host's yes. Any session and any person can be reported. People who were there see the session's photographs together. A host can make the session a tasting. A guest who cannot come gives the seat back and the next person is offered it.

**Done when** someone Adrian has never met hosts a session that goes well.

## What can start today, before Launch 2 is merged

Adrian, 2026-11-26: "Better to run multiple simultaneously." These five slices touch nothing Launch 2 changes, so they branch from `main` into `build/launch-3` now.

| Slice | Why it is independent |
|---|---|
| J5, reports on a session or a person | New table, new module, reviewed where family reports already are |
| J7, the session gallery | Built on the guest book photographs and the thank-you link that Launch 1 shipped |
| J8, "this is a tasting" | A choice on a session and the existing tasting screens |
| J9 audit, the waiting list and a released seat | Astra reads what exists on `main` and reports before anyone changes it |
| J11, free, by contribution, or a price paid to the host | Two columns and one line of wording |

Everything else waits for Launch 2's contract (H1) and its door rule (H2) to be merged into `build/launch-2`. `build/launch-3` is then brought up to date from `build/launch-2`, not from `main`, until Launch 2 ships.

## Opus, do these first

1. Make `build/launch-3` from `main`. Send J5, J7, J8, J11 and the J9 audit.
2. Run the three checks below.
3. When Launch 2's H1 and H2 are merged, bring them in, write J1 (this launch's contract), then J2 and J3.

## The hard questions, settled

### 1. One kind of session, without moving anyone's old records.

**Evidence.** The second kind of session is the member's private sit: `member_private_sits` (a date, a title, one tea), one invitation per sit accepted by one signed-in person (`member_private_sit_invites`), a private note each (`member_private_sit_notes`), private photographs (`private_member_sit_photos`), and, for some, a published recap at `/sits/casual/:slug` (`casual_sit_publications`, tied to the sit's id with delete-cascade). All in `0109`, `0110`, `0115`; routes under `/api/me/private-sits`.

The plan says to fold these into sessions and carry the old ones over, with a before and after page for Adrian. Carrying them over means writing an account, a session, a guest and a tea for every past sit, and repointing photographs, notes and published recaps, all on people's private records.

**Recommendation.** Do not move them. From this launch, the door that made a private sit (`/account/journey/sit-invite`) makes a hosted table with the by-request door and one seat or more. The old private sits stay exactly where they are, readable as they are today, and their published recaps keep their addresses. Journey lists both kinds in one list, read together at the moment of reading. Nothing old is rewritten, so there is no migration of people's records and nothing can be lost or exposed by one.

**What it costs.** An old private sit never gains a thank-you, seats or a gallery. They are in the past, so they do not need them.

**What would change it.** If Adrian wants old sits to gain the new features. Then the carry-over is built as its own slice afterward, lazily per person, with the before and after page first. It is not on the path of this launch.

### 2. "Anyone can host" is the gate turned inside out.

Launch 2 lets a person host only if Adrian approved them. Launch 3 lets everyone host unless Adrian has stopped them. Recommend keeping both marks: host approval now means "trusted" and unlocks the by-link door and, later, reach; a new mark, `users.hosting_stopped_at`, stops one person. A new flag, `ANYONE_HOSTS_OPEN`, is the launch.

### 3. The floor for strangers in homes.

- A person who is not hand-approved can only use the by-request door. Every seat needs their yes.
- The address and the way in follow the confirmed seat, as Launch 2 made them.
- Every session page and every person's page carries "Report". A report goes to Adrian where family reports already go (`worker/src/familyRoutes.ts`, table `family_reports`). That table's check allows only page, photograph and tasting, and SQLite cannot widen a check without rebuilding the table, so reports on sessions and people get their own small table read by the same review screen.
- A new host's first session cannot be listed anywhere, whatever reach says.
- Adrian can stop a host in one move: no new sessions, no new seats, sessions already confirmed are left for him to decide by hand.

### 4. Reach is three values on the person, set only in Manage, read only by the server.

`users.host_reach`: `invitation` (default; sessions are found only by their link), `teajia` (their open sessions are shown to signed-in people), `listed` (shown on the public sessions list). The third door, "open", arrives here and can only be chosen by a host whose reach is above `invitation`. Reach is never sent to any browser but Adrian's Manage. The public sessions list today shows only the platform owner's sessions (`a.is_platform_owner = 1`, `index.ts:12616`); that one condition widens to include listed hosts.

### 5. The waiting list is already built. Audit first, then add the guest's "I can't come".

`waitlist` is a seat status, offers have claim windows (`claim_expires_at`), and a guest can already cancel from their page (`GuestManagement/CancelConfirmModal.tsx`). So this is Astra's kind of work: prove what happens when a seat is given back while two people are waiting, then patch only what fails. "Same table again" is the existing duplicate route (`handleDuplicateEvent`) offered on the host's page.

### 6. A tasting is a choice on the session, not a new kind of session.

Sessions already carry `event_format` with `private_tasting` and `public_tasting`, and tasting sessions can already be tied to a session (`tasting_sessions.event_id`). Recommend one choice on the host's page, "This is a tasting", which sets the format and opens the existing tasting screens for guests, one tea per screen. It is the one case where the app asks for writing during a session, and only because the host chose it.

## Checks that could change the build

| # | Check | What it changes |
|---|---|---|
| 1 | How many private sits exist, and how many have a published recap (`npm run sandbox:refresh` carries no people, so ask Adrian's Mac for two counts, read only) | Confirms that leaving them in place is small. If thousands of people use them weekly, tell the project chat before J3 |
| 2 | Walk "this is a tasting" on a session in a personal account in the sandbox | If tasting sessions assume shop staff, J8 grows |
| 3 | Read every place the public sessions list is consumed (Home, `/events`, the Advise page) | Decides where a listed host's session can appear, and so what J10 touches |

## The contract (slice J1)

Migration after Launch 2's, columns and one table, no existing row touched:

```sql
ALTER TABLE users  ADD COLUMN hosting_stopped_at TEXT;
ALTER TABLE users  ADD COLUMN hosting_stopped_by TEXT REFERENCES users(id);
ALTER TABLE users  ADD COLUMN host_reach TEXT CHECK (host_reach IN ('invitation','teajia','listed'));
ALTER TABLE events ADD COLUMN contribution_kind TEXT CHECK (contribution_kind IN ('free','contribution','price'));
ALTER TABLE events ADD COLUMN contribution_note TEXT;

CREATE TABLE IF NOT EXISTS session_reports (
  id               TEXT PRIMARY KEY,
  target_kind      TEXT NOT NULL CHECK (target_kind IN ('session','person')),
  target_id        TEXT NOT NULL,
  reason           TEXT CHECK (reason IS NULL OR length(reason) <= 1000),
  reporter_user_id TEXT REFERENCES users(id),
  reporter_seat_id TEXT,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acted','dismissed')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at      TEXT,
  resolved_by      TEXT REFERENCES users(id)
);
```

`events.door` already allows `'open'` in its check (the Launch 2 contract writes all three values, because a check cannot be widened in place). This launch is where routes stop refusing it. **If Launch 2's H1 was written with two values only, fix that before it ships.**

Flag: `src/lib/anyoneHosts.ts`, `ANYONE_HOSTS_OPEN = false`, in the style of `src/lib/firstTable.ts`.

## The slices

| # | Slice | Owner | Starts | Needs from Adrian |
|---|---|---|---|---|
| J1 | The contract | Opus | After Launch 2's H1 and H2 | |
| J2 | Hosting opens to every signed-in person; stopping one host; the by-link door only for trusted hosts | Opus | After J1 | |
| J3 | The private sit door makes a hosted table; Journey lists both kinds | Opus, with Sol for the Journey list | After J2 | His yes to leaving old sits in place (recommended) |
| J4 | "Host a table" in Your Table and on Home | Sol | After J2 | Yes to the two doors' wording and place. Navigation never changes without it |
| J5 | Report a session or a person; Adrian's review | Sol | **Today** | |
| J6 | A host reviews what guests put on their session | Sol | After Launch 2's H4 | |
| J7 | The session gallery for the people who were there; the one-tap photograph | Sol | **Today** | |
| J8 | "This is a tasting" | Sol | **Today** | |
| J9 | The waiting list and a released seat: audit, then patch. "Same table again" | Astra | Audit **today**; patch after Launch 2's H5 | |
| J10 | Reach, set by hand in Manage; the open door | Opus | After J2 | Which of his hosts get which reach, at launch |
| J11 | Free, by contribution, or a price paid to the host | Sol | **Today** | |
| J12 | Agent tools | Sonnet | After J2, J9 | |
| J13 | Browser journey, by a helper that built none of it | Sonnet | Last | |
| A3 | Audit: a stranger's table. The address before the yes, reach never readable, a stopped host, a report that names its reporter | Astra, findings | After J2, J5, J10 | |
| J14 | Truth-up and the ledger | Opus | Last | |

## The messages to send

Each ends with the standing rules block from the Launch 2 run sheet ("The messages to send", second paragraph); paste it in full. Each worker branches from `build/launch-3` and opens its pull request into `build/launch-3`, never `main`.

### Sol, J5: report a session or a person

```
Repository storyoftheleaf/teajia. Branch from build/launch-3 as build/l3-j5-report; pull request into build/launch-3, never main.

Goal: anyone looking at a session or a person's page can tell Adrian something is wrong, in two taps, and Adrian sees it where he already reviews reports.

Approved behaviour:
- Table session_reports exists: id, target_kind ('session' | 'person'), target_id, reason (optional, up to 1000 characters), reporter_user_id (nullable), reporter_seat_id (nullable), status ('open' | 'acted' | 'dismissed'), created_at, resolved_at, resolved_by.
- Write worker/src/sessionReports.ts exporting `fileReport(db, { targetKind, targetId, reason, reporterUserId, reporterSeatId })`, `openReports(db)` and `resolveReport(db, { id, status, actorId })`. fileReport checks the target exists; a signed-out report is allowed and is rate limited by the route. The same reporter reporting the same target twice while the first is open updates the reason and creates no second row.
- The person or host who is reported is never told who reported them, and no route returns reporter fields except to the platform owner. Keep every read of those two columns inside this module.
- Component src/components/shared/ReportLink.tsx: the quiet word "Report" that opens a small panel with one optional text field and "Send". After sending: "Thank you. Adrian will look at this." Mount it at the foot of src/components/events/EventLanding.tsx and of a person's page (find the existing report control for a family page and place this beside the same pattern; do not move or rename anything there).
- Adrian's review: find the screen that lists family_reports today (routes in worker/src/familyRoutes.ts near lines 624 to 700) and add session and person reports to the same list as two more kinds, each with "Acted" and "Dismiss". Nothing is deleted or hidden automatically by a report.
- No count of reports is shown to anyone but Adrian. Nothing ranks or flags a person publicly.

You own: worker/src/sessionReports.ts, src/components/shared/ReportLink.tsx, the two mount lines, the added rows in the review screen, worker/tests/session-reports.test.ts.
Do not touch: worker/src/index.ts, worker/migrations/, worker/src/familyRoutes.ts (read it for the pattern; name the lines you need wired), src/lib/api.ts, any navigation.

Acceptance check: worker/tests/session-reports.test.ts proves a report is filed signed in and signed out, a repeat updates, an unknown target is refused, resolve works once, and no exported function returns reporter fields unless asked with the platform owner's flag.

Then the standing rules. Report back: the branch, test output, the lines to wire.
```

### Sol, J7: the session gallery

```
Repository storyoftheleaf/teajia. Branch from build/launch-3 as build/l3-j7-gallery; pull request into build/launch-3, never main.

Goal: the people who were at a session see its photographs together in one place, and adding one is a single tap.

What exists: guests add a photograph through the guest book on the after-sit page (src/components/events/GuestBook.tsx, GuestBookPhotos.tsx; worker/src/sessionGuestBookPhotos.ts), each guest decides whether theirs is offered, and the host reviews them. Photographs are served through a revocable path, never a public address. The after-sit page is opened by a per-seat link (src/pages/AfterSitPage.tsx).

Approved behaviour:
- On the after-sit page, a section "Photographs from the table": every photograph that its taker offered and the host has not hidden, newest first, as a grid that wraps. Tapping one opens it large with "photograph by <first name>" when the taker allowed their name, else no name. No likes, no counts, no comments.
- Only people with a valid seat link for this session, and the host, can see it. It is not on the public session page or the public recap.
- A guest can take their own photograph out at any time (the existing withdraw); it leaves the gallery at once.
- "Add a photograph": one tap opens the camera or library. This is one of the places that already keeps the original with a frame, so follow exactly what GuestBookPhotos.tsx does today for picking and framing; do not add a second cropper.
- Read what the server already returns for the guest book photographs (the 'photos-read' action in worker/src/afterSitAccess.ts). If the gallery needs other guests' offered photographs and that action returns only the caller's own, do not change the worker: report the exact gap.

You own: a new src/components/events/SessionGallery.tsx, its mount line in src/pages/AfterSitPage.tsx, tests/session-gallery.spec.ts.
Do not touch: worker/, src/lib/api.ts, src/lib/afterSitAccess.ts, GuestBook.tsx's behaviour.

Acceptance check: tests/session-gallery.spec.ts at 390 by 844 with mocked routes: three offered photographs show, a withdrawn one does not, the large view names the taker only when allowed, no horizontal overflow. tests/after-sit-guest-book-photos.spec.ts still passes.

Then the standing rules. Report back: the branch, what you ran, any gap in what the server returns.
```

### Sol, J8: this is a tasting

```
Repository storyoftheleaf/teajia. Branch from build/launch-3 as build/l3-j8-tasting; pull request into build/launch-3, never main.

Goal: a host can say a session is a tasting. Only then are guests offered a screen per tea to write on during the session. For every other session the app asks nothing while people are sitting.

What exists: sessions carry event_format, with 'private_tasting' and 'public_tasting' among its values (src/types/events.ts). Tasting sessions with join codes exist and can belong to a session (tasting_sessions.event_id; routes near worker/src/index.ts line 24414; the page at /session/:id).

Approved behaviour:
- One choice in the session editor (src/admin/components/EventForm/): "This is a tasting. Guests can write about each tea as it is poured." Off by default. On sets event_format to 'private_tasting'; off returns it to what it was.
- When on, a confirmed guest's page shows one button on the day of the session, "Open the tasting", leading to the existing tasting session for that event, one tea per screen in pouring order, each with the existing tasting inputs. No timer, no prompt, no notification. A guest who never opens it is asked nothing.
- When off, nothing about tasting appears on the guest's page during the session.
- Paper notes afterward: on the after-sit page, when the session was a tasting, one line "Wrote on paper? Add your notes" leading to the journal with the tea filled in (the journal reads ?tea=<productId> and ?chest=<chestItemId>; see src/pages/JournalPage.tsx).

You own: the one choice in src/admin/components/EventForm/, the button in src/components/events/GuestManagement/ConfirmedView.tsx, the line on src/pages/AfterSitPage.tsx, tests/session-tasting.spec.ts.
Do not touch: worker/, src/lib/api.ts, the tasting screens themselves.

Acceptance check: tests/session-tasting.spec.ts with mocked routes: the choice saves and survives reload; the button shows only when the choice is on and the guest is confirmed; the paper line shows only for a tasting.

Then the standing rules. Report back: the branch, what you ran, and whether creating the tasting session for an event needed a call that does not exist.
```

### Sol, J11: free, by contribution, or a price paid to the host

```
Repository storyoftheleaf/teajia. Branch from build/launch-3 as build/l3-j11-contribution; pull request into build/launch-3, never main.

Goal: a session can say whether it is free, by contribution, or has a price, in the host's own words. Money never moves through Teajia: this is wording only.

Approved behaviour:
- Columns events.contribution_kind ('free' | 'contribution' | 'price', nullable) and events.contribution_note (text, nullable) exist and the event update route accepts both.
- In the session editor (src/admin/components/EventForm/): three plain choices and "say nothing" (the default, stores NULL), and one optional line up to 140 characters, for example "Bring what you like" or "150k, paid to me on the day".
- On the public session page (src/components/events/EventLanding.tsx): one line. "Free." / "By contribution." / the host's line. When there is a note it follows the first word. When nothing is stored, nothing is shown.
- No amount field, no currency, no pay button, no link to any payment. Do not parse numbers out of the note.

You own: the control in src/admin/components/EventForm/, the line in EventLanding.tsx, tests/session-contribution.spec.ts.
Do not touch: worker/, src/lib/api.ts, anything under pay or checkout.

Acceptance check: the spec covers each choice, the empty default, and a 141-character note refused.

Then the standing rules. Report back: the branch and what you ran.
```

### Astra, J9: the waiting list and a released seat (audit today, patch after)

```
Repository storyoftheleaf/teajia, branch main for the audit. Part one is read only and returns findings. Part two, sent later, is a patch.

Contract: a session never has more confirmed guests than seats. When a confirmed guest gives up their seat, the longest-waiting guest is offered it for a limited time, and if they do not take it the next is offered. The host is told. Nobody is offered a seat twice at once, and nobody loses a seat they hold because of someone else's action.

What exists: seat statuses requested, confirmed, waitlist, cancelled, denied on event_attendees; held and confirmed party seats on event_party_members; offers with claim_expires_at; a claim window per session (claim_window_minutes); guest cancellation from the guest's page (src/components/events/GuestManagement/); host routes approve, deny, waitlist, approve-batch (worker/src/index.ts near lines 31689 to 31695).

Part one, evidence to produce on main:
1. The exact sequence when a confirmed guest cancels with two people waiting. Who is offered, how they learn of it, and what the count is at each step.
2. Two guests cancelling at once with one person waiting; one guest cancelling while the host approves a new request; an offer expiring at the same moment it is claimed.
3. A guest with a plus-one cancelling: one seat or two given back.
4. A waiting guest whose offer expired: are they offered again later, or stuck.
5. Seats lowered by the host while offers are open.
6. A cancelled guest's access to the address and the way in afterwards.
7. Whether the host is told, and by what (the worker never messages the owner of the site; a host's notice is theirs).
8. handleDuplicateEvent and handleCreateNextEvent: what a duplicate carries over (guests, offers, address, door) and whether any of it should not.

Return: numbered findings with severity (a seat counted twice, a seat lost, or cosmetic), the evidence, and for what holds, how you proved it. Do not fix in part one.
```

### Astra, A3: a stranger's table (findings)

```
Repository storyoftheleaf/teajia, branch build/launch-3. Read only. Findings with a failing test or exact reproduction each.

Launch 3 lets any signed-in person host. Prove or break each:
1. A host who is not hand-approved cannot make or change a session to the by-link or open door by any route or tool.
2. At a by-request door, nothing that locates the house (address, map link, the steps, their photographs, a venue's photographs, a saved place's name if it is an address) reaches a guest before the host's yes, or after the yes is withdrawn.
3. users.host_reach is returned to no browser session but the platform owner's, appears in no public answer, and cannot be inferred from which sessions a signed-out person can list beyond the fact that a session is listed.
4. A host's first session is never listed, whatever their reach.
5. A stopped host (users.hosting_stopped_at): no new session, no new seat on existing ones, existing confirmed guests keep what they had. Stopping is not visible to guests as a reason.
6. Reports: the reported person cannot learn who reported them through any route, tool, export or timing; a report cannot be filed against a target that does not exist to probe for private sessions.
7. Old private sits (member_private_sits and their notes, photographs and publications) are exactly as readable and as private as before this launch.
8. A person who hosts and is also a guest at another table sees nothing of the other host's private guest book or guests' contacts.

Return: numbered findings with severity and evidence; one line of proof for each item that holds.
```

J2, J3, J10 and J14 are Opus's own and need no message. J4, J6, J12 and J13 are written by Opus from this sheet once Launch 2's names are final, in the shape of the Launch 2 messages H4, H12 and H13: J4 is two doors ("Host a table" in the Sessions view of Your Table and one plate on Home, both only after Adrian's yes); J6 mounts the existing guest book review (`/api/admin/events/:id/guest-book`) in the `after` part of the host's page; J12 adds `report`, `release_my_seat`, `same_table_again`, `set_session_tasting` and, for the platform owner only, `set_host_reach` and `stop_host`.

## The journey Opus runs last

1. **A stranger signs up** and opens "Host a table". They make a table. Only the by-request door is offered.
2. **A guest asks for a seat.** No address. The host says yes. The way in appears.
3. **A second guest** asks when the table is full and is told they are waiting. The first guest taps "I can't come". The second is offered the seat, takes it, and the count never passes the seats.
4. **The host makes it a tasting.** The confirmed guest sees "Open the tasting" on the day, and a guest at an ordinary session sees nothing of the kind.
5. **Afterward** the guests see each other's offered photographs together on the thank-you. One takes theirs out; it is gone.
6. **A guest reports the session.** Adrian sees it in his review list. The host sees nothing.
7. **Adrian stops the host.** No new table, no new seat.
8. **Adrian gives a trusted host reach "listed".** Their open session appears on the sessions list. Their reach appears nowhere a guest or the host can read it.
9. **A person with an old private sit** opens Journey: the old sit is there, unchanged, beside their new tables. Its published recap still opens at its old address.
10. **Flag off.** Hosting is by invitation again, exactly as after Launch 2.

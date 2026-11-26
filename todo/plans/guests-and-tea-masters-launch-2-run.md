# Launch 2, a few hosts: the run sheet for Opus 5.5

**Status: ready to run, 2026-11-26.** Written by the Fable build thread from a read of `main` at the commit that shipped Launch 1 (`234c312`). Same shape as [the Launch 1 run sheet](guests-and-tea-masters-launch-1-run.md): what Opus does first, the hard questions settled from the code, the contract, the slices, a message per worker, and the journey that proves it. The why is in [guests-and-tea-masters.md](guests-and-tea-masters.md), "Step 2: a few hosts, by hand". Where this file and [the build file](guests-and-tea-masters-build.md) differ on Launch 2, this file is the newer one and the differences are listed.

**What a person can do when it launches.** Three to five people Adrian trusts each host their own table. A host gives a day and a time and holds a link. Guests take a seat by name. The host says yes, and only then does the guest see the way to the house. The host adds any tea, sends the thank-you Adrian used in Launch 1, and keeps a private line about each guest.

**Done when** each of those hosts has run a session without asking Adrian how.

## Opus, do these first

1. **Close the address leak, before anything else.** See hard question 1. It affects Adrian's own sessions on the live site today, it is a repair and needs no flag, and it can ship alone on his "ship". Start Astra's read-only audit (message A1) at the same moment, on `main`.
2. **Make the integration branch** `build/launch-2` from `main`.
3. **Run the four checks** under "Checks that could change the build". The first one decides how large this launch is.
4. **Write slice H1** (the contract) and merge it. Then send the messages marked "after H1".

## Who does what

Unchanged from Launch 1. Opus 5.5 owns the build, every shared file, and anything touching what is stored, who sees what, sign-in or navigation. GPT-6.2 Sol (`gpt-6.2-sol`) builds settled, bounded pieces. GPT-6.2 Astra (`gpt-6.2-astra`) takes the work where details are easy to get wrong and every audit. Sonnet 5.5 helps in the cloud with tools, browser checks and a first read of every GPT pull request. Haiku 5.5 runs errands. Sol and Astra run through the Codex CLI bundled in the ChatGPT app on Adrian's Mac, in sibling worktrees, with `-s workspace-write` (audits `-s read-only`); the details are in project memory, `codex-on-adrians-mac`.

Shared files only Opus edits: `worker/src/index.ts`, `src/App.tsx`, `src/lib/store.ts`, `src/lib/api.ts`, `src/types.ts`, `src/styles/tokens.css`, `worker/migrations/`, `worker/src/mcpTools/registry.ts`, `worker/src/sessionTeas.ts`, `CLAUDE.md`, `docs/PILLAR.md`, the build files, and every navigation component.

## What Launch 1 taught that matters here

- Shop order statuses are Draft, Pending, Filled and Void. There is no "Paid".
- An order joins to where it came from through `inquiries.converted_invoice_id`. `invoices.source_inquiry_id` is empty for a converted bag request.
- `order_session_sources.host_user_id` is the user of the session's `lead_host` contributor. A small host has no contributor row yet, so hard question 6 below gives every hosted table a host that this can read.
- In the cloud container, `account-panel-mobile` "manage door", two Tea Master profile tests and `curate-holdings-read-budget` fail on `main` already. They are not this launch's.

## The hard questions, settled

### 1. The public session answer carries the address. Fix it first.

**Evidence.** `handleGetEventBySlug` (`worker/src/index.ts:12406`) selects `address_text`, `map_link`, `venue_guide` and the venue's photographs, and returns everything it selected except two fields (`const { account_id, reading_article_id, ...publicEvent } = event`). The page hides them: `src/components/events/EventLanding.tsx:726` says "full address shown after approval". But anyone holding a session's link can read the address, the map link and the photographed way in by asking `/api/events/<slug>/public` directly. The guest's own page does it right and gates the same fields on a confirmed seat (`index.ts:12957`). Read from the code; not yet tried against the live site.

**Recommendation.** The public answer never carries `address_text`, `map_link`, `venue_guide` or venue photographs. It carries `location_name` and `area_hint` only. This is slice H0, Opus's, with a worker test that fails if any of the four reappears. Astra's audit A1 then walks every other door an address could leave by (the store's session list, the network list, recaps, duplicated sessions, share messages, agent tools, the cached copy).

**What would change it.** If Adrian wants the address public for sessions held at a public tea house. Then a session's place is marked public by hand and only those carry it. Default until he says so: never.

### 2. A host's account already exists in the code. Use it, and approve hosts the way sellers are approved.

**Evidence.** A person who opens a Tea Chest gets a small private account of kind `master`, one per person, made on demand by `handlePersonalInventoryAccount` (`index.ts:16366`). Its owner holds every permission, so the existing session routes (`requireBundle(…, 'gather')`) already work for it. Adrian approves who may sell from such an account by hand, through `worker/src/personalSellerApproval.ts`, with the mark kept on the person (`0120`, `0121`) so it can be given before they open anything.

**Recommendation.** A host's sessions belong to that same personal account, which is what the plan's "Recommendation on B5" asks for. "Made by Adrian by hand" becomes "approved by Adrian by hand": a new mark, host approval, copied exactly from seller approval. No new kind of account, and Launch 3's "anyone can host" becomes lifting this one gate plus carrying the old private sits over. The separate "create a Tea Master account" route in Settings stays as it is and is not used for small hosts.

### 3. A private account's session cannot be opened by link today. One rule changes, and it is the riskiest line in the launch.

**Evidence.** Every public session read requires `a.public_enabled = 1` on the account (`PUBLIC_EVENT_HOST`, `index.ts:12401`). A personal account is born private, so a host's link would answer "Event not found". Turning the account public instead would expose their shelf and shop page, which they did not ask for.

**Recommendation.** One function, `publicSessionHostSql(account)`, in a new `worker/src/hostApproval.ts`: true for a public active account as today, and also for an active personal account whose owner is an approved host. It replaces the constant for direct session reads only (the session page, its tea list, taking a seat, the guest's own page, the after-sit link). It does not replace it for store pages, product reads or any list. Opus writes it (slice H2); Astra's audit A2 proves that opening this door opens nothing else of a private account.

### 4. The arrival walkthrough is mostly built. The work is privacy, the photo editor and reuse.

**Evidence.** `events.venue_guide` already holds steps, each with a line and a photograph, plus parking, transit and arrival notes (`src/types/events.ts:57`). Hosts edit it in `src/admin/components/EventForm/sections/VenueGuideSection.tsx`, guests see it step by step in `src/components/events/VenueGuide.tsx` once confirmed (`GuestManagement/ConfirmedView.tsx`), and `saved_locations` already keeps a guide per place for reuse.

**What is missing.** Four things. It leaks through the public answer (question 1). The step photograph is a bare file input, which breaks the standing rule that every photo goes through the one photo editor. It stays visible after the session ends, where the plan says until it ends. And nothing makes it readable without signal.

**Recommendation.** Keep the data shape. Opus gates it on "confirmed and the session has not ended" (H7). Sol rebuilds the host's editor on the shared photo editor and the guest's reader for a phone in one hand (H8). Whether the photographs themselves can still be fetched by address after a guest is removed is for Astra's A2 to prove; if they can, they move to the revocable photo path that `worker/src/revocableSitPhotos.ts` already provides.

**Without signal.** Recommend the smallest thing that works: when a confirmed guest opens the walkthrough, the page keeps the steps and their photographs on the phone, and removes them when the page is next opened after the session has ended. Check 3 decides whether the browser's cache is enough or a small saved copy is needed. Say plainly to hosts that a guest can always take a screenshot; no software stops that.

### 5. Two doors for a small host in this launch, not three.

**Evidence.** A session already has `requires_approval` and `public_visibility` ('public', 'unlisted', 'private'). The network list shows only the platform owner's sessions (`a.is_platform_owner = 1`, `index.ts:12616`), and a private account has no public store page. So an "open" session from a small host would be listed nowhere.

**Recommendation.** By request (the host says yes to each guest; the default at a private table) and by link (whoever holds the link has a seat until seats run out). Both are unlisted. "Open" arrives in Launch 3 together with reach set by hand (L3-08), when there is somewhere for an open session to be seen. A walkthrough at a by-link session is still shown only to a guest with a confirmed seat.

### 6. A session has a host even when the host has no public page.

**Evidence.** "Hosted by" on the public page reads `event_contributors` joined to published contributor pages (`index.ts:12447`). A new host has neither, so their session would name nobody, and an order from their thank-you would record no host.

**Recommendation.** `events.host_user_id`, set when a table is made. The page says "Hosted by" and the host's first name as plain words when there is no published page, and links the page when there is one. Others pouring stay `event_contributors` with roles `co_host` and `guest_host`, shown as "Pouring". The word master appears nowhere on a session. `recordOrderSessionSource` reads `host_user_id` first and the lead host contributor second.

### 7. Teajia's tea on a host's session must be able to link to Teajia's shop.

**Evidence.** `resolveSessionTeas` (`worker/src/sessionTeas.ts`) treats a product from any other account as a plain name, on purpose, "so a menu can never reach into an unrelated account". So a host who pours Adrian's tea today gets a name with no page, and the thank-you cannot lead a guest to it. That is the business reason for the whole plan.

**Recommendation.** One narrow opening: a tea on any session may point at a product of the platform owner's shop when that product is public, shown in the shop and active. Nothing else crosses accounts. Opus makes the change (H6, with the tea picker's server side); Astra's A2 tries to make it show a hidden or draft product.

### 8. Taking a seat by name: the contact becomes optional at a by-link door only.

**Evidence.** `handleRSVP` (`index.ts:12636`) requires a name and a phone or email, finds duplicates by contact, and creates a customer in the host's account. The plan says a guest gives a name and has a seat, and that contact details stay in the host's WhatsApp (B12).

**Recommendation.** At a by-link door, a name is enough; the guest is shown their own private page link at once and told to keep it. At a by-request door, contact stays required, because the host has to be able to answer. No customer row is created for a guest who gave no contact. The subtle parts (two taps, two guests with one name, a full table, a door changed after links went out, finding a seat again with no contact) go to Astra as a patch, slice H5.

### 9. Seats: a number is always stored.

The plan lets a host leave seats out and shows no limit. Seat counting, held seats, the waiting list and claim windows all assume a number (`total_capacity INTEGER NOT NULL`). Recommend the one screen shows seats already filled in as 6 and editable, so a host still types only a day and a time. Unlimited seats is left out of this launch.

### 10. "Free, and your record is yours" is said only when the second half is true.

Nothing lets a host take their record away today. Recommend the wording waits for Q5 and for a small export (their sessions, the names guests gave, teas poured, their private lines, as one file), slice H11. Until then the site says nothing about it.

## Checks that could change the build

| # | Check | How | What it changes |
|---|---|---|---|
| 1 | A session in a personal account, end to end | In the sandbox, as a user with a Tea Chest account: create a session through the existing routes, take a seat, approve, open the guest page, complete it, copy the guest link, open the thank-you. Write down everything that assumes a shop (a shop name shown as host, a WhatsApp number, notices, customers) | This is the plan's "one check before building". A short list means the slices below stand. A long one means H3 and H4 grow, and Opus says so in the project chat before sending them |
| 2 | Contact on a seat | Read `event_attendees`: are `phone_number` and `email` nullable, and what else reads them as present (recovery, notices, the customers join) | Decides whether H5 is a change of rule or also a change of shape |
| 3 | The walkthrough without signal | Open a confirmed guest page with a three-step guide on a phone-sized browser, go offline, reload | If it survives, H8 only adds clearing after the end. If not, H8 adds the saved copy |
| 4 | The leak, seen | In the sandbox, give a session an address and a guide, then fetch `/api/events/<slug>/public` signed out | Expected: all four fields present before H0, absent after |

## The contract (slice H1)

**Migration**, the next free number after `0128`, `worker/migrations/0129_few_hosts.sql`. Columns and one table only, no existing row touched, so there is no before and after page for Adrian.

```sql
ALTER TABLE users    ADD COLUMN host_approved_at TEXT;
ALTER TABLE users    ADD COLUMN host_approved_by TEXT REFERENCES users(id);
ALTER TABLE accounts ADD COLUMN host_approved_at TEXT;
ALTER TABLE accounts ADD COLUMN host_approved_by TEXT REFERENCES users(id);

ALTER TABLE events ADD COLUMN host_user_id TEXT REFERENCES users(id);
ALTER TABLE events ADD COLUMN door TEXT CHECK (door IN ('request','link','open'));

CREATE TABLE IF NOT EXISTS host_guest_notes (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  attendee_id  TEXT NOT NULL,
  note         TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 500),
  updated_at   TEXT NOT NULL,
  UNIQUE (host_user_id, event_id, attendee_id)
);
```

`door` NULL means an older session, read as today from `requires_approval`. The check allows `'open'` because a check cannot be widened later without rebuilding the table, but every route refuses `'open'` until Launch 3. A hosted table always sets `door`, `requires_approval` to match it, `public_visibility = 'unlisted'` and `network_discovery = 0`.

**Flag.** `src/lib/fewHosts.ts`, `FEW_HOSTS_OPEN = false`, with `fewHostsOpen(env)` in the exact style of `src/lib/firstTable.ts`. Two gates stand together: the flag, and the person's host approval. Every new write route answers 404 unless both hold.

**New module, Opus's:** `worker/src/hostApproval.ts`, copied in shape from `personalSellerApproval.ts`: `hostApprovedSql(account)`, `publicSessionHostSql(account)`, `hostApproved(db, userId)`, `setHostApproval(db, userId, approved, actorId)`.

**Routes**, all wired by Opus:

| Route | Who | Does |
|---|---|---|
| `PUT /api/platform/users/:id/host-approval` `{ approved }` | The platform owner | Approves or withdraws a host, beside the seller approval route (`index.ts:16761`) |
| `GET /api/me/hosting` | A signed-in user | `{ approved, account_id }`; makes nothing |
| `POST /api/me/tables` `{ date, time, timezone, seats?, door?, name? }` | An approved host | Makes their personal account if they have none, then one session. Calls `createHostedTable` (Sol, H3). Returns `{ id, slug, link }` |
| `GET /api/me/tables`, `GET /api/me/tables/:id` | The host | Their sessions; one session with guests, teas, door, link |
| Existing `/api/admin/events/:id/…` and `/api/admin/attendees/:id/…` | The host, with their own account active | Guests, approve, deny, attendance, tea menu, complete, guest link. Unchanged |
| `PUT /api/me/tables/:id/guests/:attendeeId/note` `{ note }`, `GET /api/me/tables/:id/notes` | The host only | The private guest book (Sol, H9) |
| `GET /api/me/record` | The host | The export (H11, after Q5) |

**Addresses.** `/account/host` (make a table) and `/account/host/:id` (one table, with `?part=guests|teas|way|after` as steps through `useStepParam`). Both are new routes, added by Opus. See the question to Adrian about the door to them.

## The slices

| # | Slice | Owner | Starts | Files it owns | Proven by |
|---|---|---|---|---|---|
| H0 | The public session answer never carries an address | Opus | Now, ships alone | The projection in `handleGetEventBySlug`, new `worker/tests/public-session-no-address.test.ts` | The test; check 4 |
| A1 | Audit: every door an address can leave by | Astra, findings | Now, on `main` | Read only | Its evidence list |
| H1 | The contract: migration, flag, `hostApproval.ts`, route stubs, a sandbox fixture with one approved host and one finished hosted table | Opus | After the checks | Shared files, `worker/src/hostApproval.ts`, `src/lib/fewHosts.ts`, `worker/sandbox/` | Migration applies; `npm run lint`; `npm run lint:worker-types` |
| H2 | An approved host's session opens by link while their account stays private; "hosted by" from `host_user_id` | Opus | After H1 | `index.ts` session reads, `worker/src/orderSessionSource.ts` | New `worker/tests/hosted-session-doors.test.ts` |
| H3 | Host a table on one screen | Sol | After H1 | New `worker/src/hostTable.ts`, new `src/pages/HostTablePage.tsx`, new `worker/tests/host-table.test.ts` | The worker test; a day and a time to a link in under a minute |
| H4 | The host's page for one table: the link, the guests, yes and no, the door, seats | Sol | After H3 | New `src/pages/HostedTablePage.tsx`, new `src/components/host/` | New `tests/host-guests.spec.ts` at 390 wide |
| H5 | A seat by name | Astra, patch | After H2 | New `worker/src/seatRequest.ts`, new `worker/tests/seat-request.test.ts`, the exact handler lines for Opus | The cases in its message, each a test |
| H6 | Any tea on a session: Teajia's shop first, the host's chest second, a typed name last | Opus for the server, Sol for the picker | After H4 | Opus: `worker/src/sessionTeas.ts`. Sol: new `src/components/host/HostTeaPicker.tsx` | Q4 answered; `public-session-teas.test.ts` extended |
| H7 | The walkthrough is shown only to a confirmed guest and only until the session ends | Opus | After H0 | The guest page projection (`index.ts:12940` on) | Extends `hosted-session-doors.test.ts` |
| H8 | The walkthrough editor on the shared photo editor, reused per table, and the guest's reader that works without signal | Sol | After H4, H7 | New `src/components/host/WalkthroughEditor.tsx`, `src/components/events/VenueGuide.tsx` | New `tests/host-walkthrough.spec.ts` |
| H9 | The host's private guest book | Sol | After H4 | New `worker/src/hostGuestNotes.ts`, new `src/components/host/GuestBookPrivate.tsx`, new `worker/tests/host-guest-notes.test.ts` | The worker test |
| H10 | "Hosted by" and "pouring", the photograph line, and "please not me" | Sol | After H2 | `src/components/events/EventLanding.tsx`, the seat form, the guest row in `src/components/host/` | New `tests/host-words.spec.ts` |
| H11 | Approving a host in Settings; the profile wording; the free-and-yours wording with the export | Opus | Approval after H1; wording after Q5 | `src/admin/` Platform screen, `src/pages/AccountProfilePage.tsx`, new `worker/src/hostRecord.ts` | Sandbox; his words |
| A2 | Audit: a private account stays private, the walkthrough stays with its guest, the tea link cannot show a hidden tea, the guest book is the host's alone | Astra, findings | After H2, H5 to H9 | Read only | Its evidence list |
| H12 | The same actions as agent tools | Sonnet | After H3, H9 | New `worker/src/mcpTools/fewHosts.ts` | A worker test: each write previews, then confirms |
| H13 | Browser journey for the launch, by a helper that built none of it | Sonnet | After H3 to H10 | New `tests/few-hosts.spec.ts` | Phone and desktop sizes against the sandbox |
| H14 | Truth-up of `docs/PILLAR.md`, `docs/CHANGELOG.md`, `docs/STATE_OF_THE_SITE.md`, the ledger | Opus | Last | `docs/` | The documents say what shipped |

**Side by side.** H0 and A1 now. After H1: H2 (Opus) with H3 (Sol). After H3: H4. After H4: H8, H9, H10 on the Mac with H6 beside them, which is the ceiling of four. **In order:** H1, H2, H5. H3, H4, then the rest. **Waiting on Adrian:** H6's cross-shop link (Q4), H11's wording (Q5), and the door to "Host a table". Everything else moves without him.

## What Adrian is asked, and what he can try

- **First, a repair worth shipping today.** Anyone holding a session link can read that session's address by asking the site directly, though the page hides it. H0 closes it. Say "ship" for it alone when Opus reports it ready.
- **Try this when H3 is on the preview link:** from your phone, make a table with only a day and a time, and send yourself the link. If it took more than a minute or asked you anything you did not want to answer, say what.
- **Q4.** May a host put any tea on a session, from anywhere, with no price? And may a session of theirs link your teas to your shop? Recommended: yes to both.
- **Q5.** May the site tell hosts it is free and their record is theirs to take away? Recommended: yes, once the export exists.
- **The door to "Host a table".** It needs somewhere to be found, and navigation never changes without your yes. Recommended: one line inside the Sessions view of Your Table, shown only to hosts you approved. No bar word, no new tile. Until you answer, approved hosts reach it by its address.
- **Two doors now, the third later.** By request and by link in this launch; open comes with Launch 3. Say so if you want open now.
- **Who the first hosts are.** Their emails, when the launch is ready. You approve each in Settings.

## What changed from the build file

| Build file | This run sheet | Why |
|---|---|---|
| L2-01, an account made by Adrian by hand | The person's own Tea Chest account, with host approval by hand | It exists, and it is Launch 3's model too |
| L2-03, three doors | Two: by request and by link | An open session from a private host is listed nowhere until Launch 3 |
| L2-05, build the arrival walkthrough | Fix its privacy, put it on the photo editor, make it reusable and readable without signal | The guide itself is already built |
| L2-02, seats optional | Seats prefilled as 6 | Every seat rule assumes a number |
| Not in the build file | H0, the address in the public answer | Found reading the code |
| L2-07 and L2-08 | One slice, H10 | Same files, both small |

## The messages to send

Each is complete without this file. Replace any name that changed in H1 before sending. Every worker branches from `build/launch-2` and its pull request goes into `build/launch-2`, never `main`. Append the shared block from `todo/plans/launch-1-prompts/common.txt` if it is still current.

Rules that go at the foot of every Sol message (shortened below as **"the standing rules"**): colours only from tea-text, tea-surface, tea-bg, tea-elevated, tea-gold, tea-gold-lt, tea-border, tea-accent-sub, tea-text-sec, tea-text-dim; border-tea-border takes no opacity modifier; headings and body through TYPOGRAPHY_CLASSES, raw sizes as text-ui-N, never text-[Npx]; no horizontal scroll, use flex-wrap; anything tappable under 44 by 44 gets tap-target; the phone's bottom bar overlaps content, so use the pb-nav classes from card-utilities.css, never an inline calc(); a step (a tab, a screen, an open panel) lives in the address through useStepParam, never useState alone; any photograph a person adds goes through usePhotoEditor (src/components/shared/usePhotoEditor.tsx), never a bare file input; no em dashes in any wording; the word "master" never appears on a session; the app never asks anything of a guest while a session is under way. Verify in the sandbox (npm run sandbox, sign in sandbox / sandbox), never npm run dev, which edits the real shop. Run npm run lint, npm run lint:worker-types and npm run lint:colors. If you need a change in a file you do not own, or a product decision, stop and send the exact conflict.

### Astra, A1: every door an address can leave by (findings)

```
Repository storyoftheleaf/teajia, branch main. Read only. Return findings, each with a failing test or an exact reproduction. Do not fix.

Contract: the address of a session (events.address_text, events.map_link), the photographed way in (events.venue_guide, a JSON guide whose steps carry image addresses) and a venue's photographs (venues.photos) may be read only by a guest whose seat on that session is confirmed, and by the host. Nobody else, by any route, cached copy or tool.

Known already: handleGetEventBySlug in worker/src/index.ts (near line 12406) returns all four to anyone, because it returns every selected column except two. That is being fixed separately. The guest's own page (near line 12940) gates them on a confirmed seat; treat that as the model.

Evidence to produce:
1. Every handler in worker/src/index.ts, worker/src/publicSessions.ts, worker/src/mcp.ts and worker/src/mcpTools/ that selects or returns any of the four, or saved_locations.address / map_link / venue_guide, or venues.address / arrival_notes. For each: who can call it, and whether it holds the contract.
2. The lists: /api/events, /api/s/:slug/events, /api/products/:id/events, any recap or share-message route. Any that carry a location beyond location_name and area_hint.
3. Caching: handleGetEventBySlug answers through cachedJson for 30 seconds. After the fix ships, can a stale copy still serve an address, and for how long.
4. The guest's page: a guest whose seat was confirmed and then denied, waitlisted or cancelled; a guest of a different session of the same host; a plus-guest invite not yet claimed. What each can read.
5. The step photographs: where they are stored, whether the address of a photograph can be fetched by someone who is not a confirmed guest, and whether it still can after the guest is removed or the session ends.
6. Duplicated and "next" sessions (handleDuplicateEvent, handleCreateNextEvent) copy the address and guide. Confirm the copies are no more visible than the original.
7. Agent tools (get_event, list_events and the public /mcp/public surface): what location fields each returns and to which scope.

Return: a numbered list with severity (address readable by a stranger, by a non-confirmed guest, or cosmetic), the evidence, and for doors that hold, one line on how you proved it.
```

### Sol, H3: host a table on one screen

```
Repository storyoftheleaf/teajia. Branch from build/launch-2 as build/l2-h3-host; pull request into build/launch-2, never main.

Goal: an approved host gives a day and a time and holds a link to send, on one screen, in under a minute.

Approved behaviour:
- Server. Write worker/src/hostTable.ts exporting `createHostedTable(db, { userId, accountId, date, time, timezone, seats, door, name })` and the pure helpers it needs. It inserts one row into events with: account_id = accountId; host_user_id = userId; title = name when given, else "<Weekday> at <first name>'s table" (first name from users.name; "a table" when there is none); slug = a short readable stem plus at least 10 random characters from crypto, because at a by-link door the link is the only key; event_date from date, time and timezone; total_capacity = seats (default 6, whole number from 1 to 40); door = 'request' (default) or 'link'; requires_approval = 1 for 'request', 0 for 'link'; public_visibility = 'unlisted'; network_discovery = 0; status 'active' with its matching lifecycle_status (read EVENT_LIFECYCLE_BY_STATUS in worker/src/index.ts for the pair; do not edit that file). Name every column you rely on in the INSERT; do not lean on table defaults.
- Refuse a date in the past, a missing time, and seats outside 1 to 40, each with a plain sentence.
- The route POST /api/me/tables is wired by the build owner. It has already checked that the launch is open and the person is an approved host, and it passes you the account.
- Page. src/pages/HostTablePage.tsx at /account/host: a day, a time (the browser's own date and time inputs, timezone taken from the device and shown in words), seats already filled in as 6, the door as two plain choices ("I say yes to each guest" and "Anyone with the link has a seat") with the first chosen, an optional name. One primary button, "Make the table", on the right. On success show the link with "Copy link" and "Send in WhatsApp" (a wa.me share link with the session's day and the link as text), and a line to open the table's page at /account/host/<id>.
- Signed out: send to sign in and back. Signed in and not approved: one calm sentence, "Hosting opens by invitation for now.", and nothing else.
- Hidden entirely when fewHostsOpen() (src/lib/fewHosts.ts) is false.

You own: worker/src/hostTable.ts, src/pages/HostTablePage.tsx, worker/tests/host-table.test.ts.
Do not touch: worker/src/index.ts, worker/migrations/, src/App.tsx, src/lib/api.ts, src/lib/store.ts, any navigation component. State in your report the api.ts lines you need.

Existing pattern: handleCreateEvent in worker/src/index.ts (near line 13598) for the columns an event needs; worker/tests/after-sit-access.test.ts for testing against an in-memory database.

Acceptance check: worker/tests/host-table.test.ts proves the defaults above, that two tables made in the same second get different slugs, that a past date and bad seats are refused, and that the row is unlisted with network_discovery 0 whatever the caller sends. Then in the sandbox as the fixture host: make a table from a 390 by 844 screen, copy the link, open it signed out and see the session.

Then the standing rules. Report back: the branch, what you ran, the api.ts lines, anything you could not do.
```

### Sol, H4: the host's page for one table

```
Repository storyoftheleaf/teajia. Branch from build/launch-2 as build/l2-h4-table; pull request into build/launch-2, never main.

Goal: a host opens one of their tables and sees who is coming, says yes or no with one tap, and can send the link again. No part of Manage is needed.

Approved behaviour:
- Page src/pages/HostedTablePage.tsx at /account/host/:id. Parts are steps in the address through useStepParam: `part=guests` (default), `teas`, `way`, `after`. Build `guests` fully. Leave `teas`, `way` and `after` as mounted empty parts with a heading only; other workers fill them, each exporting one component you mount. Name those three mount points in your report.
- Top: the session's day and time, the door in words, seats taken of seats, and the link with "Copy link" and "Send in WhatsApp".
- Guests, in three plain groups: "Asked, waiting for your yes", "Coming", "Not coming". Each guest: name, any note they wrote, "Yes" and "No" where they are waiting, and "Message in WhatsApp" only when they gave a phone number. A guest who asked not to be photographed shows the words "Please, no photographs of me".
- Changing the door or the seats: two quiet controls. Lowering seats below the number already coming is refused with a plain sentence.
- After the session's time has passed: one button "Mark who came" (the existing attendance call), then, per guest who came, "Copy their thank-you link" (the existing after-sit link call used by src/admin/components/AttendeeTable.tsx).
- Data: use the calls that already exist, exactly as src/admin/hooks/useEventData.ts and src/admin/components/AttendeeTable.tsx use them (attendees, approve, deny, attendance, the after-sit link), sent with the host's own account active. GET /api/me/tables/:id gives the session, door and link. Add no worker route.
- Hidden when fewHostsOpen() is false, and for anyone who is not this table's host: the same "not found" for both.

You own: src/pages/HostedTablePage.tsx, new files under src/components/host/, tests/host-guests.spec.ts.
Do not touch: worker/, src/admin/ (read it, copy its calls, do not import admin screens into this page), src/App.tsx, src/lib/api.ts, any navigation.

Must be preserved: the admin Sessions room works exactly as before.

Acceptance check: tests/host-guests.spec.ts, in the route-mocking style of tests/after-sit-guest-book-photos.spec.ts, at 390 by 844: a waiting guest becomes "Coming" on Yes; a No moves them; the photograph words show; back and forward move between parts; no horizontal overflow. Then walk it in the sandbox on the fixture table.

Then the standing rules. Report back: the branch, what you ran, the three mount points, anything you could not do.
```

### Astra, H5: a seat by name (patch)

```
Repository storyoftheleaf/teajia. Branch from build/launch-2 as build/l2-h5-seat; pull request into build/launch-2, never main. Return a patch with tests, plus the exact lines the build owner must change in worker/src/index.ts, which you do not edit.

Contract: a session has a door, events.door, 'request' or 'link' (NULL on older sessions, which behave exactly as today).
- 'link': a guest gives a name. Phone and email are optional. If a seat is free they have it at once, confirmed, and are handed their own private page link in the response. If none is free they are told so; no waiting list is created for them in this launch.
- 'request': a guest gives a name and a phone or email, as today. They wait for the host's yes.
- Never more confirmed guests than seats, whatever arrives at once.
- A guest who gave no contact creates no customers row.

What exists: handleRSVP in worker/src/index.ts (near line 12636). It requires a contact, finds an existing seat by contact, creates or finds a customer in the host's account, sets tiers, and writes event_attendees and event_party_members. Seats are counted from event_party_members with seat_status 'held' or 'confirmed' and from waiting-list offers. Recovery is handleFindRSVP.

Write worker/src/seatRequest.ts: pure decision functions the handler calls (what to require, whether this is a repeat, what status the seat gets), plus the SQL for the one statement that must be atomic. Then list, line by line, the changes handleRSVP needs.

Cases to settle, each a test in worker/tests/seat-request.test.ts with one sentence of reasoning:
1. Two requests for the last seat at a 'link' door arriving together. One has the seat. Show the statement that guarantees it and why a read followed by a write is not enough here.
2. The same person tapping twice with no contact, and two different guests who share a name. With no contact there is nothing to tell them apart. State the rule you chose (recommended: a per-browser key sent with the request makes a repeat idempotent; without it, two requests are two guests) and prove it does not let one browser fill a table.
3. A guest with no contact loses their private link. What can and cannot be recovered, and what handleFindRSVP must answer.
4. The host changes the door from 'link' to 'request' after ten guests are confirmed, and from 'request' to 'link' while four are waiting. Nobody already confirmed loses a seat; state what happens to those waiting.
5. The host lowers seats below the confirmed count through any route. Refused, with the evidence of which routes can do it.
6. Plus-ones and party members (plus_one, event_party_members, guest_invites): a 'link' seat with a plus-one when one seat is left.
7. A session whose door is NULL, an event in a shop account, a session that is full, closed, completed or cancelled: unchanged behaviour, proven against worker/tests that already cover RSVP.
8. Abuse at a 'link' door: one address taking every seat. The handler has a durable rate limiter; say whether it is enough for a table of six and what the smallest further guard is.
9. A request with no contact must not match another guest through the phone-suffix or email lookups (an empty string matching empty strings).

Do not touch: worker/src/index.ts, worker/migrations/. If the contract cannot hold without a column or an index, bring back the exact statement and the reason.

Return: the patch, the test output, the handler changes, and a table of the nine cases with the decision taken. A product decision comes back as a question with your recommended default implemented.
```

### Sol, H6 (picker): a tea for the table

```
Repository storyoftheleaf/teajia. Branch from build/launch-2 as build/l2-h6-teas; pull request into build/launch-2, never main.

Goal: on their table's page a host types a few letters and adds a tea. A tea from Teajia's shop is offered first, a tea from their own Tea Chest second, and anything else is simply the name they typed. A name alone is a complete entry.

Approved behaviour:
- Component src/components/host/HostTeaPicker.tsx, mounted in the `teas` part of /account/host/:id (the mount point exists).
- The list of teas already on the table, in pouring order, each removable. No prices, no stock, no cost anywhere on this screen.
- One text field. As the host types: up to five matches from Teajia's shop (GET /api/me/tables/tea-search?q=, already provided, returns { source: 'shop' | 'chest', id, name, type, year }), shop first, then chest. The last row is always "Add '<what they typed>' as written".
- Optional, per tea, after it is added: one line "Where it is from" and a photograph. The photograph goes through usePhotoEditor with freeShape. Both can be left empty for ever and nothing prompts for them.
- Saving uses the existing tea menu calls (see how src/admin/ saves event_tea_menu through /api/admin/events/:id/tea-menu). Add no worker route.
- An empty table shows one sentence: "No teas listed. That is fine." and the field.

You own: src/components/host/HostTeaPicker.tsx, tests/host-teas.spec.ts.
Do not touch: worker/, src/admin/, src/lib/api.ts, src/App.tsx.

Acceptance check: tests/host-teas.spec.ts at 390 by 844 with mocked routes: a shop match is added, a chest match is added, a typed name is added as written, a tea is removed, and the list keeps its order after reload. No horizontal overflow.

Then the standing rules. Report back: the branch, what you ran, anything you could not do.
```

### Sol, H8: the way to the house

```
Repository storyoftheleaf/teajia. Branch from build/launch-2 as build/l2-h8-way; pull request into build/launch-2, never main.

Goal: a host walks the way to their house once, a photograph and one line at each point that matters, and reuses it for every session there. A confirmed guest reads it on a phone held in one hand, and it still opens where the signal ends.

What exists, and stays as the data: the guide is events.venue_guide, typed VenueGuide in src/types/events.ts ({ steps: [{ description, image_url }], parking_notes, transit_notes, arrival_notes }). Saved places keep one too (the /api/admin/locations calls). The admin editor is src/admin/components/EventForm/sections/VenueGuideSection.tsx; the guest reader is src/components/events/VenueGuide.tsx, shown from src/components/events/GuestManagement/ConfirmedView.tsx. The server already sends the guide only to a confirmed guest and only until the session ends; do not change who receives it.

Approved behaviour:
- Host editor src/components/host/WalkthroughEditor.tsx, mounted in the `way` part of /account/host/:id. Steps in order, each one line and one photograph; add, remove, move up and down. Each photograph opens in the shared editor first: usePhotoEditor with freeShape. Never a bare file input. Below the steps, three optional lines: where to park, what to bring or wear, a number to call if lost. And the address with a map link, marked in words as "Shown only to guests you have said yes to".
- Reuse: "Use the way to <place name>" lists the host's saved places that have a guide; choosing one copies it in. "Keep this for next time" saves the current guide to a saved place by name. One place per table is the usual case.
- One sentence at the top of the editor: "Guests see this only after your yes, and only until the session ends. A guest can still take a screenshot."
- Guest reader, src/components/events/VenueGuide.tsx: one step at a time, large photograph, the line beneath, Next and Back as large targets at the bottom reachable by a thumb, "Open in maps" at the top. When the guide is opened, keep its steps and photographs on the phone so the page opens without signal; when the page is opened after the session's end time, remove what was kept. Keep it in the browser's Cache storage and a small localStorage record keyed by the guest's page, in the way src/pages/AfterSitPage.tsx keeps its "saved on this device" copy; wrap every storage call so a private window still renders the page.
- Also replace the bare file input in the admin VenueGuideSection with the same shared editor, so one rule holds in both places.

You own: src/components/host/WalkthroughEditor.tsx, src/components/events/VenueGuide.tsx, the photograph control inside src/admin/components/EventForm/sections/VenueGuideSection.tsx, tests/host-walkthrough.spec.ts.
Do not touch: worker/, src/lib/api.ts, src/App.tsx, ConfirmedView's decision about who sees the guide.

Acceptance check: tests/host-walkthrough.spec.ts at 390 by 844: a host adds three steps with photographs through the editor and reorders them; a saved place's guide is copied in; a guest steps through all three; with the network switched off after first opening, a reload still shows all three steps and photographs; after the end time, the kept copy is gone. tests/event-photo-essay.spec.ts and tests/admin-history.spec.ts still pass.

Then the standing rules. Report back: the branch, what you ran, anything you could not do.
```

### Sol, H9: the host's private guest book

```
Repository storyoftheleaf/teajia. Branch from build/launch-2 as build/l2-h9-notes; pull request into build/launch-2, never main.

Goal: after a session a host sees who came and what was poured, and can keep one private line about each guest that nobody else ever sees.

Approved behaviour:
- Table host_guest_notes already exists: id, account_id, host_user_id, event_id, attendee_id, note (1 to 500 characters), updated_at, unique on (host_user_id, event_id, attendee_id).
- Write worker/src/hostGuestNotes.ts exporting `saveGuestNote(db, { hostUserId, accountId, eventId, attendeeId, note })`, `clearGuestNote(...)` and `guestNotesFor(db, { hostUserId, accountId, eventId })`. Each first proves that eventId is a session in accountId whose host_user_id is hostUserId, and that attendeeId is a guest of that session; otherwise the same "not found" for every failure. An empty note clears the row. The routes are wired by the build owner.
- A note is the host's alone: it is never joined into any guest-facing, public, recap, export-for-others or agent answer. Keep every read inside this module.
- Component src/components/host/GuestBookPrivate.tsx, mounted in the `after` part of /account/host/:id: the guests who came, each with the teas poured listed once at the top, and one text field per guest that saves when the host leaves it. Above them: "Only you can see these."
- No contact details are shown or stored here. A guest's phone number stays in the host's WhatsApp.

You own: worker/src/hostGuestNotes.ts, src/components/host/GuestBookPrivate.tsx, worker/tests/host-guest-notes.test.ts.
Do not touch: worker/src/index.ts, worker/migrations/, worker/src/sessionGuestBook.ts (that is the guests' own guest book, a different thing), src/lib/api.ts.

Acceptance check: worker/tests/host-guest-notes.test.ts proves a host saves, changes and clears a note; a second host of another session cannot read or write it; a co-host of the same session cannot read the first host's notes; a guest id from another session is refused; a 501-character note is refused.

Then the standing rules. Report back: the branch, test output, anything you could not do.
```

### Sol, H10: hosted by, pouring, and photographs

```
Repository storyoftheleaf/teajia. Branch from build/launch-2 as build/l2-h10-words; pull request into build/launch-2, never main.

Goal: a session's page says who it is hosted by and who is pouring, tells guests in one line that photographs may be taken, and lets a guest say "please not me".

Approved behaviour:
- The public session answer now carries `host: { name, path | null }` and `pouring: [{ name, path | null }]` beside the existing `hosts`. On src/components/events/EventLanding.tsx show "Hosted by <name>", and "Pouring: <name>, <name>" when there are any. A name with a path is a link to it; without one it is plain words. Do not use the words "tea master" or "master" on this page.
- One line on the session page near the seat form: "Photographs are sometimes taken at the table. Tell the host if you would rather not be in them."
- In the seat form, one unticked choice: "Please, no photographs of me". It is sent as the existing field photo_consent = false; leaving it unticked sends what the form sends today. Read how the form sends photo_consent now and keep older behaviour for every other field.
- The host's guest list already shows the words for such a guest; confirm they appear from the value you send.

You own: the host and photograph lines in src/components/events/EventLanding.tsx, the one choice in the seat form component it uses, tests/host-words.spec.ts.
Do not touch: worker/, src/lib/api.ts, src/types/events.ts, the rest of the seat form.

Acceptance check: tests/host-words.spec.ts with mocked routes: a session with a host who has a page and one person pouring without a page; a session with a host only; the photograph line is present; ticking the choice sends photo_consent false. tests/event-signin-navigation.spec.ts still passes.

Then the standing rules. Report back: the branch, what you ran, anything you could not do.
```

### Astra, A2: a private account stays private (findings)

```
Repository storyoftheleaf/teajia, branch build/launch-2. Read only. Return findings, each with a failing test or exact reproduction. Do not fix.

Launch 2 lets a person Adrian approved host sessions from their own private account (accounts.kind 'master', personal_inventory_user_id set, public_enabled 0). Four contracts were added. Find where they do not hold.

Contract A, the door opens the session and nothing else. publicSessionHostSql in worker/src/hostApproval.ts replaced the old rule (account public) for direct session reads only.
1. List every query that used PUBLIC_EVENT_HOST before and what it uses now. For each, say whether a private approved host's data can now be read through it and whether it should.
2. From a hosted session's public answer, tea list, seat form and guest page: can a stranger learn the host's email, the account's slug or store page, any product, price, stock or cost of the private account, another session of the same host, or a guest's name they did not opt to show.
3. Withdraw the host's approval and close the launch flag, separately. Sessions already made: what still opens, what a confirmed guest still sees, and whether a new seat can be taken.
4. A person who is approved as a host but not as a seller: prove no tea of theirs becomes buyable or priced through a session (see worker/src/personalSellerApproval.ts and worker/src/sessionTeas.ts).

Contract B, a tea may point across accounts only at a public tea of the platform owner's shop.
5. Put on a hosted session's menu: a draft product of the shop, a public product not shown in the shop, an archived one, a product of a third account, a product id that does not exist, another person's Tea Chest holding. Each must resolve to a plain name with no path, price or id.
6. The tea search GET /api/me/tables/tea-search: what it returns for a host, and whether it can be used to list teas the public shop does not show.

Contract C, the way to the house belongs to the confirmed guest and ends with the session. (An earlier audit covered the address doors on main; check only what Launch 2 changed.)
7. A guest confirmed then removed; a guest at a by-link door before and after the session's end time; the kept copy on a phone after the end time; the photographs fetched directly by address after removal.
8. A saved place's guide reused across sessions: can a guest of one session read the guide of another.

Contract D, the private guest book is the host's alone. worker/src/hostGuestNotes.ts.
9. Search for every read of host_guest_notes. Prove none reaches a guest, a co-host, a recap, an agent tool scoped to another user, or the host's export when requested by someone else.

Also: 10. order_session_sources.host_user_id now reads events.host_user_id first. Show an order from a hosted session's thank-you names that host, and that a session with both a host_user_id and a lead host contributor is consistent.

Return: numbered findings with severity (private data readable by a stranger, by another member, or cosmetic), the evidence, and one line of proof for each item that holds.
```

### Sonnet, H12: the same actions as agent tools

```
Repository storyoftheleaf/teajia. Branch from build/launch-2 as build/l2-h12-tools; pull request into build/launch-2, never main.

Goal: a host can say "Saturday at four at my table", "who is coming on Saturday", "say yes to Mei" and "add the 2015 shou to Saturday" to an agent, and every write is previewed before it is confirmed.

One new module worker/src/mcpTools/fewHosts.ts with: host_table (date, time, seats?, door?, name?; calls createHostedTable in worker/src/hostTable.ts), list_my_tables, get_table_guests (names, status, the photograph wish; never a contact detail the host did not already hold, never an address), answer_guest (attendee, yes or no), add_table_tea (a shop tea id, a chest id or a plain name), set_guest_note and get_guest_notes (worker/src/hostGuestNotes.ts). Platform owner only: set_host_approval (worker/src/hostApproval.ts).

Copy worker/src/mcpTools/firstTable.ts for shape and worker/src/mcpTools/tickets.ts for confirmation tickets; tickets come only from tickets.ts. Read docs/claude/mcp.md first. Every tool is scoped to the caller: a table that is not theirs is "not found". Every tool answers "not available" while the launch is closed or the caller is not an approved host.

You own: worker/src/mcpTools/fewHosts.ts, worker/tests/few-hosts-tools.test.ts. Do not touch worker/src/mcp.ts, worker/src/mcpTools/registry.ts (give the lines to register) or worker/src/index.ts.

Acceptance check: the test proves each write does nothing on preview and writes on confirm; another host's table is not found; an unapproved caller is refused; get_table_guests returns no address and no note. Run npm run test:worker for the file, npm run lint:worker-types, npm run test:mcp-token.

Report back: the branch, test output, the registry lines.
```

### Sonnet, H13: the browser journey (a helper that built none of it)

```
Repository storyoftheleaf/teajia, branch build/launch-2. Branch as build/l2-h13-checks; pull request into build/launch-2, never main. You built none of this. Test it from what a person can do.

One spec, tests/few-hosts.spec.ts, against the sandbox fixture (an approved host, a finished hosted table; see worker/sandbox/README.md), at 390 by 844 and at a desktop size, each step also asserting no horizontal overflow and no console errors:
1. The approved host makes a table with only a day and a time and is shown a link.
2. Signed out, the link opens the session: the day, the area, "Hosted by" the host's name, seats, the photograph line. No address anywhere on the page, and none in the answer of /api/events/<slug>/public.
3. A guest asks for a seat with a name and a phone number and is told to wait. Their page shows no address and no way to the house.
4. The host says yes. The guest's page now shows the way, step by step, and the address.
5. At a second table with the by-link door, a guest gives only a name and has a seat at once. When the last seat is taken, the next guest is told the table is full.
6. The host adds a tea from the shop, a tea from their chest and a typed name. The session's tea list shows all three; only the shop tea is a link.
7. After the end time: the guest's page no longer shows the way. The host marks who came, copies a thank-you link, and it opens the Launch 1 thank-you with the teas.
8. The host writes a private line about a guest, reloads, and it is there. Signed in as the guest, it appears nowhere.
9. A signed-in person who is not approved opens /account/host and sees "Hosting opens by invitation for now."
10. With FEW_HOSTS_OPEN false: /account/host and the hosted session's link answer as if they did not exist, and the admin Sessions room works as before.

Never npm run dev. Follow tests/first-table.spec.ts for structure. You own tests/few-hosts.spec.ts and one helper under tests/helpers if needed. Touch nothing under src/ or worker/. A step you cannot pass is a finding: report the step, what you saw and a screenshot path. Never skip or weaken a check.

Report back: the branch, the run output at both sizes, the findings.
```

## The gate, and the journey Opus runs last

The launch gate in the build file stands: every slice merged and read, the suites run by Opus on `build/launch-2`, A1 and A2 answered or fixed, the documents true, Adrian's "ship", and then his approval of each first host by hand.

Opus then walks this itself in the sandbox, on a phone-sized screen, with the flag on, and writes down what it saw.

1. **As Adrian.** In Settings, approve one person as a host. Confirm a person who is not approved sees only "Hosting opens by invitation for now."
2. **As the host, on a phone.** Open `/account/host`. Give a day and a time. Hold the link in under a minute. The account is still private: its store page does not open.
3. **Walk the way.** On the table's page, add three steps with photographs through the photo editor, an address, and keep it for next time.
4. **As a stranger with the link, signed out.** See the day, the area, who hosts, the seats. Ask the site directly for the session: no address, no map link, no steps, no photographs.
5. **As a guest.** Ask for a seat by name and number. See "waiting". Still no address.
6. **As the host.** Say yes. As the guest, the way to the house appears. Switch the network off and reload: it still opens.
7. **A second table, by link.** A guest gives only a name and has a seat. Fill it. The next guest is told it is full, and the count never passes the seats.
8. **Teas.** Add one of Adrian's teas, one from the host's chest, one typed name. The guest's tea list links only Adrian's, to his shop.
9. **Afterward.** Past the end time the way is gone from the guest's page and from the phone. Mark who came, copy the thank-you link, open it as the guest: the Launch 1 thank-you, teas and all. Order Adrian's tea from it: the order records this session and this host.
10. **The private line.** Write one about a guest. It shows to the host only.
11. **Withdraw.** As Adrian, withdraw the host's approval. No new table can be made and no new seat taken; nothing already recorded is lost.
12. **Flag off.** Everything looks as it does on the live site after Launch 1.

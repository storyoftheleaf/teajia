# Events Release 1: Trust and Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing Events action persist correctly and establish one safe lifecycle, seat allocator, identity path, Tea Master relation, and team-assignment model.

**Architecture:** Keep the existing event routes and screens, but move reusable lifecycle, payload, projection, and capacity rules into a focused `eventDomain.ts` module. Add forward-only relational tables beside legacy attendee fields, migrate consumers incrementally, and require all public/admin route handlers to use account-scoped projections and guarded state changes.

**Tech Stack:** Cloudflare Workers, D1/SQLite migrations, TypeScript, Vitest, React 19, React Query, Vite, Playwright.

---

## File map

- Create `worker/migrations/127_events_trust_identity.sql`: lifecycle compatibility, parties, contributors, team assignments, consent, and required indexes.
- Create `worker/src/eventDomain.ts`: canonical lifecycle, API payload normalization, token-safe projections, and capacity arithmetic.
- Create `worker/tests/event-domain.test.ts`: pure domain behavior.
- Create `worker/tests/event-migration-127.test.ts`: migration compatibility and constraints.
- Create `worker/tests/event-contract-routes.test.ts`: repaired public/admin route contracts and privacy.
- Create `worker/tests/event-capacity-routes.test.ts`: allocation, approval, waitlist, and guest-claim invariants.
- Create `worker/tests/event-identity-routes.test.ts`: authenticated RSVP/User/Customer linkage and tenant isolation.
- Create `worker/tests/event-team-routes.test.ts`: contributor/team ownership and authorization.
- Modify `worker/schema.sql`: canonical schema snapshot after migration 127.
- Modify `worker/src/index.ts`: use domain helpers and register repaired/new routes.
- Modify `src/lib/api.ts`: canonical request bodies and new contributor/team calls.
- Modify `src/types/events.ts`: canonical status, party, contributor, and team types.
- Modify `src/admin/hooks/useEventData.ts`: complete lossless event mapping.
- Modify `src/admin/components/EventForm/EditForm.tsx`: canonical update keys and timezone persistence.
- Modify `src/admin/components/EventsManager.tsx`: duplicate date input and error handling.
- Modify `src/admin/components/TeaMenuEditor.tsx`: canonical tea-menu result handling.
- Modify `src/admin/components/NotificationPanel.tsx`: honest communications availability state.
- Modify `src/admin/components/ShareSheet.tsx`: correct links and disable unavailable email delivery.
- Modify `src/admin/components/EventDetail.tsx`: host/team editing surface and lifecycle actions.
- Create `src/admin/components/EventPeopleEditor.tsx`: contributor and team assignments.
- Modify `src/components/events/EventLanding.tsx`: safe host projection and persisted RSVP state.
- Modify `src/hooks/useEventPolling.ts`: canonical RSVP updates.
- Modify `tests/event-admin-trust.spec.ts`: browser regression coverage for repaired actions.

## Task 1: Define the canonical event domain

**Files:**
- Create: `worker/src/eventDomain.ts`
- Create: `worker/tests/event-domain.test.ts`

- [ ] **Step 1: Write failing lifecycle, payload, projection, and capacity tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  EVENT_TRANSITIONS,
  normalizeEventUpdate,
  normalizeRsvpUpdate,
  publicPostSessionProjection,
  seatAvailability,
} from '../src/eventDomain';

describe('event domain', () => {
  it('permits only canonical lifecycle transitions', () => {
    expect(EVENT_TRANSITIONS.published).toEqual(['registration_closed', 'cancelled']);
    expect(EVENT_TRANSITIONS.completed).toEqual(['archived']);
    expect(EVENT_TRANSITIONS.cancelled).toEqual(['archived']);
  });

  it('normalizes legacy event and RSVP request keys', () => {
    expect(normalizeEventUpdate({ end_date: '2026-09-01T12:00:00Z', capacity: 12 }))
      .toEqual({ event_end_date: '2026-09-01T12:00:00Z', total_capacity: 12 });
    expect(normalizeRsvpUpdate({ status: 'cancelled', cancellation_note: 'Travel' }))
      .toEqual({ action: 'cancel', cancellationNote: 'Travel' });
    expect(normalizeRsvpUpdate({ notes: 'No stairs', first_visit_briefed: 1 }))
      .toEqual({ action: 'update', notes: 'No stairs', firstVisitBriefed: true });
  });

  it('never exposes host-only post-session fields', () => {
    expect(publicPostSessionProjection({
      event_id: 'event-1', session_notes: 'Shared', gallery_images: '[]',
      host_notes: 'Private', host_changes: 'Private change', tea_ledger: '{}',
    })).toEqual({ event_id: 'event-1', session_notes: 'Shared', gallery_images: [], tea_ledger: {} });
  });

  it('counts primary, party, and live offered seats without returning negatives', () => {
    expect(seatAvailability({ capacity: 3, confirmedSeats: 2, offeredSeats: 1 })).toEqual({ held: 3, available: 0 });
    expect(seatAvailability({ capacity: 2, confirmedSeats: 3, offeredSeats: 0 })).toEqual({ held: 3, available: 0 });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run worker/tests/event-domain.test.ts`

Expected: FAIL because `worker/src/eventDomain.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure domain module**

```ts
export type EventLifecycle = 'draft' | 'published' | 'registration_closed' | 'completed' | 'cancelled' | 'archived';

export const EVENT_TRANSITIONS: Record<EventLifecycle, EventLifecycle[]> = {
  draft: ['published', 'cancelled'],
  published: ['registration_closed', 'cancelled'],
  registration_closed: ['completed', 'cancelled'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

export function normalizeEventUpdate(input: Record<string, unknown>) {
  const result = { ...input };
  if ('end_date' in result) { result.event_end_date = result.end_date; delete result.end_date; }
  if ('capacity' in result) { result.total_capacity = result.capacity; delete result.capacity; }
  return result;
}

export function normalizeRsvpUpdate(input: Record<string, unknown>) {
  if (input.cancel === true || input.status === 'cancelled') {
    return { action: 'cancel' as const, cancellationNote: String(input.cancellation_note || '') || undefined };
  }
  return {
    action: 'update' as const,
    ...('notes' in input ? { notes: String(input.notes || '') || null } : {}),
    ...('first_visit_briefed' in input ? { firstVisitBriefed: Boolean(input.first_visit_briefed) } : {}),
    ...('show_in_guest_list' in input ? { showInGuestList: Boolean(input.show_in_guest_list) } : {}),
  };
}

const parseJson = (value: unknown, fallback: unknown) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

export function publicPostSessionProjection(row: Record<string, unknown>) {
  return {
    event_id: row.event_id,
    session_notes: row.session_notes ?? null,
    gallery_images: parseJson(row.gallery_images, []),
    tea_ledger: parseJson(row.tea_ledger, null),
  };
}

export function seatAvailability(input: { capacity: number; confirmedSeats: number; offeredSeats: number }) {
  const held = input.confirmedSeats + input.offeredSeats;
  return { held, available: Math.max(0, input.capacity - held) };
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npx vitest run worker/tests/event-domain.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/eventDomain.ts worker/tests/event-domain.test.ts
git commit -m "test(events): define lifecycle and payload domain"
```

## Task 2: Add the trust-and-identity migration

**Files:**
- Create: `worker/migrations/127_events_trust_identity.sql`
- Create: `worker/tests/event-migration-127.test.ts`
- Modify: `worker/schema.sql`

- [ ] **Step 1: Write the failing migration test**

```ts
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 127', () => {
  it('adds event lifecycle, parties, contributors, team, and consent without losing legacy attendees', () => {
    const db = new Database(':memory:');
    db.exec(readFileSync('worker/migrations/003_events.sql', 'utf8'));
    db.exec("ALTER TABLE events ADD COLUMN account_id TEXT; ALTER TABLE event_attendees ADD COLUMN account_id TEXT;");
    db.exec("INSERT INTO events(id,slug,title,event_date,status,account_id) VALUES('e','tea','Tea','2026-09-01','active','a')");
    db.exec("INSERT INTO event_attendees(id,event_id,full_name,phone_number,status,magic_token,account_id) VALUES('p','e','Guest','1','confirmed','m','a')");
    db.exec(readFileSync('worker/migrations/127_events_trust_identity.sql', 'utf8'));

    expect(db.prepare("SELECT lifecycle_status FROM events WHERE id='e'").get()).toEqual({ lifecycle_status: 'published' });
    expect(db.prepare("SELECT user_id FROM event_attendees WHERE id='p'").get()).toEqual({ user_id: null });
    expect(db.prepare("SELECT COUNT(*) AS count FROM event_party_members WHERE participation_id='p'").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='event_contributors'").get()).toEqual({ name: 'event_contributors' });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='event_team_assignments'").get()).toEqual({ name: 'event_team_assignments' });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run worker/tests/event-migration-127.test.ts`

Expected: FAIL because migration 127 does not exist.

- [ ] **Step 3: Create the forward-only migration**

The migration must:

```sql
ALTER TABLE events ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'draft'
  CHECK(lifecycle_status IN ('draft','published','registration_closed','completed','cancelled','archived'));
ALTER TABLE events ADD COLUMN public_visibility TEXT NOT NULL DEFAULT 'public'
  CHECK(public_visibility IN ('public','unlisted','private'));
ALTER TABLE events ADD COLUMN network_discovery INTEGER NOT NULL DEFAULT 1;
ALTER TABLE events ADD COLUMN recap_status TEXT NOT NULL DEFAULT 'draft'
  CHECK(recap_status IN ('draft','published'));
ALTER TABLE event_attendees ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE event_attendees ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK(payment_status IN ('not_required','pending','paid','waived','refunded'));

UPDATE events SET lifecycle_status = CASE status
  WHEN 'active' THEN 'published'
  WHEN 'closed' THEN 'registration_closed'
  WHEN 'archived' THEN 'archived'
  ELSE 'draft' END;

CREATE TABLE event_party_members (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id),
  participation_id TEXT NOT NULL REFERENCES event_attendees(id),
  user_id TEXT REFERENCES users(id),
  customer_id TEXT REFERENCES customers(id),
  full_name TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  invitation_id TEXT,
  seat_status TEXT NOT NULL CHECK(seat_status IN ('requested','held','confirmed','cancelled','expired')),
  attendance_status TEXT CHECK(attendance_status IN ('checked_in','attended','no_show')),
  checked_in_at TEXT,
  attended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO event_party_members(id,account_id,event_id,participation_id,user_id,customer_id,full_name,is_primary,seat_status)
SELECT 'primary-' || id, account_id, event_id, id, user_id, customer_id, full_name, 1,
  CASE status WHEN 'confirmed' THEN 'confirmed' WHEN 'cancelled' THEN 'cancelled' ELSE 'requested' END
FROM event_attendees;

CREATE TABLE event_contributors (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id),
  contributor_id TEXT NOT NULL REFERENCES contributors(id),
  role TEXT NOT NULL CHECK(role IN ('lead_host','co_host','guest_host','photographer','author')),
  is_public INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(event_id, contributor_id, role)
);

CREATE TABLE event_team_assignments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('coordinator','service','assistant','inventory','communications','photographer')),
  UNIQUE(event_id, user_id, role)
);

CREATE TABLE event_consents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id),
  attendee_id TEXT NOT NULL REFERENCES event_attendees(id),
  photography INTEGER NOT NULL DEFAULT 0,
  public_quote INTEGER NOT NULL DEFAULT 0,
  review_publication INTEGER NOT NULL DEFAULT 0,
  contact_exchange INTEGER NOT NULL DEFAULT 0,
  operational_messages INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, attendee_id)
);
```

Add indexes on `(account_id, lifecycle_status, event_date)`, party `(event_id, seat_status)`, contributors `(event_id, display_order)`, and team `(event_id, user_id)`.

- [ ] **Step 4: Run the migration test and verify GREEN**

Run: `npx vitest run worker/tests/event-migration-127.test.ts`

Expected: migration test passes.

- [ ] **Step 5: Apply the migration mechanically to `worker/schema.sql` and run rehearsal tests**

Run: `npx vitest run worker/tests/event-migration-127.test.ts worker/tests/migration-017-rehearsal.test.ts worker/tests/tea-master-migrations.test.ts`

Expected: all selected migration tests pass.

- [ ] **Step 6: Commit**

```bash
git add worker/migrations/127_events_trust_identity.sql worker/schema.sql worker/tests/event-migration-127.test.ts
git commit -m "feat(events): add trust and identity schema"
```

## Task 3: Repair existing request and response contracts

**Files:**
- Create: `worker/tests/event-contract-routes.test.ts`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/admin/hooks/useEventData.ts`
- Modify: `src/admin/components/EventForm/EditForm.tsx`
- Modify: `src/admin/components/EventsManager.tsx`

- [ ] **Step 1: Write failing route tests for the audited contracts**

Add tests that assert:

```ts
it('persists cancellation notes and briefing state from canonical client bodies', async () => {
  expect(await putRsvp({ status: 'cancelled', cancellation_note: 'Travel' })).toMatchObject({ status: 200, body: { status: 'cancelled' } });
  expect(db.attendee).toMatchObject({ status: 'cancelled', cancellation_note: 'Travel' });
  expect(await putRsvp({ first_visit_briefed: 1, notes: 'No stairs' })).toMatchObject({ status: 200 });
  expect(db.attendee).toMatchObject({ first_visit_briefed: 1, notes: 'No stairs' });
});

it('accepts the client tea-menu and tasting-note envelopes', async () => {
  expect((await postAdminTeaMenu({ items: [{ custom_name: 'Baozhong', brew_order: 1 }] })).status).toBe(200);
  expect((await postGuestNotes({ notes: [{ tea_menu_id: 'menu-1', impression: 'Lilac' }] })).status).toBe(201);
});

it('uses canonical event end date and duplicate date', async () => {
  expect((await updateEvent({ end_date: '2026-09-01T13:00:00Z' })).status).toBe(200);
  expect(db.event.event_end_date).toBe('2026-09-01T13:00:00Z');
  expect((await duplicateEvent({ slug: 'tea-2', event_date: '2026-10-01T10:00:00Z' })).status).toBe(201);
});
```

The in-memory test DB must record persisted rows, not only SQL text.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run worker/tests/event-contract-routes.test.ts`

Expected: cancellation/note, tea-menu, tasting-note, edit, and duplicate cases fail for their audited reasons.

- [ ] **Step 3: Repair Worker contracts through canonical normalization**

- Call `normalizeEventUpdate()` before the event update allowlist and remove `end_date`, `capacity`, and `location` aliases from SQL column generation.
- Call `normalizeRsvpUpdate()` in `handleUpdateRSVP`; persist `cancellation_note`, `notes`, and `first_visit_briefed` when provided.
- Accept `{ items }` in `handleUpsertTeaMenu` and `{ notes }` in `handleSubmitTastingNotes` while retaining raw-array compatibility during Release 1.
- Require `event_date` for duplication and return the new event object.
- Add public `GET /api/events/:slug/tea-menu` using an explicit public allowlist and same-account product join.
- Change generated share URLs to `${APP_URL}/event/:slug`.
- Do not register `send-emails` until the communications outbox exists; make the client surface report “Email delivery is not configured” instead of calling a nonexistent route.

- [ ] **Step 4: Repair frontend payloads and lossless event mapping**

- `api.events.upsertTeaMenu` sends the canonical envelope accepted by the Worker.
- `api.rsvp.submitTastingNotes` sends the canonical envelope accepted by the Worker.
- `api.events.duplicate` accepts `(id, { slug, eventDate })`.
- `EditForm` sends `event_end_date` and timezone.
- `mapEvent` includes `event_format`, `gathering_type`, `venue_id`, `active_space_ids`, `requires_approval`, `lifecycle_status`, `public_visibility`, and `network_discovery`.

- [ ] **Step 5: Run contract and type tests and verify GREEN**

Run: `npx vitest run worker/tests/event-contract-routes.test.ts worker/tests/rsvp-security.test.ts && npm run lint`

Expected: selected tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/tests/event-contract-routes.test.ts src/lib/api.ts src/admin/hooks/useEventData.ts src/admin/components/EventForm/EditForm.tsx src/admin/components/EventsManager.tsx
git commit -m "fix(events): repair persisted action contracts"
```

## Task 4: Protect attendee tokens and post-event input

**Files:**
- Modify: `worker/tests/event-contract-routes.test.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/eventDomain.ts`

- [ ] **Step 1: Add failing privacy and attendance tests**

```ts
it('returns only public post-session fields to attendee tokens', async () => {
  const body = await (await getAttendeePostSession()).json() as Record<string, unknown>;
  expect(body).toMatchObject({ session_notes: 'Shared' });
  expect(body).not.toHaveProperty('host_notes');
  expect(body).not.toHaveProperty('host_changes');
  expect(body).not.toHaveProperty('account_id');
});

it('requires completed attendance and an event-owned menu item for tasting notes', async () => {
  expect((await postGuestNotesAs({ lifecycle: 'published', attended: 1, menuEvent: 'event-1' })).status).toBe(409);
  expect((await postGuestNotesAs({ lifecycle: 'completed', attended: 0, menuEvent: 'event-1' })).status).toBe(403);
  expect((await postGuestNotesAs({ lifecycle: 'completed', attended: 1, menuEvent: 'event-2' })).status).toBe(400);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run worker/tests/event-contract-routes.test.ts`

Expected: token response contains host-only fields and note guards fail.

- [ ] **Step 3: Implement allowlisted projection and note ownership checks**

- Use `publicPostSessionProjection()` instead of spreading `event_post_session`.
- Require `lifecycle_status = 'completed'`, `status = 'confirmed'`, and `attended = 1`.
- Verify every non-null `tea_menu_id` belongs to the attendee's event and account.
- Write `account_id` on every tasting-note row.
- Upsert one note per `(attendee_id, tea_menu_id)` rather than appending duplicates.

- [ ] **Step 4: Run and verify GREEN**

Run: `npx vitest run worker/tests/event-contract-routes.test.ts worker/tests/event-article-draft-routes.test.ts`

Expected: privacy and post-event cases pass without breaking admin post-session behavior.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts worker/src/eventDomain.ts worker/tests/event-contract-routes.test.ts
git commit -m "fix(events): protect attendee post-session data"
```

## Task 5: Centralize atomic seat allocation

**Files:**
- Create: `worker/tests/event-capacity-routes.test.ts`
- Modify: `worker/src/eventDomain.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write failing route tests for every seat path**

The test DB must model conditional seat claims. Add cases for:

```ts
it.each(['instant RSVP', 'single approval', 'batch approval', 'waitlist claim', 'guest claim'])
  ('never confirms a party beyond capacity through %s', async path => {
    db.capacity = 2;
    db.confirmedSeats = 2;
    const response = await invokeSeatPath(path, db);
    expect(response.status).toBe(409);
    expect(db.confirmedSeats).toBe(2);
  });

it('claims a guest invitation once', async () => {
  const [first, second] = await Promise.all([claimGuest('token'), claimGuest('token')]);
  expect([first.status, second.status].sort()).toEqual([201, 409]);
  expect(db.partyMembers.filter(member => member.invitation_id === 'invite-1')).toHaveLength(1);
});

it('counts accepted party members and unexpired offers as held seats', async () => {
  expect(await publicAvailability()).toEqual({ capacity: 4, confirmed: 2, offered: 1, available: 1, isFull: false });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run worker/tests/event-capacity-routes.test.ts`

Expected: all guarded-path tests fail against legacy count-then-write behavior.

- [ ] **Step 3: Add a single seat allocation helper**

Implement `reservePartySeats(env, { accountId, eventId, participationId, seats, sourceState, targetState, offerExpiresAt })` so it:

1. validates the event lifecycle allows the operation;
2. derives held seats from `event_party_members` in `held|confirmed` plus live offers;
3. uses a D1 batch with guarded `UPDATE ... WHERE` state predicates;
4. inserts or transitions exactly the requested party seats;
5. verifies affected-row counts and returns a typed `capacity_conflict` when the full party cannot be reserved;
6. leaves no partial state after failure.

Use the helper from public RSVP, single approval, batch approval, waitlist claim, and guest claim. Guest claim updates `guest_invites` only from `pending` and records the claimed party member in the same guarded operation.

- [ ] **Step 4: Derive every public/admin capacity count from party seats**

Replace `SUM(1 + plus_one)` projections with primary and party-member seat counts. Keep `plus_one` as read compatibility only during Release 1.

- [ ] **Step 5: Run and verify GREEN**

Run: `npx vitest run worker/tests/event-capacity-routes.test.ts worker/tests/rsvp-security.test.ts`

Expected: all seat paths reject over-capacity and the duplicate-token security behavior remains green.

- [ ] **Step 6: Commit**

```bash
git add worker/src/eventDomain.ts worker/src/index.ts worker/tests/event-capacity-routes.test.ts
git commit -m "feat(events): enforce atomic party capacity"
```

## Task 6: Bind authenticated users to durable participation

**Files:**
- Create: `worker/tests/event-identity-routes.test.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write failing identity and tenant tests**

```ts
it('binds an authenticated RSVP to the account customer and attendee', async () => {
  const response = await rsvp({ authUser: 'user-1', email: 'guest@test' });
  expect(response.status).toBe(201);
  expect(db.customers).toContainEqual(expect.objectContaining({ account_id: 'account-a', user_id: 'user-1' }));
  expect(db.attendees).toContainEqual(expect.objectContaining({ account_id: 'account-a', user_id: 'user-1', customer_id: expect.any(String) }));
});

it('does not expose another account journey through matching contact text', async () => {
  db.attendees.push(attendee({ account_id: 'account-b', email: 'guest@test', attended: 1 }));
  const body = await (await getAdminAttendees('event-a')).json() as unknown[];
  expect(JSON.stringify(body)).not.toContain('account-b');
});

it('rejects linking an attendee to a customer from another account', async () => {
  expect((await updateAttendee({ customer_id: 'customer-b' })).status).toBe(400);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run worker/tests/event-identity-routes.test.ts`

Expected: authenticated RSVP lacks durable linkage and cross-account guards fail.

- [ ] **Step 3: Implement verified account-local binding**

- Parse and validate the session token on RSVP when present.
- Find or create the Customer within the event account.
- Set `customers.user_id` only when null or already equal; return an identity conflict otherwise.
- Write both `user_id` and `customer_id` to the attendee and primary party member.
- Scope attendee journey lookups by event account.
- Validate any admin-supplied `customer_id` against the attendee's account.

- [ ] **Step 4: Run and verify GREEN**

Run: `npx vitest run worker/tests/event-identity-routes.test.ts worker/tests/verification-routes.test.ts`

Expected: durable identity and tenant-isolation cases pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts worker/tests/event-identity-routes.test.ts
git commit -m "feat(events): bind users to account participation"
```

## Task 7: Add Tea Master and event-team relationships

**Files:**
- Create: `worker/tests/event-team-routes.test.ts`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/types/events.ts`

- [ ] **Step 1: Write failing route tests**

```ts
it('accepts only contributors associated with the event account', async () => {
  expect((await replaceContributors('event-a', [{ contributor_id: 'host-a', role: 'lead_host' }])).status).toBe(200);
  expect((await replaceContributors('event-a', [{ contributor_id: 'host-b', role: 'lead_host' }])).status).toBe(400);
});

it('accepts only account members as event team', async () => {
  expect((await replaceTeam('event-a', [{ user_id: 'member-a', role: 'coordinator' }])).status).toBe(200);
  expect((await replaceTeam('event-a', [{ user_id: 'member-b', role: 'service' }])).status).toBe(400);
});

it('returns only public contributor identity on public event detail', async () => {
  expect(await publicEvent()).toMatchObject({ hosts: [{ slug: 'adrian', displayName: 'Adrian', role: 'lead_host' }] });
  expect(JSON.stringify(await publicEvent())).not.toContain('payment');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run worker/tests/event-team-routes.test.ts`

Expected: contributor/team routes do not exist.

- [ ] **Step 3: Add account-scoped replacement routes**

Register:

- `GET /api/admin/events/:id/people`
- `PUT /api/admin/events/:id/contributors`
- `PUT /api/admin/events/:id/team`

Each replacement validates the parent event, contributor account association, and account membership before a transactional delete/insert. Public event detail returns only published Contributor fields: slug, display name, public role, image, event role, and ordering.

- [ ] **Step 4: Add frontend API and types**

```ts
export interface EventContributor {
  contributorId: string;
  slug: string;
  displayName: string;
  role: 'lead_host' | 'co_host' | 'guest_host' | 'photographer' | 'author';
  isPublic: boolean;
  displayOrder: number;
}

export interface EventTeamAssignment {
  userId: string;
  name: string;
  role: 'coordinator' | 'service' | 'assistant' | 'inventory' | 'communications' | 'photographer';
}
```

- [ ] **Step 5: Run and verify GREEN**

Run: `npx vitest run worker/tests/event-team-routes.test.ts && npm run lint`

Expected: route tests and TypeScript pass.

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/tests/event-team-routes.test.ts src/lib/api.ts src/types/events.ts
git commit -m "feat(events): connect tea masters and event teams"
```

## Task 8: Complete product, venue, and stock tenant integrity

**Files:**
- Modify: `worker/tests/event-contract-routes.test.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add failing cross-account child tests**

```ts
it.each([
  ['venue_id', 'venue-b'],
  ['active_space_ids', ['space-b']],
  ['product_id', 'product-b'],
  ['customer_id', 'customer-b'],
])('rejects cross-account %s references', async (field, value) => {
  expect((await mutateEventChild(field, value)).status).toBe(400);
});

it('rebuilds or releases stock holds when menu, capacity, lifecycle, or usage changes', async () => {
  await setMenu([{ product_id: 'product-a', grams_per_guest: 4 }]);
  await setCapacity(10);
  expect(db.holdFor('product-a')).toBe(40);
  await cancelEvent();
  expect(db.holdFor('product-a')).toBe(0);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run worker/tests/event-contract-routes.test.ts`

Expected: cross-account venue/product references and hold lifecycle cases fail.

- [ ] **Step 3: Add explicit account validation and hold refresh**

- Validate venue and each active space against the event account.
- Validate every product/menu item against the event account before write.
- Recalculate holds after menu or capacity changes.
- Release holds on cancellation.
- Keep completion consumption for Release 3; Release 1 must prevent stale or cross-tenant holds.
- Treat hold refresh failure as a failed event/menu mutation, not a swallowed warning.

- [ ] **Step 4: Run and verify GREEN**

Run: `npx vitest run worker/tests/event-contract-routes.test.ts`

Expected: ownership and hold cases pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts worker/tests/event-contract-routes.test.ts
git commit -m "fix(events): enforce child ownership and stock holds"
```

## Task 9: Add the admin host/team editor and repaired actions

**Files:**
- Create: `src/admin/components/EventPeopleEditor.tsx`
- Modify: `src/admin/components/EventDetail.tsx`
- Modify: `src/admin/components/TeaMenuEditor.tsx`
- Modify: `src/admin/components/EventsManager.tsx`
- Modify: `src/admin/components/NotificationPanel.tsx`
- Modify: `src/admin/components/ShareSheet.tsx`
- Create: `tests/event-admin-trust.spec.ts`

- [ ] **Step 1: Write failing Playwright tests**

```ts
test('edits end date, duplicates with a date, and persists a tea menu', async ({ page }) => {
  await mockEventAdmin(page);
  await page.goto('/admin/events/event-1');
  await page.getByRole('button', { name: 'Edit event' }).click();
  await page.getByLabel('End date').fill('2026-09-01');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(lastUpdateBody()).toMatchObject({ event_end_date: expect.any(String) });

  await page.getByRole('tab', { name: 'Tea menu' }).click();
  await page.getByRole('button', { name: 'Add tea' }).click();
  await page.getByLabel('Tea name').fill('Baozhong');
  await page.getByRole('button', { name: 'Save tea menu' }).click();
  expect(lastMenuBody()).toEqual({ items: [expect.objectContaining({ custom_name: 'Baozhong' })] });
});

test('assigns a lead Tea Master and event coordinator', async ({ page }) => {
  await mockEventAdmin(page);
  await page.goto('/admin/events/event-1?tab=people');
  await page.getByLabel('Lead host').selectOption('contributor-a');
  await page.getByLabel('Coordinator').selectOption('user-a');
  await page.getByRole('button', { name: 'Save people' }).click();
  expect(lastContributorBody()).toMatchObject({ contributors: [{ contributor_id: 'contributor-a', role: 'lead_host' }] });
  expect(lastTeamBody()).toMatchObject({ assignments: [{ user_id: 'user-a', role: 'coordinator' }] });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx playwright test tests/event-admin-trust.spec.ts --project='Desktop Chrome'`

Expected: repaired controls or People editor are absent.

- [ ] **Step 3: Implement `EventPeopleEditor` and integrate it**

- Use `TYPOGRAPHY_CLASSES` and safe tea tokens.
- Use ordinary selects/searchable lists already present in the admin design system.
- Lead host is required before publishing a public event; other assignments are optional.
- Save contributors and team independently, showing persisted server errors.
- All compact icon buttons include `tap-target` and accessible labels.
- Do not add a new nav item; People is an EventDetail tab.

- [ ] **Step 4: Repair duplicate, menu, and error surfaces**

- Duplicate dialog requires slug and date.
- Tea menu renders actual persisted results.
- Email send controls render a clear unavailable state until Release 3.
- No mutation displays success before its response is persisted.

- [ ] **Step 5: Run browser, type, and color verification**

Run: `npx playwright test tests/event-admin-trust.spec.ts --project='Desktop Chrome' && npm run lint && npm run lint:colors`

Expected: Playwright, TypeScript, and color rules pass.

- [ ] **Step 6: Commit**

```bash
git add src/admin/components/EventPeopleEditor.tsx src/admin/components/EventDetail.tsx src/admin/components/TeaMenuEditor.tsx src/admin/components/EventsManager.tsx src/admin/components/NotificationPanel.tsx src/admin/components/ShareSheet.tsx tests/event-admin-trust.spec.ts
git commit -m "feat(events): add people assignments and trusted admin actions"
```

## Task 10: Integrate public host identity and persisted RSVP state

**Files:**
- Modify: `src/components/events/EventLanding.tsx`
- Modify: `src/hooks/useEventPolling.ts`
- Modify: `src/types/events.ts`
- Modify: `tests/event-admin-trust.spec.ts`

- [ ] **Step 1: Add failing browser tests**

```ts
test('shows the public Tea Master and persists attendee cancellation', async ({ page }) => {
  await mockPublicEvent(page, { hosts: [{ slug: 'adrian', displayName: 'Adrian', role: 'lead_host' }] });
  await page.goto('/event/tea-night');
  await expect(page.getByRole('link', { name: 'Adrian' })).toHaveAttribute('href', '/people/adrian');

  await page.goto('/m/magic-token');
  await page.getByRole('button', { name: 'Cancel reservation' }).click();
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  expect(lastRsvpUpdateBody()).toMatchObject({ status: 'cancelled' });
  await expect(page.getByText('Reservation cancelled')).toBeVisible();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx playwright test tests/event-admin-trust.spec.ts --project='Mobile Chrome'`

Expected: host link or persisted cancellation assertion fails.

- [ ] **Step 3: Render public host identity and canonical RSVP updates**

- Replace the plain account-name host footer with ordered public contributor links and retain account attribution.
- Refresh attendee data after cancellation, note, briefing, and guest changes; do not hide state only locally.
- Correct the stored-token response read from `data.attendee.status`.
- Preserve focus management, bottom-nav clearance, reduced motion, and existing visual language.

- [ ] **Step 4: Run and verify GREEN**

Run: `npx playwright test tests/event-admin-trust.spec.ts --project='Mobile Chrome' && npm run lint && npm run lint:colors`

Expected: mobile browser, TypeScript, and color checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/events/EventLanding.tsx src/hooks/useEventPolling.ts src/types/events.ts tests/event-admin-trust.spec.ts
git commit -m "feat(events): connect hosts and persisted RSVP state"
```

## Task 11: Release 1 verification and documentation

**Files:**
- Modify: `docs/STATE_OF_THE_SITE.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/plan/event-system-v2.md`

- [ ] **Step 1: Run the focused event suite**

Run:

```bash
npx vitest run \
  worker/tests/event-domain.test.ts \
  worker/tests/event-migration-127.test.ts \
  worker/tests/event-contract-routes.test.ts \
  worker/tests/event-capacity-routes.test.ts \
  worker/tests/event-identity-routes.test.ts \
  worker/tests/event-team-routes.test.ts \
  worker/tests/rsvp-security.test.ts \
  worker/tests/verification-routes.test.ts \
  worker/tests/event-article-draft-routes.test.ts
```

Expected: all selected files pass with zero failed tests.

- [ ] **Step 2: Run the complete relevant verification**

Run:

```bash
npm run test:worker
npm run lint
npm run lint:colors
npm run build
npx playwright test tests/event-admin-trust.spec.ts --project='Desktop Chrome' --project='Mobile Chrome'
```

Expected: worker suite, TypeScript, color rules, production build, and both browser projects exit 0.

- [ ] **Step 3: Inspect real screens**

Run the app on the reserved port 7777 and inspect:

- public event landing at 390×844 and 1440×900;
- attendee magic-link management at 390×844;
- admin EventDetail People and Tea Menu tabs at 390×844 and 1440×900;
- duplicate and edit dialogs;
- no horizontal overflow and mobile bottom-nav clearance.

- [ ] **Step 4: Update documentation only with verified behavior**

Document the canonical lifecycle, atomic party seats, authenticated identity binding, Tea Master/team assignments, repaired actions, and remaining Release 2–4 work. Remove claims that still describe legacy behavior as complete.

- [ ] **Step 5: Review the entire task-scoped diff**

Run: `git diff $(git merge-base HEAD origin/main)..HEAD -- worker src tests docs worker/migrations`

Expected: no unrelated Tea Master sales or other concurrent work is introduced by Release 1 commits.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/STATE_OF_THE_SITE.md docs/CHANGELOG.md docs/plan/event-system-v2.md
git commit -m "docs(events): record trust and identity release"
```

## Release 1 acceptance gate

Release 1 is complete only when all of the following are demonstrated by fresh evidence:

- editing, duplication, tea-menu saving, cancellation, briefing state, attendee notes, and tasting-note submission persist correctly;
- attendee tokens cannot expose host-only debrief content;
- RSVP, approval, batch approval, waitlist claim, and guest claim cannot exceed capacity;
- signed-in RSVP binds User, account Customer, attendee, and primary party seat;
- raw contact matching cannot leak cross-account history;
- public events expose allowlisted Tea Master identity;
- event teams are account-scoped and persisted;
- venue, space, product, Customer, and menu relations reject cross-account IDs;
- stock holds update on menu/capacity changes and release on cancellation;
- the focused suite, full worker suite, lint, color lint, build, and mobile/desktop browser tests all pass.

After this gate, create and execute the Release 2 customer-journey plan from the approved Events Platform Rebuild Design; then Release 3 operations and Release 4 memory/discovery/WhatsApp inquiry plans in dependency order.

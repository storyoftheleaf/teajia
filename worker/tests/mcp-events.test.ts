import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { combineToolModules } from '../src/mcpTools/registry';
import { eventsToolModule, EVENT_STATUS_BY_LIFECYCLE } from '../src/mcpTools/events';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/*
 * The event tools run a real session by voice, so the failures worth pinning
 * are the ones that are invisible from the transcript: a seat sold twice, a
 * guest's phone number read out loud in an answer to "who is coming", a
 * published event the public site cannot see, and a confirmation ticket that
 * can be spent more than once.
 *
 * Two of these tests read source text rather than behaviour. That is on
 * purpose: this module has to duplicate two constants it cannot import, and a
 * duplicated constant that nothing compares is the shape that gave this shop
 * four freight rates at once.
 */

const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

const AUTH = {
  accountId: 'acct', userId: 'host', userEmail: 'host@test.dev',
  tokenId: 'token-one', creatorTier: 'owner',
};
const OTHER_TOKEN = { ...AUTH, tokenId: 'token-two' };

const H = eventsToolModule.handlers;
const call = (name: keyof typeof H, db: SqliteD1, args: unknown, auth = AUTH) =>
  H[name]({ DB: db as unknown as D1Database }, auth as never, args);

function makeDb() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'host', accountId: 'acct', accountSlug: 'shop' });
  seedIdentity(db, { userId: 'rival', accountId: 'other-acct', accountSlug: 'other-shop' });
  return db;
}

function insertEvent(db: SqliteD1, o: {
  id: string; accountId?: string; slug: string; capacity?: number;
  lifecycle?: string; status?: string; date?: string; requiresApproval?: boolean;
}) {
  db.sqlite.prepare(`INSERT INTO events
    (id, account_id, slug, title, event_date, total_capacity, status, lifecycle_status, requires_approval)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      o.id, o.accountId ?? 'acct', o.slug, `Session ${o.slug}`,
      o.date ?? '2099-10-04T18:30:00.000Z', o.capacity ?? 4,
      o.status ?? 'draft', o.lifecycle ?? 'draft',
      o.requiresApproval === false ? 0 : 1,
    );
}

/** A party on the list, seats and all, without going through the tools. */
function insertParty(db: SqliteD1, o: {
  id: string; eventId: string; status: string; seatStatus?: string;
  phone?: string | null; email?: string | null; guests?: number;
}) {
  db.sqlite.prepare(`INSERT INTO event_attendees
    (id, account_id, event_id, full_name, phone_number, email, status, magic_token, guest_requests)
    VALUES (?, 'acct', ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      o.id, o.eventId, `Guest ${o.id}`, o.phone ?? null, o.email ?? null, o.status,
      `magic-${o.id}`,
      o.guests ? JSON.stringify(Array.from({ length: o.guests }, (_, i) => ({ nameHint: `Plus ${i}`, contact: null, approved: null }))) : null,
    );
  db.sqlite.prepare(`INSERT INTO event_party_members
    (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, 'acct', ?, ?, ?, 1, ?)`)
    .run(`seat-${o.id}`, o.eventId, o.id, `Guest ${o.id}`, o.seatStatus ?? (o.status === 'confirmed' ? 'confirmed' : 'requested'));
  for (let i = 0; i < (o.guests ?? 0); i++) {
    db.sqlite.prepare(`INSERT INTO event_party_members
      (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
      VALUES (?, 'acct', ?, ?, ?, 0, ?)`)
      .run(`seat-${o.id}-g${i}`, o.eventId, o.id, `Plus ${i}`, o.seatStatus ?? 'requested');
  }
}

/** Preview, then confirm with the token it handed back. */
async function previewThenConfirm(name: keyof typeof H, db: SqliteD1, args: Record<string, unknown>, auth = AUTH) {
  const preview = await call(name, db, args, auth) as any;
  expect(preview.confirmation_token, JSON.stringify(preview)).toBeTruthy();
  const committed = await call(name, db, { ...args, confirm: preview.confirmation_token }, auth) as any;
  return { preview, committed };
}

const source = (file: string) => readFileSync(join(process.cwd(), 'worker/src', file), 'utf8');

// ── the module contract ──

describe('module registration', () => {
  it('folds into the registry with a handler behind every definition', () => {
    const { defs, handlers } = combineToolModules([eventsToolModule]);
    expect(defs).toHaveLength(8);
    for (const def of defs) expect(typeof handlers[def.name]).toBe('function');
  });

  it('claims no scope that does not already exist', () => {
    // There is no events:read and this module must not pretend there is: the
    // scope list lives in mcp.ts, and a tool asking for a scope no minted token
    // can hold is a tool nobody can call.
    const real = new Set(['inventory:read', 'stock:write', 'customers:read', 'sales:read',
      'sales:write', 'catalog:write', 'customers:write', 'admin:write']);
    for (const def of eventsToolModule.defs) {
      expect(real.has(def.scope), `${def.name} asks for ${def.scope}`).toBe(true);
      expect(def.scope).not.toContain('event');
    }
  });

  it('takes no tool name that mcp.ts already answers to', () => {
    const mcp = source('mcp.ts');
    for (const def of eventsToolModule.defs) {
      expect(mcp.includes(`name: '${def.name}'`), `${def.name} collides with a built-in tool`).toBe(false);
    }
  });
});

// ── the constants this module had to copy ──

describe('what this module had to duplicate, and what it must not', () => {
  it('maps lifecycle to the legacy status column exactly as index.ts does', () => {
    // events.status is what every public route still selects on, so a drift
    // here publishes an event no visitor can see — with nothing failing.
    const block = source('index.ts').match(
      /const EVENT_STATUS_BY_LIFECYCLE[^=]*=\s*\{([^}]*)\}/,
    );
    expect(block, 'EVENT_STATUS_BY_LIFECYCLE not found in index.ts').toBeTruthy();
    const theirs: Record<string, string> = {};
    for (const [, key, value] of block![1].matchAll(/(\w+):\s*'([^']+)'/g)) theirs[key] = value;
    expect(theirs).toEqual(EVENT_STATUS_BY_LIFECYCLE);
  });

  it('keeps no ticket mechanism of its own', () => {
    // The preview/confirm ticket lives in mcpTools/tickets.ts, once. Four
    // modules each writing their own is how the guard drifts, so this module
    // must import it rather than grow a second copy back.
    const mine = source('mcpTools/events.ts');
    expect(mine).toContain("from './tickets'");
    expect(mine).not.toMatch(/INSERT INTO mcp_confirmation_tickets/);
    expect(mine).not.toMatch(/UPDATE mcp_confirmation_tickets/);
  });
});

// ── reads ──

describe('reads', () => {
  it('never returns another shop\'s events', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'mine', slug: 'mine' });
    insertEvent(db, { id: 'theirs', slug: 'theirs', accountId: 'other-acct' });

    const list = await call('list_events', db, { when: 'all' }) as any;
    expect(list.events.map((e: any) => e.id)).toEqual(['mine']);
    expect(await call('get_event', db, { event_id: 'theirs' })).toEqual({ error: 'event_not_found' });
    expect(await call('list_event_rsvps', db, { event_id: 'theirs' })).toEqual({ error: 'event_not_found' });
  });

  it('counts seats from party members, so a party of three is three seats', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 6, lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'confirmed', seatStatus: 'confirmed', guests: 2 });

    const got = await call('get_event', db, { slug: 'e1' }) as any;
    expect(got.event.seats_held).toBe(3);
    expect(got.event.seats_available).toBe(3);
    expect(got.event.is_full).toBe(false);
  });

  it('shows a draft in "upcoming", because that is the one that needs attention', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'draft', slug: 'draft-one' });
    const list = await call('list_events', db, {}) as any;
    expect(list.events).toHaveLength(1);
    expect(list.events[0].lifecycle_status).toBe('draft');
    expect(list.events[0].next_lifecycle_states).toEqual(['published', 'cancelled']);
  });

  it('puts no phone number or email address in any read payload', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'confirmed', phone: '+62811234567', email: 'guest@example.com' });

    const payloads = JSON.stringify([
      await call('list_events', db, { when: 'all' }),
      await call('get_event', db, { slug: 'e1' }),
      await call('list_event_rsvps', db, { slug: 'e1' }),
    ]);
    expect(payloads).not.toContain('+62811234567');
    expect(payloads).not.toContain('guest@example.com');

    // The name and the link back to the customer record are what a caller gets
    // instead — enough to look the contact up with get_customer, which holds
    // the scope for it.
    const roster = await call('list_event_rsvps', db, { slug: 'e1' }) as any;
    expect(roster.rsvps[0].name).toBe('Guest a');
    expect(roster.rsvps[0]).toHaveProperty('customer_id');
  });

  it('reports attendance as unknown until somebody marks it', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'confirmed' });
    const roster = await call('list_event_rsvps', db, { slug: 'e1' }) as any;
    // NULL is "the session has not happened", which is not "did not turn up".
    expect(roster.rsvps[0].attended).toBeNull();
  });
});

// ── confirmation tickets ──

describe('confirmation tickets', () => {
  it('spends once and refuses the replay', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    const preview = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published' }) as any;
    const first = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published', confirm: preview.confirmation_token }) as any;
    expect(first.committed).toBe(true);
    const replay = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published', confirm: preview.confirmation_token }) as any;
    expect(replay.error).toBeTruthy();
  });

  it('lives in D1, not in module memory', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published' });
    // Preview and confirm can land on different isolates, so the ticket has to
    // survive outside the process that made it.
    const row = db.sqlite.prepare('SELECT kind, account_id, token_id, consumed_at FROM mcp_confirmation_tickets').get() as any;
    expect(row.kind).toBe('set_event_lifecycle');
    expect(row.account_id).toBe('acct');
    expect(row.token_id).toBe('token-one');
    expect(row.consumed_at).toBeNull();
  });

  it('refuses a ticket pasted into the wrong tool without spending it', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    const preview = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published' }) as any;

    const wrongTool = await call('update_event', db, { event_id: 'e1', title: 'Renamed', confirm: preview.confirmation_token }) as any;
    expect(wrongTool.error).toBe('invalid_or_expired_confirmation_token');

    // Still live: the kind is in the guarded UPDATE, so the wrong tool cannot
    // burn a ticket the right one is about to need.
    const right = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published', confirm: preview.confirmation_token }) as any;
    expect(right.committed).toBe(true);
  });

  it('refuses a sibling token confirming what it never previewed', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    const preview = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published' }) as any;
    const stolen = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published', confirm: preview.confirmation_token }, OTHER_TOKEN) as any;
    expect(stolen.error).toBe('invalid_or_expired_confirmation_token');
  });
});

// ── event shape ──

describe('create_event', () => {
  it('refuses a capacity nobody stated and accepts one deliberately set to zero', async () => {
    const db = makeDb();
    await expect(call('create_event', db, { slug: 'a', title: 'A', event_date: '2099-01-01T00:00:00Z' }))
      .rejects.toThrow(/total_capacity is required/);

    const zero = await call('create_event', db, { slug: 'b', title: 'B', event_date: '2099-01-01T00:00:00Z', total_capacity: 0 }) as any;
    expect(zero.preview.fields.total_capacity).toBe(0);
    expect(zero.preview.capacity_note).toMatch(/no seat can be held/);
  });

  it('refuses a blank string where a value was expected', async () => {
    const db = makeDb();
    await expect(call('create_event', db, { slug: 'a', title: '   ', event_date: '2099-01-01T00:00:00Z', total_capacity: 4 }))
      .rejects.toThrow(/title is required/);
    await expect(call('create_event', db, { slug: 'a', title: 'A', event_date: '2099-01-01T00:00:00Z', total_capacity: 4, location_name: '' }))
      .rejects.toThrow(/location_name cannot be blank/);
  });

  it('creates a draft, never a published event', async () => {
    const db = makeDb();
    const { committed } = await previewThenConfirm('create_event', db, {
      slug: 'autumn-shou', title: 'Autumn Shou', event_date: '2099-10-04T18:30:00.000Z', total_capacity: 8,
    });
    expect(committed.lifecycle_status).toBe('draft');
    const row = db.sqlite.prepare('SELECT status, lifecycle_status, total_capacity, account_id FROM events WHERE slug = ?').get('autumn-shou') as any;
    // Publishing puts a page on the public internet; it is its own sentence.
    expect(row).toMatchObject({ status: 'draft', lifecycle_status: 'draft', total_capacity: 8, account_id: 'acct' });
  });

  it('refuses a slug another shop already holds, because slugs are public URLs', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'theirs', slug: 'taken', accountId: 'other-acct' });
    const result = await call('create_event', db, { slug: 'taken', title: 'Mine', event_date: '2099-01-01T00:00:00Z', total_capacity: 4 }) as any;
    expect(result.error).toBe('slug_taken');
  });
});

describe('update_event', () => {
  it('will not shrink capacity below the seats already given out', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 6, lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'confirmed', seatStatus: 'confirmed', guests: 2 });

    const refused = await call('update_event', db, { event_id: 'e1', total_capacity: 2 }) as any;
    expect(refused.error).toBe('capacity_below_held_seats');
    expect(refused.seats_held).toBe(3);

    const allowed = await call('update_event', db, { event_id: 'e1', total_capacity: 3 }) as any;
    expect(allowed.confirmation_token).toBeTruthy();
  });

  it('clears a field only when told to, and writes NULL rather than an empty string', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    db.sqlite.prepare('UPDATE events SET subtitle = ? WHERE id = ?').run('An evening of shou', 'e1');

    await previewThenConfirm('update_event', db, { event_id: 'e1', clear_fields: ['subtitle'] });
    expect((db.sqlite.prepare('SELECT subtitle FROM events WHERE id = ?').get('e1') as any).subtitle).toBeNull();

    await expect(call('update_event', db, { event_id: 'e1', clear_fields: ['title'] }))
      .rejects.toThrow(/title cannot be cleared/);
  });
});

describe('set_event_lifecycle', () => {
  it('moves the legacy status column in lockstep', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    await previewThenConfirm('set_event_lifecycle', db, { event_id: 'e1', to: 'published' });
    // The public routes still select on status = 'active'; a lifecycle written
    // alone is an event nobody outside the admin can see.
    expect(db.sqlite.prepare('SELECT status, lifecycle_status FROM events WHERE id = ?').get('e1'))
      .toMatchObject({ status: 'active', lifecycle_status: 'published' });
  });

  it('refuses a move the transition table does not have, and says what is legal', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', lifecycle: 'published', status: 'active' });
    const refused = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'draft' }) as any;
    expect(refused.error).toBe('illegal_transition');
    // There is no unpublish. Closing registration is the move that exists.
    expect(refused.allowed).toEqual(['registration_closed', 'cancelled']);
  });

  it('refuses to commit when the state moved under it', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    const preview = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published' }) as any;
    db.sqlite.prepare("UPDATE events SET lifecycle_status = 'cancelled', status = 'closed' WHERE id = ?").run('e1');
    const result = await call('set_event_lifecycle', db, { event_id: 'e1', to: 'published', confirm: preview.confirmation_token }) as any;
    expect(result.error).toBe('state_conflict');
    expect((db.sqlite.prepare('SELECT lifecycle_status FROM events WHERE id = ?').get('e1') as any).lifecycle_status).toBe('cancelled');
  });
});

// ── the list ──

describe('record_event_rsvp', () => {
  const person = { full_name: 'Maria', phone_number: '+62 811 234 567' };

  it('will not seat anyone on an event that is not published', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1' });
    const result = await call('record_event_rsvp', db, { event_id: 'e1', ...person }) as any;
    expect(result.error).toBe('event_not_published');
  });

  it('needs a way to reach the person', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', lifecycle: 'published', status: 'active' });
    await expect(call('record_event_rsvp', db, { event_id: 'e1', full_name: 'Maria' }))
      .rejects.toThrow(/phone_number or email is required/);
  });

  it('follows the event\'s approval setting when nothing is said, and obeys an explicit answer', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', lifecycle: 'published', status: 'active' });
    insertEvent(db, { id: 'e2', slug: 'e2', lifecycle: 'published', status: 'active', requiresApproval: false });

    const inherited = await call('record_event_rsvp', db, { event_id: 'e1', ...person }) as any;
    expect(inherited.preview.resulting_status).toBe('requested');

    const inheritedOpen = await call('record_event_rsvp', db, { event_id: 'e2', ...person }) as any;
    expect(inheritedOpen.preview.resulting_status).toBe('confirmed');

    // Absent means "whatever the event does"; present means obey. The operator
    // typing it in is the approval.
    const overridden = await call('record_event_rsvp', db, { event_id: 'e1', ...person, hold_for_approval: false }) as any;
    expect(overridden.preview.resulting_status).toBe('confirmed');
  });

  it('seats the party and hands back a private link', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 4, lifecycle: 'published', status: 'active' });
    const { committed } = await previewThenConfirm('record_event_rsvp', db, {
      event_id: 'e1', ...person, hold_for_approval: false, guests: ['Sam'],
    });
    expect(committed.status).toBe('confirmed');
    expect(committed.seats_taken).toBe(2);
    expect(committed.rsvp_link).toMatch(/^\/m\//);

    const seats = db.sqlite.prepare(
      `SELECT COUNT(*) AS n FROM event_party_members WHERE event_id = 'e1' AND seat_status = 'confirmed'`
    ).get() as any;
    expect(Number(seats.n)).toBe(2);
    const after = await call('get_event', db, { event_id: 'e1' }) as any;
    expect(after.event.seats_available).toBe(2);
  });

  it('keeps a name off the public guest list unless consent was given', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', lifecycle: 'published', status: 'active' });
    await previewThenConfirm('record_event_rsvp', db, { event_id: 'e1', ...person, hold_for_approval: false });
    const row = db.sqlite.prepare(`SELECT show_in_guest_list, source FROM event_attendees WHERE event_id = 'e1'`).get() as any;
    expect(Number(row.show_in_guest_list)).toBe(0);
    // So a hand-entered RSVP can later be told apart from a self-service one.
    expect(row.source).toBe('mcp');
  });

  it('refuses to oversell rather than writing a seat that does not exist', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 1, lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'confirmed', seatStatus: 'confirmed' });

    const result = await call('record_event_rsvp', db, { event_id: 'e1', ...person, hold_for_approval: false }) as any;
    expect(result.error).toBe('capacity_conflict');
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM event_attendees WHERE full_name = 'Maria'`).get()).toMatchObject({ n: 0 });
  });

  it('catches the same number written two different ways', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 6, lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'confirmed', phone: '+62811234567' });
    const result = await call('record_event_rsvp', db, { event_id: 'e1', full_name: 'Maria', phone_number: '0811234567' }) as any;
    expect(result.error).toBe('already_on_the_list');
  });
});

describe('approve_event_rsvp', () => {
  it('confirms the primary seat and holds an invitation for each approved guest', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 4, lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'requested', guests: 1 });

    const { committed } = await previewThenConfirm('approve_event_rsvp', db, { attendee_id: 'a', approve_guests: 1 });
    expect(committed).toMatchObject({ status: 'confirmed', guests_held: 1, seats_taken: 2 });
    expect(db.sqlite.prepare(`SELECT status FROM event_attendees WHERE id = 'a'`).get()).toMatchObject({ status: 'confirmed' });
    // Held, not confirmed: the seat is spoken for while the person in it is
    // still unknown.
    expect(db.sqlite.prepare(`SELECT seat_status FROM event_party_members WHERE is_primary = 0`).get()).toMatchObject({ seat_status: 'held' });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM guest_invites WHERE status = 'pending'`).get()).toMatchObject({ n: 1 });
  });

  it('returns no invite token, because the payload is not where a bearer link belongs', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 4, lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'requested', guests: 1 });
    const { committed } = await previewThenConfirm('approve_event_rsvp', db, { attendee_id: 'a', approve_guests: 1 });
    const token = (db.sqlite.prepare('SELECT invite_token FROM guest_invites').get() as any).invite_token;
    expect(JSON.stringify(committed)).not.toContain(token);
  });

  it('approves only a request', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'confirmed', seatStatus: 'confirmed' });
    expect(await call('approve_event_rsvp', db, { attendee_id: 'a' })).toMatchObject({ error: 'not_awaiting_approval' });
  });

  it('will not approve more guests than were asked for', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 8, lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'a', eventId: 'e1', status: 'requested', guests: 1 });
    expect(await call('approve_event_rsvp', db, { attendee_id: 'a', approve_guests: 3 }))
      .toMatchObject({ error: 'more_guests_than_requested' });
  });

  it('refuses rather than overselling when the room filled first', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'e1', slug: 'e1', capacity: 1, lifecycle: 'published', status: 'active' });
    insertParty(db, { id: 'seated', eventId: 'e1', status: 'confirmed', seatStatus: 'confirmed' });
    insertParty(db, { id: 'waiting', eventId: 'e1', status: 'requested' });

    const preview = await call('approve_event_rsvp', db, { attendee_id: 'waiting' }) as any;
    const result = await call('approve_event_rsvp', db, { attendee_id: 'waiting', confirm: preview.confirmation_token }) as any;
    expect(result.error).toBe('capacity_conflict');
    expect(db.sqlite.prepare(`SELECT status FROM event_attendees WHERE id = 'waiting'`).get()).toMatchObject({ status: 'requested' });
  });

  it('reaches nothing outside its own shop', async () => {
    const db = makeDb();
    insertEvent(db, { id: 'theirs', slug: 'theirs', accountId: 'other-acct', lifecycle: 'published', status: 'active' });
    db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token)
      VALUES ('rival', 'other-acct', 'theirs', 'Rival Guest', 'requested', 'magic-rival')`).run();
    expect(await call('approve_event_rsvp', db, { attendee_id: 'rival' })).toEqual({ error: 'attendee_not_found' });
  });
});

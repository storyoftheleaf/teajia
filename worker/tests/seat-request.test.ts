// Launch 2, slice H5 (todo/plans/guests-and-tea-masters-launch-2-run.md, hard
// question 8 and "Astra, H5: a seat by name"). A by-link door seats a guest by
// name alone; a by-request door still asks for a phone or an email; an older
// session behaves as before. The nine cases of the brief, one describe each.
// Also: photo_consent is NULL when the guest said nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { reservePartySeats } from '../src/eventDomain';
import { eventsToolModule } from '../src/mcpTools/events';
import {
  linkDoorFullAnswer, photoConsentValue, seatContact, seatDoorRule, seatIdFromKey, seatKey, seatRequirement, seatStatusFor,
} from '../src/seatRequest';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-seat-request-secret';
const DAY = 24 * 60 * 60 * 1000;
const KEY_A = 'browserkeyAAAAAAAAAAAAAAAAAAAAAA';
const KEY_B = 'browserkeyBBBBBBBBBBBBBBBBBBBBBB';

type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', accountId: 'ana-personal' };
const mei: Actor = { userId: 'mei', accountId: 'mei-home' };

let db: SqliteD1;
let limiter: { limit: (input: { key: string }) => Promise<{ success: boolean }> };

async function call(path: string, options: {
  actor?: Actor; method?: string; body?: unknown; ip?: string;
} = {}) {
  const { actor, body, method = 'GET', ip = '203.0.113.9' } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': ip });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.userId, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: 'true', RSVP_LIMITER: limiter,
  } as never, { waitUntil: () => undefined } as never);
}

const seat = (slug: string, body: Record<string, unknown>, options: { actor?: Actor; ip?: string } = {}) =>
  call(`/api/events/${slug}/rsvp`, { method: 'POST', body, ...options });

function personalAccount(actor: Actor) {
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(actor.accountId, actor.accountId, 'Ana’s Tea Chest', actor.userId, actor.userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`)
    .run(actor.accountId, actor.userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(actor.userId);
}

type TableOptions = {
  door?: 'request' | 'link' | 'open' | null; seats?: number; requiresApproval?: number | null;
  lifecycle?: string; status?: string; hostUserId?: string | null;
};
function table(id: string, accountId: string, options: TableOptions = {}) {
  const door = options.door === undefined ? 'link' : options.door;
  const requiresApproval = options.requiresApproval !== undefined ? options.requiresApproval : (door === 'link' ? 0 : 1);
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status)
    VALUES (?, ?, ?, ?, ?, ?, 'UTC', ?, ?, 'unlisted', 0, ?, ?, ?)`)
    .run(id, accountId, id, `Table ${id}`, new Date(Date.now() + 7 * DAY).toISOString().slice(0, 16), options.seats ?? 6,
      door, requiresApproval, options.hostUserId === undefined ? (accountId === ana.accountId ? ana.userId : null) : options.hostUserId,
      options.status ?? 'active', options.lifecycle ?? 'published');
}

function guest(id: string, eventId: string, accountId: string, status: string, contact: { phone?: string | null; email?: string | null } = {}) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, phone_number, email, status, magic_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, eventId, `Guest ${id}`, contact.phone ?? null, contact.email ?? null, status, `token-${id}`);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`).run(`seat-of-${id}`, accountId, eventId, id, `Guest ${id}`,
      status === 'confirmed' ? 'confirmed' : 'requested');
}

const count = (sql: string, ...values: unknown[]) => Number((db.sqlite.prepare(sql).get(...(values as never[])) as { n: number }).n);
const confirmedSeats = (eventId: string) => count(
  `SELECT COUNT(*) AS n FROM event_party_members WHERE event_id = ? AND seat_status IN ('held','confirmed')`, eventId);
const attendees = (eventId: string) => count('SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = ?', eventId);
const customers = (accountId: string) => count('SELECT COUNT(*) AS n FROM customers WHERE account_id = ?', accountId);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  limiter = { limit: async () => ({ success: true }) };
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner', bundles: ['gather'] });
  db.sqlite.prepare(`UPDATE accounts SET is_platform_owner = 1, public_enabled = 1 WHERE id = ?`).run(adrian.accountId);
  seedIdentity(db, { userId: ana.userId, accountId: 'ana-unused', publicEnabled: false });
  seedIdentity(db, { userId: mei.userId, accountId: mei.accountId, publicEnabled: false });
  personalAccount(ana);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('the decisions, on their own', () => {
  it('reads the door, the contact, what is required and the status', () => {
    expect([seatDoorRule('link'), seatDoorRule('request'), seatDoorRule(null), seatDoorRule('open')])
      .toEqual(['link', 'request', 'older', 'closed']);
    expect(seatContact({ phone_number: '   ', email: '' })).toEqual({ phone: null, email: null });
    expect(seatContact({ phone_number: 'none', email: ' a@b.c ' })).toEqual({ phone: null, email: 'a@b.c' });
    expect(seatRequirement('link', 'Mei', { phone: null, email: null })).toBeNull();
    expect(seatRequirement('request', 'Mei', { phone: null, email: null })?.code).toBe('contact_required');
    expect(seatRequirement('older', 'Mei', { phone: null, email: null })?.code).toBe('contact_required');
    expect(seatRequirement('link', '  ', { phone: null, email: null })?.code).toBe('full_name_required');
    expect(seatRequirement('closed', 'Mei', { phone: '+1', email: null })?.code).toBe('event_not_reservable');
    expect([seatStatusFor('link', 1), seatStatusFor('request', 0), seatStatusFor('older', 0), seatStatusFor('older', 1), seatStatusFor('older', null)])
      .toEqual(['confirmed', 'requested', 'confirmed', 'requested', 'requested']);
    expect([photoConsentValue(true), photoConsentValue(false), photoConsentValue(undefined), photoConsentValue(null)]).toEqual([1, 0, null, null]);
    expect([seatKey(KEY_A), seatKey('short'), seatKey('has spaces in it, twenty two'), seatKey(42)]).toEqual([KEY_A, null, null, null]);
    expect(linkDoorFullAnswer(0, 1).code).toBe('table_full');
    expect(linkDoorFullAnswer(1, 2).error).toBe('One seat is left, and you asked for 2. Ask for fewer, or ask the host.');
  });

  it('derives a seat id that does not show the key', async () => {
    const id = await seatIdFromKey('t1', KEY_A);
    expect(id).toMatch(/^seat-[0-9a-f]{32}$/);
    expect(id).not.toContain(KEY_A);
    expect(await seatIdFromKey('t1', KEY_A)).toBe(id);
    expect(await seatIdFromKey('t2', KEY_A)).not.toBe(id);
  });
});

describe('a by-link door seats a guest by name', () => {
  it('tells the session page its door, its host and who is pouring, so the form can ask for a name alone', async () => {
    table('t-link', ana.accountId);
    const answer = await (await call('/api/events/t-link/public')).json() as Record<string, unknown>;
    expect(answer).toMatchObject({ door: 'link', host: { name: 'ana', path: null }, pouring: [] });
    table('shop-old', adrian.accountId, { door: null });
    expect(await (await call('/api/events/shop-old/public')).json()).toMatchObject({ door: null });
  });

  it('confirms at once, hands back the guest’s own page, and makes no customer without a contact', async () => {
    table('t-link', ana.accountId);
    const response = await seat('t-link', { full_name: '  Mei  ' });
    expect(response.status).toBe(201);
    const body = await response.json() as Record<string, string>;
    expect(body.status).toBe('confirmed');
    expect(body.link).toBe(`https://hosts.test/m/${body.magic_token}`);
    expect(body.redirect_url).toBe(`/m/${body.magic_token}`);
    expect(db.sqlite.prepare('SELECT full_name, customer_id, phone_number, email FROM event_attendees WHERE magic_token = ?').get(body.magic_token))
      .toEqual({ full_name: 'Mei', customer_id: null, phone_number: null, email: null });
    expect(customers(ana.accountId)).toBe(0);
    expect(confirmedSeats('t-link')).toBe(1);
  });

  it('still makes a customer when the guest gives a contact', async () => {
    table('t-link', ana.accountId);
    expect((await seat('t-link', { full_name: 'Mei', phone_number: '+62 811 222 333' })).status).toBe(201);
    expect(customers(ana.accountId)).toBe(1);
  });

  it('records the photograph wish only when the guest gave one', async () => {
    table('t-link', ana.accountId);
    await seat('t-link', { full_name: 'Silent' });
    await seat('t-link', { full_name: 'Shy', photo_consent: false });
    await seat('t-link', { full_name: 'Happy', photo_consent: true });
    const rows = db.sqlite.prepare(`SELECT full_name, photo_consent FROM event_attendees WHERE event_id = 't-link' ORDER BY full_name`).all();
    expect(rows).toEqual([
      { full_name: 'Happy', photo_consent: 1 },
      { full_name: 'Shy', photo_consent: 0 },
      { full_name: 'Silent', photo_consent: null },
    ]);
    const list = await (await call('/api/me/tables/t-link', { actor: ana })).json() as { guests: Array<{ full_name: string; no_photographs: boolean }> };
    expect(Object.fromEntries(list.guests.map(g => [g.full_name, g.no_photographs]))).toEqual({ Happy: false, Shy: true, Silent: false });
  });
});

describe('case 1: two requests for the last seat at once', () => {
  it('gives the seat to one, because the count is in the insert itself, not in a read before it', async () => {
    table('t-last', ana.accountId, { seats: 1 });
    // Both requests read "one seat left" before either writes: the batches are
    // held until both reads have happened. Only the guarded insert decides.
    let release: () => void = () => undefined;
    const bothRead = new Promise<void>(resolve => { release = resolve; });
    let waiting = 0;
    const racing = {
      prepare: (sql: string) => db.prepare(sql),
      batch: async (statements: never[]) => {
        waiting += 1;
        if (waiting === 2) release();
        await bothRead;
        return db.batch(statements);
      },
    };
    const attempt = (n: number) => reservePartySeats({ DB: racing as never }, {
      accountId: ana.accountId, eventId: 't-last', participationId: `p${n}`, sourceState: 'requested', targetState: 'confirmed',
      seats: [{ id: `s${n}`, fullName: `Guest ${n}`, isPrimary: true, sourceState: null, targetState: 'confirmed' }],
      createParticipation: { columns: ['full_name', 'magic_token'], values: [`Guest ${n}`, `m${n}`] },
    });
    const results = await Promise.all([attempt(1), attempt(2)]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.find(r => !r.ok)).toEqual({ ok: false, code: 'capacity_conflict' });
    expect(confirmedSeats('t-last')).toBe(1);
    expect(attendees('t-last')).toBe(1);
  });

  it('tells the second guest at the route that the table is full', async () => {
    table('t-last', ana.accountId, { seats: 1 });
    const [first, second] = await Promise.all([seat('t-last', { full_name: 'One' }), seat('t-last', { full_name: 'Two' })]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const refused = [first, second].find(r => r.status === 409)!;
    expect(await refused.json()).toEqual({ error: 'This table is full.', code: 'table_full' });
    expect(confirmedSeats('t-last')).toBe(1);
    // No waiting list is made for them in this launch.
    expect(count(`SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = 't-last' AND status = 'waitlist'`)).toBe(0);
  });
});

describe('case 2: the same browser twice, and two guests with one name', () => {
  it('makes a repeat from one browser key idempotent, at once or later', async () => {
    table('t-link', ana.accountId);
    const together = await Promise.all([seat('t-link', { full_name: 'Mei', seat_key: KEY_A }), seat('t-link', { full_name: 'Mei', seat_key: KEY_A })]);
    const later = await seat('t-link', { full_name: 'Mei', seat_key: KEY_A });
    const bodies = await Promise.all([...together, later].map(r => r.json() as Promise<Record<string, unknown>>));
    expect(new Set(bodies.map(b => b.magic_token)).size).toBe(1);
    expect(bodies.filter(b => b.repeat === true)).toHaveLength(2);
    expect(attendees('t-link')).toBe(1);
    // The key itself is not stored anywhere.
    expect(JSON.stringify(db.sqlite.prepare(`SELECT * FROM event_attendees`).all())).not.toContain(KEY_A);
  });

  it('does not let one browser key fill a table, whatever name it sends', async () => {
    table('t-link', ana.accountId);
    for (const name of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) await seat('t-link', { full_name: name, seat_key: KEY_A });
    expect(confirmedSeats('t-link')).toBe(1);
  });

  it('seats two guests who share a name, from two browsers or with no key', async () => {
    table('t-link', ana.accountId);
    await seat('t-link', { full_name: 'Mei', seat_key: KEY_A });
    await seat('t-link', { full_name: 'Mei', seat_key: KEY_B });
    await seat('t-link', { full_name: 'Mei' });
    await seat('t-link', { full_name: 'Mei' });
    expect(attendees('t-link')).toBe(4);
  });

  it('ignores the key at a by-request door and at an older session, which tell guests apart by contact as before', async () => {
    table('t-request', ana.accountId, { door: 'request' });
    const first = await seat('t-request', { full_name: 'Mei', phone_number: '+62 811 222 333', seat_key: KEY_A });
    expect(first.status).toBe(201);
    const again = await seat('t-request', { full_name: 'Mei', phone_number: '+62 811 222 333', seat_key: KEY_A });
    expect(again.status).toBe(200);
    expect(await again.json()).not.toHaveProperty('magic_token');
    expect(attendees('t-request')).toBe(1);
  });
});

describe('case 3: a guest with no contact loses their link', () => {
  it('cannot be found by a phone or an email, and the answer says nothing either way', async () => {
    table('t-link', ana.accountId);
    await seat('t-link', { full_name: 'Mei' });
    const byPhone = await call('/api/events/t-link/find-rsvp', { method: 'POST', body: { phone_number: '+62 811 222 333' } });
    expect(byPhone.status).toBe(200);
    expect(JSON.stringify(await byPhone.json())).not.toMatch(/magic_token|\/m\//);
    expect((await call('/api/events/t-link/find-rsvp', { method: 'POST', body: { phone_number: '  ', email: '' } })).status).toBe(400);
  });

  it('is found again from the same browser, by its key', async () => {
    table('t-link', ana.accountId);
    const token = (await (await seat('t-link', { full_name: 'Mei', seat_key: KEY_A })).json() as { magic_token: string }).magic_token;
    const again = await (await seat('t-link', { full_name: 'Mei', seat_key: KEY_A })).json() as { magic_token: string; link: string };
    expect(again.magic_token).toBe(token);
    expect(again.link).toBe(`https://hosts.test/m/${token}`);
  });

  it('is found from their account when they took the seat signed in', async () => {
    table('t-link', ana.accountId);
    const token = (await (await seat('t-link', { full_name: 'Mei' }, { actor: mei })).json() as { magic_token: string }).magic_token;
    const found = await call('/api/events/t-link/find-rsvp', { method: 'POST', actor: mei });
    expect(found.status).toBe(200);
    expect((await found.json() as { magic_token: string }).magic_token).toBe(token);
    // Another person's account does not find it.
    expect((await call('/api/events/t-link/find-rsvp', { method: 'POST', actor: ana })).status).toBe(404);
  });
});

describe('case 4: the host changes the door', () => {
  it('keeps every confirmed guest when the door goes from link to request; new guests then wait and need a contact', async () => {
    table('t-link', ana.accountId, { seats: 12 });
    for (let n = 0; n < 10; n += 1) await seat('t-link', { full_name: `Guest ${n}` });
    expect(confirmedSeats('t-link')).toBe(10);
    expect((await call('/api/me/tables/t-link', { actor: ana, method: 'PUT', body: { door: 'request' } })).status).toBe(200);
    expect(confirmedSeats('t-link')).toBe(10);
    expect((await seat('t-link', { full_name: 'Late' })).status).toBe(400);
    const late = await seat('t-link', { full_name: 'Late', phone_number: '+62 811 000 001' });
    expect((await late.json() as { status: string }).status).toBe('requested');
    expect(confirmedSeats('t-link')).toBe(10);
  });

  it('leaves the four waiting guests waiting for the host’s yes when the door goes from request to link', async () => {
    table('t-request', ana.accountId, { door: 'request', seats: 6 });
    for (let n = 0; n < 4; n += 1) guest(`w${n}`, 't-request', ana.accountId, 'requested', { phone: `+62 811 100 00${n}` });
    expect((await call('/api/me/tables/t-request', { actor: ana, method: 'PUT', body: { door: 'link' } })).status).toBe(200);
    expect(count(`SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = 't-request' AND status = 'requested'`)).toBe(4);
    expect(confirmedSeats('t-request')).toBe(0);
    const walkIn = await seat('t-request', { full_name: 'Walk-in' });
    expect((await walkIn.json() as { status: string }).status).toBe('confirmed');
  });

  it('refuses a change of requires_approval that would part it from the door, in the admin and in the agent tool', async () => {
    table('t-link', ana.accountId);
    const put = (body: unknown) => call('/api/admin/events/t-link', { actor: ana, method: 'PUT', body });
    expect((await put({ requires_approval: 1 })).status).toBe(409);
    expect((await put({ requires_approval: 0, title: 'Same door' })).status).toBe(200);
    const auth = { accountId: ana.accountId, userId: ana.userId, userEmail: 'ana@test.dev', tokenId: 't-ana', scopes: [], creatorTier: 'platform_owner' };
    const preview = await eventsToolModule.handlers.update_event({ DB: db as unknown as D1Database }, auth as never, { event_id: 't-link', requires_approval: true });
    expect(preview).toMatchObject({ error: 'hosted_table_door' });
    expect(db.sqlite.prepare(`SELECT door, requires_approval FROM events WHERE id = 't-link'`).get()).toEqual({ door: 'link', requires_approval: 0 });
  });
});

describe('case 5: seats never go below the guests already seated', () => {
  beforeEach(() => {
    table('t-four', ana.accountId, { seats: 6 });
    for (let n = 0; n < 4; n += 1) guest(`c${n}`, 't-four', ana.accountId, 'confirmed');
  });
  const capacity = () => (db.sqlite.prepare(`SELECT total_capacity AS n FROM events WHERE id = 't-four'`).get() as { n: number }).n;

  it('is refused on the table’s own page', async () => {
    const response = await call('/api/me/tables/t-four', { actor: ana, method: 'PUT', body: { seats: 3 } });
    expect(response.status).toBe(409);
    expect(capacity()).toBe(6);
  });

  it('is refused in the admin, and a capacity that is not lowered is still saved', async () => {
    const lower = await call('/api/admin/events/t-four', { actor: ana, method: 'PUT', body: { total_capacity: 3 } });
    expect(lower.status).toBe(409);
    expect(await lower.json()).toMatchObject({ code: 'capacity_below_held_seats', seats_held: 4 });
    expect((await call('/api/admin/events/t-four', { actor: ana, method: 'PUT', body: { total_capacity: '3' } })).status).toBe(409);
    expect(capacity()).toBe(6);
    expect((await call('/api/admin/events/t-four', { actor: ana, method: 'PUT', body: { total_capacity: 4 } })).status).toBe(200);
    expect(capacity()).toBe(4);
    // An event already over its number (set before this guard) can still be edited.
    db.sqlite.prepare(`UPDATE events SET total_capacity = 2 WHERE id = 't-four'`).run();
    expect((await call('/api/admin/events/t-four', { actor: ana, method: 'PUT', body: { total_capacity: 2, title: 'Renamed' } })).status).toBe(200);
  });

  it('is refused by the agent tool at preview, and again at confirm when a seat was taken in between', async () => {
    const H = eventsToolModule.handlers;
    const auth = { accountId: ana.accountId, userId: ana.userId, userEmail: 'ana@test.dev', tokenId: 't-ana', scopes: [], creatorTier: 'platform_owner' };
    const env = { DB: db as unknown as D1Database };
    expect(await H.update_event(env, auth as never, { event_id: 't-four', total_capacity: 3 })).toMatchObject({ error: 'capacity_below_held_seats' });
    const preview = await H.update_event(env, auth as never, { event_id: 't-four', total_capacity: 4 }) as { confirmation_token: string };
    guest('c-late', 't-four', ana.accountId, 'confirmed');
    const confirmed = await H.update_event(env, auth as never, { event_id: 't-four', total_capacity: 4, confirm: preview.confirmation_token });
    expect(confirmed).toMatchObject({ error: 'capacity_below_held_seats' });
    expect(capacity()).toBe(6);
  });
});

describe('case 6: a party when one seat is left', () => {
  it('seats a party whole or not at all, and says how many seats are left', async () => {
    table('t-one-left', ana.accountId, { seats: 2 });
    await seat('t-one-left', { full_name: 'First' });
    const party = await seat('t-one-left', { full_name: 'Mei', guest_requests: [{ nameHint: 'my sister' }] });
    expect(party.status).toBe(409);
    expect(await party.json()).toEqual({
      error: 'One seat is left, and you asked for 2. Ask for fewer, or ask the host.', code: 'table_too_few_seats',
    });
    const plusOne = await seat('t-one-left', { full_name: 'Mei', plus_one: true, plus_one_name: 'Tao' });
    expect(plusOne.status).toBe(409);
    expect(attendees('t-one-left')).toBe(1);
    expect((await seat('t-one-left', { full_name: 'Mei' })).status).toBe(201);
    expect(confirmedSeats('t-one-left')).toBe(2);
  });
});

describe('case 7: every other session behaves as before', () => {
  it('a shop session with no door still needs a contact, waits for approval, and confirms at once when approval is off', async () => {
    table('shop-ask', adrian.accountId, { door: null, requiresApproval: 1 });
    table('shop-instant', adrian.accountId, { door: null, requiresApproval: 0 });
    expect(await (await seat('shop-ask', { full_name: 'Mei' })).json()).toMatchObject({ error: 'phone_number or email is required' });
    const asked = await seat('shop-ask', { full_name: 'Mei', email: 'mei@example.test', seat_key: KEY_A });
    expect(asked.status).toBe(201);
    const askedBody = await asked.json() as Record<string, unknown>;
    expect(askedBody.status).toBe('requested');
    expect(askedBody).not.toHaveProperty('link');
    expect(customers(adrian.accountId)).toBe(1);
    expect((await (await seat('shop-instant', { full_name: 'Mei', email: 'mei@example.test' })).json() as { status: string }).status).toBe('confirmed');
  });

  it('a full shop session answers as it did', async () => {
    table('shop-full', adrian.accountId, { door: null, requiresApproval: 0, seats: 1 });
    guest('there', 'shop-full', adrian.accountId, 'confirmed', { email: 'there@example.test' });
    const full = await seat('shop-full', { full_name: 'Mei', email: 'mei@example.test' });
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'Event capacity reached', code: 'capacity_conflict' });
  });

  it('a closed, completed or cancelled session takes no seat, and an open door is refused until Launch 3', async () => {
    table('t-closed', ana.accountId, { status: 'closed', lifecycle: 'registration_closed' });
    table('t-done', ana.accountId, { status: 'closed', lifecycle: 'completed' });
    table('t-cancelled', ana.accountId, { status: 'archived', lifecycle: 'cancelled' });
    for (const slug of ['t-closed', 't-done', 't-cancelled']) expect((await seat(slug, { full_name: 'Mei' })).status).toBe(404);
    table('t-open', ana.accountId, { door: 'open' });
    expect((await seat('t-open', { full_name: 'Mei', phone_number: '+62 811 222 333' })).status).toBe(409);
    expect(attendees('t-open')).toBe(0);
  });

  it('a by-request door needs a contact and waits for the yes', async () => {
    table('t-request', ana.accountId, { door: 'request' });
    expect((await seat('t-request', { full_name: 'Mei', phone_number: '   ' })).status).toBe(400);
    const asked = await seat('t-request', { full_name: 'Mei', phone_number: '+62 811 222 333' });
    expect((await asked.json() as { status: string }).status).toBe('requested');
    expect(confirmedSeats('t-request')).toBe(0);
  });
});

describe('case 8: one address taking every seat', () => {
  it('is held only by the durable limiter, ten a minute per address, which alone lets one address fill a table of six', async () => {
    const keys: string[] = [];
    let used = 0;
    limiter = { limit: async ({ key }) => { keys.push(key); used += 1; return { success: used <= 10 }; } };
    table('t-link', ana.accountId, { seats: 6 });
    for (let n = 0; n < 6; n += 1) expect((await seat('t-link', { full_name: `Bot ${n}` })).status).toBe(201);
    expect(confirmedSeats('t-link')).toBe(6);
    expect(new Set(keys)).toEqual(new Set(['203.0.113.9:create']));
    // Past ten in the window the address is refused before anything is read.
    table('t-other', ana.accountId);
    for (let n = 0; n < 4; n += 1) await seat('t-other', { full_name: `Bot ${n}` });
    expect((await seat('t-other', { full_name: 'Bot 99' })).status).toBe(429);
    expect(attendees('t-other')).toBe(4);
  });
});

describe('case 9: no contact never matches another guest', () => {
  it('does not match empty or blank phones and emails already stored, nor a customer with them', async () => {
    table('t-link', ana.accountId);
    guest('blank', 't-link', ana.accountId, 'confirmed', { phone: '', email: '' });
    db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, phone, email, whatsapp) VALUES ('c-blank', ?, 'Blank', '', '', '')`).run(ana.accountId);
    const response = await seat('t-link', { full_name: 'Mei', phone_number: '  ', email: '' });
    expect(response.status).toBe(201);
    const body = await response.json() as { magic_token: string };
    expect(body.magic_token).not.toBe('token-blank');
    expect(db.sqlite.prepare('SELECT customer_id, phone_number, email FROM event_attendees WHERE magic_token = ?').get(body.magic_token))
      .toEqual({ customer_id: null, phone_number: null, email: null });
    expect(customers(ana.accountId)).toBe(1);
    expect(attendees('t-link')).toBe(2);
  });
});

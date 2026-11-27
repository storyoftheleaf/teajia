// Launch 3, slices J1 and J2 (todo/plans/guests-and-tea-masters-launch-3-run.md,
// hard questions 2 and 3; Adrian, 2026-11-26):
//
// J1, the contract: migration 0141 (hosting_stopped_at, hosting_stopped_by,
// host_reach), and the helpers in worker/src/hostApproval.ts.
// J2: with ANYONE_HOSTS_OPEN on, any signed-in person hosts by request from
// their own private account; the by-link door stays the approved host's; a
// stopped host makes no new table and seats no one new, while guests already
// confirmed keep what they had; a host's first session is never listed. With
// the switch off, everything is exactly Launch 2.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { hostDoorSql, hostDoorsFor, hostingStoppedSql, hostStanding, listableHostedSessionSql } from '../src/hostApproval';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-anyone-hosts-secret';
const HOUR = 60 * 60 * 1000;
type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', name: 'Ana', accountId: 'ana-home' };
const bo: Actor = { userId: 'bo', name: 'Bo', accountId: 'bo-home' };

let db: SqliteD1;
const allow = { limit: async () => ({ success: true }) };

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; anyone?: boolean; few?: boolean } = {}) {
  const { actor, body, method = 'GET', anyone = true, few = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.name, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test',
    FEW_HOSTS_OPEN: few ? 'true' : 'false', ANYONE_HOSTS_OPEN: anyone ? 'true' : 'false',
    RSVP_LIMITER: allow, PUBLIC_MCP_LIMITER: allow, PROVIDER_LIMITER: allow, INQUIRY_LIMITER: allow,
  } as never, { waitUntil: () => undefined } as never);
}

const body = async (response: Response) => response.json() as Promise<Record<string, any>>;
const table = { date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), time: '16:00', timezone: 'Asia/Makassar' };
const approve = (userId: string, approved: boolean) =>
  call(`/api/platform/users/${userId}/host-approval`, { actor: adrian, method: 'PUT', body: { approved } });
const stop = (userId: string, stopped: boolean, actor = adrian) =>
  call(`/api/platform/users/${userId}/hosting-stopped`, { actor, method: 'PUT', body: { stopped } });
const personalAccountOf = (userId: string) =>
  db.sqlite.prepare('SELECT id FROM accounts WHERE personal_inventory_user_id = ?').get(userId) as { id: string } | undefined;

async function makeTable(actor: Actor, extra: Record<string, unknown> = {}, anyone = true) {
  return call('/api/me/tables', { actor, method: 'POST', body: { ...table, ...extra }, anyone });
}

async function ask(slug: string, name = 'Mei', anyone = true) {
  return call(`/api/events/${slug}/rsvp`, { method: 'POST', body: { full_name: name, phone_number: `+62 811 ${[...name].map(c => c.charCodeAt(0)).join('').slice(0, 9)}` }, anyone });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run(adrian.accountId);
  for (const person of [ana, bo]) seedIdentity(db, { userId: person.userId, accountId: person.accountId, publicEnabled: false });
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('J1, the contract', () => {
  it('migration 0141 adds the stop and the reach to the person, and nothing else changes', () => {
    const columns = (db.sqlite.prepare(`PRAGMA table_info('users')`).all() as { name: string }[]).map(c => c.name);
    expect(columns).toEqual(expect.arrayContaining(['hosting_stopped_at', 'hosting_stopped_by', 'host_reach']));
    expect(db.sqlite.prepare(`SELECT hosting_stopped_at, host_reach FROM users WHERE id = 'ana'`).get())
      .toEqual({ hosting_stopped_at: null, host_reach: null });
    for (const reach of ['invitation', 'teajia', 'listed']) {
      db.sqlite.prepare('UPDATE users SET host_reach = ? WHERE id = ?').run(reach, 'ana');
    }
    expect(() => db.sqlite.prepare('UPDATE users SET host_reach = ? WHERE id = ?').run('everyone', 'ana')).toThrow();
  });

  it('keeps every gate in hostDoorsFor: a stopped host has no door, approved or not, switch on or off', () => {
    expect(hostDoorsFor({ approved: false, stopped: false }, false)).toBeNull();
    expect(hostDoorsFor({ approved: false, stopped: false }, true)).toEqual(['request']);
    expect(hostDoorsFor({ approved: true, stopped: false }, true)).toEqual(['request', 'link']);
    expect(hostDoorsFor({ approved: true, stopped: true }, true)).toBeNull();
    expect(hostDoorsFor({ approved: false, stopped: true }, true)).toBeNull();
    expect(hostDoorsFor({ approved: true, stopped: true }, false)).toBeNull();
    // Launch 2's boolean form still reads the same.
    expect(hostDoorsFor(true, false)).toEqual(['request', 'link']);
    expect(hostDoorsFor(false, false)).toBeNull();
  });

  it('reads the standing in one place, and the door and the stop in SQL for the seat routes', async () => {
    expect(await hostStanding(db as unknown as D1Database, 'ana')).toEqual({ approved: false, stopped: false, reach: 'invitation' });
    expect(await hostStanding(db as unknown as D1Database, 'nobody')).toEqual({ approved: false, stopped: false, reach: 'invitation' });
    db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26', hosting_stopped_at = '2026-11-27' WHERE id = 'ana'`).run();
    expect(await hostStanding(db as unknown as D1Database, 'ana')).toEqual({ approved: true, stopped: true, reach: 'invitation' });

    db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id, personal_inventory_user_id)
      VALUES ('ana-chest', 'ana-chest', 'Chest', 'master', 'active', 0, 'ana', 'ana')`).run();
    const stopped = (id: string) => (db.sqlite.prepare(`SELECT ${hostingStoppedSql('a')} AS s FROM accounts a WHERE a.id = ?`).get(id) as { s: number }).s;
    expect(stopped('ana-chest')).toBe(1);
    // A shop is never a stopped host, whoever owns it.
    db.sqlite.prepare(`UPDATE accounts SET owner_user_id = 'ana' WHERE id = 'shop'`).run();
    expect(stopped('shop')).toBe(0);

    const door = (accountApproved: string | null, stored: string | null, accountId = 'ana-chest') => {
      db.sqlite.prepare('UPDATE accounts SET host_approved_at = ? WHERE id = ?').run(accountApproved, accountId);
      return (db.sqlite.prepare(`SELECT ${hostDoorSql('a', 'e')} AS door FROM accounts a, (SELECT ? AS door) e WHERE a.id = ?`)
        .get(stored, accountId) as { door: string | null }).door;
    };
    expect(door('2026-11-26', 'link')).toBe('link');
    expect(door(null, 'link')).toBe('request');
    expect(door(null, 'request')).toBe('request');
    expect(door(null, null)).toBeNull();
    expect(door(null, 'link', 'shop')).toBe('link');
  });
});

describe('J2, with the switch off: exactly Launch 2', () => {
  it('lets no unapproved person host, and opens nothing of their table', async () => {
    expect(await body(await call('/api/me/hosting', { actor: bo, anyone: false }))).toEqual({ approved: false, account_id: null, doors: null });
    expect((await makeTable(bo, {}, false)).status).toBe(404);
    expect(personalAccountOf('bo')).toBeUndefined();
    // The same person, the moment the switch opens, may host by request.
    expect(await body(await call('/api/me/hosting', { actor: bo }))).toEqual({ approved: false, account_id: null, doors: ['request'] });
  });

  it('closes a stranger’s table again when the switch closes', async () => {
    const made = await body(await makeTable(bo));
    expect((await call(`/api/events/${made.slug}/public`)).status).toBe(200);
    expect((await call(`/api/events/${made.slug}/public`, { anyone: false })).status).toBe(404);
    expect((await ask(made.slug, 'Mei', false)).status).toBe(404);
    expect((await call('/api/me/tables', { actor: bo, anyone: false })).status).toBe(404);
  });

  it('answers 404 on the stop route while Launch 2 is closed', async () => {
    expect((await call('/api/platform/users/bo/hosting-stopped', { actor: adrian, method: 'PUT', body: { stopped: true }, few: false })).status).toBe(404);
  });
});

describe('J2, with the switch on: anyone signed in hosts by request', () => {
  it('makes a stranger’s private account on first use and a by-request table in it', async () => {
    expect((await call('/api/me/tables', { method: 'POST', body: table })).status).toBe(401);
    const made = await makeTable(bo, { seats: 3 });
    expect(made.status).toBe(201);
    const account = personalAccountOf('bo');
    expect(account).toBeDefined();
    const row = db.sqlite.prepare('SELECT account_id, host_user_id, door, requires_approval, public_visibility, network_discovery FROM events').get();
    expect(row).toEqual({ account_id: account!.id, host_user_id: 'bo', door: 'request', requires_approval: 1, public_visibility: 'unlisted', network_discovery: 0 });
    expect(db.sqlite.prepare(`SELECT public_enabled, host_approved_at FROM accounts WHERE id = ?`).get(account!.id))
      .toEqual({ public_enabled: 0, host_approved_at: null });
    // Their own table list and page answer.
    expect((await body(await call('/api/me/tables', { actor: bo }))).tables).toHaveLength(1);
  });

  it('refuses a stranger the by-link door and the open door, on making and on changing', async () => {
    const link = await makeTable(bo, { door: 'link' });
    expect(link.status).toBe(403);
    expect((await body(link)).code).toBe('hosted_table_door_needs_approval');
    expect((await makeTable(bo, { door: 'open' })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM events').get()).toEqual({ n: 0 });

    const made = await body(await makeTable(bo));
    const change = await call(`/api/me/tables/${made.id}`, { actor: bo, method: 'PUT', body: { door: 'link' } });
    expect(change.status).toBe(403);
    expect((await call(`/api/me/tables/${made.id}`, { actor: bo, method: 'PUT', body: { door: 'open' } })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT door FROM events WHERE id = ?').get(made.id)).toEqual({ door: 'request' });
  });

  it('seats nobody at a stranger’s table without the host’s yes', async () => {
    const made = await body(await makeTable(bo));
    const page = await body(await call(`/api/events/${made.slug}/public`));
    expect(page.door).toBe('request');
    const noContact = await call(`/api/events/${made.slug}/rsvp`, { method: 'POST', body: { full_name: 'Mei' } });
    expect(noContact.status).toBe(400);
    const seat = await ask(made.slug);
    expect(seat.status).toBe(201);
    expect((await body(seat)).status).toBe('requested');
    const guest = db.sqlite.prepare('SELECT id FROM event_attendees').get() as { id: string };
    const yes = await call(`/api/me/tables/${made.id}/guests/${guest.id}/yes`, { actor: bo, method: 'PUT' });
    expect(yes.status).toBe(200);
    expect(db.sqlite.prepare('SELECT status FROM event_attendees WHERE id = ?').get(guest.id)).toEqual({ status: 'confirmed' });
  });

  it('gives a host Adrian approved the by-link door, which seats a guest at once', async () => {
    expect((await approve('ana', true)).status).toBe(200);
    expect((await body(await call('/api/me/hosting', { actor: ana }))).doors).toEqual(['request', 'link']);
    const made = await makeTable(ana, { door: 'link' });
    expect(made.status).toBe(201);
    const { slug } = await body(made);
    expect((await body(await call(`/api/events/${slug}/public`))).door).toBe('link');
    expect((await body(await ask(slug))).status).toBe('confirmed');
  });

  it('meets a by-link table by request once the host’s approval is withdrawn', async () => {
    await approve('ana', true);
    const { slug } = await body(await makeTable(ana, { door: 'link' }));
    await approve('ana', false);
    expect((await body(await call(`/api/events/${slug}/public`))).door).toBe('request');
    expect((await body(await ask(slug))).status).toBe('requested');
    // Launch 2 behaviour with the switch off: the table does not open at all.
    expect((await call(`/api/events/${slug}/public`, { anyone: false })).status).toBe(404);
  });
});

describe('J2, stopping one host', () => {
  async function stoppedTable() {
    const made = await body(await makeTable(bo, { seats: 4 }));
    const kept = await body(await ask(made.slug, 'Kept'));
    const keptRow = db.sqlite.prepare('SELECT id FROM event_attendees WHERE magic_token = ?').get(kept.magic_token) as { id: string };
    expect((await call(`/api/me/tables/${made.id}/guests/${keptRow.id}/yes`, { actor: bo, method: 'PUT' })).status).toBe(200);
    const waiting = await body(await ask(made.slug, 'Waiting'));
    const waitingRow = db.sqlite.prepare('SELECT id FROM event_attendees WHERE magic_token = ?').get(waiting.magic_token) as { id: string };
    db.sqlite.prepare("UPDATE events SET address_text = 'Jalan Teduh 7' WHERE id = ?").run(made.id);
    expect((await stop('bo', true)).status).toBe(200);
    return { made, kept, waitingRow };
  }

  it('lets only the platform owner stop or restart a host', async () => {
    expect((await stop('bo', true, ana)).status).toBe(403);
    expect((await call('/api/platform/users/bo/hosting-stopped', { method: 'PUT', body: { stopped: true } })).status).toBe(401);
    expect((await call('/api/platform/users/bo/hosting-stopped', { actor: adrian, method: 'PUT', body: { stopped: 'yes' } })).status).toBe(400);
    expect((await stop('nobody', true)).status).toBe(404);
    expect(await body(await stop('bo', true))).toEqual({ ok: true, hosting_stopped: true });
    expect(db.sqlite.prepare(`SELECT hosting_stopped_by FROM users WHERE id = 'bo'`).get()).toEqual({ hosting_stopped_by: 'adrian' });
    const users = (await body(await call('/api/platform/users', { actor: adrian }))).users as { id: string; hosting_stopped_at: string | null }[];
    expect(users.find(u => u.id === 'bo')?.hosting_stopped_at).toEqual(expect.any(String));
    expect(await body(await stop('bo', false))).toEqual({ ok: true, hosting_stopped: false });
    expect(db.sqlite.prepare(`SELECT hosting_stopped_at FROM users WHERE id = 'bo'`).get()).toEqual({ hosting_stopped_at: null });
  });

  it('makes no new table for a stopped host, approved or not', async () => {
    await approve('ana', true);
    await stop('ana', true);
    await stop('bo', true);
    for (const actor of [ana, bo]) {
      const hosting = await body(await call('/api/me/hosting', { actor }));
      expect(hosting).toMatchObject({ doors: null, stopped: true });
      expect((await makeTable(actor)).status).toBe(404);
    }
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM events').get()).toEqual({ n: 0 });
  });

  it('seats no one new, by any door, while confirmed guests keep what they had', async () => {
    const { made, kept, waitingRow } = await stoppedTable();
    // The host still sees the table, and cannot seat or change anything.
    expect((await call(`/api/me/tables/${made.id}`, { actor: bo })).status).toBe(200);
    expect((await makeTable(bo)).status).toBe(403);
    const yes = await call(`/api/me/tables/${made.id}/guests/${waitingRow.id}/yes`, { actor: bo, method: 'PUT' });
    expect(yes.status).toBe(403);
    expect((await body(yes)).code).toBe('hosting_stopped');
    expect((await call(`/api/admin/attendees/${waitingRow.id}/approve`, { actor: { ...bo, accountId: personalAccountOf('bo')!.id }, method: 'PUT', body: {} })).status).toBe(403);
    expect((await call(`/api/me/tables/${made.id}`, { actor: bo, method: 'PUT', body: { seats: 10 } })).status).toBe(403);
    expect(db.sqlite.prepare('SELECT status FROM event_attendees WHERE id = ?').get(waitingRow.id)).toEqual({ status: 'requested' });

    // A stranger asking is told only that the table is not taking seats.
    const refused = await ask(made.slug, 'New');
    expect(refused.status).toBe(409);
    const answer = await refused.text();
    expect(answer).toContain('This table is not taking seats.');
    expect(answer.toLowerCase()).not.toMatch(/stop|paus|host/);
    expect(db.sqlite.prepare(`SELECT count(*) AS n FROM event_attendees WHERE full_name = 'New'`).get()).toEqual({ n: 0 });

    // An offered seat from the waiting list is not claimed either.
    db.sqlite.prepare(`UPDATE event_attendees SET status = 'waitlist', claim_expires_at = ? WHERE id = ?`)
      .run(new Date(Date.now() + HOUR).toISOString(), waitingRow.id);
    const token = (db.sqlite.prepare('SELECT magic_token FROM event_attendees WHERE id = ?').get(waitingRow.id) as { magic_token: string }).magic_token;
    expect((await call(`/api/rsvp/${token}/claim`, { method: 'POST' })).status).toBe(404);

    // The confirmed guest keeps their seat and their page, the page names no reason.
    const page = await call(`/api/rsvp/${kept.magic_token}`);
    expect(page.status).toBe(200);
    const pageText = await page.text();
    expect(pageText.toLowerCase()).not.toMatch(/stopped|paused/);
    expect(JSON.parse(pageText).attendee.status).toBe('confirmed');
    expect(JSON.parse(pageText).event.address_text).toBe('Jalan Teduh 7');
    // The session page still opens for them.
    expect((await call(`/api/events/${made.slug}/public`)).status).toBe(200);
  });

  it('hosts again once Adrian lets them', async () => {
    const { made, waitingRow } = await stoppedTable();
    await stop('bo', false);
    expect((await call(`/api/me/tables/${made.id}/guests/${waitingRow.id}/yes`, { actor: bo, method: 'PUT' })).status).toBe(200);
    expect((await makeTable(bo)).status).toBe(201);
    expect((await ask(made.slug, 'After')).status).toBe(201);
  });
});

describe('J2, a host’s first session is never listed', () => {
  function event(id: string, hostUserId: string | null, createdAt: string, accountId = 'shop') {
    db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone,
        public_visibility, network_discovery, host_user_id, status, lifecycle_status, created_at)
      VALUES (?, ?, ?, ?, ?, 6, 'UTC', 'public', 1, ?, 'active', 'published', ?)`)
      .run(id, accountId, id, `Session ${id}`, new Date(Date.now() + 10 * 86400000).toISOString(), hostUserId, createdAt);
  }
  // Ana's own account is her personal one: her tables live there.
  const personal = (userId: string, accountId: string) =>
    db.sqlite.prepare('UPDATE accounts SET personal_inventory_user_id = ?, owner_user_id = ? WHERE id = ?').run(userId, userId, accountId);

  it('lists a person’s table only after their first, and leaves the shop’s sessions alone, host named or not', async () => {
    personal('ana', 'ana-home');
    personal('bo', 'bo-home');
    event('shop-own', null, '2026-11-01 10:00:00');
    event('shop-poured-by-ana', 'ana', '2026-11-01 09:00:00');
    event('ana-first', 'ana', '2026-11-02 10:00:00', 'ana-home');
    event('ana-second', 'ana', '2026-11-03 10:00:00', 'ana-home');
    event('bo-first', 'bo', '2026-11-03 10:00:00', 'bo-home');
    const listable = (db.sqlite.prepare(`SELECT e.id FROM events e WHERE ${listableHostedSessionSql('e')} ORDER BY e.id`).all() as { id: string }[])
      .map(row => row.id);
    expect(listable).toEqual(['ana-second', 'shop-own', 'shop-poured-by-ana']);
    // The shop's sessions are on the public list exactly as before, the one naming Ana as host included.
    const listed = (await body(await call('/api/events')) as unknown as { id: string }[]).map(row => row.id).sort();
    expect(listed).toEqual(['shop-own', 'shop-poured-by-ana']);
  });

  it('treats two sessions made in the same second by their order, so exactly one is first', () => {
    personal('ana', 'ana-home');
    event('b', 'ana', '2026-11-02 10:00:00', 'ana-home');
    event('a', 'ana', '2026-11-02 10:00:00', 'ana-home');
    const listable = (db.sqlite.prepare(`SELECT e.id FROM events e WHERE ${listableHostedSessionSql('e')}`).all() as { id: string }[]).map(r => r.id);
    expect(listable).toEqual(['b']);
  });
});

describe('J3, old private sits stay exactly as they were', () => {
  it('reads the same sits, notes and invitations with the switch on and off', async () => {
    const sitBase = '/api/me/private-sits';
    const made = await call(sitBase, { actor: bo, method: 'POST', body: { requestId: crypto.randomUUID(), date: '2026-11-20', tea: { name: 'Rock tea' } }, anyone: false });
    expect(made.status).toBe(201);
    const { id } = await body(made);
    expect((await call(`${sitBase}/${id}/note`, { actor: bo, method: 'PUT', body: { note: 'Quiet morning' }, anyone: false })).status).toBe(200);
    const before = db.sqlite.prepare('SELECT * FROM member_private_sits').all();

    const off = await body(await call(sitBase, { actor: bo, anyone: false }));
    const on = await body(await call(sitBase, { actor: bo }));
    expect(on).toEqual(off);
    expect(on.sits).toEqual([expect.objectContaining({ id, date: '2026-11-20', note: 'Quiet morning' })]);
    expect(await body(await call(`${sitBase}/${id}`, { actor: bo }))).toEqual(await body(await call(`${sitBase}/${id}`, { actor: bo, anyone: false })));

    // Making a hosted table touches no old sit.
    expect((await makeTable(bo)).status).toBe(201);
    expect(db.sqlite.prepare('SELECT * FROM member_private_sits').all()).toEqual(before);
    expect((await body(await call(sitBase, { actor: bo }))).sits).toHaveLength(1);
  });
});

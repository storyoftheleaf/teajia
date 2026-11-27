// Launch 2 contract (slice H1, todo/plans/guests-and-tea-masters-launch-2-run.md):
// the migration, the two gates (the switch and host approval) on every new
// route, the door 'open' refused, and a host's tables scoped to that host.
// Slices H2, H3 and H9 add their own tests beside this one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { hostApproved, hostDoorsFor, publicSessionHostSql } from '../src/hostApproval';
import { fewHosts, fewHostsStatements } from '../sandbox/few-hosts-fixture.mjs';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-few-hosts-secret';
type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'platform-home' };
const ana: Actor = { userId: 'ana', name: 'Ana', accountId: 'ana-home' };
const bo: Actor = { userId: 'bo', name: 'Bo', accountId: 'bo-home' };
const cy: Actor = { userId: 'cy', name: 'Cy', accountId: 'cy-home' };

let db: SqliteD1;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean } = {}) {
  const { actor, body, method = 'GET', open = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json' });
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
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: open ? 'true' : 'false', ANYONE_HOSTS_OPEN: 'false',
  } as never);
}

const approve = (userId: string, approved: boolean, actor = adrian) =>
  call(`/api/platform/users/${userId}/host-approval`, { actor, method: 'PUT', body: { approved } });

// Always a day ahead, so the table writer's past-day refusal never trips this file.
const table = { date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), time: '16:00', timezone: 'Asia/Makassar' };

/** A personal account the way ensurePersonalInventoryAccount makes one. */
function personalAccount(userId: string, approved: boolean) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, ?)`)
    .run(id, id, id, userId, userId, approved ? '2026-11-26T00:00:00Z' : null);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`)
    .run(id, userId);
  if (approved) db.sqlite.prepare('UPDATE users SET host_approved_at = ? WHERE id = ?').run('2026-11-26T00:00:00Z', userId);
  return id;
}

function hostedEvent(id: string, accountId: string, hostUserId: string | null, date = '2026-12-01') {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, lifecycle_status)
    VALUES (?, ?, ?, ?, ?, 6, 'Asia/Makassar', 'link', 0, 'unlisted', 0, ?, 'published')`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, date, hostUserId);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  for (const person of [ana, bo, cy]) seedIdentity(db, { userId: person.userId, accountId: person.accountId, publicEnabled: false });
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('migration 0129', () => {
  it('adds the host marks, the host and door of a session, and the private guest book', () => {
    const columns = (table: string) => (db.sqlite.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as { name: string }[])
      .map(row => row.name);
    expect(columns('users')).toEqual(expect.arrayContaining(['host_approved_at', 'host_approved_by']));
    expect(columns('accounts')).toEqual(expect.arrayContaining(['host_approved_at', 'host_approved_by']));
    expect(columns('events')).toEqual(expect.arrayContaining(['host_user_id', 'door']));
    expect(columns('host_guest_notes')).toEqual(
      ['id', 'account_id', 'host_user_id', 'event_id', 'attendee_id', 'note', 'updated_at']);
  });

  it('allows the three doors in the table and nothing else', () => {
    hostedEvent('e-door', ana.accountId, null);
    for (const door of ['request', 'link', 'open', null]) {
      db.sqlite.prepare('UPDATE events SET door = ? WHERE id = ?').run(door, 'e-door');
    }
    expect(() => db.sqlite.prepare('UPDATE events SET door = ? WHERE id = ?').run('anyone', 'e-door')).toThrow(/CHECK/);
  });

  it('keeps a private line between 1 and 500 characters, one per host, session and guest', () => {
    const insert = db.sqlite.prepare(`INSERT INTO host_guest_notes (id, account_id, host_user_id, event_id, attendee_id, note, updated_at)
      VALUES (?, 'acc', 'ana', 'e', 'g', ?, 'now')`);
    expect(() => insert.run('n0', '')).toThrow(/CHECK/);
    expect(() => insert.run('n1', 'x'.repeat(501))).toThrow(/CHECK/);
    insert.run('n2', 'Likes it strong');
    expect(() => insert.run('n3', 'Again')).toThrow(/UNIQUE/);
  });
});

describe('who may host', () => {
  it('opens a session by link for a public account or an approved host’s private account, and nothing else', () => {
    const personal = personalAccount('ana', true);
    const unapproved = personalAccount('bo', false);
    db.sqlite.prepare(`UPDATE accounts SET status = 'active', public_enabled = 1 WHERE id = ?`).run(adrian.accountId);
    const opens = (id: string) => Boolean(db.sqlite.prepare(`SELECT 1 FROM accounts a WHERE a.id = ? AND ${publicSessionHostSql('a')}`).get(id));
    expect(opens(adrian.accountId)).toBe(true);
    expect(opens(personal)).toBe(true);
    expect(opens(unapproved)).toBe(false);
    expect(opens(cy.accountId)).toBe(false);
    db.sqlite.prepare(`UPDATE accounts SET status = 'suspended' WHERE id = ?`).run(personal);
    expect(opens(personal)).toBe(false);
  });

  it('keeps the gate in one place that Launch 3 lifts without reshaping anything', () => {
    // Launch 2: approval is the only way in, and it gives both doors.
    expect(hostDoorsFor(true, false)).toEqual(['request', 'link']);
    expect(hostDoorsFor(false, false)).toBeNull();
    // Launch 3 (anyone hosts): the unapproved get the by-request door only.
    expect(hostDoorsFor(false, true)).toEqual(['request']);
    expect(hostDoorsFor(true, true)).toEqual(['request', 'link']);
    const unapproved = personalAccount('bo', false);
    const opens = (anyoneHosts: boolean) => Boolean(db.sqlite.prepare(
      `SELECT 1 FROM accounts a WHERE a.id = ? AND ${publicSessionHostSql('a', { anyoneHosts })}`).get(unapproved));
    expect(opens(false)).toBe(false);
    expect(opens(true)).toBe(true);
    // A shop account that is not public still never opens.
    expect(Boolean(db.sqlite.prepare(
      `SELECT 1 FROM accounts a WHERE a.id = ? AND ${publicSessionHostSql('a', { anyoneHosts: true })}`).get(cy.accountId))).toBe(false);
  });

  it('lets only the platform owner approve or withdraw a host, and copies the mark onto their account', async () => {
    const personal = personalAccount('ana', false);
    expect((await approve('ana', true, bo)).status).toBe(403);
    expect((await call('/api/platform/users/ana/host-approval', { method: 'PUT', body: { approved: true } })).status).toBe(401);
    expect(await hostApproved(db as unknown as D1Database, 'ana')).toBe(false);

    const response = await approve('ana', true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, may_host: true });
    expect(await hostApproved(db as unknown as D1Database, 'ana')).toBe(true);
    expect(db.sqlite.prepare('SELECT host_approved_by FROM accounts WHERE id = ?').get(personal)).toEqual({ host_approved_by: 'adrian' });

    expect((await approve('ana', false)).status).toBe(200);
    expect(await hostApproved(db as unknown as D1Database, 'ana')).toBe(false);
    expect(db.sqlite.prepare('SELECT host_approved_at FROM accounts WHERE id = ?').get(personal)).toEqual({ host_approved_at: null });
    expect((await approve('nobody', true)).status).toBe(404);
    expect((await call('/api/platform/users/ana/host-approval', { actor: adrian, method: 'PUT', body: { approved: 'yes' } })).status).toBe(400);
  });
});

describe('the switch', () => {
  it('answers 404 on every new route while Launch 2 is closed, even to an approved host and to Adrian', async () => {
    personalAccount('ana', true);
    hostedEvent('e-ana', 'ana-personal', 'ana');
    const routes: [string, string, Actor, unknown?][] = [
      ['PUT', '/api/platform/users/ana/host-approval', adrian, { approved: true }],
      ['GET', '/api/me/hosting', ana],
      ['GET', '/api/me/tables', ana],
      ['POST', '/api/me/tables', ana, table],
      ['GET', '/api/me/tables/e-ana', ana],
      ['GET', '/api/me/tables/e-ana/notes', ana],
      ['PUT', '/api/me/tables/e-ana/guests/g/note', ana, { note: 'Likes it strong' }],
      ['GET', '/api/me/tables/e-ana/way', ana],
      ['PUT', '/api/me/tables/e-ana/way', ana, { venue_guide: { steps: [] } }],
      ['POST', '/api/me/tables/e-ana/way/keep', ana, { name: 'Home' }],
    ];
    for (const [method, path, actor, body] of routes) {
      expect((await call(path, { actor, method, body, open: false })).status, `${method} ${path}`).toBe(404);
    }
    expect(db.sqlite.prepare(`SELECT count(*) AS n FROM events`).get()).toEqual({ n: 1 });
  });
});

describe('the host routes', () => {
  it('answer 404 to a signed-in person Adrian has not approved, and make nothing', async () => {
    const hosting = await call('/api/me/hosting', { actor: bo });
    expect(await hosting.json()).toEqual({ approved: false, account_id: null, doors: null });
    for (const [method, path, body] of [
      ['GET', '/api/me/tables'], ['POST', '/api/me/tables', table], ['GET', '/api/me/tables/anything'],
      ['GET', '/api/me/tables/anything/notes'], ['PUT', '/api/me/tables/anything/guests/g/note', { note: 'x' }],
      ['GET', '/api/me/tables/anything/way'], ['PUT', '/api/me/tables/anything/way', { venue_guide: { steps: [] } }],
    ] as [string, string, unknown?][]) {
      expect((await call(path, { actor: bo, method, body })).status, `${method} ${path}`).toBe(404);
    }
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM accounts WHERE personal_inventory_user_id = ?').get('bo')).toEqual({ n: 0 });
  });

  it('ask a signed-out caller to sign in', async () => {
    expect((await call('/api/me/hosting')).status).toBe(401);
    expect((await call('/api/me/tables')).status).toBe(401);
  });

  it('let an approved host make their private account and make a table', async () => {
    expect((await approve('ana', true)).status).toBe(200);
    expect(await (await call('/api/me/hosting', { actor: ana })).json()).toEqual({ approved: true, account_id: null, doors: ['request', 'link'] });

    const made = await call('/api/me/tables', { actor: ana, method: 'POST', body: { ...table, seats: 4, door: 'link', name: 'Winter tea' } });
    expect(made.status).toBe(201);
    expect(await made.json()).toMatchObject({ id: expect.any(String), slug: expect.any(String), link: expect.any(String) });
    const account = db.sqlite.prepare(`SELECT id, kind, public_enabled, host_approved_at IS NOT NULL AS approved
      FROM accounts WHERE personal_inventory_user_id = 'ana'`).get() as Record<string, unknown>;
    expect(account).toMatchObject({ kind: 'master', public_enabled: 0, approved: 1 });
    expect(await (await call('/api/me/hosting', { actor: ana })).json()).toEqual({ approved: true, account_id: account.id, doors: ['request', 'link'] });
    // Asking again uses the same account.
    expect((await call('/api/me/tables', { actor: ana, method: 'POST', body: table })).status).toBe(201);
    expect(db.sqlite.prepare(`SELECT count(*) AS n FROM accounts WHERE personal_inventory_user_id = 'ana'`).get()).toEqual({ n: 1 });

    // The guest book (H9) answers only for a table of hers.
    expect((await call('/api/me/tables/anything/notes', { actor: ana })).status).toBe(404);
    expect((await call('/api/me/tables/anything/guests/g/note', { actor: ana, method: 'PUT', body: { note: 'x' } })).status).toBe(404);
  });

  it('refuse the open door, and any table without a true day, time and time zone, before making anything', async () => {
    personalAccount('ana', true);
    db.sqlite.prepare(`DELETE FROM account_members WHERE account_id = 'ana-personal'`).run();
    db.sqlite.prepare(`DELETE FROM accounts WHERE id = 'ana-personal'`).run();
    for (const body of [
      { ...table, door: 'open' },
      { ...table, door: 'anyone' },
      { ...table, date: '2026-02-30' },
      { ...table, date: 'next friday' },
      { ...table, time: '25:00' },
      { ...table, timezone: 'Mars/Olympus' },
      { ...table, seats: 0 },
      { ...table, seats: 2.5 },
      { ...table, name: 'x'.repeat(121) },
      { time: '16:00', timezone: 'Asia/Makassar' },
      null,
    ]) {
      const response = await call('/api/me/tables', { actor: ana, method: 'POST', body });
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    const open = await (await call('/api/me/tables', { actor: ana, method: 'POST', body: { ...table, door: 'open' } })).json() as { code: string };
    expect(open.code).toBe('hosted_table_door');
    expect(db.sqlite.prepare(`SELECT count(*) AS n FROM accounts WHERE personal_inventory_user_id = 'ana'`).get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare(`SELECT count(*) AS n FROM events`).get()).toEqual({ n: 0 });
  });

  it('never show a host another person’s session', async () => {
    const anaAccount = personalAccount('ana', true);
    const boAccount = personalAccount('bo', true);
    hostedEvent('e-ana-1', anaAccount, 'ana', '2026-12-01');
    hostedEvent('e-ana-2', anaAccount, 'ana', '2026-12-08');
    hostedEvent('e-bo', boAccount, 'bo');
    // Named as host in a shop's session, which is not her own account.
    hostedEvent('e-shop', adrian.accountId, 'ana');
    // In her account but naming someone else as host.
    hostedEvent('e-stray', anaAccount, 'bo');
    db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status) VALUES
      ('g-1', ?, 'e-ana-1', 'Rui', 'm-1', 'confirmed'),
      ('g-2', ?, 'e-ana-1', 'Lia', 'm-2', 'requested'),
      ('g-3', ?, 'e-bo', 'Bo guest', 'm-3', 'confirmed')`).run(anaAccount, anaAccount, boAccount);

    const list = await (await call('/api/me/tables', { actor: ana })).json() as { tables: Record<string, any>[] };
    expect(list.tables.map(row => row.id)).toEqual(['e-ana-2', 'e-ana-1']);
    expect(list.tables[1]).toMatchObject({
      slug: 'slug-e-ana-1', door: 'link', seats: 6, guests: { confirmed: 1, requested: 1, waitlist: 0 },
      link: 'https://hosts.test/event/slug-e-ana-1',
    });

    const one = await (await call('/api/me/tables/e-ana-1', { actor: ana })).json() as Record<string, any>;
    expect(one.table).toMatchObject({ id: 'e-ana-1', door: 'link', link: 'https://hosts.test/event/slug-e-ana-1' });
    expect(one.guests.map((guest: { id: string }) => guest.id)).toEqual(['g-1', 'g-2']);
    expect(one.guests[0]).not.toHaveProperty('magic_token');
    for (const id of ['e-bo', 'e-shop', 'e-stray', 'missing']) {
      expect((await call(`/api/me/tables/${id}`, { actor: ana })).status, id).toBe(404);
    }
    const boList = await (await call('/api/me/tables', { actor: bo })).json() as { tables: { id: string }[] };
    expect(boList.tables.map(row => row.id)).toEqual(['e-bo']);
  });
});

describe('the sandbox fixture', () => {
  it('seeds one approved host with one finished hosted table and one open one in her private account', async () => {
    // In the sandbox the operator fixture runs first; here, only the approver it names.
    seedIdentity(db, { userId: 'sandbox-operator', accountId: 'sandbox-home' });
    for (const statement of fewHostsStatements) db.sqlite.exec(statement);
    expect(await hostApproved(db as unknown as D1Database, fewHosts.host.id)).toBe(true);
    const account = db.sqlite.prepare('SELECT public_enabled, kind FROM accounts WHERE id = ?').get(fewHosts.accountId);
    expect(account).toEqual({ public_enabled: 0, kind: 'master' });
    const host = { userId: fewHosts.host.id, name: fewHosts.host.name, accountId: fewHosts.accountId };
    const list = await (await call('/api/me/tables', { actor: host })).json() as { tables: Record<string, any>[] };
    // The finished table, and the next one a week ahead (H4) with two guests waiting.
    expect(list.tables.map(row => row.id)).toEqual([fewHosts.next.eventId, fewHosts.eventId]);
    expect(list.tables[0]).toMatchObject({ door: 'request', lifecycle_status: 'published', guests: { confirmed: 0, requested: 2, waitlist: 0 } });
    expect(list.tables[1]).toMatchObject({
      id: fewHosts.eventId, door: 'link', lifecycle_status: 'completed', guests: { confirmed: 1, requested: 0, waitlist: 0 },
    });
    const one = await (await call(`/api/me/tables/${fewHosts.eventId}`, { actor: host })).json() as Record<string, any>;
    expect(one.table).toMatchObject({ public_visibility: 'unlisted', requires_approval: 0 });
    expect(one.teas.map((tea: { id: string }) => tea.id)).toEqual(fewHosts.teas);
  });
});

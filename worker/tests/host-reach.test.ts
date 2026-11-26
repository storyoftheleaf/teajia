// Launch 3, slice J10 (todo/plans/guests-and-tea-masters-launch-3-run.md,
// hard question 4; Adrian, 2026-11-26): reach is three values on the person,
// set only in Manage, read only by the server.
//
// - users.host_reach: 'invitation' (NULL reads as this; found only by the
//   link), 'teajia' (open tables shown to people signed in), 'listed' (open
//   tables on the public sessions list).
// - The open door is offered only while ANYONE_HOSTS_OPEN is on, to a host who
//   may host and is not stopped, whose reach is above 'invitation'. Making and
//   changing a table enforce it on the server. A seat there still needs the
//   host's yes.
// - Lists carry an open table of a host with that reach: published, to come,
//   the host not stopped, never their first session, never the address.
// - No answer to anyone but the platform owner carries host_reach.
// - With the switch off, everything is exactly as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { hostDoorsFor, hostReachOf, isHostReach, reachListedSessionSql } from '../src/hostApproval';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-host-reach-secret';
type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', name: 'Ana', accountId: 'ana-home' };
const bo: Actor = { userId: 'bo', name: 'Bo', accountId: 'bo-home' };
const cy: Actor = { userId: 'cy', name: 'Cy', accountId: 'cy-home' };
const helper: Actor = { userId: 'helper', name: 'Helper', accountId: 'helper-home' };

let db: SqliteD1;
const allow = { limit: async () => ({ success: true }) };

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; anyone?: boolean; few?: boolean } = {}) {
  const { actor, body, method = 'GET', anyone = true, few = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' });
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

const json = async (response: Response) => response.json() as Promise<Record<string, any>>;
const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const table = { date: future(30), time: '16:00', timezone: 'Asia/Makassar' };
const setReach = (userId: string, reach: unknown, actor: Actor = adrian, options: { anyone?: boolean; few?: boolean } = {}) =>
  call(`/api/platform/users/${userId}/host-reach`, { actor, method: 'PUT', body: { reach }, ...options });
const stop = (userId: string, stopped: boolean) =>
  call(`/api/platform/users/${userId}/hosting-stopped`, { actor: adrian, method: 'PUT', body: { stopped } });
const makeTable = (actor: Actor, extra: Record<string, unknown> = {}, anyone = true) =>
  call('/api/me/tables', { actor, method: 'POST', body: { ...table, ...extra }, anyone });
const storedReach = (userId: string) =>
  (db.sqlite.prepare('SELECT host_reach FROM users WHERE id = ?').get(userId) as { host_reach: string | null }).host_reach;
// A person's table is listed by its slug: its row carries no id (A3).
const listedIds = async (path = '/api/events', actor?: Actor, anyone = true) =>
  ((await json(await call(path, { actor, anyone }))) as unknown as { slug: string }[]).map(row => row.slug).sort();

/** A host's first table, made a day earlier, so the next one is never their first. */
async function firstTable(actor: Actor) {
  const made = await json(await makeTable(actor, { name: `${actor.name}'s first` }));
  db.sqlite.prepare(`UPDATE events SET created_at = datetime('now', '-1 day') WHERE id = ?`).run(made.id);
  return made;
}

/** A host with reach, their first table made, and an open table of theirs to list. */
async function openTable(actor: Actor, reach: 'teajia' | 'listed') {
  expect((await setReach(actor.userId, reach)).status).toBe(200);
  const first = await firstTable(actor);
  const made = await makeTable(actor, { door: 'open', name: `${actor.name}'s open table` });
  expect(made.status).toBe(201);
  const open = await json(made);
  db.sqlite.prepare(`UPDATE events SET address_text = 'Jalan Rahasia 3', map_link = 'https://maps.test/secret',
      location_name = 'Ubud', area_hint = 'North of the market' WHERE id = ?`).run(open.id);
  return { first, open };
}

/** A session of the shop, on the public list as before. */
function shopSession(id: string) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone,
      public_visibility, network_discovery, status, lifecycle_status, created_at)
    VALUES (?, 'shop', ?, ?, ?, 6, 'UTC', 'public', 1, 'active', 'published', datetime('now'))`)
    .run(id, id, `Session ${id}`, new Date(Date.now() + 5 * 86400000).toISOString());
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run(adrian.accountId);
  seedIdentity(db, { userId: helper.userId, accountId: helper.accountId, platformRole: 'platform_admin', publicEnabled: false });
  for (const person of [ana, bo, cy]) seedIdentity(db, { userId: person.userId, accountId: person.accountId, publicEnabled: false });
  shopSession('shop-1');
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('J10, the doors with reach', () => {
  it('reads NULL and anything unknown as invitation, and writes only the three values', () => {
    expect([hostReachOf(null), hostReachOf(undefined), hostReachOf('everyone'), hostReachOf('teajia'), hostReachOf('listed')])
      .toEqual(['invitation', 'invitation', 'invitation', 'teajia', 'listed']);
    expect(['invitation', 'teajia', 'listed'].every(isHostReach)).toBe(true);
    expect([null, '', 'everyone', 1, 'Listed'].some(isHostReach)).toBe(false);
  });

  it('adds the open door only with the switch on, a host who may host and is not stopped, and reach above invitation', () => {
    const doors = (approved: boolean, stopped: boolean, reach: 'invitation' | 'teajia' | 'listed', anyone: boolean) =>
      hostDoorsFor({ approved, stopped, reach }, anyone);
    expect(doors(false, false, 'invitation', true)).toEqual(['request']);
    expect(doors(false, false, 'teajia', true)).toEqual(['request', 'open']);
    expect(doors(false, false, 'listed', true)).toEqual(['request', 'open']);
    expect(doors(true, false, 'invitation', true)).toEqual(['request', 'link']);
    expect(doors(true, false, 'listed', true)).toEqual(['request', 'link', 'open']);
    // A stopped host has no door, whatever reach says.
    expect(doors(true, true, 'listed', true)).toBeNull();
    expect(doors(false, true, 'teajia', true)).toBeNull();
    // With the switch off, reach changes nothing: exactly as before.
    expect(doors(true, false, 'listed', false)).toEqual(['request', 'link']);
    expect(doors(false, false, 'listed', false)).toBeNull();
    // Launch 2's shape, the approval alone, is unchanged.
    expect(hostDoorsFor(true, true)).toEqual(['request', 'link']);
    expect(hostDoorsFor(false, true)).toEqual(['request']);
  });
});

describe('J10, Adrian sets reach in Manage', () => {
  it('lets the platform owner alone set it, to one of the three, and logs it', async () => {
    expect((await call('/api/platform/users/bo/host-reach', { method: 'PUT', body: { reach: 'listed' } })).status).toBe(401);
    expect((await setReach('bo', 'listed', ana)).status).toBe(403);
    expect((await setReach('bo', 'listed', helper)).status).toBe(403);
    for (const bad of ['everyone', '', null, 2, 'Listed']) expect((await setReach('bo', bad)).status).toBe(400);
    expect((await setReach('nobody', 'listed')).status).toBe(404);
    expect(storedReach('bo')).toBeNull();

    const set = await setReach('bo', 'teajia');
    expect(set.status).toBe(200);
    expect(await json(set)).toEqual({ ok: true, host_reach: 'teajia' });
    expect(storedReach('bo')).toBe('teajia');
    expect((await setReach('bo', 'invitation')).status).toBe(200);
    expect(storedReach('bo')).toBe('invitation');

    const log = db.sqlite.prepare(`SELECT action, actor_id, target_type, target_id, details FROM platform_audit_log
      WHERE action = 'host.reach_changed' ORDER BY rowid`).all() as { details: string }[];
    expect(log.map(row => ({ ...row, details: JSON.parse(row.details) }))).toEqual([
      { action: 'host.reach_changed', actor_id: 'adrian', target_type: 'user', target_id: 'bo', details: { reach: 'teajia' } },
      { action: 'host.reach_changed', actor_id: 'adrian', target_type: 'user', target_id: 'bo', details: { reach: 'invitation' } },
    ]);
  });

  it('has no reach route while either switch is off', async () => {
    expect((await setReach('bo', 'listed', adrian, { anyone: false })).status).toBe(404);
    expect((await setReach('bo', 'listed', adrian, { few: false })).status).toBe(404);
    expect(storedReach('bo')).toBeNull();
  });

  it('shows reach in the people list to the platform owner only', async () => {
    await setReach('bo', 'listed');
    const owner = (await json(await call('/api/platform/users', { actor: adrian }))).users as Record<string, unknown>[];
    expect(owner.find(user => user.id === 'bo')?.host_reach).toBe('listed');
    expect(owner.find(user => user.id === 'ana')?.host_reach).toBe('invitation');

    const adminText = await (await call('/api/platform/users', { actor: helper })).text();
    expect(JSON.parse(adminText).users.length).toBeGreaterThan(0);
    expect(adminText).not.toContain('host_reach');

    const offText = await (await call('/api/platform/users', { actor: adrian, anyone: false })).text();
    expect(offText).not.toContain('host_reach');
  });
});

describe('J10, the open door is enforced on the server', () => {
  it('refuses the open door to a host at invitation, exactly as before', async () => {
    expect((await json(await call('/api/me/hosting', { actor: bo }))).doors).toEqual(['request']);
    const refused = await makeTable(bo, { door: 'open' });
    expect(refused.status).toBe(400);
    expect((await json(refused)).code).toBe('hosted_table_door');
    const made = await json(await makeTable(bo));
    expect((await call(`/api/me/tables/${made.id}`, { actor: bo, method: 'PUT', body: { door: 'open' } })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT door FROM events WHERE id = ?').get(made.id)).toEqual({ door: 'request' });
  });

  it('lets a host with reach make an open table, unlisted in its own columns, every seat asking the host', async () => {
    await setReach('bo', 'teajia');
    expect((await json(await call('/api/me/hosting', { actor: bo }))).doors).toEqual(['request', 'open']);
    const made = await makeTable(bo, { door: 'open' });
    expect(made.status).toBe(201);
    const { id, slug } = await json(made);
    expect(db.sqlite.prepare('SELECT door, requires_approval, public_visibility, network_discovery FROM events WHERE id = ?').get(id))
      .toEqual({ door: 'open', requires_approval: 1, public_visibility: 'unlisted', network_discovery: 0 });

    // The guest meets it by request: the door says nothing of reach.
    const pageText = await (await call(`/api/events/${slug}/public`)).text();
    expect(JSON.parse(pageText).door).toBe('request');
    expect(pageText).not.toMatch(/host_reach|"open"|teajia"|listed/);
    expect((await call(`/api/events/${slug}/rsvp`, { method: 'POST', body: { full_name: 'Mei' } })).status).toBe(400);
    const seat = await call(`/api/events/${slug}/rsvp`, { method: 'POST', body: { full_name: 'Mei', phone_number: '+62 811 111 222' } });
    expect(seat.status).toBe(201);
    expect((await json(seat)).status).toBe('requested');
  });

  it('lets a host with reach change a table to open and back, and refuses it once reach is lowered', async () => {
    await setReach('ana', 'listed');
    const made = await json(await makeTable(ana));
    expect((await call(`/api/me/tables/${made.id}`, { actor: ana, method: 'PUT', body: { door: 'open' } })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT door, requires_approval FROM events WHERE id = ?').get(made.id)).toEqual({ door: 'open', requires_approval: 1 });
    expect((await call(`/api/me/tables/${made.id}`, { actor: ana, method: 'PUT', body: { door: 'request' } })).status).toBe(200);
    await setReach('ana', 'invitation');
    expect((await call(`/api/me/tables/${made.id}`, { actor: ana, method: 'PUT', body: { door: 'open' } })).status).toBe(400);
    expect((await makeTable(ana, { door: 'open' })).status).toBe(400);
  });

  it('gives a stopped host no open door, whatever reach says', async () => {
    await setReach('bo', 'listed');
    const made = await json(await makeTable(bo));
    await stop('bo', true);
    expect((await makeTable(bo, { door: 'open' })).status).toBe(400);
    expect((await call(`/api/me/tables/${made.id}`, { actor: bo, method: 'PUT', body: { door: 'open' } })).status).toBe(403);
    expect(db.sqlite.prepare('SELECT door FROM events WHERE id = ?').get(made.id)).toEqual({ door: 'request' });
  });

  it('keeps the approved host’s by-link door alongside open', async () => {
    db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-20' WHERE id = 'ana'`).run();
    await setReach('ana', 'teajia');
    expect((await json(await call('/api/me/hosting', { actor: ana }))).doors).toEqual(['request', 'link', 'open']);
    expect((await makeTable(ana, { door: 'link' })).status).toBe(201);
    expect((await makeTable(ana, { door: 'open' })).status).toBe(201);
  });
});

describe('J10, the lists', () => {
  it('puts a listed host’s open table on the public list, never their first, never the address', async () => {
    const { first, open } = await openTable(bo, 'listed');
    const listText = await (await call('/api/events')).text();
    const list = JSON.parse(listText) as Record<string, unknown>[];
    expect(list.map(row => row.slug).sort()).toEqual([open.slug, 'shop-1'].sort());
    expect(list.map(row => row.slug)).not.toContain(first.slug);
    const row = list.find(entry => entry.slug === open.slug)!;
    // A person's table is known by its link alone; the shop's session keeps its id (A3).
    expect(row).not.toHaveProperty('id');
    expect(list.find(entry => entry.slug === 'shop-1')).toMatchObject({ id: 'shop-1' });
    expect(listText).not.toContain(open.id);
    expect(row).toMatchObject({ title: "Bo's open table", location_name: 'Ubud', area_hint: 'North of the market', seats_remaining: 6 });
    for (const secret of ['address_text', 'map_link', 'venue_guide', 'host_reach', 'door', 'Jalan Rahasia', 'maps.test']) {
      expect(listText).not.toContain(secret);
    }
  });

  it('never lists a host’s first session, even an open one', async () => {
    await setReach('cy', 'listed');
    const made = await json(await makeTable(cy, { door: 'open' }));
    expect(await listedIds()).toEqual(['shop-1']);
    expect(await listedIds('/api/me/sessions', ana)).toEqual(['shop-1']);
    // Their second is listed; the first still is not.
    const second = await json(await makeTable(cy, { door: 'open' }));
    db.sqlite.prepare(`UPDATE events SET created_at = datetime('now', '-1 day') WHERE id = ?`).run(made.id);
    expect(await listedIds()).toEqual([second.slug, 'shop-1'].sort());
  });

  it('lists only open tables: a listed host’s by-request table stays found by its link', async () => {
    await setReach('bo', 'listed');
    await firstTable(bo);
    await makeTable(bo);
    expect(await listedIds()).toEqual(['shop-1']);
    expect(await listedIds('/api/me/sessions', ana)).toEqual(['shop-1']);
  });

  it('shows a teajia host’s open table to signed-in people only', async () => {
    const { open } = await openTable(ana, 'teajia');
    expect(await listedIds()).toEqual(['shop-1']);
    expect((await call('/api/me/sessions')).status).toBe(401);
    const signedIn = await call('/api/me/sessions', { actor: cy });
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get('Cache-Control')).toBe('private, no-store');
    const text = await signedIn.text();
    expect((JSON.parse(text) as { slug: string }[]).map(row => row.slug).sort()).toEqual([open.slug, 'shop-1'].sort());
    expect(text).not.toContain(open.id);
    for (const secret of ['address_text', 'map_link', 'host_reach', 'Jalan Rahasia']) expect(text).not.toContain(secret);
  });

  it('shows a listed host’s open table to signed-in people too', async () => {
    const { open } = await openTable(bo, 'listed');
    expect(await listedIds('/api/me/sessions', cy)).toEqual([open.slug, 'shop-1'].sort());
  });

  it('takes the tables off at once when reach is lowered, the host is stopped, or the table is past or done', async () => {
    const { open } = await openTable(bo, 'listed');
    await setReach('bo', 'teajia');
    expect(await listedIds()).toEqual(['shop-1']);
    expect(await listedIds('/api/me/sessions', cy)).toEqual([open.slug, 'shop-1'].sort());
    await setReach('bo', 'invitation');
    expect(await listedIds('/api/me/sessions', cy)).toEqual(['shop-1']);

    await setReach('bo', 'listed');
    await stop('bo', true);
    expect(await listedIds()).toEqual(['shop-1']);
    expect(await listedIds('/api/me/sessions', cy)).toEqual(['shop-1']);
    await stop('bo', false);
    expect(await listedIds()).toEqual([open.slug, 'shop-1'].sort());

    db.sqlite.prepare(`UPDATE events SET lifecycle_status = 'completed' WHERE id = ?`).run(open.id);
    expect(await listedIds()).toEqual(['shop-1']);
    db.sqlite.prepare(`UPDATE events SET lifecycle_status = 'published', event_date = ? WHERE id = ?`)
      .run(new Date(Date.now() - 86400000).toISOString(), open.id);
    expect(await listedIds()).toEqual(['shop-1']);
  });

  it('lists nothing of a table whose account is closed, or that is not in its host’s own account', async () => {
    const { open } = await openTable(bo, 'listed');
    const account = db.sqlite.prepare('SELECT account_id FROM events WHERE id = ?').get(open.id) as { account_id: string };
    db.sqlite.prepare(`UPDATE accounts SET status = 'suspended' WHERE id = ?`).run(account.account_id);
    expect(await listedIds()).toEqual(['shop-1']);
    db.sqlite.prepare(`UPDATE accounts SET status = 'active' WHERE id = ?`).run(account.account_id);
    // Another person named as host of a table in Bo's account is not Bo's table.
    db.sqlite.prepare(`UPDATE events SET host_user_id = 'cy' WHERE id = ?`).run(open.id);
    await setReach('cy', 'listed');
    expect(await listedIds()).not.toContain(open.slug);
  });

  it('reads reach in SQL from the person, for the reaches asked', () => {
    expect(reachListedSessionSql('a', 'e', [])).toBe('0');
    expect(reachListedSessionSql('a', 'e', ['listed'])).toContain(`host_reach IN ('listed')`);
    expect(reachListedSessionSql('a', 'e', ['teajia', 'listed'])).toContain(`host_reach IN ('teajia', 'listed')`);
  });
});

describe('J10, reach is never sent to the host or a guest', () => {
  it('leaves it out of everything the host reads of themself', async () => {
    const { open } = await openTable(bo, 'listed');
    for (const path of ['/api/me/hosting', '/api/me/tables', `/api/me/tables/${open.id}`]) {
      const text = await (await call(path, { actor: bo })).text();
      expect(text, path).not.toContain('host_reach');
      expect(text, path).not.toMatch(/"(invitation|teajia|listed)"/);
    }
    const hosting = await json(await call('/api/me/hosting', { actor: bo }));
    expect(Object.keys(hosting).sort()).toEqual(['account_id', 'approved', 'doors']);
  });

  it('leaves it out of the session page and the guest’s own page', async () => {
    const { open } = await openTable(bo, 'listed');
    const seat = await json(await call(`/api/events/${open.slug}/rsvp`, { method: 'POST', body: { full_name: 'Mei', phone_number: '+62 811 333 444' } }));
    for (const path of [`/api/events/${open.slug}/public`, `/api/events/${open.slug}/availability`, `/api/rsvp/${seat.magic_token}`]) {
      const text = await (await call(path)).text();
      expect(text, path).not.toContain('host_reach');
      expect(text, path).not.toMatch(/"(teajia|listed)"/);
    }
  });
});

describe('J10, with ANYONE_HOSTS_OPEN off: exactly as now', () => {
  it('lists only the shop’s sessions and has no signed-in list, whatever reach and doors are stored', async () => {
    const { open } = await openTable(bo, 'listed');
    const before = await (await call('/api/events', { anyone: false })).text();
    expect((JSON.parse(before) as { id: string }[]).map(row => row.id)).toEqual(['shop-1']);
    expect(await listedIds('/api/events', undefined, false)).not.toContain(open.slug);
    expect((await call('/api/me/sessions', { actor: cy, anyone: false })).status).toBe(404);
  });

  it('offers no open door to an approved host with reach, and refuses it on making and changing', async () => {
    db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-20', host_reach = 'listed' WHERE id = 'ana'`).run();
    expect((await json(await call('/api/me/hosting', { actor: ana, anyone: false }))).doors).toEqual(['request', 'link']);
    const refused = await makeTable(ana, { door: 'open' }, false);
    expect(refused.status).toBe(400);
    expect((await json(refused)).code).toBe('hosted_table_door');
    const made = await json(await makeTable(ana, {}, false));
    expect((await call(`/api/me/tables/${made.id}`, { actor: ana, method: 'PUT', body: { door: 'open' }, anyone: false })).status).toBe(400);
  });

  it('reads a stored open door as before: shown as stored, and no seat taken', async () => {
    db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-20' WHERE id = 'ana'`).run();
    const made = await json(await makeTable(ana, {}, false));
    db.sqlite.prepare(`UPDATE events SET door = 'open' WHERE id = ?`).run(made.id);
    expect((await json(await call(`/api/events/${made.slug}/public`, { anyone: false }))).door).toBe('open');
    const seat = await call(`/api/events/${made.slug}/rsvp`, { method: 'POST', body: { full_name: 'Mei', phone_number: '+62 811 555 666' }, anyone: false });
    expect(seat.status).toBe(409);
  });
});

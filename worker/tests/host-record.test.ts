// Launch 2, slice H11 (todo/plans/guests-and-tea-masters-launch-2-run.md,
// "Free, and your record is yours"): the host's record is one JSON file of
// their own tables, the names guests gave, teas poured and their private
// lines. Never another host's, never a guest's contact, never an address.
// Also: only the platform owner approves, stops and approves a host again.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { saveGuestNote } from '../src/hostGuestNotes';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-host-record-secret';
type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'platform-home' };
const ana: Actor = { userId: 'ana', accountId: 'ana-home' };
const bo: Actor = { userId: 'bo', accountId: 'bo-home' };
const cy: Actor = { userId: 'cy', accountId: 'cy-home' };
const staff: Actor = { userId: 'staff', accountId: 'staff-home' };

let db: SqliteD1;
const d1 = () => db as unknown as D1Database;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean } = {}) {
  const { actor, body, method = 'GET', open = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.userId, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: open ? 'true' : 'false', ANYONE_HOSTS_OPEN: 'false' } as never);
}

function personalAccount(userId: string, approved = true) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, ?)`)
    .run(id, id, id, userId, userId, approved ? '2026-11-26T00:00:00Z' : null);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(id, userId);
  if (approved) db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(userId);
}

function table(id: string, accountId: string, hostUserId: string | null) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status,
      address_text, venue_guide)
    VALUES (?, ?, ?, ?, '2026-11-20T08:00:00.000Z', 6, 'Asia/Makassar', 'link', 0, 'unlisted', 0, ?, 'closed', 'completed',
      ?, ?)`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, hostUserId,
      `12 Secret Lane ${id}`, JSON.stringify({ steps: [{ text: `Gate code 4471 ${id}` }] }));
}

function guest(id: string, eventId: string, accountId: string, extra: { plusOneName?: string } = {}) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status, attended,
      phone_number, email, notes, plus_one, plus_one_name)
    VALUES (?, ?, ?, ?, ?, 'confirmed', 1, ?, ?, ?, ?, ?)`)
    .run(id, accountId, eventId, `Guest ${id}`, `magic-${id}`, `+62 811 000 ${id}`, `${id}@guest.test`,
      `Lives at 9 Hidden Road ${id}`, extra.plusOneName ? 1 : 0, extra.plusOneName ?? null);
}

function tea(id: string, eventId: string, accountId: string, name: string) {
  db.sqlite.prepare(`INSERT INTO event_tea_menu (id, account_id, event_id, custom_name, custom_description, brew_order)
    VALUES (?, ?, ?, ?, 'Wuyi', 1)`).run(id, accountId, eventId, name);
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  seedIdentity(db, { userId: staff.userId, accountId: staff.accountId, platformRole: 'platform_admin' });
  for (const person of [ana, bo, cy]) seedIdentity(db, { userId: person.userId, accountId: person.accountId, publicEnabled: false });
  personalAccount('ana');
  personalAccount('bo');
  table('t-ana', 'ana-personal', 'ana');
  guest('g-rui', 't-ana', 'ana-personal', { plusOneName: 'Mei' });
  guest('g-lin', 't-ana', 'ana-personal');
  tea('m-ana', 't-ana', 'ana-personal', 'Rou Gui 2024');
  table('t-bo', 'bo-personal', 'bo');
  guest('g-bo', 't-bo', 'bo-personal');
  tea('m-bo', 't-bo', 'bo-personal', 'Bo’s Dancong');
  // A session in Ana's personal account that does not name her as host is not hers to take.
  table('t-old', 'ana-personal', null);
  guest('g-old', 't-old', 'ana-personal');
  await saveGuestNote(d1(), { hostUserId: 'ana', accountId: 'ana-personal', eventId: 't-ana', attendeeId: 'g-rui', note: 'Likes it strong.' });
  await saveGuestNote(d1(), { hostUserId: 'bo', accountId: 'bo-personal', eventId: 't-bo', attendeeId: 'g-bo', note: 'Bo’s private line.' });
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('GET /api/me/record', () => {
  it('gives the host one JSON file of their own tables, guests’ names, teas and private lines', async () => {
    const response = await call('/api/me/record', { actor: ana });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="teajia-record-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const record = await response.json() as any;
    expect(record).toMatchObject({ kind: 'teajia-host-record', version: 1, host: { name: 'ana' } });
    expect(record.tables).toHaveLength(1);
    expect(record.tables[0]).toMatchObject({
      title: 'Table t-ana', door: 'link', seats: 6, status: 'completed', link: 'https://hosts.test/event/slug-t-ana',
      teas: [{ name: 'Rou Gui 2024', from: 'Wuyi', pour_order: 1 }],
    });
    expect([...record.tables[0].guests].sort((a: any, b: any) => b.name.localeCompare(a.name))).toEqual([
      { name: 'Guest g-rui', status: 'confirmed', came: true, plus_one: true, plus_one_name: 'Mei', my_note: 'Likes it strong.' },
      { name: 'Guest g-lin', status: 'confirmed', came: true, plus_one: false, plus_one_name: null, my_note: null },
    ]);
  });

  it('never carries another host’s table, a guest’s contact or private link, or any address', async () => {
    const text = await (await call('/api/me/record', { actor: ana })).text();
    for (const leak of [
      't-bo', 'g-bo', 'Bo’s Dancong', 'Bo’s private line', 't-old', 'g-old',
      '+62', '@guest.test', 'magic-', 'Hidden Road', 'Secret Lane', 'Gate code', 'ana@test.dev',
      'phone', 'email', 'address', 'venue_guide', 'account_id', 'attendee_id',
    ]) {
      expect(text).not.toContain(leak);
    }
    const bos = await (await call('/api/me/record', { actor: bo })).json() as any;
    expect(bos.tables.map((t: any) => t.title)).toEqual(['Table t-bo']);
    expect(JSON.stringify(bos)).not.toContain('Likes it strong.');
  });

  it('answers 404 for anything that names another host, and to a person who neither hosts nor may host', async () => {
    expect((await call('/api/me/record/ana', { actor: bo })).status).toBe(404);
    expect((await call('/api/me/record?host=ana', { actor: bo })).status).toBe(200);
    expect(JSON.stringify(await (await call('/api/me/record?host=ana', { actor: bo })).json())).not.toContain('t-ana');
    expect((await call('/api/me/record', { actor: cy })).status).toBe(404);
  });

  it('answers 404 while Launch 2 is closed, even to the host', async () => {
    expect((await call('/api/me/record', { actor: ana, open: false })).status).toBe(404);
  });

  it('asks a signed-out caller to sign in', async () => {
    expect((await call('/api/me/record')).status).toBe(401);
  });

  it('still gives a host Adrian stopped the record of the tables they hosted', async () => {
    expect((await call('/api/platform/users/ana/host-approval', { actor: adrian, method: 'PUT', body: { approved: false } })).status).toBe(200);
    const response = await call('/api/me/record', { actor: ana });
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).tables).toHaveLength(1);
  });
});

describe('approving a host in Settings', () => {
  const setHost = (userId: string, approved: boolean, actor?: Actor, open = true) =>
    call(`/api/platform/users/${userId}/host-approval`, { actor, method: 'PUT', body: { approved }, open });
  const mark = (userId: string) => db.sqlite.prepare('SELECT host_approved_at FROM users WHERE id = ?').get(userId) as { host_approved_at: string | null };

  it('lets the platform owner alone approve, stop and approve again', async () => {
    expect((await setHost('cy', true)).status).toBe(401);
    expect((await setHost('cy', true, staff)).status).toBe(403);
    expect((await setHost('cy', true, bo)).status).toBe(403);
    expect(mark('cy').host_approved_at).toBeNull();

    expect(await (await setHost('cy', true, adrian)).json()).toEqual({ ok: true, may_host: true });
    expect(mark('cy').host_approved_at).not.toBeNull();
    expect(await (await setHost('cy', false, adrian)).json()).toEqual({ ok: true, may_host: false });
    expect(mark('cy').host_approved_at).toBeNull();
    expect(await (await setHost('cy', true, adrian)).json()).toEqual({ ok: true, may_host: true });
    expect(mark('cy').host_approved_at).not.toBeNull();
  });

  it('is closed while Launch 2 is closed', async () => {
    expect((await setHost('cy', true, adrian, false)).status).toBe(404);
    expect(mark('cy').host_approved_at).toBeNull();
  });

  it('shows the Platform screen who may host by link, only while Launch 2 is open', async () => {
    const open = await (await call('/api/platform/users', { actor: adrian })).json() as { users: any[] };
    expect(open.users.find(u => u.id === 'ana')).toMatchObject({ may_host: true });
    expect(open.users.find(u => u.id === 'cy')).toMatchObject({ may_host: false, host_approved_at: null });
    const closed = await (await call('/api/platform/users', { actor: adrian, open: false })).json() as { users: any[] };
    expect(closed.users.find(u => u.id === 'ana')).not.toHaveProperty('may_host');
  });
});

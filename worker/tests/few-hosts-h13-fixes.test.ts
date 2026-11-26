// Launch 2, check run H13: what the browser journey found.
//  1. A hosted table's area: the host writes one short line (never the
//     address, never a link) and the public answer carries it; with none,
//     nothing names a place.
//  2. A signed-in person with no seat asks find-rsvp and is told "no seat"
//     with a 200, never a 404.
//  3. A guest who asked for a seat at a request door, signed in, is found
//     again by their account.
//  4. The guest's own page names the host by the rule of sessionHost.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { readTableArea } from '../src/hostTableArea';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-h13-secret';
type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', name: 'Ana Lestari', accountId: 'ana-personal' };
const bo: Actor = { userId: 'bo', name: 'Bo', accountId: 'bo-personal' };
const mei: Actor = { userId: 'mei', name: 'Mei', accountId: 'mei-home' };
const ADDRESS = 'Jalan Hantu Teh 12, Ubud';
const allow = { limit: async () => ({ success: true }) };
const DAY = 86_400_000;

let db: SqliteD1;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown } = {}) {
  const { actor, body, method = 'GET' } = options;
  const headers = new Headers({ 'CF-Connecting-IP': '203.0.113.7' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.name, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  if (body === undefined && method === 'POST') headers.set('Content-Length', '0');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: 'true',
    RSVP_LIMITER: allow, PUBLIC_MCP_LIMITER: allow, PROVIDER_LIMITER: allow, INQUIRY_LIMITER: allow,
  } as never, { waitUntil: () => undefined } as never);
}

function personalAccount(actor: Actor) {
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(actor.accountId, actor.accountId, `${actor.name}’s Tea Chest`, actor.userId, actor.userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`)
    .run(actor.accountId, actor.userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z', name = ? WHERE id = ?`).run(actor.name, actor.userId);
}

const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function makeTable(body: Record<string, unknown> = {}) {
  const response = await call('/api/me/tables', {
    actor: ana, method: 'POST', body: { date: day(5), time: '19:00', timezone: 'Asia/Makassar', ...body },
  });
  return { response, table: response.status === 201 ? await response.json() as { id: string; slug: string } : null };
}

const publicAnswer = async (slug: string) => (await call(`/api/events/${slug}/public`)).json() as Promise<Record<string, unknown>>;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner', bundles: ['gather', 'sell'] });
  for (const person of [ana, bo]) {
    seedIdentity(db, { userId: person.userId, accountId: `${person.userId}-home`, publicEnabled: false });
    personalAccount(person);
  }
  seedIdentity(db, { userId: mei.userId, accountId: mei.accountId, publicEnabled: false });
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('a hosted table’s area (finding 1)', () => {
  it('reads one short line, clears on blank, and refuses a link', () => {
    expect(readTableArea({})).toBeUndefined();
    expect(readTableArea({ area: '  Ubud,   near the market ' })).toBe('Ubud, near the market');
    expect(readTableArea({ area: '   ' })).toBeNull();
    expect(readTableArea({ area: null })).toBeNull();
    for (const link of ['https://maps.app.goo.gl/x', 'see www.example.com']) {
      expect(readTableArea({ area: link })).toMatchObject({ refused: { code: 'hosted_table_area_address' } });
    }
    expect(readTableArea({ area: 'x'.repeat(81) })).toMatchObject({ refused: { code: 'hosted_table_area' } });
    expect(readTableArea({ area: 7 })).toMatchObject({ refused: { code: 'hosted_table_area' } });
  });

  it('a table made with only a day and a time names no area, and says it is a person’s table', async () => {
    const { table } = await makeTable();
    const answer = await publicAnswer(table!.slug);
    expect(answer.area_hint).toBeNull();
    expect(answer.location_name).toBeNull();
    expect(answer.private_host).toBe(true);
  });

  it('the host gives an area when making the table or later, and it is shown publicly', async () => {
    const made = await makeTable({ area: 'Ubud, near the market' });
    expect(made.response.status).toBe(201);
    expect((await publicAnswer(made.table!.slug)).area_hint).toBe('Ubud, near the market');

    const later = await makeTable();
    const put = await call(`/api/me/tables/${later.table!.id}`, { actor: ana, method: 'PUT', body: { area: 'Penestanan' } });
    expect(put.status).toBe(200);
    expect((await publicAnswer(later.table!.slug)).area_hint).toBe('Penestanan');
    const detail = await (await call(`/api/me/tables/${later.table!.id}`, { actor: ana })).json() as { table: { area_hint: string | null } };
    expect(detail.table.area_hint).toBe('Penestanan');

    // Cleared: back to no place at all.
    expect((await call(`/api/me/tables/${later.table!.id}`, { actor: ana, method: 'PUT', body: { area: '' } })).status).toBe(200);
    expect((await publicAnswer(later.table!.slug)).area_hint).toBeNull();
  });

  it('refuses an area that carries the saved address or a link, and writes nothing', async () => {
    const { table } = await makeTable();
    db.sqlite.prepare('UPDATE events SET address_text = ? WHERE id = ?').run(ADDRESS, table!.id);
    const withAddress = await call(`/api/me/tables/${table!.id}`, {
      actor: ana, method: 'PUT', body: { area: `Near ${ADDRESS.toUpperCase()}` },
    });
    expect(withAddress.status).toBe(400);
    expect(await withAddress.text()).toContain('not the address');
    const withLink = await call(`/api/me/tables/${table!.id}`, { actor: ana, method: 'PUT', body: { area: 'https://maps.example/house' } });
    expect(withLink.status).toBe(400);
    expect((await publicAnswer(table!.slug)).area_hint).toBeNull();

    // A place the host kept the way to counts too, even when making a new table.
    db.sqlite.prepare(`INSERT INTO saved_locations (id, account_id, name, address) VALUES ('kept', ?, 'Home', 'Gang Melati 3')`).run(ana.accountId);
    const made = await makeTable({ area: 'gang melati 3, Ubud' });
    expect(made.response.status).toBe(400);
    // The area naming only the area is kept.
    expect((await call(`/api/me/tables/${table!.id}`, { actor: ana, method: 'PUT', body: { area: 'Ubud, near the market' } })).status).toBe(200);
  });

  it('another host cannot set the area of a table that is not theirs', async () => {
    const { table } = await makeTable();
    const put = await call(`/api/me/tables/${table!.id}`, { actor: bo, method: 'PUT', body: { area: 'Elsewhere' } });
    expect(put.status).toBe(404);
    expect((await publicAnswer(table!.slug)).area_hint).toBeNull();
  });
});

describe('finding a seat again (findings 2 and 3)', () => {
  it('a signed-in person with no seat is answered 200 with no seat', async () => {
    const { table } = await makeTable();
    const response = await call(`/api/events/${table!.slug}/find-rsvp`, { actor: mei, method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ magic_token: null, status: null, redirect_url: null });
  });

  it('a signed-in guest who asked at a request door, with a phone only, is found by their account', async () => {
    const { table } = await makeTable();
    const seat = await call(`/api/events/${table!.slug}/rsvp`, {
      actor: mei, method: 'POST', body: { full_name: 'Mei Visitor', phone_number: '+62 812 345 678', contact_method: 'whatsapp' },
    });
    expect(seat.status).toBe(201);
    const { magic_token: token, status } = await seat.json() as { magic_token: string; status: string };
    expect(status).toBe('requested');
    const found = await call(`/api/events/${table!.slug}/find-rsvp`, { actor: mei, method: 'POST' });
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({ magic_token: token, status: 'requested', redirect_url: `/m/${token}` });
    // Someone else signed in is not handed it.
    const other = await call(`/api/events/${table!.slug}/find-rsvp`, { actor: bo, method: 'POST' });
    expect((await other.json() as { magic_token: string | null }).magic_token).toBeNull();
  });
});

describe('the guest’s page names the host (finding 4)', () => {
  it('a person’s table names its host by their first name, and says it is a person’s table', async () => {
    const { table } = await makeTable();
    const seat = await call(`/api/events/${table!.slug}/rsvp`, { method: 'POST', body: { full_name: 'Tao', phone_number: '+62 812 000 111' } });
    const { magic_token: token } = await seat.json() as { magic_token: string };
    const page = await (await call(`/api/rsvp/${token}`)).json() as { event: Record<string, unknown> };
    expect(page.event.host).toEqual({ name: 'Ana', path: null });
    expect(page.event.private_host).toBe(true);
    expect(JSON.stringify(page)).not.toContain('host_user_id');
  });

  it('a shop’s session with no public lead host names nobody and is not a person’s table', async () => {
    db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone,
        requires_approval, public_visibility, status, lifecycle_status)
      VALUES ('shop-s', ?, 'shop-session-a1b2', 'Shop sitting', ?, 6, 'UTC', 1, 'public', 'active', 'published')`)
      .run(adrian.accountId, new Date(Date.now() + 5 * DAY).toISOString());
    db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token)
      VALUES ('shop-g', ?, 'shop-s', 'Guest', 'requested', 'token-shop-g')`).run(adrian.accountId);
    const page = await (await call('/api/rsvp/token-shop-g')).json() as { event: Record<string, unknown> };
    expect(page.event.host).toBeNull();
    expect(page.event.private_host).toBe(false);
  });
});

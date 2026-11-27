// Launch 4, slice K4, "Add your table"
// (todo/plans/guests-and-tea-masters-launch-4-run.md, hard question 4).
//
// A table is a saved place in the host's own account; a tea house is a public
// account; they never share a page. The host names one saved place as their
// table and writes its area. No public answer (the session page, the lists,
// the tea houses, Visit, the public agent tools) ever carries the table's
// address, coordinates, way-in steps or the saved place's id, and a table
// never appears in Visit.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-your-table-secret';
const DAY = 24 * 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString().slice(0, 16);

type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', name: 'Ana Lestari', accountId: 'ana-personal' };
const cy: Actor = { userId: 'cy', name: 'Cy', accountId: 'cy-personal' };

const PLACE_ID = 'place-7q2wzk';
const PLACE_NAME = 'Rumah Kecil';
const ADDRESS = 'Jalan Rahasia 7, Penestanan';
const MAP = 'https://maps.example/place/@-8.50691,115.26254,17z';
const GUIDE = JSON.stringify({
  steps: [{ description: 'Blue gate by the frangipani', image_url: 'https://media.teajia.co/accounts/ana-personal/venue-guide/gate.jpg' }],
  parking_notes: 'Behind the bakery',
});
const AREA = 'Ubud, near the market';
const SECRETS = ['Jalan Rahasia', 'maps.example', '-8.50691', '115.26254', 'frangipani', 'gate.jpg', 'bakery', PLACE_ID, 'saved_locations', 'location_id'];

let db: SqliteD1;
const allow = { limit: async () => ({ success: true }) };

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean } = {}) {
  const { actor, body, method = 'GET', open = true } = options;
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
    FEW_HOSTS_OPEN: 'true', YOUR_TABLE_PLACE_OPEN: open ? 'true' : 'false', TEA_HOUSES_OPEN: 'true',
    RSVP_LIMITER: allow, PUBLIC_MCP_LIMITER: allow, PROVIDER_LIMITER: allow, INQUIRY_LIMITER: allow,
  } as never, { waitUntil: () => undefined } as never);
}

const text = async (path: string, options?: Parameters<typeof call>[1]) => {
  const response = await call(path, options);
  return { status: response.status, text: await response.text() };
};

function personalAccount(actor: Actor) {
  seedIdentity(db, { userId: actor.userId, accountId: `${actor.userId}-unused`, publicEnabled: false });
  db.sqlite.prepare('UPDATE users SET name = ?, host_approved_at = ? WHERE id = ?').run(actor.name, '2026-11-26T00:00:00Z', actor.userId);
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(actor.accountId, actor.accountId, `${actor.name}’s Tea Chest`, actor.userId, actor.userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`)
    .run(actor.accountId, actor.userId);
}

function place(id: string, accountId: string, name: string, table = 0, area: string | null = null) {
  db.sqlite.prepare(`INSERT INTO saved_locations (id, account_id, name, address, map_link, venue_guide, is_host_table, area_hint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, name, ADDRESS, MAP, GUIDE, table, area);
}

function session(id: string, accountId: string, locationId: string | null, options: { hostUserId?: string | null; visibility?: string; discovery?: number } = {}) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone,
      door, requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status,
      location_name, address_text, map_link, venue_guide, location_id)
    VALUES (?, ?, ?, ?, ?, 6, 'UTC', 'request', 1, ?, ?, ?, 'active', 'published', NULL, ?, ?, ?, ?)`)
    .run(id, accountId, `${id}-k3x9q2m7wz`, `Table ${id}`, at(7 * DAY), options.visibility ?? 'unlisted', options.discovery ?? 0,
      options.hostUserId === undefined ? null : options.hostUserId, ADDRESS, MAP, GUIDE, locationId);
}

function expectNoSecrets(body: string) {
  for (const secret of SECRETS) expect(body).not.toContain(secret);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  db.sqlite.prepare(`UPDATE accounts SET is_platform_owner = 1, public_enabled = 1, status = 'active' WHERE id = ?`).run(adrian.accountId);
  personalAccount(ana);
  personalAccount(cy);
  place(PLACE_ID, ana.accountId, PLACE_NAME);
  place('place-studio', ana.accountId, 'Studio');
  place('cy-place', cy.accountId, 'Cy’s flat');
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('migration 0144', () => {
  it('starts every place as not a table, with no area, and allows one table per account', () => {
    const rows = db.sqlite.prepare('SELECT is_host_table, area_hint FROM saved_locations').all() as Array<Record<string, unknown>>;
    expect(rows.every(row => row.is_host_table === 0 && row.area_hint === null)).toBe(true);
    db.sqlite.prepare('UPDATE saved_locations SET is_host_table = 1 WHERE id = ?').run(PLACE_ID);
    expect(() => db.sqlite.prepare('UPDATE saved_locations SET is_host_table = 1 WHERE id = ?').run('place-studio')).toThrow();
  });
});

describe('choosing your table', () => {
  it('is closed while the switch is off', async () => {
    expect((await call('/api/me/your-table', { actor: ana, open: false })).status).toBe(404);
    expect((await call('/api/me/your-table', { actor: ana, open: false, method: 'PUT', body: { place_id: PLACE_ID, area_hint: AREA } })).status).toBe(404);
    expect((await call('/api/me/your-table')).status).toBe(401);
  });

  it('names one place as the table, moves it, and undoes it', async () => {
    const list = await (await call('/api/me/your-table', { actor: ana })).json() as { places: Array<Record<string, unknown>> };
    expect(list.places.map(p => p.name)).toEqual([PLACE_NAME, 'Studio']);
    expect(list.places.every(p => p.is_table === false)).toBe(true);
    expect(JSON.stringify(list)).not.toContain('Cy’s flat');

    const chosen = await call('/api/me/your-table', { actor: ana, method: 'PUT', body: { place_id: PLACE_ID, area_hint: `  ${AREA} ` } });
    expect(chosen.status).toBe(200);
    expect(chosen.headers.get('Cache-Control')).toBe('private, no-store');
    const after = await chosen.json() as { places: Array<{ id: string; is_table: boolean; area_hint: string | null }> };
    expect(after.places.find(p => p.id === PLACE_ID)).toMatchObject({ is_table: true, area_hint: AREA });

    await call('/api/me/your-table', { actor: ana, method: 'PUT', body: { place_id: 'place-studio', area_hint: 'Ubud' } });
    const moved = db.sqlite.prepare('SELECT id FROM saved_locations WHERE account_id = ? AND is_host_table = 1').all(ana.accountId);
    expect(moved).toEqual([{ id: 'place-studio' }]);

    const undone = await (await call('/api/me/your-table', { actor: ana, method: 'DELETE' })).json() as { places: Array<{ is_table: boolean }> };
    expect(undone.places.every(p => !p.is_table)).toBe(true);
    // The places themselves stay.
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM saved_locations WHERE account_id = ?').get(ana.accountId)).toEqual({ n: 2 });
  });

  it('offers the fifty-first old saved place, and every one after it (review A6-3)', async () => {
    for (let n = 1; n <= 51; n += 1) place(`place-garden-${n}`, ana.accountId, `Garden ${String(n).padStart(2, '0')}`);
    const list = await (await call('/api/me/your-table', { actor: ana })).json() as { places: Array<{ id: string; name: string }> };
    expect(list.places).toHaveLength(53);
    expect(list.places.map(p => p.name)).toContain('Garden 51');
    const chosen = await call('/api/me/your-table', { actor: ana, method: 'PUT', body: { place_id: 'place-garden-51', area_hint: 'Ubud' } });
    expect(chosen.status).toBe(200);
  });

  it("refuses another person's place, a missing area, and an area that carries the address or a link", async () => {
    const put = (body: unknown) => call('/api/me/your-table', { actor: ana, method: 'PUT', body });
    expect((await put({ place_id: 'cy-place', area_hint: AREA })).status).toBe(404);
    expect((await put({ place_id: PLACE_ID, area_hint: '  ' })).status).toBe(400);
    expect((await put({ place_id: PLACE_ID, area_hint: `At ${ADDRESS}` })).status).toBe(400);
    expect((await put({ place_id: PLACE_ID, area_hint: 'see https://maps.example/x' })).status).toBe(400);
    expect((await put({ place_id: PLACE_ID, area_hint: 'x'.repeat(81) })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM saved_locations WHERE is_host_table = 1').get()).toEqual({ n: 0 });
    // Cy's own place is untouched by Ana's tries.
    expect(db.sqlite.prepare('SELECT area_hint FROM saved_locations WHERE id = ?').get('cy-place')).toEqual({ area_hint: null });
  });
});

describe('the public is told the area only', () => {
  beforeEach(async () => {
    session('ana-table', ana.accountId, PLACE_ID, { hostUserId: 'ana' });
    await call('/api/me/your-table', { actor: ana, method: 'PUT', body: { place_id: PLACE_ID, area_hint: AREA } });
  });

  it('describes a session at the table by its area on the session page, and nothing else of the place', async () => {
    const page = await text('/api/events/ana-table-k3x9q2m7wz/public');
    expect(page.status).toBe(200);
    const body = JSON.parse(page.text) as Record<string, unknown>;
    expect(body.your_table).toEqual({ area: AREA });
    expect(Object.keys(body.your_table as object)).toEqual(['area']);
    for (const key of ['address_text', 'map_link', 'venue_guide', 'location_id', 'at_your_table', 'your_table_area']) expect(body).not.toHaveProperty(key);
    expectNoSecrets(page.text);
    expect(page.text).not.toContain(PLACE_NAME);
  });

  it('says nothing of a table while the switch is off', async () => {
    const page = await text('/api/events/ana-table-k3x9q2m7wz/public', { open: false });
    expect(page.status).toBe(200);
    expect(page.text).not.toContain('your_table');
    expect(page.text).not.toContain(AREA);
    expectNoSecrets(page.text);
  });

  it('says nothing for a session at a place that is not the table', async () => {
    session('studio-night', ana.accountId, 'place-studio', { hostUserId: 'ana' });
    const page = await text('/api/events/studio-night-k3x9q2m7wz/public');
    expect(page.status).toBe(200);
    expect(page.text).not.toContain('your_table');
    expectNoSecrets(page.text);
  });

  it('never borrows the table of another account', async () => {
    // A shop session whose place id points at Ana's table is not at a table.
    session('shop-night', adrian.accountId, PLACE_ID, { visibility: 'public', discovery: 1 });
    const page = await text('/api/events/shop-night-k3x9q2m7wz/public');
    expect(page.status).toBe(200);
    expect(page.text).not.toContain('your_table');
    expect(page.text).not.toContain(AREA);
    const list = await text('/api/events');
    expect(list.text).toContain('shop-night');
    expect(list.text).not.toContain(AREA);
    expectNoSecrets(list.text);
  });

  it('shows a listed session at a table by its area only, in the lists', async () => {
    // The worst case for a list: a listed shop session at a place marked as the shop's table.
    place('shop-place', adrian.accountId, 'Back room', 1, 'Sanur');
    session('shop-table', adrian.accountId, 'shop-place', { visibility: 'public', discovery: 1 });
    const list = await text('/api/events');
    expect(list.status).toBe(200);
    const rows = JSON.parse(list.text) as Array<Record<string, unknown>>;
    expect(rows.find(row => row.id === 'shop-table')?.your_table).toEqual({ area: 'Sanur' });
    expect(list.text).not.toContain('shop-place');
    expect(list.text).not.toContain('Back room');
    expectNoSecrets(list.text);
  });

  it('keeps the table out of every list, tea house, Visit and public agent tool', async () => {
    const reads = [
      '/api/events',
      `/api/s/${ana.accountId}/events`,
      `/api/s/${ana.accountId}`,
      '/api/network/stores', // Visit reads this list
      '/api/tea-houses/work',
      '/api/tea-houses/build',
      `/api/tea-houses/work/${ana.accountId}`,
      `/mcp/public?account=${ana.accountId}`,
    ];
    for (const path of reads) {
      const read = await text(path);
      expectNoSecrets(read.text);
      expect(read.text, path).not.toContain(PLACE_NAME);
      expect(read.text, path).not.toContain(AREA);
    }
    const visit = JSON.parse((await text('/api/network/stores')).text) as unknown;
    expect(JSON.stringify(visit)).not.toContain(ana.accountId);

    for (const body of [
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'browse_catalog', arguments: {} } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_tea', arguments: { query: 'Ubud' } } },
    ]) {
      const read = await text('/mcp/public', { method: 'POST', body });
      expect(read.status).toBe(200);
      expectNoSecrets(read.text);
      expect(read.text).not.toContain(PLACE_NAME);
      expect(read.text).not.toContain(AREA);
    }
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { afterSitRoutes } from '../src/afterSitAccess';
import { hashAfterSitCredential } from '../src/afterSitCredential';
import { pouredGrams, pourSitRoutes, sitTitleFor } from '../src/pourSit';
import { wayMediaVerdict, WAY_MEDIA_ORIGIN } from '../src/wayMedia';
import { sitWayOpen } from '../../shared/sessionEnd';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

type Env = { DB: D1Database; JWT_SECRET?: string };
let db: SqliteD1;
const jwtSecret = 'synthetic-test-secret';

const requireHost = async (request: Request) => {
  const accountId = request.headers.get('Test-Host');
  return accountId ? { accountId, userId: request.headers.get('Test-Host-User'), email: 'host@test.dev' } : { error: new Response(null, { status: 403 }) };
};
const requireUser = async (request: Request) => {
  const userId = request.headers.get('Test-User');
  return userId ? { userId } : { error: new Response(null, { status: 401 }) };
};
const routes = [
  ...pourSitRoutes<Env>({
    requireHost, requireUser, limit: async () => null,
    ownPlacesAccount: async (_env, userId) => (userId === 'host' ? 'host-own' : null),
    readPublic: () => async () => null, appOrigin: () => 'https://teajia.test',
    optionalUser: async request => request.headers.get('Test-User'),
    sessionRsvpSql: () => "e.status = 'active' AND e.public_visibility IN ('public', 'unlisted')",
    sessionGuestSql: () => '1',
  }),
  ...afterSitRoutes<Env>({ requireHost, requireUser, limit: async () => null }),
];

async function call(method: string, pattern: string, options: {
  host?: string; hostUser?: string; user?: string; body?: unknown; params?: Record<string, string>; query?: string;
} = {}) {
  const route = routes.find(([verb, path]) => verb === method && path === pattern);
  if (!route) throw new Error(`no route ${method} ${pattern}`);
  const request = new Request(`https://teajia.test${pattern}${options.query ?? ''}`, {
    method,
    headers: { ...(options.host ? { 'Test-Host': options.host } : {}), ...(options.hostUser ? { 'Test-Host-User': options.hostUser } : {}), ...(options.user ? { 'Test-User': options.user } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const response = await route[2](request, { DB: db as unknown as D1Database, FIRST_TABLE_OPEN: 'false', JWT_SECRET: jwtSecret } as never, options.params ?? {});
  return { status: response.status, body: await response.json().catch(() => null) as any };
}

const today = new Date().toISOString().slice(0, 10);
const pour = (body: Record<string, unknown>, host = 'shop-a') =>
  call('POST', '/api/admin/pour', { host, body: { date: today, timezone: 'UTC', ...body } });
const stock = (id: string) => (db.sqlite.prepare('SELECT stock_grams, status FROM products WHERE id = ?').get(id) as { stock_grams: number; status: string });
const codeOf = (link: string) => link.split('/sit/')[1];

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'host', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'guest', accountId: 'shop-b' });
  db.exec(`
    INSERT INTO products (id, account_id, type, product_name, given_name, stock_grams, status, cost_amount, cost_currency) VALUES
      ('liubao', 'shop-a', 'Heicha', 'Liu Bao 2005', 'Old Basket', 100, 'Active', 1, 'USD'),
      ('scrap', 'shop-a', 'Oolong', 'Last of the Dancong', NULL, 5, 'Active', 1, 'USD'),
      ('draft', 'shop-a', 'Oolong', 'Unlisted sample', NULL, 4, 'Draft', 1, 'USD'),
      ('pot', 'shop-a', 'Teaware', 'A pot', NULL, 0, 'Active', 1, 'USD'),
      ('theirs', 'shop-b', 'Oolong', 'Another shop tea', NULL, 50, 'Active', 1, 'USD');
  `);
});

describe('sharing a scheduled private sit', () => {
  const key = 'accounts/shop-a/venue-guide/synthetic.png';
  const guide = JSON.stringify({ steps: [{ description: 'Through the gate', image_url: WAY_MEDIA_ORIGIN + key }] });
  const editLink = (link: boolean) => call('PUT', '/api/admin/pour/sits/:id', {
    host: 'shop-a', params: { id: 'scheduled' }, body: { link },
  });

  beforeEach(() => {
    db.sqlite.prepare(`INSERT INTO events
      (id, account_id, slug, title, event_date, event_end_date, timezone, lifecycle_status, status,
       public_visibility, address_text, map_link, venue_guide, requires_approval)
      VALUES ('scheduled', 'shop-a', 'private-scheduled', 'Host schedule', '2999-01-01', '2999-01-02', 'UTC',
        'published', 'active', 'private', '1 Gate Lane', 'https://maps.test/x', ?, 1)`).run(guide);
    db.exec(`INSERT INTO event_attendee_recaps (event_id, account_id, session_notes)
        VALUES ('scheduled', 'shop-a', 'Note for approved guests');
      INSERT INTO event_tea_menu (id, event_id, account_id, custom_name)
        VALUES ('pour-scheduled', 'scheduled', 'shop-a', 'Private menu');
      INSERT INTO event_attendees (id, event_id, account_id, user_id, full_name, status, magic_token, attended)
        VALUES ('request', 'scheduled', 'shop-a', 'guest', 'Synthetic Guest', 'requested', 'test-rsvp', NULL);`);
  });

  it('keeps the existing link with confirmed-seat access and expires the way in with the session', async () => {
    const code = codeOf((await editLink(true)).body.sit.link);
    const params = { code };
    const read = (user?: string) => call('GET', '/api/sit/:code', { params, user });
    for (const user of [undefined, 'guest']) {
      expect(await read(user)).toEqual({ status: 200, body: { access: 'approval', rsvp_path: null } });
    }
    expect(db.sqlite.prepare(`SELECT requires_approval, public_visibility, casual_sit FROM events WHERE id = 'scheduled'`).get())
      .toEqual({ requires_approval: 1, public_visibility: 'private', casual_sit: 0 });

    db.exec(`UPDATE events SET public_visibility = 'unlisted' WHERE id = 'scheduled'`);
    expect((await read('guest')).body).toEqual({ access: 'approval', rsvp_path: '/event/private-scheduled' });
    db.exec(`UPDATE events SET public_visibility = 'private' WHERE id = 'scheduled';
      UPDATE event_attendees SET status = 'confirmed' WHERE id = 'request'`);
    expect(codeOf((await editLink(true)).body.sit.link)).toBe(code);
    const confirmed = (await read('guest')).body;
    expect(confirmed).toMatchObject({
      access: 'confirmed', note: 'Note for approved guests', seated: false, happened: false,
      teas: [{ name: 'Private menu' }], way: { address: '1 Gate Lane', map_link: 'https://maps.test/x' },
    });
    expect((await read('host')).body).toEqual({ access: 'approval', rsvp_path: null });
    const signed = new URL(JSON.parse(confirmed.way.guide).steps[0].image_url);
    const verdict = () => wayMediaVerdict(db as unknown as D1Database, jwtSecret, key, signed.searchParams, '1');
    expect(await verdict()).toBe('signed');

    db.exec(`UPDATE event_attendees SET status = 'cancelled' WHERE id = 'request'`);
    expect((await read('guest')).body).toEqual({ access: 'approval', rsvp_path: null });
    expect(await verdict()).toBe('refused');
    db.exec(`UPDATE event_attendees SET status = 'confirmed' WHERE id = 'request';
      UPDATE events SET event_date = '2026-01-01', event_end_date = '2026-01-02' WHERE id = 'scheduled'`);
    expect((await read('guest')).body.way).toBeNull();
    expect(await verdict()).toBe('refused');

    db.exec(`UPDATE events SET event_date = '2999-01-01', event_end_date = '2999-01-02' WHERE id = 'scheduled'`);
    expect((await editLink(false)).body.sit.link).toBeNull();
    expect((await read('guest')).status).toBe(404);
    expect(await verdict()).toBe('refused');
    expect(codeOf((await editLink(true)).body.sit.link)).not.toBe(code);
    expect(await verdict()).toBe('refused');
  });

  it('opens the thank-you for host-recorded attendance and preserves its expiry and revocation', async () => {
    const params = { code: codeOf((await editLink(true)).body.sit.link) };
    db.exec(`UPDATE events SET lifecycle_status = 'completed' WHERE id = 'scheduled'`);
    const join = (user: string) => call('POST', '/api/sit/:code/join', { params, user });
    expect((await join('guest')).status).toBe(403);
    expect((await join('host')).status).toBe(403);
    db.exec(`UPDATE event_attendees SET status = 'confirmed' WHERE id = 'request'`);
    expect((await join('guest')).status).toBe(403);
    expect(db.sqlite.prepare(`SELECT status, attended FROM event_attendees WHERE event_id = 'scheduled'`).all())
      .toEqual([{ status: 'confirmed', attended: null }]);

    db.exec(`UPDATE event_attendees SET attended = 1 WHERE id = 'request'`);
    const credential = (await join('guest')).body.credential;
    const recap = () => call('POST', '/api/after-sit/recap', { body: { credential } });
    expect((await recap()).body).toMatchObject({ host_note: 'Note for approved guests' });
    db.exec(`UPDATE after_sit_access SET expires_at = unixepoch() - 1 WHERE attendee_id = 'request'`);
    expect((await recap()).status).toBe(404);
    const replacement = (await join('guest')).body.credential;
    db.exec(`UPDATE event_attendees SET attended = 0 WHERE id = 'request'`);
    expect((await call('POST', '/api/after-sit/recap', { body: { credential: replacement } })).status).toBe(404);
  });

  it('withholds private material from a historical self-attested seat on a scheduled event', async () => {
    const params = { code: codeOf((await editLink(true)).body.sit.link) };
    const credential = 'a'.repeat(64);
    const credentialHash = await hashAfterSitCredential(credential);
    db.exec(`UPDATE events SET lifecycle_status = 'completed' WHERE id = 'scheduled';
      UPDATE event_attendees SET status = 'confirmed', attended = 1, source = 'sit_link' WHERE id = 'request'`);
    db.sqlite.prepare(`INSERT INTO after_sit_access (attendee_id, event_id, account_id, credential_hash, expires_at)
      VALUES ('request', 'scheduled', 'shop-a', ?, unixepoch() + 3600)`).run(credentialHash);
    expect((await call('GET', '/api/sit/:code', { params, user: 'guest' })).body).toEqual({ access: 'approval', rsvp_path: null });
    expect((await call('POST', '/api/sit/:code/join', { params, user: 'guest' })).status).toBe(403);
    expect((await call('POST', '/api/after-sit/recap', { body: { credential } })).status).toBe(404);
  });
});

describe('a typed weight', () => {
  it('is no weight when nothing is typed, and the number otherwise', () => {
    expect(pouredGrams(undefined)).toBeNull();
    expect(pouredGrams('')).toBeNull();
    expect(pouredGrams(0)).toBeNull();
    expect(pouredGrams('7.5')).toBe(7.5);
    expect(pouredGrams(7.26)).toBe(7.3);
    expect(pouredGrams(-1)).toEqual({ refused: expect.any(String) });
    expect(pouredGrams('abc')).toEqual({ refused: expect.any(String) });
  });
});

describe('the pour page', () => {
  it('lists the whole shelf except teaware, and only this shop', async () => {
    const { body } = await call('GET', '/api/admin/pour/teas', { host: 'shop-a' });
    expect(body.teas.map((tea: { id: string }) => tea.id).sort()).toEqual(['draft', 'liubao', 'scrap']);
  });

  it('says what a gram of each tea sells for, and nothing where the cost is unknown', async () => {
    db.exec(`INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1), ('Yuan', 7.1);
      UPDATE products SET cost_amount = 50, quantity_purchased = 100 WHERE id = 'liubao';
      INSERT INTO products (id, account_id, type, product_name, stock_grams, status, cost_amount, cost_currency)
        VALUES ('unpriced', 'shop-a', 'Oolong', 'No cost yet', 10, 'Active', NULL, NULL)`);
    const { body } = await call('GET', '/api/admin/pour/teas', { host: 'shop-a' });
    const price = (id: string) => body.teas.find((tea: { id: string }) => tea.id === id).price_per_gram;
    expect(price('liubao')).toBeGreaterThanOrEqual(1.5); // 50 for 100 g, times three, plus freight
    expect(price('unpriced')).toBeNull();
  });

  it('makes the day\'s sit on the first pour and takes the grams out of stock', async () => {
    const first = await pour({ product_id: 'liubao', grams: 7.5 });
    expect(first.status).toBe(201);
    expect(first.body.sit.title).toBe(sitTitleFor(today));
    expect(first.body.sit.happened).toBe(true);
    expect(first.body.sit.link).toMatch(/^https:\/\/teajia\.test\/sit\/[a-f0-9]{24}$/);
    expect(first.body.sit.teas).toEqual([expect.objectContaining({ name: 'Old Basket', grams: 7.5, short: false })]);
    expect(stock('liubao').stock_grams).toBe(92.5);
    const ledger = db.sqlite.prepare(`SELECT delta, balance_after, reason, movement_type, note FROM stock_ledger WHERE product_id = 'liubao'`).get();
    expect(ledger).toEqual({ delta: -7.5, balance_after: 92.5, reason: 'SAMPLE', movement_type: 'sample_use', note: `Poured at ${sitTitleFor(today)}` });

    const second = await pour({ product_id: 'scrap' });
    expect(second.body.sit.id).toBe(first.body.sit.id);
    expect(second.body.sit.teas).toHaveLength(2);
    expect(second.body.sit.teas[1]).toEqual(expect.objectContaining({ grams: null, short: false }));
    expect(stock('scrap').stock_grams).toBe(5);
  });

  it('never refuses a pour for want of stock: it takes what is there', async () => {
    const { body } = await pour({ product_id: 'scrap', grams: 8 });
    expect(body.sit.teas[0]).toEqual(expect.objectContaining({ grams: 8, short: true }));
    expect(stock('scrap')).toEqual({ stock_grams: 0, status: 'Sold Out' });
    // A draft that empties stays a draft.
    await pour({ product_id: 'draft', grams: 4 });
    expect(stock('draft')).toEqual({ stock_grams: 0, status: 'Draft' });
  });

  it('takes a pour back, and its grams with it', async () => {
    const { body } = await pour({ product_id: 'scrap', grams: 8 });
    const undone = await call('DELETE', '/api/admin/pour/:menuId', { host: 'shop-a', params: { menuId: body.poured } });
    expect(undone.body.sit.teas).toEqual([]);
    expect(stock('scrap')).toEqual({ stock_grams: 5, status: 'Active' });
    const again = await call('DELETE', '/api/admin/pour/:menuId', { host: 'shop-a', params: { menuId: body.poured } });
    expect(again.status).toBe(404);
    expect(stock('scrap').stock_grams).toBe(5);
  });

  it('pours a tea by name alone, and refuses another shop\'s tea', async () => {
    const named = await pour({ name: 'A friend\'s Dan Cong', grams: 6 });
    expect(named.body.sit.teas[0]).toEqual(expect.objectContaining({ name: 'A friend\'s Dan Cong', product_id: null, short: false }));
    expect((await pour({ product_id: 'theirs', grams: 5 })).status).toBe(404);
    expect((await pour({ product_id: 'pot' })).status).toBe(404);
    expect((await pour({})).status).toBe(400);
    expect(stock('theirs').stock_grams).toBe(50);
    const other = await call('DELETE', '/api/admin/pour/:menuId', { host: 'shop-b', params: { menuId: named.body.poured } });
    expect(other.status).toBe(404);
  });
});

describe('the one link', () => {
  async function sitWithPlace() {
    const { body } = await pour({ product_id: 'liubao', grams: 7 });
    db.exec(`INSERT INTO saved_locations (id, account_id, name, address, map_link, venue_guide)
      VALUES ('studio', 'shop-a', 'The studio', '1 Gate Lane', 'https://maps.test/x', '{"steps":[{"description":"Through the green gate"}]}'),
             ('elsewhere', 'shop-b', 'Not yours', '9 Other Road', NULL, NULL)`);
    const placed = await call('PUT', '/api/admin/pour/sits/:id', {
      host: 'shop-a', params: { id: body.sit.id }, body: { place_id: 'studio', note: 'Thank you for coming.', title: 'Friday at the studio' },
    });
    return placed.body.sit;
  }

  it('opens for anyone: the teas, the note and, on the day, the way in', async () => {
    const sit = await sitWithPlace();
    expect(sit).toEqual(expect.objectContaining({ title: 'Friday at the studio', note: 'Thank you for coming.', has_way: true, way_open: true }));
    const { status, body } = await call('GET', '/api/sit/:code', { params: { code: codeOf(sit.link) } });
    expect(status).toBe(200);
    expect(body.title).toBe('Friday at the studio');
    expect(body.note).toBe('Thank you for coming.');
    expect(body.teas.map((tea: { name: string }) => tea.name)).toEqual(['Old Basket']);
    expect(JSON.stringify(body.teas)).not.toContain('grams');
    expect(body.way).toEqual(expect.objectContaining({ place: 'The studio', address: '1 Gate Lane', map_link: 'https://maps.test/x' }));
    expect(JSON.parse(body.way.guide).steps[0].description).toBe('Through the green gate');
  });

  it('offers the host\'s tea spaces first, then the places sat at, and never another shop\'s', async () => {
    await sitWithPlace();
    db.exec(`INSERT INTO saved_locations (id, account_id, name, address, is_host_table, area_hint)
      VALUES ('room', 'shop-a', 'The garden room', '2 Gate Lane', 1, 'Ubud'),
             ('cafe', 'shop-a', 'A cafe', '3 Gate Lane', 0, NULL)`);
    const { body } = await call('GET', '/api/admin/pour/places', { host: 'shop-a' });
    expect(body.places).toEqual([
      { id: 'room', name: 'The garden room', space: true, sat: false },
      { id: 'studio', name: 'The studio', space: false, sat: true },
      { id: 'cafe', name: 'A cafe', space: false, sat: false },
    ]);
  });

  it('offers the host\'s own tea spaces beside the shop\'s places, and takes one as the way in', async () => {
    const sit = await sitWithPlace();
    db.exec(`INSERT INTO saved_locations (id, account_id, name, address, is_host_table, area_hint)
      VALUES ('home', 'host-own', 'The house, upstairs', '5 Home Lane', 1, 'Ubud')`);
    const listed = await call('GET', '/api/admin/pour/places', { host: 'shop-a', hostUser: 'host' });
    expect(listed.body.places.map((place: { id: string }) => place.id)).toEqual(['home', 'studio']);
    const unseen = await call('GET', '/api/admin/pour/places', { host: 'shop-a' });
    expect(unseen.body.places.map((place: { id: string }) => place.id)).toEqual(['studio']);
    const refused = await call('PUT', '/api/admin/pour/sits/:id', { host: 'shop-a', params: { id: sit.id }, body: { place_id: 'home' } });
    expect(refused.status).toBe(404);
    const placed = await call('PUT', '/api/admin/pour/sits/:id', { host: 'shop-a', hostUser: 'host', params: { id: sit.id }, body: { place_id: 'home' } });
    expect(placed.body.sit.place).toMatchObject({ id: 'home', name: 'The house, upstairs' });
  });

  it('drops the way in once the day is over, and keeps the rest', async () => {
    const sit = await sitWithPlace();
    db.sqlite.prepare(`UPDATE events SET event_date = '2026-01-02' WHERE id = ?`).run(sit.id);
    const { body } = await call('GET', '/api/sit/:code', { params: { code: codeOf(sit.link) } });
    expect(body.way).toBeNull();
    expect(JSON.stringify(body)).not.toContain('Gate Lane');
    expect(body.teas).toHaveLength(1);
  });

  it('refuses a place that belongs to someone else, and a code that names nothing', async () => {
    const sit = await sitWithPlace();
    const wrong = await call('PUT', '/api/admin/pour/sits/:id', { host: 'shop-a', params: { id: sit.id }, body: { place_id: 'elsewhere' } });
    expect(wrong.status).toBe(404);
    expect((await call('GET', '/api/sit/:code', { params: { code: 'a'.repeat(24) } })).status).toBe(404);
    expect((await call('GET', '/api/sit/:code', { params: { code: 'nope' } })).status).toBe(404);
    expect((await call('PUT', '/api/admin/pour/sits/:id', { host: 'shop-b', params: { id: sit.id }, body: { title: 'Mine now' } })).status).toBe(404);
  });

  it('gives a signed-in guest a seat and a thank-you link that opens the recap', async () => {
    const sit = await sitWithPlace();
    const code = codeOf(sit.link);
    expect((await call('POST', '/api/sit/:code/join', { params: { code } })).status).toBe(401);
    const joined = await call('POST', '/api/sit/:code/join', { params: { code }, user: 'guest' });
    expect(joined.status).toBe(200);
    expect(joined.body.credential).toMatch(/^[a-f0-9]{64}$/);
    const recap = await call('POST', '/api/after-sit/recap', { body: { credential: joined.body.credential } });
    expect(recap.status).toBe(200);
    expect(recap.body.event.title).toBe('Friday at the studio');
    expect(recap.body.host_note).toBe('Thank you for coming.');
    expect(recap.body.teas.map((tea: { name: string }) => tea.name)).toEqual(['Old Basket']);
    // Opening it again makes no second seat.
    await call('POST', '/api/sit/:code/join', { params: { code }, user: 'guest' });
    expect(db.sqlite.prepare(`SELECT count(*) AS n FROM event_attendees WHERE event_id = ?`).get(sit.id)).toEqual({ n: 1 });
    // A seat the host marked as not there gets no link.
    db.sqlite.prepare(`UPDATE event_attendees SET attended = 0 WHERE event_id = ?`).run(sit.id);
    expect((await call('POST', '/api/sit/:code/join', { params: { code }, user: 'guest' })).status).toBe(403);
  });

  it('makes a sit ahead of its day that waits, shows the way in, and has happened once the day comes', async () => {
    const made = await call('POST', '/api/admin/pour/sits', { host: 'shop-a', body: { date: '2999-01-01', timezone: 'UTC' } });
    expect(made.status).toBe(201);
    expect(made.body.sit.happened).toBe(false);
    const code = codeOf(made.body.sit.link);
    expect((await call('POST', '/api/sit/:code/join', { params: { code }, user: 'guest' })).status).toBe(409);
    db.sqlite.prepare(`UPDATE events SET event_date = ? WHERE id = ?`).run(today, made.body.sit.id);
    const opened = await call('GET', '/api/sit/:code', { params: { code } });
    expect(opened.body.happened).toBe(true);
    expect((await call('POST', '/api/sit/:code/join', { params: { code }, user: 'guest' })).status).toBe(200);
  });

  it('gives a session invited ahead its own link when the host asks', async () => {
    db.exec(`INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status) VALUES ('proper', 'shop-a', 'proper', 'Tea evening', '${today}', 'completed')`);
    const listed = await call('GET', '/api/admin/pour/sits', { host: 'shop-a', query: `?date=${today}` });
    expect(listed.body.sits).toEqual([expect.objectContaining({ id: 'proper', link: null, casual: false })]);
    const linked = await call('PUT', '/api/admin/pour/sits/:id', { host: 'shop-a', params: { id: 'proper' }, body: { link: true } });
    expect(linked.body.sit.link).toMatch(/\/sit\/[a-f0-9]{24}$/);
    const poured = await pour({ sit_id: 'proper', product_id: 'liubao', grams: 5 });
    expect(poured.body.sit.id).toBe('proper');
  });
});

describe('the day the way in closes', () => {
  it('is the end of the sit\'s own day, whatever state the sit is in', () => {
    const sit = { event_date: '2026-11-27', timezone: 'Asia/Makassar', lifecycle_status: 'completed' };
    expect(sitWayOpen(sit, Date.parse('2026-11-27T15:00:00Z'))).toBe(true);   // 23:00 in Bali
    expect(sitWayOpen(sit, Date.parse('2026-11-27T16:00:00Z'))).toBe(false);  // midnight in Bali
    const timed = { event_date: '2026-11-27T06:00:00.000Z', timezone: 'Asia/Makassar' }; // 14:00 in Bali
    expect(sitWayOpen(timed, Date.parse('2026-11-27T15:59:00Z'))).toBe(true);
    expect(sitWayOpen(timed, Date.parse('2026-11-27T16:00:00Z'))).toBe(false);
    expect(sitWayOpen({ ...sit, lifecycle_status: 'cancelled' }, Date.parse('2026-11-27T10:00:00Z'))).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { afterSitRoutes } from '../src/afterSitAccess';
import { hashAfterSitCredential } from '../src/afterSitCredential';
import { keepSessionTea } from '../src/chestKeep';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

type Env = { DB: D1Database; FIRST_TABLE_OPEN?: string };
let db: SqliteD1;

const routes = afterSitRoutes<Env>({
  requireHost: async request => {
    const accountId = request.headers.get('Test-Host');
    return accountId ? { accountId } : { error: new Response(null, { status: 403 }) };
  },
  requireUser: async request => {
    const userId = request.headers.get('Test-User');
    return userId ? { userId } : { error: new Response(null, { status: 401 }) };
  },
  limit: async () => null,
});

async function call(path: string, body: unknown, headers: Record<string, string> = {}, env: Partial<Env> = {},
  params: Record<string, string> = {}) {
  const route = routes.find(([method, pattern]) => method === 'POST' && pattern === path);
  if (!route) throw new Error(`no route ${path}`);
  return route[2](new Request(`https://teajia.test${path}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  }), { DB: db as unknown as D1Database, ...env }, params);
}

async function issue(attendeeId = 'seat-a', eventId = 'event-a') {
  const response = await call('/api/admin/events/:eventId/after-sit/:attendeeId', undefined,
    { 'Test-Host': 'shop-a' }, {}, { attendeeId, eventId });
  expect(response.status).toBe(200);
  return (await response.json() as { credential: string }).credential;
}

// Stands in for the shop's public catalogue rule: only a public, shown product is readable.
const readPublic = async (accountId: string, productId: string) => db.sqlite.prepare(
  'SELECT id FROM products WHERE account_id = ? AND id = ? AND is_public = 1 AND shown_in_shop = 1',
).get(accountId, productId) as Record<string, unknown> | undefined ?? null;

async function keep(credential: string, userId: string, teaId: string) {
  return keepSessionTea(db as unknown as D1Database, {
    userId, teaId, credentialHash: await hashAfterSitCredential(credential), readPublic,
  });
}

beforeEach(() => {
  db = new SqliteD1('migrations', '0128');
  seedIdentity(db, { userId: 'guest-a', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'guest-b', accountId: 'shop-a' });
  db.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status) VALUES
      ('event-a', 'shop-a', 'one', 'First table', '2026-11-22', 'completed'),
      ('event-b', 'shop-a', 'two', 'Second table', '2026-11-23', 'completed');
    INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status, attended) VALUES
      ('seat-a', 'shop-a', 'event-a', 'Guest A', 'legacy-a', 'confirmed', 1),
      ('seat-b', 'shop-a', 'event-b', 'Guest B', 'legacy-b', 'confirmed', 1);
    INSERT INTO products
      (id, account_id, type, product_name, year, origin_country, origin_region, is_public, shown_in_shop)
    VALUES
      ('product-public', 'shop-a', 'White', 'Public white', 2018, 'China', 'Fujian', 1, 1),
      ('product-private', 'shop-a', 'Red', 'Private red', 2020, 'China', 'Yunnan', 0, 1);
    INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order) VALUES
      ('tea-public', 'shop-a', 'event-a', 'product-public', 'Session white', 1),
      ('tea-private', 'shop-a', 'event-a', 'product-private', null, 2),
      ('tea-other', 'shop-a', 'event-b', 'product-public', 'Other table white', 1);
  `);
});

afterEach(() => db.close());

describe('keeping a served tea in a guest Tea Chest', () => {
  it('keeps details of a public product only; a hidden product gives its name and nothing more', async () => {
    const credential = await issue();
    const publicItem = await keep(credential, 'guest-a', 'tea-public');
    const privateItem = await keep(credential, 'guest-a', 'tea-private');

    expect(publicItem).toMatchObject({
      id: expect.stringMatching(/^cellar_[a-f0-9]{32}$/),
      name: 'Session white', type: 'White', year: 2018, origin: 'Fujian, China', grams: 0,
      linkedProductId: 'product-public', costAmount: null, costCurrency: null,
      source: { kind: 'session', eventId: 'event-a', eventTitle: 'First table' },
    });
    expect(privateItem).toMatchObject({
      name: 'Private red', type: null, year: null, origin: null, grams: 0,
      linkedProductId: null, costAmount: null, costCurrency: null,
    });
    expect(db.sqlite.prepare(`SELECT grams, chest_cost_amount, chest_cost_currency, source_kind,
      source_event_id, source_tea_ref, linked_product_id FROM personal_cellar_items ORDER BY source_tea_ref`).all())
      .toEqual([
        { grams: 0, chest_cost_amount: null, chest_cost_currency: null, source_kind: 'session', source_event_id: 'event-a', source_tea_ref: 'tea-private', linked_product_id: null },
        { grams: 0, chest_cost_amount: null, chest_cost_currency: null, source_kind: 'session', source_event_id: 'event-a', source_tea_ref: 'tea-public', linked_product_id: 'product-public' },
      ]);
  });

  it('lets a party link keep a tea, as it opens the thank-you', async () => {
    const response = await call('/api/admin/events/:eventId/after-sit/:attendeeId/party', { first_name: 'Mei' },
      { 'Test-Host': 'shop-a' }, {}, { attendeeId: 'seat-a', eventId: 'event-a' });
    expect(response.status).toBe(200);
    const { credential } = await response.json() as { credential: string };
    expect(await keep(credential, 'guest-b', 'tea-public')).toMatchObject({ name: 'Session white', linkedProductId: 'product-public' });
  });

  it('copies nothing but the name when no catalogue reader is given', async () => {
    const credential = await issue();
    const item = await keepSessionTea(db as unknown as D1Database, {
      userId: 'guest-a', teaId: 'tea-public', credentialHash: await hashAfterSitCredential(credential),
    });
    expect(item).toMatchObject({ name: 'Session white', type: null, year: null, origin: null, linkedProductId: null });
  });

  it('returns the same chest item when the same user keeps the tea twice', async () => {
    const credential = await issue();
    const first = await keep(credential, 'guest-a', 'tea-public');
    const second = await keep(credential, 'guest-a', 'tea-public');
    expect(second).toEqual(first);
    expect(db.sqlite.prepare('SELECT count(*) AS count FROM personal_cellar_items').get()).toEqual({ count: 1 });
  });

  it('refuses a tea served at another session', async () => {
    expect(await keep(await issue(), 'guest-a', 'tea-other')).toBeNull();
    expect(db.sqlite.prepare('SELECT count(*) AS count FROM personal_cellar_items').get()).toEqual({ count: 0 });
  });

  it('refuses a link after the guest is marked not attended', async () => {
    const credential = await issue();
    db.exec("UPDATE event_attendees SET attended = 0 WHERE id = 'seat-a'");
    expect(await keep(credential, 'guest-a', 'tea-public')).toBeNull();
  });

  it('refuses an expired link', async () => {
    const credential = await issue();
    db.exec('UPDATE after_sit_access SET expires_at = unixepoch() - 1');
    expect(await keep(credential, 'guest-a', 'tea-public')).toBeNull();
  });

  it('lets two users each keep their own copy of the same served tea', async () => {
    const credential = await issue();
    const [a, b] = await Promise.all([
      keep(credential, 'guest-a', 'tea-public'), keep(credential, 'guest-b', 'tea-public'),
    ]);
    expect(a?.id).not.toBe(b?.id);
    expect(db.sqlite.prepare('SELECT owner_user_id FROM personal_cellar_items ORDER BY owner_user_id').all())
      .toEqual([{ owner_user_id: 'guest-a' }, { owner_user_id: 'guest-b' }]);
  });

  it('opens the route only when the first table flag is true', async () => {
    const credential = await issue();
    const body = { credential, teaId: 'tea-public' };
    const headers = { 'Test-User': 'guest-a' };
    expect((await call('/api/after-sit/keep-tea', body, headers, { FIRST_TABLE_OPEN: 'false' })).status).toBe(404);
    const open = await call('/api/after-sit/keep-tea', body, headers, { FIRST_TABLE_OPEN: 'true' });
    expect(open.status).toBe(200);
    expect(await open.json()).toMatchObject({ item: { name: 'Session white', source: { kind: 'session', eventId: 'event-a' } } });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { hostTableTeas, readTableTeas, saveTableTeas } from '../src/hostTableTeas';
import { isNamedPourer, tablePourRoutes } from '../src/tablePour';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

type Env = { DB: D1Database };
let db: SqliteD1;
const TABLE = { id: 'table-1', account_id: 'own-host', title: 'Friday at mine', event_date: '2026-11-27T10:00:00Z', timezone: 'UTC', lifecycle_status: 'published' };

const routes = tablePourRoutes<Env>({
  requireOwnTable: async (request, _env, tableId) => {
    const userId = request.headers.get('Test-User');
    return userId === 'host' && tableId === TABLE.id
      ? { host: { userId, name: 'Hana', email: 'hana@test.dev' }, table: TABLE }
      : { error: new Response(null, { status: 404 }) };
  },
  shopShelf: async (env, userId) => (await isNamedPourer(env.DB, 'shop', userId) ? { accountId: 'shop', priced: false } : null),
  requireShopOwner: async request => (request.headers.get('Test-Owner') ? { accountId: 'shop', userId: 'adrian' } : { error: new Response(null, { status: 403 }) }),
});

async function call(method: string, pattern: string, options: { user?: string; owner?: boolean; body?: unknown; params?: Record<string, string> } = {}) {
  const route = routes.find(([verb, path]) => verb === method && path === pattern);
  if (!route) throw new Error(`no route ${method} ${pattern}`);
  const request = new Request(`https://teajia.test${pattern}`, {
    method,
    headers: { ...(options.user ? { 'Test-User': options.user } : {}), ...(options.owner ? { 'Test-Owner': '1' } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const response = await route[2](request, { DB: db as unknown as D1Database }, options.params ?? {});
  return { status: response.status, body: await response.json().catch(() => null) as any };
}
const pour = (body: Record<string, unknown>) => call('POST', '/api/me/tables/:id/pour', { user: 'host', body, params: { id: TABLE.id } });
const takeBack = (menuId: string) => call('DELETE', '/api/me/tables/:id/pour/:menuId', { user: 'host', params: { id: TABLE.id, menuId } });
const stock = (id: string) => (db.sqlite.prepare('SELECT stock_grams, status FROM products WHERE id = ?').get(id) as { stock_grams: number; status: string });
const menu = () => db.sqlite.prepare('SELECT id, account_id, product_id, custom_name, poured_grams, stock_taken_grams, poured_at FROM event_tea_menu WHERE event_id = ? ORDER BY brew_order').all(TABLE.id) as any[];
const name = () => call('POST', '/api/admin/pour/pourers', { owner: true, body: { email: 'host@test.dev' } });

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'adrian', accountId: 'shop' });
  seedIdentity(db, { userId: 'host', accountId: 'own-host' });
  db.exec(`
    INSERT INTO events (id, account_id, title, slug, event_date, timezone, total_capacity, status, lifecycle_status, host_user_id)
      VALUES ('table-1', 'own-host', 'Friday at mine', 'friday', '2026-11-27T10:00:00Z', 'UTC', 6, 'active', 'published', 'host');
    INSERT INTO products (id, account_id, type, product_name, given_name, stock_grams, status, cost_amount, cost_currency) VALUES
      ('liubao', 'shop', 'Heicha', 'Liu Bao 2005', 'Old Basket', 100, 'Active', 1, 'USD'),
      ('last', 'shop', 'Oolong', 'Last of the Dancong', NULL, 5, 'Active', 1, 'USD'),
      ('mine', 'own-host', 'Green', 'My Longjing', NULL, 40, 'Active', 1, 'USD');
  `);
});

describe('pouring at a host\'s own table', () => {
  it('lets every host pour from their own chest and by name, and keeps the shop\'s shelf shut', async () => {
    const shelf = await call('GET', '/api/me/tables/:id/pour', { user: 'host', params: { id: TABLE.id } });
    expect(shelf.body.teas.map((tea: any) => [tea.id, tea.shelf])).toEqual([['mine', 'chest']]);

    expect((await pour({ product_id: 'liubao', grams: 7 })).status).toBe(404);
    expect(stock('liubao').stock_grams).toBe(100);

    const own = await pour({ product_id: 'mine', grams: 6 });
    expect(own.status).toBe(201);
    expect(stock('mine')).toEqual({ stock_grams: 34, status: 'Active' });
    const typed = await pour({ name: 'A friend\'s Yancha' });
    expect(typed.body.sit.teas.map((tea: any) => tea.name)).toEqual(['My Longjing', 'A friend\'s Yancha']);
  });

  it('takes a named pourer\'s grams off the shop\'s shelf, onto the table\'s own tea list, with their name in the stock record', async () => {
    expect((await name()).status).toBe(201);
    const shelf = await call('GET', '/api/me/tables/:id/pour', { user: 'host', params: { id: TABLE.id } });
    const shopTea = shelf.body.teas.find((tea: any) => tea.id === 'liubao');
    expect(shopTea.shelf).toBe('shop');
    expect(shopTea.price_per_gram).toBeNull();
    expect(JSON.stringify(shelf.body)).not.toMatch(/cost/);

    const poured = await pour({ product_id: 'liubao', grams: 7 });
    expect(poured.status).toBe(201);
    expect(stock('liubao').stock_grams).toBe(93);
    expect(menu()).toMatchObject([{ account_id: 'own-host', product_id: 'liubao', custom_name: 'Old Basket', poured_grams: 7, stock_taken_grams: 7 }]);
    const ledger = db.sqlite.prepare('SELECT account_id, delta, note, user_email FROM stock_ledger WHERE product_id = ?').get('liubao');
    expect(ledger).toEqual({ account_id: 'shop', delta: -7, note: 'Poured at Friday at mine by Hana', user_email: 'hana@test.dev' });
    // The host's own page lists it, by name.
    expect((await hostTableTeas(db as unknown as D1Database, TABLE)).map(tea => tea.name)).toEqual(['Old Basket']);
  });

  it('sells a shop tea out when the last grams are poured, and puts it back on sale when the pour is taken back', async () => {
    await name();
    const poured = await pour({ product_id: 'last', grams: 8 });
    expect(poured.body.sit.teas[0]).toMatchObject({ grams: 8, short: true });
    expect(stock('last')).toEqual({ stock_grams: 0, status: 'Sold Out' });
    const back = await takeBack(poured.body.poured);
    expect(back.body.sit.teas).toEqual([]);
    expect(stock('last')).toEqual({ stock_grams: 5, status: 'Active' });
    expect(menu()).toEqual([]);
  });

  it('pours a tea the host planned ahead in its own place, and leaves it planned when the pour is taken back', async () => {
    db.exec(`INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order, created_at)
      VALUES ('planned', 'own-host', 'table-1', 'mine', 'My Longjing', 1, '2026-11-20 08:00:00')`);
    const poured = await pour({ product_id: 'mine', grams: 5 });
    expect(poured.body.poured).toBe('planned');
    expect(menu()).toHaveLength(1);
    await takeBack('planned');
    expect(menu()).toMatchObject([{ id: 'planned', poured_grams: null, stock_taken_grams: null, poured_at: null }]);
    expect(stock('mine').stock_grams).toBe(40);
  });

  it('stops pouring from the shop the moment the owner takes the name away', async () => {
    await name();
    expect((await call('GET', '/api/admin/pour/pourers', { owner: true })).body.pourers).toMatchObject([{ id: 'host' }]);
    await call('DELETE', '/api/admin/pour/pourers/:userId', { owner: true, params: { userId: 'host' } });
    expect((await pour({ product_id: 'liubao', grams: 3 })).status).toBe(404);
    expect((await call('POST', '/api/admin/pour/pourers', { body: { email: 'host@test.dev' } })).status).toBe(403);
    expect((await call('POST', '/api/admin/pour/pourers', { owner: true, body: { email: 'nobody@test.dev' } })).status).toBe(404);
  });

  it('answers nobody but the table\'s own host', async () => {
    expect((await call('GET', '/api/me/tables/:id/pour', { user: 'adrian', params: { id: TABLE.id } })).status).toBe(404);
    expect((await call('POST', '/api/me/tables/:id/pour', { user: 'adrian', body: { name: 'x' }, params: { id: TABLE.id } })).status).toBe(404);
  });

  it('keeps a poured tea whole when the host saves the table\'s teas, and will not drop a weighed pour', async () => {
    await name();
    const poured = await pour({ product_id: 'liubao', grams: 7 });
    const listed = await hostTableTeas(db as unknown as D1Database, TABLE);
    const again = readTableTeas(TABLE, { teas: listed.map(tea => ({ ...tea, from: 'Wuzhou' })) });
    await saveTableTeas(db as unknown as D1Database, TABLE, again as never);
    expect(menu()).toMatchObject([{ id: poured.body.poured, product_id: 'liubao', custom_name: 'Old Basket', stock_taken_grams: 7 }]);
    const dropped = await saveTableTeas(db as unknown as D1Database, TABLE, []);
    expect(dropped).toMatchObject({ refused: { code: 'table_tea_poured' } });
    expect(menu()).toHaveLength(1);
  });
});

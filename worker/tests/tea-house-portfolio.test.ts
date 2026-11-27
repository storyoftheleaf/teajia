import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Tea houses as Adrian's portfolio (Launch 4, K5 part two). A house's page is
// hidden until he marks it shown, and even then only while the house is
// public; only the platform owner writes; Work and Build follow his order by
// hand; a part he did not name is never shown, and a house with no words has
// no page. Driven through worker.fetch against SQLite built from the
// migration ledger.

const SECRET = 'tea-houses-secret';
const PLATFORM = 'acc_teajia_bali';
const MEDIA = 'https://media.teajia.co/uploads/room.jpg';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function setup(open = 'true') {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: PLATFORM, accountSlug: 'teajia-bali', platformRole: 'platform_owner' });
  seedIdentity(db, { userId: 'host', accountId: 'acc-ubud', accountSlug: 'ubud-house', role: 'owner' });
  seedIdentity(db, { userId: 'admin', accountId: 'acc-admin', accountSlug: 'admin-house', platformRole: 'platform_admin' });
  seedIdentity(db, { userId: 'host-two', accountId: 'acc-canggu', accountSlug: 'canggu-house', role: 'owner' });
  seedIdentity(db, { userId: 'host-three', accountId: 'acc-closed', accountSlug: 'closed-house', role: 'owner', publicEnabled: false });
  db.sqlite.exec(`
    UPDATE accounts SET is_platform_owner = 1 WHERE id = '${PLATFORM}';
    UPDATE accounts SET name = 'Ubud House', location_city = 'Ubud', location_country = 'Indonesia', kind = 'location' WHERE id = 'acc-ubud';
    UPDATE accounts SET name = 'Canggu House', location_city = 'Canggu', location_country = 'Indonesia', kind = 'location' WHERE id = 'acc-canggu';
    UPDATE accounts SET name = 'Closed House', kind = 'location' WHERE id = 'acc-closed';
  `);
  const env = { DB: db as any, JWT_SECRET: SECRET, TEA_HOUSES_OPEN: open, PROVIDER_LIMITER: { limit: async () => ({ success: true }) } };
  return { db, env };
}

type Who = { userId: string; account?: string } | null;
async function call(env: any, who: Who, path: string, init: { method?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(SECRET, {
      sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: who.account ?? null,
      // The token's word is never trusted: the database decides.
      platform_role: 'platform_owner', session_version: 0,
    });
    headers.set('Authorization', `Bearer ${token}`);
    if (who.account) headers.set('X-Teajia-Account', who.account);
  }
  let body: BodyInit | undefined;
  if (init.body !== undefined) { body = JSON.stringify(init.body); headers.set('Content-Type', 'application/json'); }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body }), env);
}
async function ok(env: any, who: Who, path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await call(env, who, path, init);
  if (response.status !== 200) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<any>;
}

const ADRIAN = { userId: 'adrian', account: PLATFORM };
const say = (env: any, house: string, part: string, words: string, photographs: string[] = []) =>
  ok(env, ADRIAN, `/api/admin/tea-houses/${house}/parts/${part}`, { method: 'PUT', body: { words, photographs } });
const show = (env: any, house: string, shown = true) =>
  ok(env, ADRIAN, `/api/admin/tea-houses/${house}/page`, { method: 'PUT', body: { shown } });

describe('a house portfolio is hidden until shown', () => {
  it('reads nothing of a house he wrote about until he marks its page shown', async () => {
    const { env } = setup();
    await say(env, 'acc-ubud', 'room', 'I drew the room around one long table.', [MEDIA]);
    expect((await call(env, null, '/api/tea-houses/work/ubud-house')).status).toBe(404);
    expect((await ok(env, null, '/api/tea-houses/work')).houses).toEqual([]);
    expect((await ok(env, null, '/api/tea-houses/build')).parts).toEqual([]);

    await show(env, 'acc-ubud');
    const page = await ok(env, null, '/api/tea-houses/work/ubud-house');
    expect(page.house).toEqual({ slug: 'ubud-house', name: 'Ubud House', place: 'Ubud, Indonesia' });
    expect(page.parts).toEqual([{ part: 'room', words: 'I drew the room around one long table.', photographs: [MEDIA] }]);

    await show(env, 'acc-ubud', false);
    expect((await call(env, null, '/api/tea-houses/work/ubud-house')).status).toBe(404);
  });

  it('keeps a shown page back while the house itself is not public', async () => {
    const { env } = setup();
    await say(env, 'acc-closed', 'teaware', 'I chose every cup.');
    await show(env, 'acc-closed');
    expect((await call(env, null, '/api/tea-houses/work/closed-house')).status).toBe(404);
    expect((await ok(env, null, '/api/tea-houses/work')).houses).toEqual([]);
    const manage = await ok(env, ADRIAN, '/api/admin/tea-houses');
    expect(manage.houses.find((house: any) => house.id === 'acc-closed').is_public).toBe(false);
  });

  it('treats every closed portfolio route as missing, before touching the database', async () => {
    const { env } = setup('false');
    const closed = { ...env, DB: { prepare: vi.fn(() => { throw new Error('Unexpected database access'); }) } };
    for (const [method, path] of [
      ['GET', '/api/tea-houses/work'], ['GET', '/api/tea-houses/work/ubud-house'], ['GET', '/api/tea-houses/build'],
      ['GET', '/api/admin/tea-houses'], ['PUT', '/api/admin/tea-houses/order'],
      ['PUT', '/api/admin/tea-houses/acc-ubud/page'], ['PUT', '/api/admin/tea-houses/acc-ubud/parts/room'],
      ['DELETE', '/api/admin/tea-houses/acc-ubud/parts/room'],
    ]) {
      const unknown = await call(closed, ADRIAN, '/api/absent', { method });
      const actual = await call(closed, ADRIAN, path, { method });
      expect(actual.status).toBe(unknown.status);
      expect([...actual.headers]).toEqual([...unknown.headers]);
      expect(await actual.json()).toEqual(await unknown.json());
    }
    expect(closed.DB.prepare).not.toHaveBeenCalled();
  });

  it('reads eligibility and parts in one statement when the last part is removed during the request', async () => {
    const { env, db } = setup();
    await say(env, 'acc-ubud', 'room', 'The room.');
    await show(env, 'acc-ubud');
    const prepare = db.prepare.bind(db);
    let removed = false;
    vi.spyOn(db, 'prepare').mockImplementation(sql => {
      const statement = prepare(sql);
      if (!removed && sql.includes('FROM tea_house_pages hp')) {
        const all = statement.all.bind(statement);
        statement.all = (...args: Parameters<typeof all>) => {
          const rows = all(...args);
          db.exec("DELETE FROM tea_house_contributions WHERE house_account_id = 'acc-ubud'");
          removed = true;
          return rows;
        };
      }
      return statement;
    });
    expect((await ok(env, null, '/api/tea-houses/work/ubud-house')).parts).toHaveLength(1);
    expect(removed).toBe(true);
    expect((await call(env, null, '/api/tea-houses/work/ubud-house')).status).toBe(404);
  });
});

describe('only the platform owner writes', () => {
  it('refuses everyone else, whatever their token says', async () => {
    const { env } = setup();
    const writes: Array<[string, string, unknown]> = [
      ['PUT', '/api/admin/tea-houses/acc-ubud/parts/room', { words: 'Mine now.', photographs: [] }],
      ['DELETE', '/api/admin/tea-houses/acc-ubud/parts/room', undefined],
      ['PUT', '/api/admin/tea-houses/acc-ubud/page', { shown: true }],
      ['PUT', '/api/admin/tea-houses/order', { houses: ['acc-ubud'] }],
      ['GET', '/api/admin/tea-houses', undefined],
    ];
    for (const [method, path, body] of writes) {
      expect((await call(env, null, path, { method, body })).status).toBe(401);
      for (const who of [{ userId: 'host', account: 'acc-ubud' }, { userId: 'admin', account: 'acc-admin' }]) {
        expect((await call(env, who, path, { method, body })).status).toBe(403);
      }
    }
  });

  it('keeps his rows in the platform account', async () => {
    const { env, db } = setup();
    await say(env, 'acc-ubud', 'room', 'The room.');
    const rows = db.sqlite.prepare('SELECT account_id, house_account_id, part FROM tea_house_contributions').all();
    expect(rows).toEqual([{ account_id: PLATFORM, house_account_id: 'acc-ubud', part: 'room' }]);
    const page = db.sqlite.prepare('SELECT account_id, is_shown FROM tea_house_pages').all();
    expect(page).toEqual([{ account_id: PLATFORM, is_shown: 0 }]);
  });
});

describe('his order, by hand', () => {
  it('lists Work and Build in the order he set, and nothing else orders them', async () => {
    const { env } = setup();
    await say(env, 'acc-ubud', 'room', 'Ubud room.');
    await say(env, 'acc-canggu', 'room', 'Canggu room.');
    await say(env, 'acc-canggu', 'tea_menu', 'Canggu menu.');
    await show(env, 'acc-ubud');
    await show(env, 'acc-canggu');
    expect((await ok(env, null, '/api/tea-houses/work')).houses.map((house: any) => house.slug)).toEqual(['ubud-house', 'canggu-house']);

    await ok(env, ADRIAN, '/api/admin/tea-houses/order', { method: 'PUT', body: { houses: ['acc-canggu', 'acc-ubud'] } });
    const work = await ok(env, null, '/api/tea-houses/work');
    expect(work.houses.map((house: any) => house.slug)).toEqual(['canggu-house', 'ubud-house']);
    const build = await ok(env, null, '/api/tea-houses/build');
    expect(build.parts).toEqual([
      { part: 'room', houses: [
        { slug: 'canggu-house', name: 'Canggu House', place: 'Canggu, Indonesia' },
        { slug: 'ubud-house', name: 'Ubud House', place: 'Ubud, Indonesia' },
      ] },
      { part: 'tea_menu', houses: [{ slug: 'canggu-house', name: 'Canggu House', place: 'Canggu, Indonesia' }] },
    ]);
    // No count, score or rank in any public answer.
    const text = JSON.stringify([work, build, await ok(env, null, '/api/tea-houses/work/canggu-house')]);
    expect(text).not.toMatch(/count|score|rank|position|likes|curated|master/i);
  });

  it('refuses to order a house he has not written about', async () => {
    const { env } = setup();
    await say(env, 'acc-ubud', 'room', 'Ubud room.');
    expect((await call(env, ADRIAN, '/api/admin/tea-houses/order', { method: 'PUT', body: { houses: ['acc-canggu'] } })).status).toBe(400);
  });
});

describe('nothing invented', () => {
  it('shows only the parts he named, in the order a build runs', async () => {
    const { env } = setup();
    await say(env, 'acc-ubud', 'sourcing', 'I still send the oolong.');
    await say(env, 'acc-ubud', 'room', 'The room.');
    await show(env, 'acc-ubud');
    const page = await ok(env, null, '/api/tea-houses/work/ubud-house');
    expect(page.parts.map((part: any) => part.part)).toEqual(['room', 'sourcing']);
    const build = await ok(env, null, '/api/tea-houses/build');
    expect(build.parts.map((entry: any) => entry.part)).toEqual(['room', 'sourcing']);
  });

  it('refuses a part without words, a page with nothing said, and a photograph from elsewhere', async () => {
    const { env } = setup();
    expect((await call(env, ADRIAN, '/api/admin/tea-houses/acc-ubud/parts/room', { method: 'PUT', body: { words: '   ', photographs: [MEDIA] } })).status).toBe(400);
    expect((await call(env, ADRIAN, '/api/admin/tea-houses/acc-ubud/parts/garden', { method: 'PUT', body: { words: 'A garden.' } })).status).toBe(400);
    expect((await call(env, ADRIAN, '/api/admin/tea-houses/acc-ubud/parts/room', { method: 'PUT', body: { words: 'Room.', photographs: ['https://example.com/a.jpg'] } })).status).toBe(400);
    // No page row yet: nothing to show.
    expect((await call(env, ADRIAN, '/api/admin/tea-houses/acc-ubud/page', { method: 'PUT', body: { shown: true } })).status).toBe(404);
  });

  it('takes a page down when its last part is taken off', async () => {
    const { env } = setup();
    await say(env, 'acc-ubud', 'room', 'The room.');
    await show(env, 'acc-ubud');
    const after = await ok(env, ADRIAN, '/api/admin/tea-houses/acc-ubud/parts/room', { method: 'DELETE' });
    expect(after.houses.find((house: any) => house.id === 'acc-ubud').page).toEqual({ position: 0, shown: false });
    expect((await call(env, null, '/api/tea-houses/work/ubud-house')).status).toBe(404);
    expect((await call(env, ADRIAN, '/api/admin/tea-houses/acc-ubud/page', { method: 'PUT', body: { shown: true } })).status).toBe(409);
  });

  it('lists every house in Manage, his first, and says nothing of a house he has not written about', async () => {
    const { env } = setup();
    await say(env, 'acc-canggu', 'opening', 'We poured the first three nights together.');
    const manage = await ok(env, ADRIAN, '/api/admin/tea-houses');
    expect(manage.houses[0]).toMatchObject({ id: 'acc-canggu', page: { position: 0, shown: false } });
    const ubud = manage.houses.find((house: any) => house.id === 'acc-ubud');
    expect(ubud).toMatchObject({ page: null, parts: [] });
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Tea spaces, step 3: one page of spaces. A shown tea house by its name, with
// its spaces; a host's own space only once they turn it on, and then by its
// area alone, with who serves there.

const SECRET = 'tea-spaces-page-secret';
let db: SqliteD1;

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'mei', accountId: 'mei-home' });
  seedIdentity(db, { userId: 'owner', accountId: 'shop' });
  seedIdentity(db, { userId: 'house-owner', accountId: 'house' });
  seedIdentity(db, { userId: 'hidden-owner', accountId: 'hidden-house' });
  db.exec(`
    UPDATE accounts SET personal_inventory_user_id = 'mei', owner_user_id = 'mei', host_approved_at = '2026-11-27' WHERE id = 'mei-home';
    UPDATE users SET host_approved_at = '2026-11-27' WHERE id = 'mei';
    UPDATE accounts SET name = 'The Leaf House', slug = 'the-leaf-house' WHERE id = 'house';
    UPDATE accounts SET name = 'Not Yet House', slug = 'not-yet' WHERE id = 'hidden-house';
    INSERT INTO tea_house_pages (house_account_id, account_id, is_shown, position) VALUES ('house', 'shop', 1, 0), ('hidden-house', 'shop', 0, 1);
    INSERT INTO venues (id, account_id, name, address) VALUES ('v1', 'house', 'The Leaf House', '1 Jalan House');
    INSERT INTO venue_spaces (id, account_id, venue_id, name, sort_order) VALUES
      ('vs2', 'house', 'v1', 'The quiet room', 2), ('vs1', 'house', 'v1', 'The long table', 1);
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published, links) VALUES
      ('mei-lin', 'shop', 'mei', 'Mei Lin', 1, '[]');
    INSERT INTO saved_locations (id, name, address, map_link, account_id, is_host_table, area_hint, shown_on_spaces) VALUES
      ('garden', 'The garden room', '12 Jalan Secret', 'https://maps.example/secret', 'mei-home', 1, 'Ubud, near the market', 0),
      ('tearoom', 'The tea room', '12 Jalan Secret', NULL, 'mei-home', 1, 'Ubud, by the river', 0);
  `);
});
afterEach(() => db.close());

async function send(path: string, init: { method?: string; body?: unknown; user?: string } = {}) {
  const headers = new Headers();
  if (init.user) {
    headers.set('Authorization', `Bearer ${await signedToken(SECRET, {
      sub: init.user, email: `${init.user}@test.dev`, name: init.user, active_account_id: `${init.user}-home`, platform_role: null,
    })}`);
  }
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }), { DB: db, JWT_SECRET: SECRET } as never, { waitUntil() {} } as never);
}

describe('the tea spaces page', () => {
  it('names a shown house and its spaces, and leaves a host’s spaces off until they turn one on', async () => {
    expect(await (await send('/api/tea-spaces')).json()).toEqual({
      houses: [{ name: 'The Leaf House', slug: 'the-leaf-house', spaces: ['The long table', 'The quiet room'] }],
      spaces: [],
    });

    const on = await send('/api/me/your-table/garden/shown', { method: 'PUT', body: { shown: true }, user: 'mei' });
    expect(on.status, await on.clone().text()).toBe(200);
    expect((await on.json()).places.find((place: { id: string }) => place.id === 'garden')).toMatchObject({ shown: true });

    const page = await send('/api/tea-spaces');
    const text = await page.clone().text();
    expect((await page.json()).spaces).toEqual([
      { id: 'garden', area: 'Ubud, near the market', served_by: { name: 'Mei Lin', slug: 'mei-lin' } },
    ]);
    for (const secret of ['The garden room', 'Jalan', 'maps.example', 'by the river', 'Not Yet House']) {
      expect(text).not.toContain(secret);
    }
  });

  it('undoing a tea space takes it off the page too', async () => {
    await send('/api/me/your-table/garden/shown', { method: 'PUT', body: { shown: true }, user: 'mei' });
    await send('/api/me/your-table?place_id=garden', { method: 'DELETE', user: 'mei' });
    expect((await (await send('/api/tea-spaces')).json()).spaces).toEqual([]);
  });

  it('only the owner turns a space on, and only a tea space', async () => {
    expect((await send('/api/me/your-table/garden/shown', { method: 'PUT', body: { shown: true }, user: 'owner' })).status).toBeGreaterThanOrEqual(400);
    expect((await send('/api/me/your-table/garden/shown', { method: 'PUT', body: { shown: true } })).status).toBe(401);
    expect((await send('/api/me/your-table/garden/shown', { method: 'PUT', body: { shown: 'yes' }, user: 'mei' })).status).toBe(400);
    expect(db.sqlite.prepare("SELECT shown_on_spaces FROM saved_locations WHERE id = 'garden'").get()).toEqual({ shown_on_spaces: 0 });
  });

  it('is not there while tea houses are closed', async () => {
    const closed = await worker.fetch(new Request('https://worker.test/api/tea-spaces'),
      { DB: db, TEA_HOUSES_OPEN: 'false' } as never, { waitUntil() {} } as never);
    expect(closed.status).toBe(404);
  });
});

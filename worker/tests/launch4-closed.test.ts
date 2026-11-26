import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// A4 review, findings 10 and 12: with every Launch 4 switch off, each Launch 4
// address answers exactly as an address that does not exist (status, body and
// headers), whoever asks, and nothing behind it is read or written.

const SECRET = 'launch4-closed-secret';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

const CLOSED = {
  TEA_TABLE_OPEN: 'false', FAVOURITES_OPEN: 'false', YOUR_TABLE_PAGE_OPEN: 'false', HOST_ARTICLES_OPEN: 'false',
  TOP_TEAS_OPEN: 'false', TEA_HOUSES_OPEN: 'false', YOUR_TABLE_PLACE_OPEN: 'false', FEW_HOSTS_OPEN: 'true',
};

const ROUTES: Array<[string, string]> = [
  ['GET', '/api/tea-table'], ['GET', '/api/tea-table/me'], ['PUT', '/api/tea-table/keeps/recap/x'],
  ['DELETE', '/api/tea-table/keeps/recap/x'], ['DELETE', '/api/tea-table/mine/tasting/x'],
  ['PUT', '/api/tea-table/holds/recap/x'], ['DELETE', '/api/tea-table/holds/recap/x'],
  ['GET', '/api/admin/tea-table'], ['POST', '/api/admin/tea-table/hide'], ['GET', '/api/admin/tea-table/recaps/x'],
  ['PUT', '/api/admin/tea-table/recaps/x'], ['DELETE', '/api/admin/tea-table/recaps/x'],
  ['PUT', '/api/family/photographs/x/credit'],
  ['GET', '/api/me/favourites'], ['PUT', '/api/me/favourites/articles/x'], ['DELETE', '/api/me/favourites/articles/x'],
  ['PUT', '/api/me/cellar/x/favourite'],
  ['GET', '/api/tea-houses/work'], ['GET', '/api/tea-houses/work/x'], ['GET', '/api/tea-houses/build'],
  ['GET', '/api/admin/tea-houses'], ['PUT', '/api/admin/tea-houses/order'], ['PUT', '/api/admin/tea-houses/x/page'],
  ['PUT', '/api/admin/tea-houses/x/parts/room'], ['DELETE', '/api/admin/tea-houses/x/parts/room'],
  ['GET', '/api/me/article-offers'], ['POST', '/api/me/article-offers'], ['GET', '/api/article-offers/x/photos/y'],
  ['GET', '/api/admin/article-offers'], ['POST', '/api/admin/article-offers/x'],
  ['GET', '/api/public/people/x/top-teas'], ['GET', '/api/public/people/x/top-teas/shop'],
  ['GET', '/api/public/people/x/top-teas/photos/y'], ['PUT', '/api/public/people/x/top-teas/Green'],
  ['DELETE', '/api/public/people/x/top-teas/Green'],
  ['GET', '/api/family/tasting-shares'],
  ['GET', '/api/me/your-table'], ['PUT', '/api/me/your-table'], ['DELETE', '/api/me/your-table'],
];

async function call(env: Record<string, unknown>, who: string | null, method: string, path: string) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (who) {
    const token = await signedToken(SECRET, { sub: who, email: `${who}@test.dev`, name: who, active_account_id: 'acc-one' });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', 'acc-one');
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method, headers, body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
  }), env as never);
}

describe('Launch 4, every switch off', () => {
  it('answers each one exactly as an unknown address, signed in or not', async () => {
    const db = new SqliteD1('migrations');
    databases.push(db);
    seedIdentity(db, { userId: 'owner', accountId: 'acc-one', role: 'owner', platformRole: 'platform_owner' });
    const env = { DB: db, JWT_SECRET: SECRET, PROVIDER_LIMITER: { limit: async () => ({ success: true }) }, ...CLOSED };
    for (const who of [null, 'owner']) {
      for (const [method, path] of ROUTES) {
        const absent = await call(env, who, method, '/api/no-such-address');
        const closed = await call(env, who, method, path);
        expect(closed.status, `${method} ${path}`).toBe(absent.status);
        expect(await closed.text(), `${method} ${path}`).toBe(await absent.text());
        expect([...closed.headers.entries()], `${method} ${path}`).toEqual([...absent.headers.entries()]);
      }
    }
  });
});

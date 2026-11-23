import { expect, it } from 'vitest';
import { serveCatalogTeaReading } from '../src/catalogTeaReading';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

it('serves the packet only to its named owner and scopes every read to the active account', async () => {
  const db = new SqliteD1('schema');
  try {
    const accountId = 'shop';
    for (const [userId, role] of [['owner', 'owner'], ['second', 'owner'], ['staff', 'staff']] as const) {
      seedIdentity(db, { accountId, userId, role });
    }
    seedIdentity(db, { accountId: 'elsewhere', userId: 'another', role: 'owner' });
    const digest = 'a'.repeat(64);
    const base = '/api/admin/catalog-review/teas';
    const prefix = 'owner-review/shop/catalog-reading/';
    const items = [{ id: 'tea-10', title: 'Loose tea', status: 'In review', digest }];
    const files = new Map([[prefix + 'index.json', JSON.stringify({ ownerUserId: 'owner', items })],
      [prefix + 'pages/' + digest + '.json', JSON.stringify({ introduction: 'Private paragraph', photos: ['private image'] })]]);
    const env = { DB: db, ATLAS_BUCKET: {
      get: async (key: string) => files.has(key) ? new Response(files.get(key)) : null,
      head: async (key: string) => files.has(key) ? {} : null,
    } } as unknown as Parameters<typeof serveCatalogTeaReading>[1];
    const read = (path = '', user = 'owner', account = accountId, method = 'GET') => serveCatalogTeaReading(
      new Request('https://example.org' + base + path, { method }), env,
      async () => user ? { userId: user, accountId: account } : { error: new Response(null, { status: 401 }) },
    );
    expect(await (await read()).json()).toEqual([{ id: 'tea-10', title: 'Loose tea', status: 'In review' }]);
    expect(await (await read('/tea-10')).json()).toMatchObject({ introduction: 'Private paragraph', photos: ['private image'] });
    for (const method of ['GET', 'HEAD']) {
      for (const [user, account, code] of [['', 'shop', 401], ['staff', 'shop', 403], ['second', 'shop', 403],
        ['owner', 'elsewhere', 403], ['another', 'elsewhere', 404]] as const) {
        const result = await read('/tea-10', user, account, method);
        expect(result.status).toBe(code);
        expect(result.headers.get('Cache-Control')).toContain('no-store');
        expect(await result.text()).toBe('');
      }
    }
    expect((await read('/absent')).status).toBe(404);
    expect((await read('/tea-10', 'owner', accountId, 'PUT')).status).toBe(405);
    const head = await read('/tea-10', 'owner', accountId, 'HEAD');
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  } finally {
    db.close();
  }
});

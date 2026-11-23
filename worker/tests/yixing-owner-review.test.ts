import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const base = '/api/admin/yixing';
const account = 'acc_teajia_bali';
const prefix = 'owner-review/' + account + '/yixing/v1/';
const hash = 'a'.repeat(64);
const board = { version: 1, ownerUserId: 'personal-owner', pots: [{ id: 'pots-04', name: 'Private pot' }, { id: 'pots-02' }],
  reference: { entries: [{ id: 'shape-hexagonal', kind: 'shape' }, { id: 'clay-zini', kind: 'clay' }] } };
const initial = { clay: '', color: '', shape: '', note: '', revision: 0 };
const databases: SqliteD1[] = [];

function setup() {
  const db = new SqliteD1('schema');
  databases.push(db);
  for (const [userId, role, platformRole] of [
    ['personal-owner', 'owner', 'platform_owner'], ['second-owner', 'owner', 'platform_admin'],
    ['staff', 'staff', null],
  ] as const) seedIdentity(db, { accountId: account, userId, role, platformRole });
  seedIdentity(db, { accountId: 'other-shop', userId: 'other-owner', role: 'owner' });
  const objects = new Map([[prefix + 'board.json', JSON.stringify(board)], [prefix + 'media/' + hash + '.jpg', 'private photo']]);
  const bucket = {
    head: async (key: string) => objects.has(key) ? { size: objects.get(key)!.length } : null,
    get: async (key: string) => {
      const text = objects.get(key);
      return text === undefined ? null : { etag: text, body: new Response(text).body, json: async () => JSON.parse(text) };
    },
    put: async (key: string, text: string, options: R2PutOptions) => {
      const match = options.onlyIf as R2Conditional;
      if (objects.has(key) ? match.etagMatches !== objects.get(key) : match.etagDoesNotMatch !== '*') return null;
      objects.set(key, text);
      return { etag: text };
    },
  };
  async function call(path: string, user: string | null = 'personal-owner', method = 'GET', body?: unknown, shop = account) {
    const headers = new Headers({ 'Content-Type': 'application/json', 'X-Teajia-Account': shop });
    if (user) headers.set('Authorization', 'Bearer ' + await signedToken('test-only', {
      sub: user, email: user + '@test.dev', name: user, active_account_id: shop,
    }));
    return worker.fetch(new Request('https://www.teajia.com' + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }), { JWT_SECRET: 'test-only', DB: db as any, ATLAS_BUCKET: bucket as any, APP_URL: 'https://www.teajia.com' } as any);
  }
  return { call, objects, db };
}

afterEach(() => { while (databases.length) databases.pop()!.close(); });

describe('personal Yixing pot review', () => {
  it('requires the named person and active Bali owner membership, including for image bytes and edits', async () => {
    const { call, objects, db } = setup();
    for (const [user, shop, status] of [[null, account, 401], ['second-owner', account, 403], ['staff', account, 403],
      ['other-owner', 'other-shop', 403], ['personal-owner', 'other-shop', 403]] as const) {
      for (const [path, method] of [[base, 'GET'], [base, 'HEAD'], [base + '/media/' + hash + '.jpg', 'GET'],
        [base + '/media/' + hash + '.jpg', 'HEAD'], [base + '/pots/pots-04', 'PUT']]) {
        const response = await call(path, user, method, method === 'PUT' ? initial : undefined, shop);
        expect(response.status).toBe(status);
        expect(response.headers.get('Cache-Control')).toContain('no-store');
      }
    }
    const photo = await call(base + '/media/' + hash + '.jpg');
    expect(photo.headers.get('Content-Type')).toBe('image/jpeg');
    expect(await photo.text()).toBe('private photo');
    expect((await (await call(base + '/media/' + hash + '.jpg', 'personal-owner', 'HEAD')).text())).toBe('');
    expect((await call('/api/atlas/' + prefix + 'media/' + hash + '.jpg')).status).toBe(404);
    expect((await call('/api/media/' + prefix + 'media/' + hash + '.jpg')).status).not.toBe(200);
    db.sqlite.prepare("UPDATE account_members SET status = 'suspended' WHERE user_id = 'personal-owner'").run();
    expect((await call(base)).status).toBe(403);
    expect(objects.size).toBe(2);
  });

  it('projects only approved board fields and persists independent, revision-checked choices', async () => {
    const { call } = setup();
    expect(await (await call(base)).json()).toEqual({ pots: board.pots, reference: board.reference, version: 1, decisions: {} });
    const put = (id: string, data: typeof initial) => call(base + '/pots/' + id, 'personal-owner', 'PUT', data);
    expect((await put('pots-33', initial)).status).toBe(404);
    expect((await put('pots-04', { ...initial, clay: 'shape-hexagonal' })).status).toBe(400);
    const shape = { ...initial, shape: 'shape-hexagonal', note: 'Six faces' };
    const saves = await Promise.all([put('pots-04', shape), put('pots-04', shape), put('pots-02', { ...initial, clay: 'clay-zini' })]);
    expect(saves.map(s => s.status).sort()).toEqual([200, 200, 409]);
    expect(await (await put('pots-04', { ...initial, revision: 1 })).json()).toEqual({ ...initial, revision: 2 });
    const readback = await (await call(base)).json() as { decisions: Record<string, typeof initial> };
    expect(readback.decisions['pots-04']).toEqual({ ...initial, revision: 2 });
    expect(readback.decisions['pots-02'].clay).toBe('clay-zini');
  });
});

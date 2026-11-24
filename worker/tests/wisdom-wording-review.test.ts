import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const bali = 'acc_teajia_bali';
const secret = 'wisdom-wording-test';
const path = '/api/admin/wisdom/listing-wording';
const vietnam = 'bb692acb-b4a0-4114-afa8-c9644140eb5f';
const xiniu = 'e5e7c9ec-d66b-48de-9197-272ffdb638e0';
let db: SqliteD1;
afterEach(() => db?.close());

function start() {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'editor', accountId: bali, role: 'owner' });
  db.sqlite.prepare("UPDATE users SET platform_role = 'platform_owner' WHERE id = ?").run('editor');
  seedIdentity(db, { userId: 'ordinary-owner', accountId: bali, role: 'owner' });
  seedIdentity(db, { userId: 'other', accountId: 'acc_other', role: 'owner' });
  return async (requestPath: string, options: { userId?: string; account?: string; method?: string } = {}) => {
    const { userId, account = bali, method = 'GET' } = options;
    const headers = new Headers();
    if (userId) {
      const token = await signedToken(secret, {
        sub: userId, active_account_id: account, platform_role: userId === 'editor' ? 'platform_owner' : null,
      });
      headers.set('Authorization', 'Bearer ' + token);
      headers.set('X-Teajia-Account', account);
    }
    return worker.fetch(new Request('https://worker.test' + requestPath, { method, headers }), {
      DB: db as never, JWT_SECRET: secret,
    } as never);
  };
}

it('serves the exact approval records only to the platform owner in the Bali shop and refuses writes', async () => {
  const call = start();
  expect((await call(path)).status).toBe(401);
  expect((await call(path, { userId: 'ordinary-owner' })).status).toBe(403);
  expect((await call(path, { userId: 'editor', account: 'acc_other' })).status).toBe(403);
  expect((await call(path, { userId: 'editor', method: 'PUT' })).status).toBe(405);
  const response = await call(path, { userId: 'editor' });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const rows = await response.json() as { id: string; title: string; revision: string; approved: boolean; proposed: string }[];
  expect(rows).toHaveLength(7);
  expect(rows.every(row => row.approved && /^[a-f0-9]{64}$/.test(row.revision))).toBe(true);
  expect(rows[4]).toMatchObject({ title: 'Pasha Village', proposed: expect.stringContaining('air and moisture') });
});

it('projects both reviewed stories into the public fallback and preserves source rows and origin fields', async () => {
  const call = start();
  db.sqlite.prepare('UPDATE accounts SET public_enabled = 1 WHERE id = ?').run(bali);
  const insert = db.sqlite.prepare(`INSERT INTO products
    (id, account_id, product_name, type, form, status, is_public, shown_in_shop, stock_grams,
     origin_region, cost_amount, cost_currency, description, lore, terroir, processing_notes)
    VALUES (?, ?, ?, 'Shou Puer', 'Cake', 'Active', 1, 1, 100, ?, 0, 'USD',
            'Original description', 'Original lore', 'Original terroir', 'Original processing')`);
  insert.run(vietnam, bali, 'Northern Vietnam', 'Northern Vietnam highlands, on the Yunnan border');
  insert.run(xiniu, bali, 'Xiniu Tang Gushu', 'Yiwu, Yunnan');
  insert.run('control-tea', bali, 'Unrelated tea', 'Yunnan');
  const cases = [
    [vietnam, 'Northern Vietnam highlands, on the Yunnan border', /This loose ripe pu’er comes from the highlands of northern Vietnam/],
    [xiniu, 'Yiwu, Yunnan', /Xiniu Tang \(犀牛塘\) means “Rhinoceros Pond.”/],
  ] as const;
  for (const [id, origin, wording] of cases) {
    const response = await call('/api/products/public/' + id);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      origin_region: origin, description: expect.stringMatching(wording), lore: null, terroir: null, processing_notes: null,
    });
    expect(db.sqlite.prepare('SELECT lore, terroir, processing_notes FROM products WHERE id = ?').get(id))
      .toEqual({ lore: 'Original lore', terroir: 'Original terroir', processing_notes: 'Original processing' });
  }
  const control = await call('/api/products/public/control-tea');
  expect(await control.json()).toMatchObject({ description: 'Original description', lore: 'Original lore' });
});

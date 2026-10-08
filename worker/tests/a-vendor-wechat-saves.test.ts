import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { foldHandlesIntoContacts, withContactHandles } from '../src/customerContactHandles';

/**
 * Adding a vendor's WeChat used to lose the whole vendor card.
 *
 * `customers` has no wechat or instagram column, but the update route accepted
 * both names, so "UPDATE customers SET wechat = ?" failed and took the phone,
 * WhatsApp, photos and location sent in the same save down with it. These
 * drive the real route against a database built from worker/schema.sql, which
 * has no such column either, so the test fails the way production did.
 */

const JWT = 'vendor-wechat-secret';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function call(db: SqliteD1, path: string, init: RequestInit = {}) {
  const auth = await signedToken(JWT, {
    sub: 'owner-one', email: 'owner@test.dev', name: 'owner',
    active_account_id: 'acc-one', platform_role: null,
  });
  const headers = new Headers({ Authorization: `Bearer ${auth}`, 'X-Teajia-Account': 'acc-one' });
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: init.method ?? 'GET', headers, body: init.body,
  }), { DB: db as any, JWT_SECRET: JWT } as any);
}

describe('saving a vendor card with a WeChat', () => {
  it('saves the WeChat into contacts and keeps everything sent beside it', async () => {
    const db = new SqliteD1();
    databases.push(db);
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one' });
    db.sqlite.exec(`INSERT INTO customers (id, account_id, name, tags, contacts) VALUES ('v-1', 'acc-one', 'Wang Laoshi', '["vendor"]', '[{"channel":"email","handle":"w@x.cn"}]')`);

    const res = await call(db, '/api/customers/v-1', {
      method: 'PUT',
      body: JSON.stringify({ wechat: 'wang_tea', phone: '+86 138', whatsapp: '+86 139', business_card_photo: 'card.jpg' }),
    });
    expect(res.status).toBe(200);

    const row = db.sqlite.prepare('SELECT phone, whatsapp, business_card_photo, contacts FROM customers WHERE id = ?').get('v-1') as any;
    expect(row.phone).toBe('+86 138');
    expect(row.whatsapp).toBe('+86 139');
    expect(row.business_card_photo).toBe('card.jpg');
    expect(JSON.parse(row.contacts)).toEqual([
      { channel: 'email', handle: 'w@x.cn' },
      { channel: 'wechat', handle: 'wang_tea' },
    ]);

    const read = await (await call(db, '/api/customers/v-1')).json() as any;
    expect(read.wechat).toBe('wang_tea');
  });
});

describe('foldHandlesIntoContacts', () => {
  it('replaces an earlier handle, and an empty one removes it', () => {
    const body: Record<string, unknown> = { wechat: 'new_id' };
    foldHandlesIntoContacts(body, '[{"channel":"wechat","handle":"old_id"}]');
    expect(JSON.parse(body.contacts as string)).toEqual([{ channel: 'wechat', handle: 'new_id' }]);
    expect('wechat' in body).toBe(false);
    const clear: Record<string, unknown> = { wechat: '' };
    foldHandlesIntoContacts(clear, body.contacts);
    expect(JSON.parse(clear.contacts as string)).toEqual([]);
  });

  it('leaves a body with no handles alone', () => {
    const body: Record<string, unknown> = { phone: '1' };
    expect(foldHandlesIntoContacts(body, '[]')).toBe(false);
    expect(body).toEqual({ phone: '1' });
  });

  it('reads a handle back out for screens that still ask for customer.wechat', () => {
    expect(withContactHandles({ contacts: '[{"channel":"wechat","handle":"w"}]' }).wechat).toBe('w');
  });
});

/**
 * Curate created vendors with `tags: 'vendor'`, a bare word, and the list read
 * ran JSON.parse over every row, so one such vendor made GET /api/customers a
 * 500 for the whole shop: the vendor picker and the People page both empty.
 */
describe('a vendor created from Curate', () => {
  it('is stored with a list of tags, and an old bare-word row no longer breaks the customer list', async () => {
    const db = new SqliteD1();
    databases.push(db);
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one' });
    db.sqlite.exec(`INSERT INTO customers (id, account_id, name, tags) VALUES ('old-1', 'acc-one', 'Old vendor', 'vendor')`);

    const created = await call(db, '/api/customers', { method: 'POST', body: JSON.stringify({ name: 'Wang Laoshi', tags: 'vendor', source: 'compass' }) });
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    const stored = db.sqlite.prepare('SELECT tags FROM customers WHERE id = ?').get(id) as { tags: string };
    expect(JSON.parse(stored.tags)).toEqual(['vendor']);

    const list = await call(db, '/api/customers');
    expect(list.status).toBe(200);
    const rows = await list.json() as Array<{ name: string; tags: string[] }>;
    expect(rows.find((r) => r.name === 'Old vendor')?.tags).toEqual(['vendor']);
    expect(rows.find((r) => r.name === 'Wang Laoshi')?.tags).toEqual(['vendor']);

    // The contact's own page read the same column and failed the same way:
    // on 2026-10-06 both answered 500 for one bare-word vendor.
    const one = await call(db, '/api/customers/old-1');
    expect(one.status).toBe(200);
    expect((await one.json() as { tags: string[] }).tags).toEqual(['vendor']);
  });
});

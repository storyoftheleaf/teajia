import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Adrian, 2026-11-23: a photo of each vendor's face, so a vendor remembered by
// face can be picked by face. The face is saved on the vendor (customers row,
// migration 0082) and has to come back wherever the vendor is listed.

const opened: SqliteD1[] = [];
afterEach(() => opened.splice(0).forEach(db => db.close()));

for (const schema of ['migrations', true] as const) {
  it(`saves a vendor's face and returns it on the vendor and in the list (${schema === true ? 'schema.sql' : 'migrations'})`, async () => {
    const db = new SqliteD1(schema); opened.push(db);
    seedIdentity(db, { userId: 'owner', accountId: 'shop' });
    db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, tags, type, storefront_photo)
      VALUES ('bo', 'shop', 'Master Bo', '["vendor"]', 'customer', 'https://img.test/shop.jpg')`).run();
    const token = await signedToken('secret', { sub: 'owner', email: 'owner@test.dev', active_account_id: 'shop', platform_role: null });
    const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request(`https://test${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop', 'Content-Type': 'application/json' },
    }), { DB: db, JWT_SECRET: 'secret' } as any);

    const saved = await call('/api/customers/bo', { method: 'PUT', body: JSON.stringify({ face_photo: 'https://img.test/bo-face.jpg' }) });
    expect(saved.status).toBe(200);

    const one = await (await call('/api/customers/bo')).json() as Record<string, unknown>;
    expect(one.face_photo).toBe('https://img.test/bo-face.jpg');
    // The shop photo is untouched: it is still there for the vendor page.
    expect(one.storefront_photo).toBe('https://img.test/shop.jpg');

    const listed = await (await call('/api/customers')).json() as any;
    const rows = (listed?.customers ?? listed) as Array<Record<string, unknown>>;
    expect(rows.find(row => row.id === 'bo')?.face_photo).toBe('https://img.test/bo-face.jpg');
  });
}

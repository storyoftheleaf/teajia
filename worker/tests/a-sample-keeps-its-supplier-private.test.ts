import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const JWT = 'sample-source-secret';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

type Viewer = {
  sub: string;
  account: string;
  platformRole?: 'platform_owner' | 'platform_admin';
  sessionVersion?: number;
};

async function call(db: SqliteD1, path: string, who: Viewer | null) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(JWT, { sub: who.sub, email: `${who.sub}@test.dev`, name: who.sub, active_account_id: who.account, platform_role: who.platformRole ?? null, session_version: who.sessionVersion ?? 0 });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', who.account);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, { headers }), { DB: db as any, JWT_SECRET: JWT } as any);
}

const privatePhotos = [
  '/api/curate/capture/tea-private/photos/76b2d89d-6ba4-478c-9fdd-c91f623d893f?original=1',
  'https://media.teajia.co/accounts/acc-shop/vendor-label.jpg',
  'data:image/png;base64,AAAA',
];
const label = '/api/samples/s-1';
const setLabel = '/api/samples/set/set-1';
const shopOwner = { sub: 'shop-owner', account: 'acc-shop' };
const sourceOwner = { sub: 'source-owner', account: 'acc-shop' };

function seeded() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'shop-owner', accountId: 'acc-shop' });
  seedIdentity(db, { userId: 'source-owner', accountId: 'acc-shop', role: 'staff', bundles: ['catalog'] });
  seedIdentity(db, { userId: 'buyer', accountId: 'acc-shop', role: 'viewer' });
  seedIdentity(db, { userId: 'viewer-one', accountId: 'acc-shop', role: 'viewer', bundles: [] });
  seedIdentity(db, { userId: 'same-shop-staff', accountId: 'acc-shop', role: 'staff', bundles: ['catalog'] });
  seedIdentity(db, { userId: 'other-seller', accountId: 'acc-other' });
  seedIdentity(db, { userId: 'platform-user', accountId: 'acc-other', platformRole: 'platform_admin' });
  db.sqlite.exec(`
    UPDATE accounts SET owner_user_id = 'shop-owner' WHERE id = 'acc-shop';
    INSERT INTO tea_sample_sets (id, account_id, name, source_id, source_name, notes, shared_with, user_id)
      VALUES ('set-1', 'acc-shop', 'Vendor labels', 'supplier-1', 'Wang Laoshi', 'private set notes', '["invite-secret"]', 'source-owner'),
             ('set-shop', 'acc-shop', 'Shop sourcing', 'supplier-1', 'Wang Laoshi', 'shop set notes', '[]', NULL),
             ('set-request', 'acc-shop', 'Sample requests — buyer@test.dev', 'supplier-1', 'Wang Laoshi', 'request set notes', '[]', 'buyer');
    UPDATE tea_sample_sets SET purpose = 'customer-request' WHERE id = 'set-request';
    INSERT INTO tea_samples (id, account_id, set_id, name, origin_region, source_id, source_name, source_contact, notes, user_id, created_by)
      VALUES ('s-1', 'acc-shop', 'set-1', 'Yiwu Gushu', 'Yunnan', 'supplier-1', 'Wang Laoshi', '{"wechat":"wang_tea"}', 'paid 380', 'source-owner', 'admin'),
             ('s-shop', 'acc-shop', 'set-1', 'Autumn oolong', NULL, 'supplier-2', 'Other vendor', '{"phone":"555-0111"}', 'shop terms', NULL, 'admin'),
             ('s-request', 'acc-shop', 'set-request', 'Oolong sample', NULL, 'supplier-1', 'Wang Laoshi', NULL, 'request notes', 'buyer', 'customer'),
             ('s-other-shop', 'acc-other', 'set-1', 'Foreign tea', NULL, 'supplier-3', 'Foreign vendor', NULL, NULL, 'other-seller', 'admin'),
             ('s-unsafe-label', 'acc-shop', 'set-1', 'WANG LAOSHI special', 'https://vendor.test/private-receipt', NULL, NULL, NULL, NULL, 'source-owner', 'admin');
    INSERT INTO tea_sample_tastings (id, sample_id, account_id, taster_id, taster_name, tasting, rating, verdict, personal_note)
      VALUES ('t-1', 's-1', 'acc-shop', 'taster@test.dev', 'Mei', '{"receipt":"/api/private/receipt.pdf"}', 9, 'love', 'supplier tasting note');
  `);
  db.prepare('UPDATE tea_samples SET photos = ? WHERE id = ?').bind(JSON.stringify(privatePhotos), 's-1').run();
  return db;
}

async function read(db: SqliteD1, path: string, who: Viewer | null) {
  const response = await call(db, path, who);
  expect(response.status).toBe(200);
  return await response.json() as any;
}

describe('public sample label readers', () => {
  it.each([
    ['a signed-out visitor', null],
    ['a same-shop buyer', { sub: 'buyer', account: 'acc-shop' }],
    ['a same-shop viewer', { sub: 'viewer-one', account: 'acc-shop' }],
    ['same-shop sourcing staff', { sub: 'same-shop-staff', account: 'acc-shop' }],
    ['a seller from another shop', { sub: 'other-seller', account: 'acc-other' }],
    ['a platform admin', { sub: 'platform-user', account: 'acc-other', platformRole: 'platform_admin' }],
    ['the environment admin', { sub: 'env-admin', account: 'acc-shop', platformRole: 'platform_owner' }],
    ['an owner with a revoked session', { ...sourceOwner, sessionVersion: 7 }],
  ] satisfies Array<[string, Viewer | null]>)('returns only public fields to %s', async (_name, viewer) => {
    const db = seeded();
    const sample = await read(db, label, viewer);
    expect(sample).toMatchObject({
      id: 's-1', name: 'Yiwu Gushu', origin_region: 'Yunnan', photos: [],
      tastings: [{ id: 't-1', rating: 9, verdict: 'love' }],
    });
    const batch = await read(db, setLabel, viewer);
    expect(batch.set.name).toBe('Tea samples');
    expect(batch.samples.map((row: any) => row.id).sort()).toEqual(['s-1', 's-shop', 's-unsafe-label']);
    expect(batch.samples.find((row: any) => row.id === 's-unsafe-label')).toMatchObject({ name: 'Tea sample', origin_region: null });

    for (const row of [sample, sample.tastings[0], batch.set, ...batch.samples]) {
      for (const field of ['source_id', 'source_name', 'source_contact', 'notes', 'user_id', 'created_by',
        'account_id', 'shared_with', 'panel_account_ids', 'compass_entry_id', 'taster_id', 'taster_name', 'tasting', 'personal_note']) {
        expect(row).not.toHaveProperty(field);
      }
    }
    const payload = JSON.stringify({ sample, batch });
    for (const secret of [...privatePhotos, 'supplier-1', 'Wang Laoshi', 'wang_tea', 'paid 380', 'private set notes',
      'invite-secret', 'taster@test.dev', '/api/private/receipt.pdf', 'supplier tasting note', 'vendor.test']) {
      expect(payload).not.toContain(secret);
    }
  });

  it('keeps the recorded source owner’s details and original media available in both readers', async () => {
    const db = seeded();
    const viewer = { ...sourceOwner, account: 'acc-other' };
    const sample = await read(db, label, viewer);
    expect(sample).toMatchObject({
      source_id: 'supplier-1', source_name: 'Wang Laoshi', source_contact: { wechat: 'wang_tea' },
      notes: 'paid 380', photos: privatePhotos, tastings: [{ personal_note: 'supplier tasting note' }],
    });
    const batch = await read(db, setLabel, viewer);
    expect(batch.set).toMatchObject({ source_name: 'Wang Laoshi', notes: 'private set notes' });
    expect(batch.samples.find((row: any) => row.id === 's-1')).toMatchObject({ photos: privatePhotos });
    expect(batch.samples.find((row: any) => row.id === 's-shop')).not.toHaveProperty('source_contact');
  });

  it('lets the recorded shop owner see unattributed shop rows without opening individually attributed rows', async () => {
    const db = seeded();
    expect(await read(db, '/api/samples/s-shop', shopOwner)).toMatchObject({
      source_id: 'supplier-2', notes: 'shop terms', source_contact: { phone: '555-0111' },
    });
    expect((await read(db, '/api/samples/set/set-shop', shopOwner)).set).toMatchObject({ notes: 'shop set notes' });
    const batch = await read(db, setLabel, shopOwner);
    expect(batch.set).not.toHaveProperty('source_name');
    expect(batch.samples.find((row: any) => row.id === 's-1')).not.toHaveProperty('source_name');
    expect(batch.samples.find((row: any) => row.id === 's-shop')).toHaveProperty('source_name', 'Other vendor');
    db.prepare("UPDATE accounts SET owner_user_id = NULL WHERE id = 'acc-shop'").run();
    expect(await read(db, '/api/samples/s-shop', shopOwner)).not.toHaveProperty('source_contact');
  });

  it('preserves the public shop tea link while hiding unpublished and foreign links', async () => {
    const db = seeded();
    db.sqlite.exec(`
      INSERT INTO products (id, account_id, product_name, type, status, is_public, shown_in_shop,
                            cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
        VALUES ('sale-tea', 'acc-shop', 'Yiwu Gushu', 'Sheng', 'Active', 1, 1, NULL, NULL, NULL, NULL);
      UPDATE tea_samples SET product_id = 'sale-tea' WHERE id IN ('s-1', 's-other-shop');
    `);
    const assertProduct = async (expected: string | null) => {
      expect(await read(db, label, null)).toHaveProperty('product_id', expected);
      expect((await read(db, setLabel, null)).samples.find((row: any) => row.id === 's-1'))
        .toHaveProperty('product_id', expected);
    };

    await assertProduct('sale-tea');
    expect(await read(db, '/api/samples/s-other-shop', null)).toHaveProperty('product_id', null);
    db.prepare("UPDATE products SET is_public = 0 WHERE id = 'sale-tea'").run();
    await assertProduct(null);
    expect(await read(db, label, sourceOwner)).toHaveProperty('product_id', 'sale-tea');
  });

  it('keeps both versions of each label response out of shared and browser caches', async () => {
    const db = seeded();
    for (const path of [label, setLabel]) {
      for (const viewer of [null, sourceOwner]) {
        expect((await call(db, path, viewer)).headers.get('Cache-Control')).toBe('private, no-store');
      }
    }
  });

  it('does not treat customer-request attribution as a supplier grant', async () => {
    const db = seeded();
    const buyer = { sub: 'buyer', account: 'acc-shop' };
    expect(await read(db, '/api/samples/s-request', buyer)).not.toHaveProperty('notes');
    const batch = await read(db, '/api/samples/set/set-request', buyer);
    expect(batch.set.name).toBe('Tea samples');
    expect(batch.set).not.toHaveProperty('source_id');
    expect(batch.samples[0]).not.toHaveProperty('source_id');
  });
});

/**
 * A viewer could list every sample with its supplier's contact, and delete a
 * shared sourcing trip, which unlinked every teammate's teas from it.
 */
describe('a viewer in the shop', () => {
  const as = async (db: SqliteD1, sub: string, path: string, method = 'GET') => {
    const auth = await signedToken(JWT, { sub, email: `${sub}@test.dev`, name: sub, active_account_id: 'acc-shop', platform_role: null });
    return worker.fetch(new Request(`https://worker.test${path}`, { method, headers: { Authorization: `Bearer ${auth}`, 'X-Teajia-Account': 'acc-shop' } }), { DB: db as any, JWT_SECRET: JWT } as any);
  };

  it('cannot list samples or delete a trip; someone who gathers can', async () => {
    const db = seeded();
    seedIdentity(db, { userId: 'viewer-one', accountId: 'acc-shop', role: 'viewer', bundles: [] });
    seedIdentity(db, { userId: 'gatherer-one', accountId: 'acc-shop', role: 'staff', bundles: ['gather'] });
    db.sqlite.exec(`INSERT INTO curate_journeys (id, account_id, name, created_by_user_id) VALUES ('j-1', 'acc-shop', 'Yiwu trip', 'shop-owner')`);

    expect((await as(db, 'viewer-one', '/api/admin/samples')).status).toBe(403);
    expect((await as(db, 'viewer-one', '/api/admin/sample-sets')).status).toBe(403);
    expect((await as(db, 'viewer-one', '/api/curate/journeys/j-1', 'DELETE')).status).toBe(403);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_journeys WHERE id = ?').get('j-1')).toEqual({ n: 1 });

    expect((await as(db, 'gatherer-one', '/api/admin/samples')).status).toBe(200);
  });
});

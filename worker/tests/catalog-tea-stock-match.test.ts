import { expect, it } from 'vitest';
import { serveCatalogTeaReading } from '../src/catalogTeaReading';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import type { TeaConnection } from '../../shared/catalog/teaConnection';

it('searches exact Stock within the owner account and saves the match only in the private intake', async () => {
  const db = new SqliteD1('schema');
  try {
    seedIdentity(db, { accountId: 'bali', userId: 'adrian', role: 'owner' });
    seedIdentity(db, { accountId: 'australia', userId: 'other', role: 'owner' });
    seedIdentity(db, { accountId: 'bali', userId: 'clerk', role: 'staff' });
    db.sqlite.exec(`
      INSERT INTO customers (id, account_id, name, tags) VALUES
        ('intake-vendor', 'bali', 'Intake contact', '["vendor"]'),
        ('lot-vendor', 'bali', 'Stock supplier', '["vendor"]');
      INSERT INTO products (id, account_id, product_name, type, chinese_name, year, form, vendor_id, teaware_category, description, cost_amount, cost_currency, is_public, shown_in_shop, stock_grams) VALUES
        ('2023', 'bali', 'Wild Ancha', 'Dark', '荒野安化茶', 2023, 'Basket', NULL, NULL, 'Writing in Stock', NULL, NULL, 0, 0, 0),
        ('2024', 'bali', 'Wild Ancha', 'Dark', '荒野安化茶', 2024, 'Basket', 'lot-vendor', NULL, 'Writing in Stock', NULL, NULL, 0, 0, 0),
        ('bai', 'bali', 'Bai Liang', 'Dark', '花卷茶', 2006, 'Roll', NULL, NULL, 'Saved listing', NULL, NULL, 0, 0, 0),
        ('foreign', 'australia', 'Wild Ancha', 'Dark', '荒野安化茶', 2024, 'Basket', NULL, NULL, 'Foreign', NULL, NULL, 0, 0, 0),
        ('ware', 'bali', 'Wild Ancha pot', 'Teaware', NULL, NULL, NULL, NULL, 'pot', 'Teaware', NULL, NULL, 0, 0, 0);
    `);
    const root = 'owner-review/bali/catalog-reading/';
    const [basketRevision, exactRevision, revisedBasket] = ['a', 'b', 'c'].map(char => char.repeat(64));
    const items = [
      { id: 'basket', digest: basketRevision, title: 'An tea in a basket', status: 'Identification conflict' },
      { id: 'exact', digest: exactRevision, title: 'Bai Liang', status: 'Stock match confirmed' },
    ];
    const objects = new Map<string, { text: string; etag: string }>();
    const seed = (key: string, data: object) => objects.set(root + key, { text: JSON.stringify(data), etag: 'seed' });
    seed('index.json', { ownerUserId: 'adrian', items });
    seed('pages/' + basketRevision + '.json', { stockCandidateIds: ['2023', '2024', 'foreign', 'ware'] });
    seed('pages/' + exactRevision + '.json', { stockId: 'bai' });
    seed('pages/' + revisedBasket + '.json', {});
    let version = 0;
    const bucket = {
      get: async (key: string) => {
        const data = objects.get(key);
        return data ? Object.assign(new Response(data.text), { etag: data.etag }) : null;
      },
      put: async (key: string, value: string, { onlyIf }: { onlyIf: { etagMatches?: string; etagDoesNotMatch?: string } }) => {
        const prior = objects.get(key);
        if (prior ? onlyIf.etagMatches !== prior.etag : onlyIf.etagDoesNotMatch !== '*') return null;
        objects.set(key, { text: value, etag: String(++version) });
        return {};
      },
    };
    const env = { DB: db, ATLAS_BUCKET: bucket } as unknown as Parameters<typeof serveCatalogTeaReading>[1];
    const call = (view: string, body?: object, role = { accountId: 'bali', userId: 'adrian' }) =>
      serveCatalogTeaReading(new Request('https://example.test/api/admin/catalog-review/teas/connection?' + view, body ? {
        method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
      } : {}), env, async () => role.userId ? role : { error: new Response(null, { status: 401 }) });
    const review = 'view=intake&id=basket';
    const snapshot = async (path = review): Promise<TeaConnection> => {
      const response = await call(path);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      return response.json();
    };
    const stockBefore = db.sqlite.prepare('SELECT id, description, stock_grams, is_public, shown_in_shop, vendor_id FROM products ORDER BY id').all();
    const first = await snapshot();
    expect(first.stockId).toBeNull();
    expect((await call(review + '&stockSearch=', undefined, { accountId:'bali', userId:'clerk' })).status).toBe(403);
    expect((await call(review + '&stockSearch=', undefined, { accountId:'bali', userId:'' })).status).toBe(401);
    expect((await call(review + '&stockSearch=', undefined, { accountId:'australia', userId:'other' })).status).toBe(404);
    for (const search of ['', 'Wild+Ancha', encodeURIComponent('荒野安化茶')]) {
      const result = await (await call(review + '&stockSearch=' + search)).json() as { id: string }[];
      expect(result.map(item => item.id)).toEqual(['2023', '2024']);
    }

    seed('pages/' + basketRevision + '.json', { title: 'An tea in a basket', evidence: 'Stock uses 荒野安化茶.' });
    expect(await (await call(review + '&stockSearch=')).json()).toMatchObject([{ id: '2023' }, { id: '2024' }]);

    const finding = { action: 'finding', expected: first, text: 'Get the order-linked photo.', resolved: false };
    expect((await call(review, { ...finding, resolved: true })).status).toBe(404);
    expect((await call(review, finding)).status).toBe(200);
    expect(await snapshot()).toMatchObject({ stockId: null, finding: { text: finding.text, resolved: false } });
    expect(await (await call('queue=1')).json()).toEqual({ matchedIntake: [], resolvedHolds: [] });

    expect((await call(review, { action: 'vendor', expected: await snapshot(), vendorId: 'intake-vendor' })).status).toBe(200);
    const fresh = await snapshot();
    const match = { action: 'match', expected: fresh, stockId: '2024', evidence: 'Test confirmation of the exact lot.' };
    for (const stockId of ['foreign', 'ware', 'missing']) {
      expect((await call(review, { ...match, stockId })).status).toBe(400);
    }
    expect((await call(review, { ...match, evidence: '  ' })).status).toBe(400);
    expect((await call(review, { ...match, expected: first })).status).toBe(409);
    const confirmed = await call(review, match);
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({
      stockId: '2024', stock: { name: 'Wild Ancha', year: 2024, listingPublic: false },
      vendorId: 'lot-vendor', intakeVendor: { id: 'intake-vendor' }, matchEvidence: match.evidence,
      finding: { text: finding.text, resolved: false },
    });
    expect(await snapshot()).toMatchObject({ stockId: '2024', matchEvidence: match.evidence });
    expect(await (await call('queue=1')).json()).toEqual({ matchedIntake: ['basket'], resolvedHolds: [] });
    expect((await call(review, { ...match, expected: await snapshot() })).status).toBe(409);
    const exact = 'view=intake&id=exact';
    expect((await call(exact, { ...match, expected: await snapshot(exact) })).status).toBe(409);
    expect(await snapshot(exact)).toMatchObject({ stockId: 'bai' });
    expect((await call(exact, { action: 'clear-match', expected: await snapshot(exact) })).status).toBe(409);
    expect((await call(review, { action: 'clear-match', expected: fresh })).status).toBe(409);
    expect((await call(review, { action: 'clear-match', expected: await snapshot() })).status).toBe(200);
    const cleared = await snapshot();
    expect(cleared).toMatchObject({ stockId: null, vendorId: 'intake-vendor', finding: { text: finding.text } });
    expect(cleared.matchEvidence).toBeUndefined();
    expect(await (await call('queue=1')).json()).toEqual({ matchedIntake: [], resolvedHolds: [] });
    expect((await call(review, { ...match, expected: cleared })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT id, description, stock_grams, is_public, shown_in_shop, vendor_id FROM products ORDER BY id').all()).toEqual(stockBefore);
    expect(version).toBe(5);

    seed('index.json', { ownerUserId: 'adrian', items: [{ ...items[0], digest: revisedBasket }, items[1]] });
    expect(await snapshot()).toMatchObject({ stockId: null, vendorId: 'intake-vendor', finding: { text: finding.text } });
    expect(await (await call('queue=1')).json()).toEqual({ matchedIntake: [], resolvedHolds: [] });
  } finally {
    db.close();
  }
});

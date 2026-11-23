import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const product = '82124f03-a6a6-4a40-8a5b-cf1fc715ce8c';
const api = '/api/admin/stock-gallery/' + product;
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function fixture() {
  const db = new SqliteD1('schema');
  databases.push(db);
  seedIdentity(db, { accountId: 'shop', userId: 'owner' });
  seedIdentity(db, { accountId: 'shop', userId: 'staff', role: 'staff' });
  seedIdentity(db, { accountId: 'other', userId: 'outside' });
  db.prepare(`INSERT INTO products (id, account_id, product_name, given_name, type, cost_amount, cost_currency, status, is_public, shown_in_shop,
    stock_grams, image_url, additional_images) VALUES (?, 'shop','Liu Bao','Inward','Dark',NULL,NULL,'Active',1,0,600,'old-main','["old-extra"]')`).bind(product).run();

  db.prepare("UPDATE products SET year=1980, origin_region='Cangwu, Guangxi', lore='Saved history', experience='Unattributed tasting' WHERE id=?").bind(product).run();

  const objects = new Map<string, { blob: Blob; customMetadata: Record<string, string> }>();
  const bucket = {
    head: (key: string) => objects.get(key) || null,
    put(key: string, blob: Blob, options: R2PutOptions) {
      expect(options.onlyIf).toEqual({ etagDoesNotMatch: '*' });
      if (objects.has(key)) return null;
      objects.set(key, { blob, customMetadata: options.customMetadata! });
      return { key };
    },
    get(key: string, { range }: { range: { offset: number; length: number } }) {
      const blob = objects.get(key)?.blob;
      return blob ? { body: blob.slice(range.offset, range.offset + range.length).stream() } : null;
    },
  };
  async function call(path: string, method = 'GET', actor = 'owner', data?: number[][]) {
    const account = actor === 'outside' ? 'other' : 'shop';
    const headers = new Headers({ 'X-Teajia-Account': account });
    if (actor) headers.set('Authorization', 'Bearer ' + await signedToken('test-only', { sub: actor, active_account_id: account }));
    const form = new FormData();
    for (const bytes of data || []) form.append('photo', new Blob([Uint8Array.from(bytes)], { type: 'image/jpeg' }), 'review.jpg');
    const request = new Request('https://teajia.test' + path, { method, headers, body: data ? form : undefined });
    if (data) request.headers.set('Content-Length', String((await request.clone().arrayBuffer()).byteLength));
    return worker.fetch(request, { JWT_SECRET: 'test-only', DB: db, ATLAS_BUCKET: bucket,
      MEDIA_BUCKET: { get: () => null }, APP_URL: 'https://teajia.test' } as never);
  }
  return { call, objects, db, row: () => db.prepare('SELECT * FROM products WHERE id=?').bind(product).first() };
}

const main = [255,216,255,224,49,255,217];
const detail = [255,216,255,224,50,255,217];
describe('private Stock gallery proposals', () => {
  it('preserves a hidden Active Stock row, orders bytes atomically and keeps retries write-free', async () => {
    const { call, row, objects } = fixture();
    const original = row();
    const target = await call(api);
    expect(target.status).toBe(200);
    expect(await target.json()).toMatchObject({ stockId: product, name: 'Inward', productName: 'Liu Bao', photos: [] });
    expect(objects.size).toBe(0);
    const created = await call(api, 'POST', 'owner', [main, detail]);
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    const metadata = await call(api + '/' + id);
    const json = await metadata.json() as { reading: {facts: unknown[]; background: unknown[]} };
    expect(json.reading.facts).toEqual([
      { label: 'Tea type', value: 'Dark' }, { label: 'Year', value: '1980' }, { label: 'Origin', value: 'Cangwu, Guangxi' },
    ]);
    expect(json.reading.background).toEqual([{ label: 'Lore & history', value: 'Saved history' }]);
    expect(JSON.stringify(json)).not.toContain('Unattributed tasting');
    const saved = objects.values().next().value;
    expect((await call(api, 'POST', 'owner', [main, detail])).status).toBe(200);
    expect(objects.size).toBe(1);
    expect(objects.values().next().value).toBe(saved);
    for (const [index, bytes] of [main, detail].entries()) {
      const image = await call(api + '/' + id + '/' + (index + 1));
      expect(image.headers.get('Cache-Control')).toBe('private, no-store');
      expect(Array.from(new Uint8Array(await image.arrayBuffer()))).toEqual(bytes);
    }
    const reversed = await call(api, 'POST', 'owner', [detail, main]);
    expect(reversed.status).toBe(201);
    expect(objects.size).toBe(2);
    expect(row()).toEqual(original);
  });
  it('reads object-specific facts for teaware while keeping unknown values empty', async () => {
    const { call, db } = fixture();
    db.prepare("UPDATE products SET type='Teaware', year=NULL, lore=NULL, origin_region=NULL, teaware_category='pot', capacity_ml=140, teaware_details=?, terroir='Tea-specific' WHERE id=?")
      .bind(JSON.stringify({ mark: 'Visible inscription', form_history: 'Saved form history' }), product).run();
    const response = await call(api);
    expect(await response.json()).toMatchObject({reading: {
      facts: [{label:'Category', value:'pot'}, {label:'Capacity', value:'140 ml'}, {label:'Mark', value:'Visible inscription'}],
      background: [{label:'Form history', value:'Saved form history'}],
    }});
  });
  it('limits proposals and photo reads to owners in the matching active shop', async () => {
    const { call } = fixture();
    const response = await call(api, 'POST', 'owner', [main]);
    const { id } = await response.json() as { id: string };
    for (const [actor, status] of [['', 401], ['staff', 403], ['outside', 404]] as const) {
      expect((await call(api, 'POST', actor, [main])).status).toBe(status);
      for (const path of [api, api + '/' + id, api + '/' + id + '/1']) {
        for (const method of ['GET', 'HEAD']) expect((await call(path, method, actor)).status).toBe(status);
      }
    }
    expect((await call('/api/media/stock-gallery-proposals/shop/' + product + '/' + id, 'GET', '')).status).toBe(404);
  });
  it('refuses invalid or repeated images before storing any bytes', async () => {
    const { call, objects } = fixture();
    expect((await call(api, 'POST', 'owner', [main, [1,2,3]])).status).toBe(415);
    expect((await call(api, 'POST', 'owner', [detail, detail])).status).toBe(400);
    expect(objects.size).toBe(0);
  });
});

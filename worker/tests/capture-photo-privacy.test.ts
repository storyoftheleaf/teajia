import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(database => database.close()));

type TestObject = {
  bytes: ArrayBuffer;
  httpMetadata: { contentType: string };
  customMetadata: { uploader: string; sha256: string; frame?: string };
};

class PrivateBucket {
  objects = new Map<string, TestObject>();
  failPut = false;
  async put(key: string, bytes: ArrayBuffer, options: Omit<TestObject, 'bytes'> & { onlyIf?: { etagDoesNotMatch: string } }) {
    if (this.failPut) throw new Error('Storage temporarily unavailable');
    if (options.onlyIf?.etagDoesNotMatch === '*' && this.objects.has(key)) return null;
    const object = { bytes, httpMetadata: options.httpMetadata, customMetadata: options.customMetadata };
    this.objects.set(key, object);
    return object;
  }
  async head(key: string) { return this.objects.get(key) ?? null; }
  async get(key: string) {
    const object = await this.head(key);
    return object ? { ...object, body: new Response(object.bytes).body, size: object.bytes.byteLength } : null;
  }
}

async function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  const secret = 'capture-fixture';
  const identities = [
    seedIdentity(db, { userId: 'operator', accountId: 'shop' }),
    seedIdentity(db, { userId: 'viewer', accountId: 'shop', role: 'viewer' }),
    seedIdentity(db, { userId: 'gatherer', accountId: 'shop', role: 'staff', bundles: ['gather'] }),
    seedIdentity(db, { userId: 'outside', accountId: 'outside-shop' }),
    seedIdentity(db, { userId: 'editor', accountId: 'shop', role: 'staff', bundles: ['catalog'] }),
  ];
  const tokens = Object.fromEntries(await Promise.all(identities.map(async ({ userId, accountId }) =>
    [userId, await signedToken(secret, { sub: userId, active_account_id: accountId })])));
  const env = { DB: db, JWT_SECRET: secret, ATLAS_BUCKET: new PrivateBucket(), PROVIDER_LIMITER: { limit: async () => ({ success: true }) } } as never;
  const request = (path: string, method = 'GET', body?: FormData | object, actor = 'operator') => worker.fetch(
    new Request('https://capture.test' + path, {
      method,
      headers: {
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }), env, { waitUntil() {} } as never);
  return { db, request, bucket: (env as any).ATLAS_BUCKET as PrivateBucket };
}

const sourcePhoto = (entry: string) => `/api/curate/capture/${entry}/photos/${crypto.randomUUID()}`;
const projection = (url: string) => url.replace('https://media.teajia.co/', '/api/media/');
const bytes = (index: number) => new Uint8Array([255, 216, 255, 224, 0, index]);
function form(index: number) {
  const data = new FormData();
  data.set('file', new File([bytes(index)], 'fixture.jpg', { type: 'image/jpeg' }));
  return data;
}

it('keeps a pre-save capture private and upload retries byte-identical', async () => {
  const { request } = await setup();
  const photo = sourcePhoto('unsaved-tea');
  expect((await request(photo, 'POST', form(1))).status).toBe(201);
  expect((await request(photo, 'POST', form(1))).status).toBe(200);
  expect((await request(photo, 'POST', form(2))).status).toBe(409);
  const image = await request(photo);
  expect(image.status).toBe(200);
  expect(image.headers.get('Cache-Control')).toBe('private, no-store');
  expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes(1));
  expect((await request(photo, 'GET', undefined, '')).status).toBe(401);
  expect((await request(photo, 'GET', undefined, 'viewer')).status).toBe(403);
  expect((await request(photo, 'GET', undefined, 'gatherer')).status).toBe(404);
  expect((await request(photo, 'GET', undefined, 'outside')).status).toBe(404);
  const key = `curate/capture/shop/unsaved-tea/${photo.split('/').at(-1)}`;
  expect((await request('/api/media/' + key, 'GET', undefined, '')).status).toBe(404);

  expect((await request('/api/compass/entries', 'POST', { id: 'unsaved-tea', name: 'Source', photos: [photo] })).status).toBe(201);
  expect((await request(photo, 'POST', form(1), 'outside')).status).toBe(404);
  expect((await request(photo, 'GET', undefined, 'gatherer')).status).toBe(404);
  expect((await request(photo + '/shop-review', 'GET', undefined, 'editor')).status).toBe(403);
});

it('requires an exact approval and public holding state to serve only the selected hero', async () => {
  const { db, request } = await setup();
  const entry = '/api/compass/entries/two-photos';
  const first = sourcePhoto('two-photos');
  const other = sourcePhoto('two-photos');
  expect((await request(first, 'POST', form(1))).status).toBe(201);
  expect((await request(other, 'POST', form(2))).status).toBe(201);
  expect((await request('/api/compass/entries', 'POST', { id: 'two-photos', name: 'Two photos', type: 'Oolong', photos: [first, other] })).status).toBe(201);
  const created = await request(entry + '/promote', 'POST');
  expect(created.status).toBe(201);
  const { id, product } = await created.json() as any;
  expect(product).toMatchObject({ image_url: null, bag_photo_url: null, additional_images: '[]' });

  const reviewUrl = first + '/shop-review';
  const review = await (await request(reviewUrl)).json() as any;
  expect(review).toMatchObject({ live: false, product_id: id });
  const approval = { product_id: id, snapshot: review.snapshot, approval_id: crypto.randomUUID() };
  expect((await request(entry, 'PUT', { photos: [other] })).status).toBe(200);
  expect((await request(reviewUrl, 'POST', approval)).status).toBe(409);
  expect((await request(entry, 'PUT', { photos: [first, other] })).status).toBe(200);
  expect((await request(reviewUrl, 'POST', { ...approval, product_id: 'wrong-product' })).status).toBe(409);
  const selected = await request(reviewUrl, 'POST', approval);
  expect(selected.status).toBe(200);
  const { url } = await selected.json() as any;
  const approvedPath = projection(url);
  expect((await request(approvedPath, 'GET', undefined, '')).status).toBe(404);
  const adminPath = '/api/curate/shop-photos/' + approval.approval_id;
  expect((await request(adminPath)).status).toBe(200);
  expect((await request(adminPath, 'GET', undefined, 'outside')).status).toBe(404);
  expect((await request('/api/curate/shop-photos/' + other.split('/').at(-1))).status).toBe(404);

  const shop = '/api/s/shop/products/' + id;
  db.sqlite.prepare("UPDATE products SET status = 'Active', is_public = 1, shown_in_shop = 1, stock_grams = 50 WHERE id = ?").run(id);
  const detail = await request(shop, 'GET', undefined, '');
  expect(detail.status).toBe(200);
  expect(await detail.json()).toMatchObject({ image_url: url, additional_images: [] });
  const media = await request(approvedPath, 'GET', undefined, '');
  expect(media.status).toBe(200);
  expect(media.headers.get('Cache-Control')).toBe('private, no-store');
  expect(new Uint8Array(await media.arrayBuffer())).toEqual(bytes(1));
  for (const path of [first, other]) expect((await request(path, 'GET', undefined, '')).status).toBe(401);
  expect((await request(other + '/shop-review', 'GET', undefined, '')).status).toBe(401);

  expect((await request(entry, 'PUT', { photos: [other] })).status).toBe(200);
  await expect((await request(shop, 'GET', undefined, '')).json()).resolves.toMatchObject({ image_url: url, additional_images: [] });
  db.sqlite.prepare("UPDATE products SET status = 'Sold Out', stock_grams = 0 WHERE id = ?").run(id);
  expect((await request(shop, 'GET', undefined, '')).status).toBe(200);
  expect((await request(approvedPath, 'GET', undefined, '')).status).toBe(200);
  db.sqlite.prepare('UPDATE products SET shown_in_shop = 0 WHERE id = ?').run(id);
  expect((await request(approvedPath, 'GET', undefined, '')).status).toBe(404);
  db.sqlite.prepare("UPDATE products SET shown_in_shop = 1, image_url = 'https://example.test/direct.jpg' WHERE id = ?").run(id);
  expect((await request(approvedPath, 'GET', undefined, '')).status).toBe(404);
  const replay = await request(reviewUrl, 'POST', approval);
  expect(await replay.json()).toMatchObject({ url, already_approved: true });
  expect(db.sqlite.prepare('SELECT image_url FROM products WHERE id = ?').get(id)).toMatchObject({ image_url: 'https://example.test/direct.jpg' });
});

it('reviews and approves the working hero when a linked Library tea also has a sample but no saved Stock pointer', async () => {
  const { db, request } = await setup();
  const entryId = 'split-holdings';
  const photo = sourcePhoto(entryId);
  expect((await request(photo, 'POST', form(1))).status).toBe(201);
  expect((await request('/api/compass/entries', 'POST', { id: entryId, name: 'Split tea', type: 'Oolong', photos: [photo] })).status).toBe(201);
  db.sqlite.exec(`INSERT INTO products (id, account_id, product_name, type, inventory_purpose, source_compass_entry_id)
    VALUES ('first-sample', 'shop', 'Split sample', 'Oolong', 'sample', 'split-holdings'),
      ('second-working', 'shop', 'Split working', 'Oolong', 'working', 'split-holdings');
    -- Force the permissive lookup to encounter the sample first, like a scan
    -- on the account index without a useful compound identity index.
    DROP INDEX idx_products_account_compass_identity;`);

  const reviewPath = photo + '/shop-review';
  const review = await (await request(reviewPath)).json() as any;
  expect(review).toMatchObject({ product_id: 'second-working' });
  const selected = await request(reviewPath, 'POST', { ...review, approval_id: crypto.randomUUID() });
  expect(selected.status).toBe(200);
  const { url } = await selected.json() as any;
  expect(db.sqlite.prepare("SELECT id, image_url FROM products ORDER BY id").all()).toEqual([
    { id: 'first-sample', image_url: null },
    { id: 'second-working', image_url: url },
  ]);
});


const squareFrame = { crop: { x: 12, y: -4 }, zoom: 1.5, rotation: 90, areaPercent: { x: 10, y: 20, width: 50, height: 60 } };
function frameForm(index: number, frame: unknown = squareFrame) {
  const data = form(index);
  data.set('frame', JSON.stringify(frame));
  return data;
}

it('keeps original bytes and stable photo URL while persisting the selected square frame', async () => {
  const { request } = await setup();
  const photo = sourcePhoto('framed-tea');
  expect((await request(photo, 'POST', form(1))).status).toBe(201);
  expect(await (await request(photo + '/frame')).json()).toEqual({ frame: null });
  expect((await request(photo + '/frame', 'PUT', frameForm(2))).status).toBe(200);
  expect(await (await request(photo + '/frame')).json()).toEqual({ frame: squareFrame });
  expect(new Uint8Array(await (await request(photo)).arrayBuffer())).toEqual(bytes(2));
  expect(new Uint8Array(await (await request(photo + '?original=1')).arrayBuffer())).toEqual(bytes(1));
  expect((await request(photo, 'POST', form(2))).status).toBe(409);
});

it('rejects unauthorized, missing-source and invalid framing without changing the original or prior frame', async () => {
  const { request } = await setup();
  const photo = sourcePhoto('private-framing');
  expect((await request(photo + '/frame', 'PUT', frameForm(2))).status).toBe(404);
  await request(photo, 'POST', form(1));
  await request(photo + '/frame', 'PUT', frameForm(2));
  for (const actor of ['', 'viewer', 'outside', 'gatherer']) {
    const expected = actor === '' ? 401 : actor === 'viewer' ? 403 : 404;
    expect((await request(photo + '/frame', 'GET', undefined, actor)).status).toBe(expected);
    expect((await request(photo + '/frame', 'PUT', frameForm(3), actor)).status).toBe(expected);
  }
  for (const frame of [{ ...squareFrame, zoom: 0 }, { ...squareFrame, rotation: 999 }, { ...squareFrame, crop: { x: null, y: 0 } }, { ...squareFrame, areaPercent: { x: 99, y: 0, width: 50, height: 20 } }]) {
    expect((await request(photo + '/frame', 'PUT', frameForm(3, frame))).status).toBe(400);
  }
  const wrongType = frameForm(3); wrongType.set('file', new File([bytes(3)], 'not-jpeg.png', { type: 'image/png' }));
  expect((await request(photo + '/frame', 'PUT', wrongType)).status).toBe(400);
  expect(new Uint8Array(await (await request(photo + '?original=1')).arrayBuffer())).toEqual(bytes(1));
  expect(new Uint8Array(await (await request(photo)).arrayBuffer())).toEqual(bytes(2));
});

it('keeps the previous frame and original when preview storage fails', async () => {
  const { request, bucket } = await setup();
  const photo = sourcePhoto('failed-framing');
  await request(photo, 'POST', form(1));
  await request(photo + '/frame', 'PUT', frameForm(2));
  bucket.failPut = true;
  expect((await request(photo + '/frame', 'PUT', frameForm(3))).status).toBe(500);
  bucket.failPut = false;
  expect(new Uint8Array(await (await request(photo)).arrayBuffer())).toEqual(bytes(2));
  expect(new Uint8Array(await (await request(photo + '?original=1')).arrayBuffer())).toEqual(bytes(1));
  expect(await (await request(photo + '/frame')).json()).toEqual({ frame: squareFrame });
});

it('pins the chosen square preview at approval so future reframing cannot change the approved product photo', async () => {
  const { db, request } = await setup();
  const photo = sourcePhoto('approved-framing');
  await request(photo, 'POST', form(1));
  await request(photo + '/frame', 'PUT', frameForm(2));
  await request('/api/compass/entries', 'POST', { id: 'approved-framing', name: 'Framed tea', type: 'Oolong', photos: [photo] });
  await request('/api/compass/entries/approved-framing/promote', 'POST');
  const review = await (await request(photo + '/shop-review')).json() as any;
  const approval = { ...review, approval_id: crypto.randomUUID() };
  const result = await request(photo + '/shop-review', 'POST', approval);
  expect(result.status).toBe(200);
  const { url } = await result.json() as any;
  db.sqlite.prepare("UPDATE products SET status = 'Active', is_public = 1, shown_in_shop = 1, stock_grams = 50 WHERE id = ?").run(review.product_id);
  await request(photo + '/frame', 'PUT', frameForm(3));
  expect(new Uint8Array(await (await request(photo)).arrayBuffer())).toEqual(bytes(3));
  expect(new Uint8Array(await (await request(projection(url), 'GET', undefined, '')).arrayBuffer())).toEqual(bytes(2));
  expect(new Uint8Array(await (await request(photo + '?original=1')).arrayBuffer())).toEqual(bytes(1));
});

it('refuses oversize previews and changed framing at approval without publishing an unreviewed image', async () => {
  const { request } = await setup();
  const photo = sourcePhoto('reviewed-framing');
  await request(photo, 'POST', form(1));
  const huge = frameForm(2);
  const hugeBytes = new Uint8Array(6 * 1024 * 1024 + 1); hugeBytes.set(bytes(2));
  huge.set('file', new File([hugeBytes], 'huge.jpg', { type: 'image/jpeg' }));
  expect((await request(photo + '/frame', 'PUT', huge)).status).toBe(413);
  const malformed = frameForm(2); malformed.set('frame', '{broken');
  expect((await request(photo + '/frame', 'PUT', malformed)).status).toBe(400);
  await request('/api/compass/entries', 'POST', { id: 'reviewed-framing', name: 'Reviewed tea', type: 'Oolong', photos: [photo] });
  await request('/api/compass/entries/reviewed-framing/promote', 'POST');
  const review = await (await request(photo + '/shop-review')).json() as any;
  await request(photo + '/frame', 'PUT', frameForm(2));
  const approvalId = crypto.randomUUID();
  expect((await request(photo + '/shop-review', 'POST', { ...review, approval_id: approvalId })).status).toBe(409);
  expect((await request('/api/media/curate-approved/' + approvalId, 'GET', undefined, '')).status).toBe(404);
  expect(new Uint8Array(await (await request(photo + '?original=1')).arrayBuffer())).toEqual(bytes(1));
});


it('persists the three framing presets on the same private original and refuses unsupported ratios', async () => {
  const { request } = await setup();
  const photo = sourcePhoto('preset-framing');
  await request(photo, 'POST', form(1));
  for (const aspect of [1, 2 / 3, 3 / 2]) {
    const frame = { ...squareFrame, aspect };
    expect((await request(photo + '/frame', 'PUT', frameForm(2, frame))).status).toBe(200);
    expect(await (await request(photo + '/frame')).json()).toEqual({ frame });
    expect((await request(photo + '/frame', 'PUT', frameForm(3, frame), 'outside')).status).toBe(404);
    expect(new Uint8Array(await (await request(photo + '?original=1')).arrayBuffer())).toEqual(bytes(1));
  }
  for (const aspect of [0, -1, 16 / 9, 'portrait', null]) {
    expect((await request(photo + '/frame', 'PUT', frameForm(3, { ...squareFrame, aspect }))).status).toBe(400);
  }
  expect(await (await request(photo + '/frame')).json()).toEqual({ frame: { ...squareFrame, aspect: 3 / 2 } });
});

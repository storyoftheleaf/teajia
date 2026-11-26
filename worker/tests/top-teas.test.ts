import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const secret = 'top-teas-test-secret';
const path = '/api/public/people/mei/top-teas';
let db: SqliteD1;
const photos = new Map<string, { bytes: ArrayBuffer; type: string }>();

beforeEach(() => {
  db = new SqliteD1('migrations', '0140');
  db.exec(readFileSync(new URL('../migrations/0148_freight_method.sql', import.meta.url), 'utf8'));
  photos.clear();
  seedIdentity(db, { userId: 'mei-user' });
  seedIdentity(db, { userId: 'other-user' });
  seedIdentity(db, { userId: 'family-user' });
  db.exec(`
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier)
    VALUES ('mei', 'acc-one', 'mei-user', 'Mei', 1, 'master'),
           ('other', 'acc-one', 'other-user', 'Other', 1, 'master'),
           ('family', 'acc-one', 'family-user', 'Family', 1, 'family');
    INSERT INTO products (id, account_id, slug, product_name, type, status, is_public, shown_in_shop, cost_amount, cost_currency)
    VALUES ('public-tea', 'acc-one', 'spring-oolong', 'Spring Oolong', 'Oolong', 'Sold Out', 1, 1, 0, 'Yuan'),
           ('private-tea', 'acc-one', 'private-oolong', 'Private Oolong', 'Oolong', 'Active', 0, 1, 0, 'Yuan');
  `);
});
afterEach(() => db.close());

function pick(fields: Record<string, string> = {}, photo = true) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Spring Tea', ...fields })) form.set(key, value);
  if (photo) form.set('photo', new Blob([Uint8Array.of(255, 216, 255, 0)], { type: 'image/jpeg' }), 'tea.jpg');
  return form;
}

async function call(url = path, options: { user?: string; method?: string; body?: FormData; open?: boolean } = {}) {
  const headers = new Headers();
  if (options.user) {
    const token = await signedToken(secret, { sub: options.user, name: options.user, email: options.user + '@test.dev' });
    headers.set('Authorization', 'Bearer ' + token);
  }
  return worker.fetch(new Request('https://top-teas.test' + url, { headers, method: options.method, body: options.body }), {
    DB: db,
    JWT_SECRET: secret,
    ...(options.open === false ? {} : { TOP_TEAS_OPEN: 'true' }),
    PROVIDER_LIMITER: { limit: async () => ({ success: true }) },
    ATLAS_BUCKET: {
      put: async (key: string, body: ReadableStream, metadata: { httpMetadata: { contentType: string } }) => {
        photos.set(key, { bytes: await new Response(body).arrayBuffer(), type: metadata.httpMetadata.contentType });
      },
      get: async (key: string) => {
        const photo = photos.get(key);
        return photo ? { body: new Response(photo.bytes).body, httpMetadata: { contentType: photo.type } } : null;
      },
      delete: async (key: string) => { photos.delete(key); },
    },
  } as unknown as Parameters<typeof worker.fetch>[1]);
}

const save = (slot: string, fields: Record<string, string> = {}, photo = true) =>
  call(path + '/' + slot, { method: 'PUT', user: 'mei-user', body: pick(fields, photo) });

describe('top teas on a person page', () => {
  it('opens an empty shelf for its owner and defaults to closed', async () => {
    expect((await call(path, { user: 'mei-user', open: false })).status).toBe(404);
    const response = await call(path, { user: 'mei-user' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ can_edit: true, picks: [] });
    expect((await call(path + '/Green', { method: 'PUT', user: 'mei-user', body: pick(), open: false })).status).toBe(404);
  });

  it('lets only the eligible profile owner edit', async () => {
    expect((await call(path + '/Green', { method: 'PUT', body: pick() })).status).toBe(401);
    expect((await call(path + '/Green', { method: 'PUT', user: 'other-user', body: pick() })).status).toBe(404);
    expect((await call('/api/public/people/family/top-teas/Green', { method: 'PUT', user: 'family-user', body: pick() })).status).toBe(404);
    expect(await (await call(path, { user: 'other-user' })).json()).toEqual({ can_edit: false, picks: [] });
  });

  it('keeps one pick per shop category plus one in each maker slot', async () => {
    expect((await save('Black')).status).toBe(404);
    expect((await save('Green', {}, false)).status).toBe(400);
    expect((await save('Green', { note: 'My words', score: '10' })).status).toBe(200);
    expect((await save('Green', { name: 'New Green' }, false)).status).toBe(200);
    expect((await save('Sheng')).status).toBe(200);
    expect((await save('own')).status).toBe(200);
    expect((await save('elsewhere')).status).toBe(200);

    const response = await call();
    const result = await response.json() as { can_edit: boolean; picks: Record<string, unknown>[] };
    expect(result.can_edit).toBe(false);
    expect(result.picks.map(row => row.slot)).toEqual(['Green', 'Sheng', 'own', 'elsewhere']);
    expect(result.picks[0]).toEqual({
      slot: 'Green', name: 'New Green', note: null, photo_path: expect.any(String), shop_path: null,
    });
  });

  it('finds public shop teas and drops the link when the shop withdraws a listing', async () => {
    const options = await call(path + '/shop?q=oolong', { user: 'mei-user' });
    expect(options.status).toBe(200);
    expect(await options.json()).toEqual({ teas: [{ id: 'public-tea', name: 'Spring Oolong', category: 'Oolong', store_name: 'acc-one' }] });
    expect((await save('Oolong', { product_id: 'private-tea' })).status).toBe(400);
    expect((await save('Green', { product_id: 'public-tea' })).status).toBe(400);
    expect((await save('Oolong', { product_id: 'public-tea', note: 'I keep returning to it.' })).status).toBe(200);
    const first = await (await call()).json() as any;
    expect(first.picks[0]).toMatchObject({ name: 'Spring Oolong', note: 'I keep returning to it.', shop_path: '/shop/product/spring-oolong?store=acc-one' });
    expect((await call('/api/s/acc-one/products/spring-oolong')).status).toBe(200);

    db.exec("UPDATE products SET shown_in_shop = 0 WHERE id = 'public-tea'");
    expect((await call('/api/s/acc-one/products/spring-oolong')).status).toBe(404);
    const next = await (await call()).json() as any;
    expect(next.picks[0]).toEqual({ ...first.picks[0], shop_path: null });
    const ownPicks = await (await call(path, { user: 'mei-user' })).json() as any;
    expect(ownPicks.shop_link_slots).toEqual(['Oolong']);
    expect(next).not.toHaveProperty('shop_link_slots');
    expect((await save('Oolong', { note: 'Still my pick.' }, false)).status).toBe(200);
    expect((await (await call()).json() as any).picks[0]).toMatchObject({ name: 'Spring Oolong', note: 'Still my pick.' });
    expect((await save('Oolong', { name: 'My tea', product_id: '' }, false)).status).toBe(200);
    db.exec("UPDATE products SET shown_in_shop = 1 WHERE id = 'public-tea'");
    expect((await (await call()).json() as any).picks[0]).toMatchObject({ name: 'My tea', shop_path: null });
  });

  it('withdraws photo URLs on replacement, removal and profile unpublication', async () => {
    await save('White');
    const photo = async () => ((await (await call()).json()) as any).picks[0].photo_path as string;
    const first = await photo();
    const image = await call(first);
    expect(image.status).toBe(200);
    expect(image.headers.get('Content-Type')).toBe('image/jpeg');
    expect(image.headers.get('Cache-Control')).toContain('no-store');
    expect((await call(first, { open: false })).status).toBe(404);

    await save('White', { name: 'New tea' });
    const replacement = await photo();
    expect(replacement).not.toBe(first);
    expect((await call(first)).status).toBe(404);
    expect((await call(path + '/White', { method: 'DELETE', user: 'mei-user' })).status).toBe(200);
    expect((await call(replacement)).status).toBe(404);
    expect(photos.size).toBe(0);

    await save('White');
    const current = await photo();
    db.exec("UPDATE contributors SET is_published = 0, unpublished_at = datetime('now') WHERE id = 'mei'");
    expect((await call()).status).toBe(404);
    expect((await call(current)).status).toBe(404);
  });
});

// A4 review, finding 15: "One of my own" and "From someone else" never hold the same shop tea.
describe('the two maker slots', () => {
  it('refuse the same shop tea in both, whichever is saved first, and keep the first', async () => {
    expect((await save('own', { product_id: 'public-tea' })).status).toBe(200);
    const twice = await save('elsewhere', { product_id: 'public-tea' });
    expect(twice.status).toBe(409);
    expect(await twice.json()).toEqual({ error: 'This tea is already picked as one of your own.' });
    expect((await save('elsewhere', { name: 'A friend\'s tea' })).status).toBe(200);
    const relink = await save('elsewhere', { product_id: 'public-tea' }, false);
    expect(relink.status).toBe(409);
    expect(await relink.json()).toEqual({ error: 'This tea is already picked as one of your own.' });
    const rows = db.sqlite.prepare(`SELECT slot, product_id FROM contributor_top_teas WHERE contributor_id = 'mei' ORDER BY slot`).all();
    expect(rows).toEqual([{ slot: 'elsewhere', product_id: null }, { slot: 'own', product_id: 'public-tea' }]);

    // Taken out of one, it may go in the other.
    expect((await save('own', { name: 'My own', product_id: '' }, false)).status).toBe(200);
    expect((await save('elsewhere', { product_id: 'public-tea' }, false)).status).toBe(200);
    const back = await save('own', { product_id: 'public-tea' }, false);
    expect(back.status).toBe(409);
    expect(await back.json()).toEqual({ error: 'This tea is already picked as from someone else.' });
  });

  it('still lets a type slot and a maker slot name the same tea', async () => {
    expect((await save('Oolong', { product_id: 'public-tea' })).status).toBe(200);
    expect((await save('own', { product_id: 'public-tea' })).status).toBe(200);
  });
});

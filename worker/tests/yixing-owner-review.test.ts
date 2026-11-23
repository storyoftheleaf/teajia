import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const base = '/api/admin/yixing';
const account = 'acc_teajia_bali';
const prefix = 'owner-review/' + account + '/yixing/v1/';
const hash = 'a'.repeat(64);
const board = { version: 1, ownerUserId: 'personal-owner', pots: [{ id: 'pots-04', name: 'Private pot' }, { id: 'pots-02' }],
  reference: { entries: [{ id: 'shape-hexagonal', kind: 'shape' }, { id: 'clay-zini', kind: 'clay' }, { id: 'clay-zhuni', kind: 'clay' }] } };
const initial = { clay: '', color: '', shape: '', note: '', revision: 0 };
const databases: SqliteD1[] = [];

function setup() {
  const db = new SqliteD1('schema');
  databases.push(db);
  for (const [userId, role, platformRole] of [
    ['personal-owner', 'owner', 'platform_owner'], ['second-owner', 'owner', 'platform_admin'],
    ['staff', 'staff', null], ['other-platform-owner', 'staff', 'platform_owner'],
  ] as const) seedIdentity(db, { accountId: account, userId, role, platformRole });
  seedIdentity(db, { accountId: 'other-shop', userId: 'other-owner', role: 'owner' });
  const objects = new Map<string, string | ArrayBuffer>([[prefix + 'board.json', JSON.stringify(board)],
    [prefix + 'media/' + hash + '.jpg', 'private photo']]);
  const metadata = new Map<string, R2PutOptions>();
  const failedPuts = new Set<string>();
  const etag = (key: string) => {
    const value = objects.get(key);
    return typeof value === 'string' ? value : value && Buffer.from(value).toString('base64');
  };
  const bucket = {
    head: async (key: string) => objects.has(key) ? { etag: etag(key), ...metadata.get(key) } : null,
    get: async (key: string) => {
      const value = objects.get(key);
      return value === undefined ? null : {
        etag: etag(key), ...metadata.get(key), body: new Response(value).body,
        json: async () => JSON.parse(value as string),
      };
    },
    put: async (key: string, value: string | ArrayBuffer, options: R2PutOptions) => {
      if (failedPuts.has(key)) throw new Error('Storage temporarily unavailable');
      const match = options.onlyIf as R2Conditional;
      if (objects.has(key) ? match.etagMatches !== etag(key) : match.etagDoesNotMatch !== '*') return null;
      objects.set(key, value);
      metadata.set(key, options);
      return { etag: etag(key) };
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
  return { call, objects, db, failedPuts };
}

afterEach(() => { while (databases.length) databases.pop()!.close(); });

describe('personal Yixing pot review', () => {
  it('admits only the individually bound platform owner when their Bali membership is staff', async () => {
    const { call, db } = setup();
    db.sqlite.prepare("UPDATE account_members SET role = 'staff' WHERE user_id = ?").run('personal-owner');
    expect((await call(base)).status).toBe(200);
    expect((await call(base, 'other-platform-owner')).status).toBe(403);
    db.sqlite.prepare("UPDATE users SET platform_role = NULL WHERE id = ?").run('personal-owner');
    expect((await call(base)).status).toBe(403);
  });
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

  it('accepts only distinct known clay rejections compatible with the confirmed clay', async () => {
    const { call } = setup();
    const path = base + '/pots/pots-04';
    for (const rejectedClays of [null, 'clay-zhuni', [42], ['unknown'], ['shape-hexagonal'], ['clay-zhuni', 'clay-zhuni'],
      ['clay-zini', 'clay-zhuni', 'unknown'], ['clay-zini']]) {
      expect((await call(path, 'personal-owner', 'PUT', { ...initial, clay: 'clay-zini', rejectedClays })).status).toBe(400);
    }
    expect(await (await call(base)).json()).toMatchObject({ decisions: {} });
    const valid = { ...initial, clay: 'clay-zini', rejectedClays: ['clay-zhuni'] };
    expect(await (await call(path, 'personal-owner', 'PUT', valid)).json()).toEqual({ ...valid, revision: 1 });
  });

  it('keeps private rejections per pot across legacy saves until confirmed or explicitly cleared', async () => {
    const { call } = setup();
    const put = (id: string, data: unknown) => call(base + '/pots/' + id, 'personal-owner', 'PUT', data);
    const rejectedClays = ['clay-zhuni', 'clay-zini'];
    const saves = await Promise.all([
      put('pots-04', { ...initial, rejectedClays }),
      put('pots-02', { ...initial, rejectedClays: ['clay-zini'] }),
    ]);
    expect(saves.map(s => s.status)).toEqual([200, 200]);
    const shape = { ...initial, revision: 1, shape: 'shape-hexagonal' };
    expect(await (await put('pots-04', shape)).json()).toEqual({ ...shape, revision: 2, rejectedClays });
    expect((await put('pots-04', { ...shape, rejectedClays: [] })).status).toBe(409);
    const confirm = { ...shape, revision: 2, clay: 'clay-zhuni' };
    expect(await (await put('pots-04', confirm)).json()).toEqual({ ...confirm, revision: 3, rejectedClays: ['clay-zini'] });
    const clear = { ...confirm, revision: 3, rejectedClays: [] };
    expect((await put('pots-04', clear)).status).toBe(200);
    expect(await (await call(base)).json()).toMatchObject({ decisions: {
      'pots-04': { ...clear, revision: 4 },
      'pots-02': { rejectedClays: ['clay-zini'], revision: 1 },
    } });
  });
});

const shapes = base + '/shapes';
const shapePrefix = 'owner-review/' + account + '/yixing/shapes/v1/';
const shapeBase = {
  schemaVersion: 1, libraryVersion: 'test-library', forms: [{
    id: 'liufang', chinese: '六方壶', pinyin: 'liùfāng hú', silhouette: 'Faceted or geometric',
    exemplar: { asset: 'assets/old-reference.jpg', imageUrl: 'https://museum.example/old-reference.jpg' },
  }],
};
const jpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAFAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCfAJJ//9k=';
const example = {
  mode: 'example', formId: 'liufang', title: 'Source teapot', credit: 'Test museum',
  recordUrl: 'https://museum.example/objects/one', imageUrl: 'https://museum.example/photos/one.jpg',
  sourceType: 'Museum or exhibition', tradition: 'Yixing', notes: 'Six faces', photo: jpeg,
};

function shapeSetup() {
  const env = setup();
  env.objects.set(shapePrefix + 'library.json', JSON.stringify(shapeBase));
  env.objects.set(shapePrefix + 'media/old-reference.jpg', 'catalogue reference photo');
  return env;
}

function anotherPhoto(density: number) {
  const bytes = Buffer.from(jpeg, 'base64');
  bytes[15] = density; // JFIF pixel density. Every fixture remains a JPEG.
  return bytes.toString('base64');
}

describe('private Yixing shape library', () => {
  it('keeps the library, media and writes behind the exact owner guard', async () => {
    const { call } = shapeSetup();
    for (const [user, status] of [[null, 401], ['second-owner', 403], ['other-platform-owner', 403]] as const) {
      for (const [path, method] of [[shapes, 'GET'], [shapes, 'HEAD'], [shapes, 'POST'],
        [shapes + '/media/old-reference.jpg', 'GET'], [shapes + '/media/old-reference.jpg', 'HEAD']]) {
        const response = await call(path, user, method, method === 'POST' ? example : undefined);
        expect(response.status).toBe(status);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      }
    }
    expect(await (await call(shapes)).json()).toEqual(shapeBase);
    const head = await call(shapes, 'personal-owner', 'HEAD');
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const media = shapes + '/media/old-reference.jpg';
    const photo = await call(media);
    expect(photo.headers.get('Content-Type')).toBe('image/jpeg');
    expect(photo.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await photo.text()).toBe('catalogue reference photo');
    expect(await (await call(media, 'personal-owner', 'HEAD')).text()).toBe('');
    expect((await call(shapes + '/media/%2Fetc.jpg')).status).toBe(404);
    expect((await call('/api/atlas/' + shapePrefix + 'media/old-reference.jpg')).status).toBe(404);
    expect((await call('/api/media/' + shapePrefix + 'media/old-reference.jpg')).status).not.toBe(200);
  });

  it('adds a new form and an exemplar to the merged library with pending source review', async () => {
    const { call, objects } = shapeSetup();
    const form = {
      ...example, mode: 'form', chinese: '新方壶', pinyin: 'xīn fāng hú', silhouette: 'Faceted or geometric',
      profile: 'Upright square', notes: 'A source-backed comparison',
    };
    const saved = await call(shapes, 'personal-owner', 'POST', form);
    expect(saved.status).toBe(201);
    const { formId, asset } = await saved.json() as { formId: string; asset: string };
    expect(formId).toBe('xin-fang');
    expect(asset).toMatch(/^assets\/owner-[a-f0-9]{24}\.jpg$/);
    const media = shapes + '/media/' + asset.split('/')[1];
    expect(Buffer.from(await (await call(media)).arrayBuffer())).toEqual(Buffer.from(jpeg, 'base64'));
    expect((await call(media, null)).status).toBe(401);
    expect((await call(shapes, 'personal-owner', 'POST', {
      ...example, formId, title: 'Second example', imageUrl: 'https://museum.example/photos/two.jpg', photo: anotherPhoto(2),
    })).status).toBe(201);
    const merged = await (await call(shapes)).json() as any;
    expect(merged.forms[1]).toMatchObject({
      id: formId, chinese: '新方壶', features: { profile: 'Upright square', foot: 'Open' },
      exemplar: { asset, reviewStatus: 'Owner addition awaiting source review' },
      additionalExemplars: [{ title: 'Second example', reviewStatus: 'Owner addition awaiting source review' }],
    });
    const reserved = await call(shapes, 'personal-owner', 'POST', {
      ...form, chinese: '另一方壶', pinyin: 'add', imageUrl: 'https://museum.example/photos/three.jpg', photo: anotherPhoto(3),
    });
    expect(reserved.status).toBe(201);
    expect(await reserved.json()).toMatchObject({ formId: expect.stringMatching(/^add-[a-f0-9]{8}$/) });
    expect(JSON.parse(objects.get(shapePrefix + 'library.json') as string)).toEqual(shapeBase);
  });

  it('rejects invalid submissions and handles simultaneous duplicates without replacing an addition', async () => {
    const { call } = shapeSetup();
    const post = (overrides: object) => call(shapes, 'personal-owner', 'POST', { ...example, ...overrides });
    for (const change of [
      { photo: '/9j//9k=' }, { recordUrl: 'https://user:secret@museum.example/one' },
      { imageUrl: 'http://museum.example/one.jpg' }, { formId: 'missing' }, { sourceType: 'Unknown source' },
    ]) expect((await post(change)).status).toBe(400);
    expect((await post({ photo: 'a'.repeat(2_100_000) })).status).toBe(413);
    expect((await post({ imageUrl: shapeBase.forms[0].exemplar.imageUrl })).status).toBe(409);
    expect((await post({
      mode: 'form', chinese: '六方壺', pinyin: 'liù fāng hú', silhouette: 'Faceted or geometric',
    })).status).toBe(409);
    const saves = await Promise.all([post({}), post({ title: 'Overlapping retry' }),
      post({ imageUrl: 'https://museum.example/photos/two.jpg', photo: anotherPhoto(3) })]);
    expect(saves.map(response => response.status).sort()).toEqual([201, 201, 409]);
    expect((await post({ imageUrl: 'https://museum.example/photos/alternate.jpg' })).status).toBe(409);
    const merged = await (await call(shapes)).json() as any;
    expect(merged.forms[0].additionalExemplars).toHaveLength(2);
  });

  it('keeps a staged JPEG out of reads until a failed append can be retried', async () => {
    const { call, failedPuts, objects } = shapeSetup();
    const additionsKey = shapePrefix + 'additions.json';
    failedPuts.add(additionsKey);
    expect((await call(shapes, 'personal-owner', 'POST', example)).status).toBe(503);
    expect(await (await call(shapes)).json()).toEqual(shapeBase);
    const staged = [...objects.keys()].find(key => key.startsWith(shapePrefix + 'media/owner-'));
    expect(staged).toBeDefined();
    const media = shapes + '/media/' + staged!.split('/').pop();
    expect((await call(media)).status).toBe(404);
    failedPuts.delete(additionsKey);
    expect((await call(shapes, 'personal-owner', 'POST', example)).status).toBe(201);
    expect((await call(media)).status).toBe(200);
  });
});

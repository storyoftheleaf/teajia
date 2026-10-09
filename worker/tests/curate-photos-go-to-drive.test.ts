import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { savePhotosToDrive, driveSeal } from '../src/curateDrive';
import { curatePhotoTools } from '../src/mcpTools/curatePhotos';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * A Curate photo is kept in the shop's media store, which the app shows, and
 * copied into the shop's Google Drive, one folder per vendor and per tea, so
 * Adrian can open it on his computer and an agent can find it without the app.
 * Google is faked here; what is measured is what the shop asks it to do.
 */

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRqoAAAAASUVORK5CYII=';
const JWT = 'drive-secret';
const KEY = 'drive-seal-key-for-tests-only-0123456789';
const databases: SqliteD1[] = [];
type R = Record<string, any>;

class Bucket {
  objects = new Map<string, { bytes: Uint8Array; type: string }>();
  async put(key: string, body: any, opts?: any) {
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
    this.objects.set(key, { bytes, type: opts?.httpMetadata?.contentType ?? 'image/jpeg' });
  }
  async get(key: string) {
    const o = this.objects.get(key);
    return o ? { arrayBuffer: async () => o.bytes.buffer, httpMetadata: { contentType: o.type } } : null;
  }
}

/** Google, as far as the shop talks to it. Records every call. */
function fakeGoogle(opts: { refreshFails?: boolean } = {}) {
  const calls: Array<{ url: string; body?: string }> = [];
  let n = 0;
  const fetchMock = vi.fn(async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = init?.body == null ? undefined : typeof init.body === 'string' ? init.body : init.body instanceof URLSearchParams ? init.body.toString() : new TextDecoder().decode(init.body);
    calls.push({ url, body });
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      if (body?.includes('grant_type=refresh_token') && opts.refreshFails) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      return Response.json({ access_token: 'at-1', refresh_token: 'rt-secret-1', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.file openid email' });
    }
    if (url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')) return Response.json({ email: 'adrian@gmail.test' });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files')) return Response.json({ id: `folder-${++n}` });
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) return Response.json({ id: `file-${++n}`, webViewLink: `https://drive.google.com/file/d/file-${n}/view` });
    if (url.startsWith('https://pics.example/')) return new Response(Uint8Array.from(atob(PNG), char => char.charCodeAt(0)), { headers: { 'Content-Type': 'image/png' } });
    return new Response('not faked', { status: 599 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => { vi.unstubAllGlobals(); while (databases.length) databases.pop()!.close(); });

function setup() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: 'acc-shop', role: 'owner', bundles: ['catalog', 'gather', 'stock'] });
  seedIdentity(db, { userId: 'helper', accountId: 'acc-shop', role: 'staff', bundles: ['catalog', 'gather'] });
  const bucket = new Bucket();
  bucket.objects.set('accounts/acc-shop/products/p1.jpg', { bytes: new Uint8Array([9, 9]), type: 'image/jpeg' });
  db.sqlite.exec(`
    INSERT INTO tea_compass_entries (id, user_id, account_id, name, year, vendor_name, photos)
      VALUES ('e-1', 'adrian', 'acc-shop', 'Yiwu Gushu', 2019, 'Wang Laoshi', '["https://media.teajia.co/accounts/acc-shop/products/p1.jpg?v=1"]');
  `);
  const env = { DB: db as any, JWT_SECRET: JWT, KEY_ENCRYPTION_SECRET: KEY, GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csecret', MEDIA_BUCKET: bucket as any, APP_URL: 'https://app.test' } as any;
  return { db, env, bucket };
}

async function call(env: any, path: string, who: string, init: { method?: string; body?: unknown } = {}, execCtx?: any) {
  const token = await signedToken(JWT, { sub: who, email: `${who}@test.dev`, name: who, active_account_id: 'acc-shop', platform_role: null });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'acc-shop', 'Content-Type': 'application/json' });
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) }), env, execCtx);
}

async function connect(env: any) {
  const res = await call(env, '/api/curate/drive/connect', 'adrian', { method: 'POST', body: {} });
  const { url } = await res.json() as { url: string };
  const state = new URL(url).searchParams.get('state')!;
  return worker.fetch(new Request(`https://worker.test/api/auth/google/callback?code=c-1&state=${encodeURIComponent(state)}`), env);
}

describe("connecting the shop's Drive", () => {
  it('asks Google only for the files the shop makes, and only the owner may ask', async () => {
    const { env } = setup();
    const res = await call(env, '/api/curate/drive/connect', 'adrian', { method: 'POST', body: {} });
    const url = new URL(((await res.json()) as any).url);
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('scope')).not.toMatch(/auth\/drive( |$)/);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect((await call(env, '/api/curate/drive/connect', 'helper', { method: 'POST', body: {} })).status).toBe(403);
  });

  it('keeps the Drive key sealed, never as typed, and lands back in Curate', async () => {
    const { env, db } = setup();
    fakeGoogle();
    const back = await connect(env);
    expect(back.status).toBe(302);
    expect(back.headers.get('Location')).toBe('https://app.test/admin/compass/v2?drive=connected');
    const row = db.sqlite.prepare('SELECT * FROM curate_drive_links').get() as R;
    expect(row.google_email).toBe('adrian@gmail.test');
    expect(row.refresh_token_encrypted).not.toContain('rt-secret-1');
    expect(await driveSeal(env).decrypt(row.refresh_token_encrypted)).toBe('rt-secret-1');
    const status = await (await call(env, '/api/curate/drive', 'helper')).json() as R;
    expect(status).toMatchObject({ connected: true, email: 'adrian@gmail.test', needs_reconnect: false });
  });
});

describe('a photo on a Curate tea', () => {
  it('is copied into Teajia Curate / vendor / tea once, however often the tea is saved', async () => {
    const { env, db } = setup();
    const calls = fakeGoogle();
    await connect(env);
    expect(await savePhotosToDrive(env, driveSeal(env), 'acc-shop', 'e-1')).toBe(1);
    expect(await savePhotosToDrive(env, driveSeal(env), 'acc-shop', 'e-1')).toBe(0);
    const folders = calls.filter(c => c.url.startsWith('https://www.googleapis.com/drive/v3/files')).map(c => JSON.parse(c.body!).name);
    expect(folders).toEqual(['Teajia Curate', 'Wang Laoshi', 'Yiwu Gushu 2019']);
    expect(calls.filter(c => c.url.includes('/upload/drive/'))).toHaveLength(1);
    expect(db.sqlite.prepare('SELECT drive_file_id FROM curate_drive_files').all()).toHaveLength(1);
  });

  it('a second tea from the same vendor goes in the same vendor folder', async () => {
    const { env, db } = setup();
    const calls = fakeGoogle();
    await connect(env);
    db.sqlite.exec(`INSERT INTO tea_compass_entries (id, user_id, account_id, name, vendor_name, photos) VALUES ('e-2', 'adrian', 'acc-shop', 'Bulang', 'Wang Laoshi', '["https://media.teajia.co/accounts/acc-shop/products/p1.jpg"]')`);
    await savePhotosToDrive(env, driveSeal(env), 'acc-shop', 'e-1');
    await savePhotosToDrive(env, driveSeal(env), 'acc-shop', 'e-2');
    const folders = calls.filter(c => c.url.startsWith('https://www.googleapis.com/drive/v3/files')).map(c => JSON.parse(c.body!).name);
    expect(folders).toEqual(['Teajia Curate', 'Wang Laoshi', 'Yiwu Gushu 2019', 'Bulang']);
  });

  it('is saved to Drive after a sync, without holding up the save', async () => {
    const { env, db } = setup();
    fakeGoogle();
    await connect(env);
    const waits: Promise<unknown>[] = [];
    const execCtx = { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException() {} };
    const res = await call(env, '/api/compass/sync', 'adrian', { method: 'POST', body: { entries: [{ id: 'e-1', name: 'Yiwu Gushu', photos: ['https://media.teajia.co/accounts/acc-shop/products/p1.jpg?v=1'] }] } }, execCtx);
    expect(res.status).toBe(200);
    await Promise.all(waits);
    expect(db.sqlite.prepare('SELECT * FROM curate_drive_files').all()).toHaveLength(1);
  });

  it('when Google withdraws the link, the shop says reconnect instead of failing saves', async () => {
    const { env, db } = setup();
    fakeGoogle({ refreshFails: true });
    await connect(env);
    const waits: Promise<unknown>[] = [];
    const execCtx = { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException() {} };
    const res = await call(env, '/api/compass/sync', 'adrian', { method: 'POST', body: { entries: [{ id: 'e-1', name: 'Yiwu Gushu', photos: ['https://media.teajia.co/accounts/acc-shop/products/p1.jpg?v=1'] }] } }, execCtx);
    expect(res.status).toBe(200);
    await Promise.all(waits);
    expect((db.sqlite.prepare('SELECT last_error FROM curate_drive_links').get() as R).last_error).toBe('reconnect');
    expect(((await (await call(env, '/api/curate/drive', 'adrian')).json()) as R).needs_reconnect).toBe(true);
  });
});

describe('an agent adding a photo', () => {
  const auth = { accountId: 'acc-shop', userId: 'adrian', userEmail: 'a@test.dev', tokenId: 't', creatorTier: 'owner' } as any;

  it('previews a linked image then confirms it into private storage without public or Drive copying', async () => {
    const { env, db, bucket } = setup();
    const privateBucket = new Bucket(); env.ATLAS_BUCKET = privateBucket;
    const calls = fakeGoogle();
    await connect(env);
    const args = { tea_id: 'e-1', image_url: 'https://pics.example/label.png', role: 'label', filename: 'label.png' };
    const preview = await curatePhotoTools.handlers.curate_add_photo(env, auth, args) as R;
    expect(preview.confirmation_token).toBeTruthy();
    expect(privateBucket.objects.size).toBe(0);
    const result = await curatePhotoTools.handlers.curate_add_photo(env, auth, { ...args, confirm: preview.confirmation_token }) as R;
    expect(result.confirmed).toBe(true);
    expect(result.attachment).toMatchObject({ role: 'label', filename: 'label.png' });
    expect(privateBucket.objects.size).toBe(1);
    expect([...privateBucket.objects.keys()][0]).toMatch(/^curate\/attachments\/acc-shop\//);
    expect(bucket.objects.size).toBe(1);
    expect(calls.filter(call => call.url.includes('/upload/drive/') || call.url.includes('/drive/v3/files'))).toHaveLength(0);
    expect(JSON.parse((db.sqlite.prepare("SELECT photos FROM tea_compass_entries WHERE id='e-1'").get() as R).photos)).toHaveLength(1);
  });

  it('confirms a valid image privately even when Drive is not connected', async () => {
    const { env, db } = setup();
    const privateBucket = new Bucket(); env.ATLAS_BUCKET = privateBucket;
    const calls = fakeGoogle();
    const args = { tea_id: 'e-1', image_base64: PNG, mime_type: 'image/png', role: 'pricelist', filename: 'price-list.png' };
    const preview = await curatePhotoTools.handlers.curate_add_photo(env, auth, args) as R;
    expect(preview.confirmation_token).toBeTruthy();
    expect(privateBucket.objects.size).toBe(0);
    const result = await curatePhotoTools.handlers.curate_add_photo(env, auth, { ...args, confirm: preview.confirmation_token }) as R;
    expect(result.confirmed).toBe(true);
    expect(result.attachment).toMatchObject({ role: 'pricelist' });
    expect(privateBucket.objects.size).toBe(1);
    expect(calls).toHaveLength(0);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_drive_files').get()).toMatchObject({ n: 0 });
  });

  it('refuses nonimages and unauthorized shop targets before private storage is touched', async () => {
    const { env } = setup();
    const privateBucket = new Bucket(); env.ATLAS_BUCKET = privateBucket;
    fakeGoogle();
    await expect(curatePhotoTools.handlers.curate_add_photo(env, auth, { tea_id: 'e-1', image_base64: 'AAAA', mime_type: 'application/pdf' })).rejects.toThrow(/mime_type/);
    await expect(curatePhotoTools.handlers.curate_add_photo(env, { ...auth, accountId: 'acc-other' }, { tea_id: 'e-1', image_base64: PNG, mime_type: 'image/png' })).rejects.toThrow(/ownership|capability/i);
    expect(privateBucket.objects.size).toBe(0);
  });
});

describe('a photo that never left the phone', () => {
  it('makes no folders and copies nothing', async () => {
    const { env, db } = setup();
    const calls = fakeGoogle();
    await connect(env);
    db.sqlite.exec(`UPDATE tea_compass_entries SET photos = '["blob:https://www.teajia.com/403bf9d9"]' WHERE id = 'e-1'`);
    expect(await savePhotosToDrive(env, driveSeal(env), 'acc-shop', 'e-1')).toBe(0);
    expect(calls.filter(c => c.url.includes('googleapis.com/drive') || c.url.includes('/upload/drive/'))).toHaveLength(0);
  });
});

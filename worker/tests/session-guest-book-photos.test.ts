import { afterEach, describe, expect, it, vi } from 'vitest';
import { afterSitRoutes } from '../src/afterSitAccess';
import { servePublicRecapPhoto, serveRecapPhotoReview } from '../src/revocableSitPhotos';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

const photoId = '9dc818e0-c31e-44c5-94ec-c8014694fc1d';
const grantId = '17478d56-6370-44c1-ac4b-9bcd7068b14a';
const secondGrant = '48c2a3d5-7415-4305-aff2-ded94b97b011';
const description = 'Two cups beside a teapot';
const jpeg = Uint8Array.from([255, 216, 255, 192, 0, 7, 8, 0, 64, 0, 64, 255, 218, 0, 2, 36, 255, 217]);
const jpegObject = () => ({ size: jpeg.length, arrayBuffer: async () => jpeg.slice().buffer });
const issuePath = '/api/admin/events/:eventId/after-sit/:attendeeId';
const bookPath = '/api/after-sit/guest-book';
const reviewPath = '/api/admin/events/:eventId/guest-book/photos';
const ownerPath = '/api/me/personal-kept-setups/:eventId/photos/:photoId/guest-book';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

async function fixture() {
  const sql = new SqliteD1('migrations', '0116');
  databases.push(sql);
  const db = sql as unknown as D1Database;
  seedIdentity(sql, { userId: 'owner', accountId: 'shop' });
  seedIdentity(sql, { userId: 'viewer', accountId: 'shop' });
  seedIdentity(sql, { userId: 'outside', accountId: 'elsewhere' });
  sql.exec(`
    UPDATE users SET email_verified_at = '2026-11-23' WHERE id = 'viewer';
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status)
    VALUES ('event', 'shop', 'tea-sit', 'Tea session', '2026-11-20', 'completed', 'public', 'published'),
           ('other', 'elsewhere', 'other-sit', 'Other sit', '2026-11-20', 'completed', 'public', 'published');
    INSERT INTO event_post_session (id, account_id, event_id, session_notes)
    VALUES ('recap', 'shop', 'event', 'Host recap');
    INSERT INTO event_attendees (id, account_id, event_id, full_name, email, user_id, magic_token, status, attended)
    VALUES ('seat-owner', 'shop', 'event', 'Photo Guest', 'owner@test.dev', 'owner', 'maker-token', 'confirmed', 1),
           ('seat-viewer', 'shop', 'event', 'Viewer', 'viewer@test.dev', NULL, 'viewer-token', 'confirmed', 1),
           ('seat-other', 'elsewhere', 'other', 'Other', 'outside@test.dev', 'outside', 'outside-token', 'confirmed', 1);
    INSERT INTO private_kept_setups (account_id, user_id, event_id, event_title, event_date, teas_json, saved_at)
    VALUES ('shop', 'owner', 'event', 'Tea session', '2026-11-20', '[]', '2026-11-20');
    INSERT INTO private_kept_setup_photos (account_id, user_id, event_id, id, tea_id, object_key, created_at)
    VALUES ('shop', 'owner', 'event', '${photoId}', NULL, 'private-kept-setups/${photoId}.jpg', '2026-11-20');
  `);

  const get = vi.fn(async (_key: string) => jpegObject());
  const bucket = { get } as unknown as R2Bucket;
  const env = { DB: db, ATLAS_BUCKET: bucket };
  const routes = afterSitRoutes<typeof env>({
    requireHost: async req => {
      const accountId = req.headers.get('Test-Host');
      return accountId ? { accountId } : { error: new Response(null, { status: 403 }) };
    },
    requireUser: async req => {
      const userId = req.headers.get('Test-User');
      return userId ? { userId } : { error: new Response(null, { status: 401 }) };
    },
    limit: async () => null,
  });
  const request = (method: string, headers?: Record<string, string>, body?: object) =>
    new Request('https://teajia.test/', { method, headers, body: body && JSON.stringify(body) });
  async function call(method: string, route: string, headers?: Record<string, string>, body?: object, params = {}) {
    return routes.find(([verb, path]) => verb === method && route === path)![2](request(method, headers, body), env, params);
  }
  async function issue(attendeeId: string, accountId = 'shop', eventId = 'event') {
    return (await (await call('POST', issuePath, { 'Test-Host': accountId }, undefined, { attendeeId, eventId })).json()).credential as string;
  }
  const owner = await issue('seat-owner');
  const viewer = await issue('seat-viewer');
  const other = await issue('seat-other', 'elsewhere', 'other');
  const book = (user: string, credential: string, action: string, input?: object) =>
    call('POST', bookPath, { 'Test-User': user }, { credential, action, ...input });
  const offer = (id = grantId, alt = description) => book('owner', owner, 'photo-offer', { photoId, grantId: id, description: alt });
  const gallery = () => book('viewer', viewer, 'photos-read');
  const bytes = (id = grantId) => book('viewer', viewer, 'photo-bytes', { grantId: id });
  const review = (method = 'GET', body?: object, id?: string, shop = 'shop') =>
    call(method, id ? reviewPath + '/:grantId' : reviewPath, { 'Test-Host': shop }, body, { eventId: 'event', grantId: id });
  const include = (id = grantId) => review('PUT', { action: 'include', status: 'pending' }, id);
  const withdraw = (userId = 'owner') => call('DELETE', ownerPath, { 'Test-User': userId }, { grantId }, { eventId: 'event', photoId });
  return { sql, db, env, request, get, book, offer, gallery, bytes, include, review, withdraw, owner, viewer, other };
}

describe('formal attendee Guest Book photos', () => {
  it('limits the picker and gallery to the correct signed-in attendee, then serves only included photo bytes', async () => {
    const { book, gallery, bytes, include, offer, other, viewer, owner, review } = await fixture();
    expect((await book('', viewer, 'photos-read')).status).toBe(401);
    expect((await book('owner', viewer, 'photos-read')).status).toBe(403);
    expect((await book('outside', owner, 'photos-read')).status).toBe(403);
    expect((await book('viewer', viewer, 'private-photo-preview', { photoId })).status).toBe(404);
    expect((await book('owner', owner, 'private-photo-preview', { photoId })).status).toBe(200);
    expect(await (await gallery()).json()).toEqual({ gallery: [], own: [] });
    expect((await offer()).status).toBe(201);
    expect((await offer()).status).toBe(200);
    expect((await bytes()).status).toBe(404);
    expect((await review('GET', undefined, grantId, 'elsewhere')).status).toBe(404);
    expect((await review('GET', undefined, grantId)).status).toBe(200);
    expect((await include()).status).toBe(200);
    expect((await book('outside', other, 'photo-bytes', { grantId })).status).toBe(404);

    const list = await gallery();
    expect(list.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await list.json()).toEqual({ gallery: [{ id: grantId, alt_text: description, display_name: 'Photo Guest' }], own: [] });
    const image = await bytes();
    expect(image.headers.get('Content-Type')).toBe('image/jpeg');
    expect(image.headers.get('Cache-Control')).toBe('private, no-store');
    expect(image.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(jpeg);
  });

  it('separates attendee-only grants from public use and preserves the original on withdrawal after link expiry', async () => {
    const { sql, db, env, request, offer, bytes, include, withdraw, review } = await fixture();
    expect((await offer()).status).toBe(201);
    expect((await include()).status).toBe(200);
    expect(await (await servePublicRecapPhoto(request('GET'), db, env.ATLAS_BUCKET, 'tea-sit')).json()).toEqual({ photo: null });
    expect((await servePublicRecapPhoto(request('GET'), db, env.ATLAS_BUCKET, 'tea-sit', grantId)).status).toBe(404);
    expect((await serveRecapPhotoReview(request('GET'), db, env.ATLAS_BUCKET, { accountId: 'shop', userId: 'owner' }, 'event', grantId)).status).toBe(404);
    sql.exec("UPDATE after_sit_access SET expires_at = unixepoch() - 1 WHERE attendee_id = 'seat-owner'");
    expect((await withdraw('viewer')).status).toBe(404);
    expect((await withdraw()).status).toBe(200);
    expect((await bytes()).status).toBe(404);
    expect((await review('GET', undefined, grantId)).status).toBe(404);
    expect((await include()).status).toBe(409);
    expect(sql.sqlite.prepare('SELECT id FROM private_kept_setup_photos').get()).toEqual({ id: photoId });
  });

  it('derives accessible descriptions for whole-setup and exact-tea photos when the guest leaves it blank', async () => {
    const setup = await fixture();
    expect((await setup.offer(grantId, ' ')).status).toBe(201);
    expect((await setup.offer(grantId, '')).status).toBe(200);
    expect((await setup.include()).status).toBe(200);
    expect(await (await setup.gallery()).json()).toMatchObject({ gallery: [{ alt_text: 'Photo of the tea setup' }] });

    const tea = await fixture();
    tea.sql.exec(`
      UPDATE private_kept_setups SET teas_json = '[{"id":"tea-exact","name":"Wuyi rock tea"}]';
      UPDATE private_kept_setup_photos SET tea_id = 'tea-exact';
    `);
    expect((await tea.offer(grantId, '')).status).toBe(201);
    expect((await tea.include()).status).toBe(200);
    expect(await (await tea.gallery()).json()).toMatchObject({ gallery: [{ alt_text: 'Photo of Wuyi rock tea' }] });
  });

  it('rechecks seat, grant and source after storage I/O and rejects an old review after a fresh offer', async () => {
    const { sql, get, book, owner, offer, gallery, bytes, include } = await fixture();
    expect((await offer()).status).toBe(201);
    expect((await include()).status).toBe(200);
    get.mockImplementationOnce(async () => {
      sql.exec("UPDATE event_attendees SET attended = 0 WHERE id = 'seat-owner'");
      return jpegObject();
    });
    expect((await bytes()).status).toBe(404);
    expect((await (await gallery()).json()).gallery).toEqual([]);
    get.mockImplementationOnce(async () => {
      sql.exec("UPDATE event_attendees SET attended = 0 WHERE id = 'seat-viewer'");
      return jpegObject();
    });
    sql.exec("UPDATE event_attendees SET attended = 1 WHERE id = 'seat-owner'");
    expect((await bytes()).status).toBe(404);
    expect((await gallery()).status).toBe(404);
    expect((await book('owner', owner, 'photo-withdraw', { grantId })).status).toBe(404);

    const fresh = await fixture();
    expect((await fresh.offer()).status).toBe(201);
    expect((await fresh.book('owner', fresh.owner, 'photo-withdraw', { grantId })).status).toBe(200);
    expect((await fresh.offer(secondGrant)).status).toBe(201);
    expect((await fresh.include()).status).toBe(409);
    expect((await fresh.include(secondGrant)).status).toBe(200);
    expect((await fresh.review('PUT', { action: 'pass', status: 'included' }, secondGrant)).status).toBe(200);
    expect((await fresh.bytes(secondGrant)).status).toBe(404);
  });
});

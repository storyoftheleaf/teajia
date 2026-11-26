import { afterEach, describe, expect, it, vi } from 'vitest';
import { afterSitRoutes } from '../src/afterSitAccess';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

// The session gallery (Launch 3, J7): photographs from the table, seen only by
// people holding a seat link for this session, the taker named only by choice.
const jpeg = Uint8Array.from([255, 216, 255, 192, 0, 7, 8, 0, 64, 0, 64, 255, 218, 0, 2, 36, 255, 217]);
const photo = {
  mei: '9dc818e0-c31e-44c5-94ec-c8014694fc1d',
  sam: '83741bb3-4220-4d65-b10b-2f0727ea1b88',
  jo: 'c90b7b58-286e-420a-98ae-d28e275cd982',
  kai: '25c7cb2c-ba58-49f6-9aab-9edd5c3c4d76',
};
const grant = {
  mei: '17478d56-6370-44c1-ac4b-9bcd7068b14a',
  sam: '48c2a3d5-7415-4305-aff2-ded94b97b011',
  jo: '5948d330-2336-4726-8540-0b49c913adb1',
  kai: '6a1e4c55-3c1d-4b0a-9f4e-2d7b8e9c0a11',
};
const issuePath = '/api/admin/events/:eventId/after-sit/:attendeeId';
const partyPath = '/api/admin/events/:eventId/after-sit/:attendeeId/party';
const reviewPath = '/api/admin/events/:eventId/guest-book/photos/:grantId';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

async function fixture() {
  const sql = new SqliteD1('migrations');
  databases.push(sql);
  for (const userId of ['mei', 'sam', 'jo', 'kai', 'viewer', 'plus-one', 'stranger', 'elsewhere']) {
    seedIdentity(sql, { userId, accountId: 'shop' });
  }
  sql.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status)
    VALUES ('event', 'shop', 'sit', 'Tea session', '2026-11-20', 'completed'),
           ('later', 'shop', 'later', 'Later sit', '2026-11-21', 'completed');
    INSERT INTO event_attendees (id, account_id, event_id, full_name, email, user_id, magic_token, status, attended) VALUES
      ('seat-mei', 'shop', 'event', 'Mei Lin Chen', 'mei@test.dev', 'mei', 't-mei', 'confirmed', 1),
      ('seat-sam', 'shop', 'event', 'Sam Okafor', 'sam@test.dev', 'sam', 't-sam', 'confirmed', 1),
      ('seat-jo', 'shop', 'event', 'Jo Park', 'jo@test.dev', 'jo', 't-jo', 'confirmed', 1),
      ('seat-kai', 'shop', 'event', 'Kai Doe', 'kai@test.dev', 'kai', 't-kai', 'confirmed', 1),
      ('seat-viewer', 'shop', 'event', 'Viewer Booker', 'viewer@test.dev', 'viewer', 't-viewer', 'confirmed', 1),
      ('seat-later', 'shop', 'later', 'Elsewhere Guest', 'elsewhere@test.dev', 'elsewhere', 't-later', 'confirmed', 1);
  `);
  for (const user of ['mei', 'sam', 'jo', 'kai'] as const) {
    sql.sqlite.prepare(`INSERT INTO private_kept_setups (account_id, user_id, event_id, event_title, event_date, teas_json, saved_at)
      VALUES ('shop', ?, 'event', 'Tea session', '2026-11-20', '[]', '2026-11-20')`).run(user);
    sql.sqlite.prepare(`INSERT INTO private_kept_setup_photos (account_id, user_id, event_id, id, tea_id, object_key, created_at)
      VALUES ('shop', ?, 'event', ?, NULL, ?, '2026-11-20')`).run(user, photo[user], `private-kept-setups/${photo[user]}.jpg`);
  }

  const get = vi.fn(async () => ({ size: jpeg.length, arrayBuffer: async () => jpeg.slice().buffer }));
  const env = { DB: sql as unknown as D1Database, ATLAS_BUCKET: { get } as unknown as R2Bucket, ANYONE_HOSTS_OPEN: 'true' };
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
  async function call(method: string, path: string, headers: Record<string, string>, body?: object, params = {}) {
    const request = new Request('https://teajia.test/', { method, headers, body: body && JSON.stringify(body) });
    return routes.find(([verb, route]) => verb === method && route === path)![2](request, env, params);
  }
  const host = { 'Test-Host': 'shop' };
  async function issue(attendeeId: string, eventId = 'event') {
    return (await (await call('POST', issuePath, host, undefined, { attendeeId, eventId })).json()).credential as string;
  }
  const links = {
    mei: await issue('seat-mei'), sam: await issue('seat-sam'), jo: await issue('seat-jo'), kai: await issue('seat-kai'),
    viewer: await issue('seat-viewer'), later: await issue('seat-later', 'later'),
  };
  const party = (await (await call('POST', partyPath, host, { first_name: 'Ana' },
    { attendeeId: 'seat-viewer', eventId: 'event' })).json()).credential as string;

  const offer = (user: keyof typeof photo, extra: object = {}) => call('POST', '/api/after-sit/guest-book', { 'Test-User': user },
    { credential: links[user], action: 'photo-offer', photoId: photo[user], grantId: grant[user], ...extra });
  const include = (id: string) => call('PUT', reviewPath, host, { action: 'include', status: 'pending' }, { eventId: 'event', grantId: id });
  const gallery = (user: string, credential: string, body: object = { action: 'read' }) =>
    call('POST', '/api/after-sit/gallery', user ? { 'Test-User': user } : {}, { credential, ...body });
  const read = async (user: string, credential: string) => gallery(user, credential).then(response => response.json());
  return { sql, get, links, party, offer, include, gallery, read, call };
}

async function seated() {
  const f = await fixture();
  // Mei says her name may be shown; Sam says nothing (the default); Jo's stays pending;
  // Kai's is included and then withdrawn.
  expect((await f.offer('mei', { showName: true })).status).toBe(201);
  expect((await f.offer('sam')).status).toBe(201);
  expect((await f.offer('jo', { showName: true })).status).toBe(201);
  expect((await f.offer('kai', { showName: true })).status).toBe(201);
  f.sql.sqlite.prepare("UPDATE session_guest_book_photos SET offered_at = '2026-11-20T10:00:00Z' WHERE id = ?").run(grant.mei);
  f.sql.sqlite.prepare("UPDATE session_guest_book_photos SET offered_at = '2026-11-20T11:00:00Z' WHERE id = ?").run(grant.sam);
  for (const id of [grant.mei, grant.sam, grant.kai]) expect((await f.include(id)).status).toBe(200);
  expect((await f.call('POST', '/api/after-sit/guest-book', { 'Test-User': 'kai' },
    { credential: f.links.kai, action: 'photo-withdraw', grantId: grant.kai })).status).toBe(200);
  return f;
}

describe('session gallery', () => {
  it("shows other guests' included photographs newest first, never pending or withdrawn ones, named only when allowed", async () => {
    const { read, links } = await seated();
    const body = await read('viewer', links.viewer);
    expect(body).toEqual({
      photos: [
        { id: grant.sam, alt_text: 'Photo of the tea setup', taker_first_name: null, own: false },
        { id: grant.mei, alt_text: 'Photo of the tea setup', taker_first_name: 'Mei', own: false },
      ],
      can_add: true,
      waiting: false,
    });
    expect(JSON.stringify(body)).not.toMatch(/Chen|Lin|Okafor|Jo Park|Kai|user_id/);
  });

  it("marks the viewer's own photograph and whether one waits for the host", async () => {
    const { read, links } = await seated();
    expect((await read('mei', links.mei)).photos.map((p: { own: boolean }) => p.own)).toEqual([false, true]);
    expect(await read('jo', links.jo)).toMatchObject({ waiting: true, can_add: true });
  });

  it('opens for a personal party link with the same seat check as keeps, read only', async () => {
    const { read, party, gallery } = await seated();
    const body = await read('plus-one', party);
    expect(body.photos.map((p: { id: string }) => p.id)).toEqual([grant.sam, grant.mei]);
    expect(body.can_add).toBe(false);
    const image = await gallery('plus-one', party, { action: 'bytes', grantId: grant.mei });
    expect(image.status).toBe(200);
    expect(image.headers.get('Cache-Control')).toBe('private, no-store');
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(jpeg);
  });

  it('serves bytes only for included, current photographs', async () => {
    const { gallery, links } = await seated();
    expect((await gallery('viewer', links.viewer, { action: 'bytes', grantId: grant.sam })).status).toBe(200);
    expect((await gallery('viewer', links.viewer, { action: 'bytes', grantId: grant.jo })).status).toBe(404);
    expect((await gallery('viewer', links.viewer, { action: 'bytes', grantId: grant.kai })).status).toBe(404);
    expect((await gallery('viewer', links.viewer, { action: 'bytes', grantId: 'not-an-id' })).status).toBe(404);
  });

  it('a withdrawn photograph leaves the gallery at once', async () => {
    const { read, links, call } = await seated();
    expect((await call('POST', '/api/after-sit/guest-book', { 'Test-User': 'mei' },
      { credential: links.mei, action: 'photo-withdraw', grantId: grant.mei })).status).toBe(200);
    expect((await read('viewer', links.viewer)).photos.map((p: { id: string }) => p.id)).toEqual([grant.sam]);
  });

  it('a link for another session reads nothing of this one', async () => {
    const { read, gallery, links } = await seated();
    expect(await read('elsewhere', links.later)).toEqual({ photos: [], can_add: true, waiting: false });
    expect((await gallery('elsewhere', links.later, { action: 'bytes', grantId: grant.mei })).status).toBe(404);
  });

  it('a stranger reads nothing: no link, a made-up link, a revoked link, or not signed in', async () => {
    const { gallery, links, party, call } = await seated();
    expect((await gallery('stranger', '')).status).toBe(404);
    expect((await gallery('stranger', 'a'.repeat(64))).status).toBe(404);
    expect((await gallery('stranger', 'a'.repeat(64), { action: 'bytes', grantId: grant.mei })).status).toBe(404);
    expect((await gallery('', links.viewer)).status).toBe(401);
    expect((await call('DELETE', issuePath, { 'Test-Host': 'shop' }, undefined, { attendeeId: 'seat-viewer', eventId: 'event' })).status).toBe(200);
    expect((await gallery('viewer', links.viewer)).status).toBe(404);
    expect((await gallery('plus-one', party)).status).toBe(404);
  });

  it('stores the name choice at offer time, not shown by default, and refuses a non-boolean', async () => {
    const { sql, offer } = await fixture();
    expect((await offer('mei', { showName: 'yes' })).status).toBe(400);
    expect((await offer('mei')).status).toBe(201);
    expect(sql.sqlite.prepare('SELECT show_name FROM session_guest_book_photos WHERE id = ?').get(grant.mei)).toEqual({ show_name: 0 });
    // An exact retry is fine; the same grant with a different choice is a conflict.
    expect((await offer('mei')).status).toBe(200);
    expect((await offer('mei', { showName: true })).status).toBe(409);
  });

  it('guest book photos-read gives other guests the first name only when allowed', async () => {
    const { call, links } = await seated();
    const body = await (await call('POST', '/api/after-sit/guest-book', { 'Test-User': 'viewer' },
      { credential: links.viewer, action: 'photos-read' })).json();
    const names = Object.fromEntries(body.gallery.map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]));
    expect(names).toEqual({ [grant.mei]: 'Mei', [grant.sam]: null });
  });
});

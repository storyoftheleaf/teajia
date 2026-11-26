import { afterEach, describe, expect, it, vi } from 'vitest';
import { serveKeptSetupPhotos } from '../src/privateKeptSetupPhotos';
import { publicSitPhotoJpeg } from '../src/revocableSitPhotoJpeg';
import { serveOwnerSitPhotoPermission, servePublicRecapPhoto, serveRecapPhotoReview } from '../src/revocableSitPhotos';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(database => database.close()));

const sourceBytes = new Uint8Array([
  0xff, 0xd8,                   // Start of image
  0xff, 0xed, 0x00, 0x06, 1, 2, 3, 4, // APP13 metadata
  0xff, 0xc0, 0x00, 0x07, 8, 0x00, 64, 0x00, 64, // 64 × 64 frame
  0xff, 0xda, 0x00, 0x02, 0x24, 0xff, 0x00, 0x35, // Scan with a stuffed byte
  0xff, 0xfe, 0x00, 0x05, 5, 6, 7, // Comment between scans
  0xff, 0xda, 0x00, 0x02, 0x46, 0xff, 0xd0, 0x57, // Scan with a restart marker
  0xff, 0xd9,                   // End of image
]);
const strippedBytes = new Uint8Array([
  ...sourceBytes.subarray(0, 2), ...sourceBytes.subarray(10, 27), ...sourceBytes.subarray(34),
]);
const grant = '17478d56-6370-44c1-ac4b-9bcd7068b14a';
const anotherGrant = '48c2a3d5-7415-4305-aff2-ded94b97b011';
const placement = { alt_text: 'A small teapot and two cups on a wood table', observation: 'We shared the last pour.' };
const request = (method = 'GET', body?: object, surface?: 'brewing' | 'essay') =>
  new Request('https://teajia.test/' + (surface ? '?placement=' + surface : ''), {
  method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
});

function fixture() {
  const sql = new SqliteD1('migrations', '0133'); // 0133: the owner's hide of a recap (A4 review, finding 2)
  databases.push(sql);
  const db = sql as unknown as D1Database;
  const owner = seedIdentity(sql, { userId: 'guest', accountId: 'shop', role: 'viewer' });
  const editor = seedIdentity(sql, { userId: 'editor', accountId: 'shop' });
  const otherShop = seedIdentity(sql, { userId: 'other', accountId: 'outside' });
  sql.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status)
    VALUES ('sit', 'shop', 'the-sit', 'This Sit', '2026-11-12T05:00:00Z', 'completed', 'public', 'published'),
           ('other', 'outside', 'the-other-sit', 'Other Sit', '2026-11-12T05:00:00Z', 'completed', 'public', 'published');
    INSERT INTO event_post_session (id, account_id, event_id, session_notes, gallery_images)
    VALUES ('recap', 'shop', 'sit', 'Host recap', '["https://fixture.test/legacy.jpg"]');
    INSERT INTO event_attendees (id, event_id, account_id, full_name, user_id, status, attended, magic_token)
    VALUES ('guest-seat', 'sit', 'shop', 'Private Fixture Guest', 'guest', 'confirmed', 1, 'private-fixture-token');
    INSERT INTO private_kept_setups (account_id, user_id, event_id, event_title, event_date, teas_json, saved_at)
    VALUES ('shop', 'guest', 'sit', 'This Sit', '2026-11-12T05:00:00Z', '[]', '2026-11-13T05:00:00Z');
    INSERT INTO private_kept_setup_photos (account_id, user_id, event_id, id, tea_id, object_key, created_at)
    VALUES ('shop', 'guest', 'sit', 'our-photo', NULL, 'private-kept-setups/9dc818e0-c31e-44c5-94ec-c8014694fc1d.jpg', '2026-11-13T05:00:00Z'),
           ('shop', 'guest', 'sit', 'second-photo', NULL, 'private-kept-setups/9dc818e0-c31e-44c5-94ec-c8014694fc1e.jpg', '2026-11-13T05:00:00Z'),
           ('shop', 'guest', 'sit', 'tea-photo', 'tea', 'private-kept-setups/9dc818e0-c31e-44c5-94ec-c8014694fc1f.jpg', '2026-11-13T05:00:00Z');
  `);
  const get = vi.fn(async (_key: string) => ({
    size: sourceBytes.length, arrayBuffer: async () => sourceBytes.slice().buffer, body: new Response(sourceBytes).body,
  }));
  const remove = vi.fn(async () => {});
  const bucket = { get, delete: remove } as unknown as R2Bucket;
  const permission = (method = 'GET', body?: object, identity = owner, photoId = 'our-photo') =>
    serveOwnerSitPhotoPermission(request(method, body), db, identity, 'sit', photoId);
  const review = (method = 'GET', body?: object, identity = editor, grantId?: string) =>
    serveRecapPhotoReview(request(method, body), db, bucket, identity, 'sit', grantId);
  const publicRead = (grantId?: string, slug = 'the-sit', method = 'GET', surface?: 'brewing' | 'essay') =>
    servePublicRecapPhoto(request(method, undefined, surface), db, bucket, slug, grantId);
  const original = (method = 'GET', identity = owner) =>
    serveKeptSetupPhotos(request(method), db, bucket, identity, 'sit', 'our-photo');
  const offer = (id = grant, photoId = 'our-photo') => permission('PUT', { id, credit: 'Fixture Photo Credit' }, owner, photoId);
  const approve = (id = grant) => review('PUT', placement, editor, id);
  return { sql, owner, editor, otherShop, permission, review, publicRead, original, offer, approve, get, remove };
}

describe('public recap photo permission', () => {
  it('offers an exact private source, publishes signed-out credit and bytes, and withdraws both together', async () => {
    const { sql, editor, otherShop, permission, review, publicRead, original, offer, approve, get, remove } = fixture();
    expect(await (await permission()).json()).toEqual({ eligible: true, permission: null });
    expect((await original('GET', editor)).status).toBe(404);
    expect((await permission('PUT', { id: grant, credit: 'Not the owner' }, editor)).status).toBe(409);
    expect((await publicRead(grant)).status).toBe(404);
    expect(get).not.toHaveBeenCalled();

    expect((await offer()).status).toBe(201);
    expect((await offer()).status).toBe(200);
    expect(await (await publicRead()).json()).toEqual({ photo: null });
    expect((await publicRead(grant)).status).toBe(404);
    expect((await review('GET', undefined, otherShop, grant)).status).toBe(404);
    expect(await (await review()).json()).toEqual({ published: true, permissions: [
      { id: grant, credit: 'Fixture Photo Credit', status: 'offered' },
    ] });
    const preview = await review('GET', undefined, editor, grant);
    expect(new Uint8Array(await preview.arrayBuffer())).toEqual(strippedBytes);

    expect((await approve()).status).toBe(200);
    expect((await approve()).status).toBe(200);
    const publicProjection = await publicRead();
    expect(publicProjection.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await publicProjection.json()).toEqual({ photo: { id: grant, credit: 'Fixture Photo Credit', ...placement } });
    expect((await publicRead(grant, 'the-other-sit')).status).toBe(404);
    const direct = await publicRead(grant);
    expect(direct.headers.get('Content-Type')).toBe('image/jpeg');
    expect(direct.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(new Uint8Array(await direct.arrayBuffer())).toEqual(strippedBytes);
    const head = await publicRead(grant, 'the-sit', 'HEAD');
    expect(head.status).toBe(200);
    expect(await head.arrayBuffer()).toHaveProperty('byteLength', 0);

    expect((await permission('DELETE', { id: grant }, editor)).status).toBe(404);
    expect((await permission('DELETE', { id: grant })).status).toBe(200);
    expect((await permission('DELETE', { id: grant })).status).toBe(200);
    expect(await (await publicRead()).json()).toEqual({ photo: null });
    const denied = await publicRead(grant);
    expect(denied.status).toBe(404);
    expect(denied.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await publicRead(grant, 'the-sit', 'HEAD')).status).toBe(404);
    expect((await review('GET', undefined, editor, grant)).status).toBe(404);
    expect((await offer()).status).toBe(409);
    expect(new Uint8Array(await (await original()).arrayBuffer())).toEqual(sourceBytes);
    expect(remove).not.toHaveBeenCalled();
    const legacy = sql.sqlite.prepare('SELECT gallery_images FROM event_post_session WHERE event_id = ?').get('sit');
    expect(legacy?.gallery_images).toBe('["https://fixture.test/legacy.jpg"]');
  });

  it('uses the exact served tea name and only opens extra placements with explicit permission', async () => {
    const { sql, owner, editor, permission, review, publicRead, offer, approve } = fixture();
    sql.exec(`
      UPDATE event_post_session SET tea_ledger = '{"served_teas":[{"id":"tea","name":"Spring Shui Xian","source":"chest","source_id":"private-chest-id"}]}' WHERE event_id = 'sit';
    `);
    const tea = { id: 'tea', name: 'Spring Shui Xian' };
    expect(await (await permission('GET', undefined, owner, 'tea-photo')).json()).toEqual({ eligible: true, permission: null });
    expect((await offer(grant, 'tea-photo')).status).toBe(201);
    expect((await approve()).status).toBe(200);
    expect(await (await publicRead()).json()).toEqual({
      photo: { id: grant, credit: 'Fixture Photo Credit', ...placement, tea },
    });
    for (const surface of ['brewing', 'essay'] as const) {
      expect(await (await publicRead(undefined, 'the-sit', 'GET', surface)).json()).toEqual({ photo: null });
      expect((await publicRead(grant, 'the-sit', 'GET', surface)).status).toBe(404);
    }
    // A replay of an old permission ID cannot expand its audience.
    const publicGrant = { id: grant, credit: 'Fixture Photo Credit', canShowInBrewing: true };
    expect((await permission('PUT', publicGrant, owner, 'tea-photo')).status).toBe(409);
    expect((await permission('DELETE', { id: grant }, owner, 'tea-photo')).status).toBe(200);
    const extraGrant = { ...publicGrant, id: anotherGrant };
    expect((await permission('PUT', extraGrant, owner, 'tea-photo')).status).toBe(201);
    expect((await permission('PUT', extraGrant, owner, 'tea-photo')).status).toBe(200);
    expect(await (await review('GET', undefined, editor)).json()).toEqual({ published: true, permissions: [
      { ...extraGrant, status: 'offered', tea },
    ] });
    expect((await approve(anotherGrant)).status).toBe(200);
    for (const surface of ['brewing', 'essay'] as const) {
      expect(await (await publicRead(undefined, 'the-sit', 'GET', surface)).json()).toEqual({
        photo: { ...extraGrant, ...placement, tea },
      });
      expect((await publicRead(anotherGrant, 'the-sit', 'GET', surface)).status).toBe(200);
    }
    sql.exec(`UPDATE event_post_session SET tea_ledger = '{"served_teas":[]}' WHERE event_id = 'sit'`);
    expect(await (await publicRead()).json()).toEqual({ photo: null });
    expect((await publicRead(anotherGrant, 'the-sit', 'HEAD', 'essay')).status).toBe(404);
  });

  it('checks current attendance, publication and host visibility before returning the placement and direct bytes', async () => {
    const { sql, owner, permission, publicRead, offer, approve } = fixture();
    expect((await permission('PUT', { id: grant, credit: 'Tea photo' }, owner, 'tea-photo')).status).toBe(409);
    sql.exec("UPDATE event_attendees SET attended = 0 WHERE id = 'guest-seat'");
    expect((await offer()).status).toBe(409);
    sql.exec("UPDATE event_attendees SET attended = 1 WHERE id = 'guest-seat'");
    expect((await offer()).status).toBe(201);
    sql.exec("UPDATE events SET recap_status = 'draft' WHERE id = 'sit'");
    expect((await approve()).status).toBe(409);
    sql.exec("UPDATE events SET recap_status = 'published' WHERE id = 'sit'");
    expect((await approve()).status).toBe(200);

    for (const [disqualify, restore] of [
      ["UPDATE event_attendees SET attended = 0 WHERE id = 'guest-seat'", "UPDATE event_attendees SET attended = 1 WHERE id = 'guest-seat'"],
      ["UPDATE event_attendees SET user_id = NULL WHERE id = 'guest-seat'", "UPDATE event_attendees SET user_id = 'guest' WHERE id = 'guest-seat'"],
      ["UPDATE events SET lifecycle_status = 'cancelled' WHERE id = 'sit'", "UPDATE events SET lifecycle_status = 'completed' WHERE id = 'sit'"],
      ["UPDATE events SET recap_status = 'draft' WHERE id = 'sit'", "UPDATE events SET recap_status = 'published' WHERE id = 'sit'"],
      ["UPDATE events SET public_visibility = 'unlisted' WHERE id = 'sit'", "UPDATE events SET public_visibility = 'public' WHERE id = 'sit'"],
      ["UPDATE accounts SET public_enabled = 0 WHERE id = 'shop'", "UPDATE accounts SET public_enabled = 1 WHERE id = 'shop'"],
      // The platform owner's hide takes the recap's photograph with it (A4 review, finding 2).
      ["UPDATE events SET tea_table_hidden_at = datetime('now') WHERE id = 'sit'", "UPDATE events SET tea_table_hidden_at = NULL WHERE id = 'sit'"],
      ["UPDATE event_post_session SET account_id = 'outside' WHERE event_id = 'sit'", "UPDATE event_post_session SET account_id = 'shop' WHERE event_id = 'sit'"],
    ]) {
      sql.exec(disqualify);
      expect(await (await publicRead()).json()).toEqual({ photo: null });
      expect((await publicRead(grant)).status).toBe(404);
      sql.exec(restore);
      expect((await publicRead(grant)).status).toBe(200);
    }
  });

  it('keeps one current selection, lets a new version use the same source, and blocks deletion and withdrawal races', async () => {
    const { permission, offer, approve, publicRead, original, get, remove } = fixture();
    expect((await offer()).status).toBe(201);
    expect((await approve()).status).toBe(200);
    expect((await offer(anotherGrant, 'second-photo')).status).toBe(201);
    expect((await approve(anotherGrant)).status).toBe(409);
    get.mockImplementationOnce(async () => {
      await permission('DELETE', { id: grant });
      return { size: sourceBytes.length, arrayBuffer: async () => sourceBytes.slice().buffer, body: new Response(sourceBytes).body };
    });
    expect((await publicRead(grant)).status).toBe(404);
    expect((await approve(grant)).status).toBe(404);

    const newVersion = '17fc9b06-8851-4de1-9b93-69fb207359a7';
    expect((await offer(newVersion)).status).toBe(201);
    expect((await approve(newVersion)).status).toBe(200);
    expect((await permission('DELETE', { id: grant })).status).toBe(200);
    expect((await publicRead(grant)).status).toBe(404);
    expect((await publicRead(newVersion)).status).toBe(200);
    expect((await original('DELETE')).status).toBe(200);
    expect(remove).toHaveBeenCalledOnce();
    expect((await publicRead(newVersion)).status).toBe(404);
    expect(await (await publicRead()).json()).toEqual({ photo: null });
    expect((await approve(anotherGrant)).status).toBe(200);
  });
});

it('strips JPEG application segments and comments from between scans and refuses trailing bytes', () => {
  expect(publicSitPhotoJpeg(sourceBytes)).toEqual(strippedBytes);
  expect(publicSitPhotoJpeg(new Uint8Array([...sourceBytes, 1, 2, 3, 0xff, 0xd9]))).toBeNull();
});

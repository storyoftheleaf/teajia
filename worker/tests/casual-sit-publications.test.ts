import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casualSitPublicationRoutes } from '../src/casualSitPublications';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const sourceBytes = new Uint8Array([
  0xff, 0xd8, // Start of image
  0xff, 0xed, 0x00, 0x06, 1, 2, 3, 4, // APP13 metadata
  0xff, 0xc0, 0x00, 0x07, 8, 0x00, 64, 0x00, 64, // Frame
  0xff, 0xda, 0x00, 0x02, 0x24, 0xff, 0x00, 0x35, // Scan
  0xff, 0xd9, // End of image
]);
const rendition = new Uint8Array([...sourceBytes.subarray(0, 2), ...sourceBytes.subarray(10)]);
const hostPhotoKey = 'private-kept-setups/9dc818e0-c31e-44c5-94ec-c8014694fc1d.jpg';
const otherPhotoKey = 'private-kept-setups/9dc818e0-c31e-44c5-94ec-c8014694fc1e.jpg';
const memberRoute = '/api/me/private-sits/:id/publication';
const peopleRoute = '/api/people/:slug/casual-sits';
const detailRoute = '/api/casual-sits/:slug';
const photoRoute = '/api/casual-sits/:slug/photo/:photoId';
const draft = {
  title: 'Tea after the market', writing: 'We let the water cool between the last two pours.',
  teaName: 'Old Tree Red', linkShopTea: false, photo: null,
};
const photo = { id: 'host-private-photo-id', alt: 'Two cups on the table', confirmed: true };

let database: SqliteD1;
beforeEach(() => {
  database = new SqliteD1('migrations');
  seedIdentity(database, { userId: 'shop-operator', accountId: 'shop' });
  database.exec(`
    INSERT INTO users (id, name, email, password_hash)
    VALUES ('host', 'Host secret email name', 'host@example.test', 'test'),
           ('guest', 'Invitee identity', 'guest@example.test', 'test');
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
    VALUES ('person-host', 'shop', 'host', 'Host Public Name', 1),
           ('person-guest', 'shop', 'guest', 'Other Public Name', 1);
    INSERT INTO products (id, account_id, product_name, type, is_public, shown_in_shop)
    VALUES ('public-product', 'shop', 'Old Tree Red', 'Red', 1, 1),
           ('private-product', 'shop', 'Old Tree Red', 'Red', 0, 1);
    INSERT INTO member_private_sits (id, owner_user_id, request_id, sit_date, title, description, tea_id, tea_name)
    VALUES ('private-sit-id', 'host', 'once', '2026-11-22', 'Private title', 'Private description', 'public-product', 'Old Tree Red'),
           ('newer-sit-id', 'host', 'once2', '2026-11-23', 'Another private title', 'Private description', 'private-product', 'Old Tree Red');
    INSERT INTO member_private_sit_notes (sit_id, user_id, note)
    VALUES ('private-sit-id', 'host', 'private host note'), ('private-sit-id', 'guest', 'private guest note');
    INSERT INTO member_private_sit_invites (token_hash, sit_id, expires_at, accepted_by_user_id)
    VALUES ('secret-invitation', 'private-sit-id', unixepoch() + 8600, 'guest');
    INSERT INTO private_member_sit_photos (sit_id, user_id, id, object_key, created_at, share_id)
    VALUES ('private-sit-id', 'host', 'host-private-photo-id', '${hostPhotoKey}', datetime(), NULL),
           ('private-sit-id', 'guest', 'guest-private-photo-id', '${otherPhotoKey}', datetime(), 'private-shared-photo');
  `);
});
afterEach(() => database.close());

function fixture() {
  const get = vi.fn(async (_key: string) => ({
    size: sourceBytes.length, arrayBuffer: async () => sourceBytes.slice().buffer,
  }));
  const env = { DB: database as unknown as D1Database, ATLAS_BUCKET: { get } as unknown as R2Bucket };
  const routes = casualSitPublicationRoutes({
    shopAccountId: 'shop',
    requireUser: async request => {
      const userId = request.headers.get('actor');
      return userId ? { userId } : { error: new Response(null, { status: 401 }) };
    },
  });
  const fetchRoute = (method: string, path: string, params: Record<string, string> = {}, body?: object, actor?: string) => {
    const handler = routes.find(([verb, pattern]) => verb === method && pattern === path)?.[2];
    if (!handler) throw new Error('Route was not found');
    return handler(new Request('https://teajia.test' + path, {
      method, headers: actor ? { actor } : {}, body: body ? JSON.stringify(body) : undefined,
    }), env, params);
  };
  const own = (method = 'GET', body?: object, actor = 'host', id = 'private-sit-id') =>
    fetchRoute(method, memberRoute, { id }, body, actor);
  const publish = async (body = draft) => {
    const response = await own('PUT', body);
    expect(response.status).toBe(200);
    return (await response.json()).publication.slug as string;
  };
  const profile = (slug = 'person-host') => fetchRoute('GET', peopleRoute, { slug });
  const detail = (slug: string) => fetchRoute('GET', detailRoute, { slug });
  const photoBytes = (slug: string, photoId: string, method = 'GET') => fetchRoute(method, photoRoute, { slug, photoId });
  return { fetchRoute, own, publish, profile, detail, photoBytes, get };
}

describe('a member publishes a casual sit', () => {
  it('requires the host’s own published profile, and needs no management memberships', async () => {
    const { fetchRoute, own, publish, profile } = fixture();
    expect((await fetchRoute('GET', memberRoute, { id: 'private-sit-id' })).status).toBe(401);
    for (const actor of ['guest', 'shop-operator']) {
      expect((await own('GET', undefined, actor)).status).toBe(404);
      expect((await own('PUT', draft, actor)).status).toBe(404);
      expect((await own('DELETE', undefined, actor)).status).toBe(404);
    }
    database.exec("UPDATE contributors SET is_published = 0 WHERE user_id = 'host'");
    expect((await (await own()).json()).profile).toBeNull();
    expect((await own('PUT', draft)).status).toBe(409);
    database.exec("UPDATE contributors SET is_published = 1 WHERE user_id = 'host'");
    const slug = await publish();
    expect(await (await profile()).json()).toMatchObject({ recaps: [{ slug, title: draft.title }] });
    expect(database.sqlite.prepare("SELECT id FROM account_members WHERE user_id = 'host'").all()).toEqual([]);
    expect(database.sqlite.prepare('SELECT id FROM events').all()).toEqual([]);
    expect(database.sqlite.prepare('SELECT id FROM tasting_sessions').all()).toEqual([]);
  });

  it('projects only explicitly published fields in date order and checks current visibility at each public door', async () => {
    const { own, publish, profile, detail } = fixture();
    const slug = await publish({ ...draft, linkShopTea: true });
    expect((await own('PUT', { ...draft, linkShopTea: true }, 'host', 'newer-sit-id')).status).toBe(409);
    const later = await own('PUT', { ...draft, title: 'A later sit' }, 'host', 'newer-sit-id');
    expect(later.status).toBe(200);
    const newest = (await later.json()).publication.slug;
    const response = await profile();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { recaps } = await response.json();
    expect(recaps.map((row: { slug: string }) => row.slug)).toEqual([newest, slug]);
    expect(recaps[1]).toEqual({
      slug, title: draft.title, writing: draft.writing, date: '2026-11-22',
      tea: { name: draft.teaName, productId: 'public-product' },
      // No shop reader here, so the shop tea resolves without a listing or price.
      teas: [expect.objectContaining({ kind: 'tea', id: null, name: draft.teaName, href: null })],
      host: { slug: 'person-host', name: 'Host Public Name' }, photo: null,
    });
    expect(await (await detail(slug)).json()).toEqual({ recap: recaps[1] });
    expect(await (await profile('person-guest')).json()).toEqual({ recaps: [] });
    database.exec("UPDATE products SET shown_in_shop = 0 WHERE id = 'public-product'");
    expect((await (await detail(slug)).json()).recap.tea).toEqual({ name: draft.teaName, productId: null });
    database.exec("UPDATE contributors SET is_published = 0 WHERE user_id = 'host'");
    expect((await detail(slug)).status).toBe(404);
    expect(await (await profile()).json()).toEqual({ recaps: [] });
    expect((await own('DELETE')).status).toBe(200);
    database.exec("UPDATE contributors SET is_published = 1 WHERE user_id = 'host'");
    expect((await detail(slug)).status).toBe(404);
  });

  it('accepts a photo-only recap after consent and derives contextual alt text from the public title', async () => {
    const { own, publish, detail } = fixture();
    expect((await own('PUT', { ...draft, writing: ' ' })).status).toBe(400);
    expect((await own('PUT', { ...draft, writing: '', photo: { ...photo, confirmed: false } })).status).toBe(400);
    const slug = await publish({ ...draft, writing: '', photo: { id: photo.id, confirmed: true } });
    expect((await (await detail(slug)).json()).recap).toMatchObject({
      title: draft.title, writing: '', photo: { alt: `Photo from ${draft.title}` },
    });
  });

  it('publishes only a separately authorized host photo and revokes previously issued byte URLs', async () => {
    const { own, publish, detail, profile, photoBytes, get } = fixture();
    expect((await own('PUT', { ...draft, photo: { ...photo, confirmed: false } })).status).toBe(400);
    for (const id of ['guest-private-photo-id', 'private-shared-photo']) {
      expect((await own('PUT', { ...draft, photo: { ...photo, id } })).status).toBe(409);
    }
    expect(get).not.toHaveBeenCalled();
    const slug = await publish({ ...draft, photo });
    const old = (await (await detail(slug)).json()).recap.photo;
    expect(old).toEqual({ id: expect.not.stringMatching(/host-private-photo-id/), alt: photo.alt });
    expect((await photoBytes(slug, photo.id)).status).toBe(404);
    expect((await photoBytes('other-recap', old.id)).status).toBe(404);
    const response = await photoBytes(slug, old.id);
    expect(response.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(rendition);
    expect((await (await photoBytes(slug, old.id, 'HEAD')).arrayBuffer()).byteLength).toBe(0);
    database.exec("UPDATE contributors SET is_published = 0 WHERE user_id = 'host'");
    expect((await photoBytes(slug, old.id)).status).toBe(404);
    database.exec("UPDATE contributors SET is_published = 1 WHERE user_id = 'host'");
    const original = database.sqlite.prepare("SELECT object_key FROM private_member_sit_photos WHERE user_id = 'host'").get();
    expect(await publish()).toBe(slug);
    expect((await (await profile()).json()).recaps[0].photo).toBeNull();
    expect((await photoBytes(slug, old.id)).status).toBe(404);
    expect(database.sqlite.prepare("SELECT object_key FROM private_member_sit_photos WHERE user_id = 'host'").get()).toEqual(original);
    expect(await publish({ ...draft, photo })).toBe(slug);
    const current = (await (await detail(slug)).json()).recap.photo.id;
    expect(current).not.toBe(old.id);
    expect((await photoBytes(slug, old.id)).status).toBe(404);
    get.mockImplementationOnce(async () => {
      database.exec("DELETE FROM private_member_sit_photos WHERE id = 'host-private-photo-id'");
      return { size: sourceBytes.length, arrayBuffer: async () => sourceBytes.slice().buffer };
    });
    expect((await photoBytes(slug, current)).status).toBe(404);
    database.exec(`INSERT INTO private_member_sit_photos (sit_id, user_id, id, object_key, created_at)
      VALUES ('private-sit-id', 'host', 'host-private-photo-id', '${hostPhotoKey}', datetime())`);
    expect((await (await detail(slug)).json()).recap.photo).toBeNull();
    expect((await photoBytes(slug, current, 'HEAD')).status).toBe(404);
    expect((await own('DELETE')).status).toBe(200);
    expect((await detail(slug)).status).toBe(404);
    expect(await publish({ ...draft, photo })).not.toBe(slug);
  });
});

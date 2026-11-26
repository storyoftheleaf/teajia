import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const secret = 'synthetic-host-review-secret';
const nextId = (number: number) => `17478d56-6370-44c1-ac4b-${String(number).padStart(12, '0')}`;
const anonymous = nextId(1);
const named = nextId(2);
const other = nextId(3);
const revoked = nextId(4);
const root = '/api/me/tables/ana-table/guest-book';
const jpeg = Uint8Array.from([255, 216, 255, 192, 0, 7, 8, 0, 64, 0, 64, 255, 218, 0, 2, 36, 255, 217]);
const getPhoto = vi.fn(async () => ({ size: jpeg.length, arrayBuffer: async () => jpeg.slice().buffer }));
let db: SqliteD1;

beforeEach(() => {
  db = new SqliteD1('migrations');
  getPhoto.mockClear();
  for (const host of ['ana', 'bo']) {
    seedIdentity(db, { userId: host, accountId: `${host}-home`, publicEnabled: false });
    db.sqlite.prepare("UPDATE users SET host_approved_at = '2026-11-20' WHERE id = ?").run(host);
    db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id, personal_inventory_user_id, host_approved_at)
      VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-20')`).run(`${host}-personal`, `${host}-personal`, host, host, host);
    db.sqlite.prepare("INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')")
      .run(`${host}-personal`, host);
    db.sqlite.prepare(`INSERT INTO events (id, slug, account_id, host_user_id, title, event_date, lifecycle_status)
      VALUES (?, ?, ?, ?, ?, '2026-11-20', 'completed')`).run(`${host}-table`, `${host}-table`, `${host}-personal`, host, host);
  }
  seedIdentity(db, { userId: 'guest', accountId: 'guest-home', publicEnabled: false });
  for (const host of ['ana', 'bo']) {
    const scope = [`${host}-personal`, `${host}-table`];
    db.sqlite.prepare(`INSERT INTO event_attendees (account_id, event_id, id, full_name, magic_token, status, attended, user_id)
      VALUES (?, ?, ?, 'Mei Guest', ?, 'confirmed', 1, 'guest')`).run(...scope, `${host}-seat`, `${host}-magic`);
    db.sqlite.prepare(`INSERT INTO session_guest_book (account_id, event_id, id, attendee_id, user_id, note, status, updated_at)
      VALUES (?, ?, ?, ?, 'guest', ?, 'included', '2026-11-20')`).run(...scope, `${host}-note`, `${host}-seat`, `Thanks, ${host}.`);
    db.sqlite.prepare(`INSERT INTO private_kept_setups (account_id, event_id, user_id, event_title, event_date, teas_json, saved_at)
      VALUES (?, ?, 'guest', 'Tea session', '2026-11-20', '[]', '2026-11-20')`).run(...scope);
  }
  for (const photo of [
    { grant: anonymous, index: 11, host: 'ana', showName: 0, revokedAt: null },
    { grant: named, index: 12, host: 'ana', showName: 1, revokedAt: null },
    { grant: revoked, index: 13, host: 'ana', showName: 1, revokedAt: '2026-11-21' },
    { grant: other, index: 14, host: 'bo', showName: 1, revokedAt: null },
  ]) {
    const { host, grant, index, showName, revokedAt } = photo;
    const scope = [`${host}-personal`, `${host}-table`];
    const source = nextId(index);
    db.sqlite.prepare(`INSERT INTO private_kept_setup_photos (account_id, event_id, user_id, id, object_key, created_at)
      VALUES (?, ?, 'guest', ?, ?, '2026-11-20')`).run(...scope, source, `private-kept-setups/${source}.jpg`);
    db.sqlite.prepare(`INSERT INTO session_guest_book_photos
      (account_id, event_id, user_id, id, attendee_id, photo_id, alt_text, status, offered_at, show_name, revoked_at)
      VALUES (?, ?, 'guest', ?, ?, ?, 'Tea on the table', 'included', '2026-11-20', ?, ?)`)
      .run(...scope, grant, `${host}-seat`, source, showName, revokedAt);
  }
});

afterEach(() => db.close());

async function call(path: string, options: {
  actor?: string; method?: string; body?: object; open?: boolean; fewHosts?: boolean;
} = {}) {
  const { actor = 'ana', method = 'GET', body, open = true, fewHosts = true } = options;
  const token = await signedToken(secret, { sub: actor, role: 'user' });
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: secret, APP_URL: 'https://hosts.test', ATLAS_BUCKET: { get: getPhoto },
    ANYONE_HOSTS_OPEN: String(open), FEW_HOSTS_OPEN: String(fewHosts),
    AFTER_SIT_LIMITER: { limit: async () => ({ success: true }) },
  } as never);
}

const noteReview = (action: 'include' | 'pass') => ({ method: 'POST', body: { action, revision: 1 } });
const photoReview = (action: 'include' | 'pass', status = 'included') => ({ method: 'PUT', body: { action, status } });

describe('guest book review for a hosted table', () => {
  it('lists only offered items from the host’s table and only credits a consenting photographer', async () => {
    const response = await call(root);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ entries: [expect.objectContaining({ id: 'ana-note', note: 'Thanks, ana.' })] });

    const photos = await call(root + '/photos');
    expect(photos.status).toBe(200);
    expect(await photos.json()).toEqual({ photos: [
      { id: anonymous, display_name: null, alt_text: 'Tea on the table', status: 'included' },
      { id: named, display_name: 'Mei', alt_text: 'Tea on the table', status: 'included' },
    ] });
    const preview = await call(root + '/photos/' + anonymous);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('Cache-Control')).toBe('private, no-store');
    expect(new Uint8Array(await preview.arrayBuffer())).toEqual(jpeg);
    expect((await call(root + '/photos/' + revoked)).status).toBe(404);
    expect((await call(root + '/photos/' + other)).status).toBe(404);
  });

  it('hides and restores visibility without changing a contribution or reaching another table', async () => {
    expect((await call(root + '/bo-note/review', noteReview('pass'))).status).toBe(409);
    expect((await call(root + '/photos/' + other, photoReview('pass'))).status).toBe(409);
    expect((await call(root + '/photos/' + revoked, photoReview('include'))).status).toBe(409);

    const issue = await call('/api/me/tables/ana-table/guests/ana-seat/thanks-link', { method: 'POST' });
    expect(issue.status).toBe(200);
    const { credential } = await issue.json() as { credential: string };
    const guestRead = (path: string) => call('/api/after-sit/' + path, {
      actor: 'guest', method: 'POST', body: { action: 'read', credential },
    });
    const preview = () => call('/api/after-sit/gallery', {
      actor: 'guest', method: 'POST', body: { action: 'bytes', credential, grantId: anonymous },
    });

    expect((await call(root + '/ana-note/review', noteReview('pass'))).status).toBe(200);
    expect((await call(root + '/photos/' + anonymous, photoReview('pass'))).status).toBe(200);
    expect(await (await guestRead('guest-book')).json()).toMatchObject({ entries: [] });
    expect(await (await guestRead('gallery')).json()).toMatchObject({ photos: [expect.objectContaining({ id: named })] });
    expect((await preview()).status).toBe(404);
    expect((await call(root + '/photos/' + anonymous)).status).toBe(200);

    expect((await call(root + '/ana-note/review', noteReview('include'))).status).toBe(200);
    expect((await call(root + '/photos/' + anonymous, photoReview('include', 'passed'))).status).toBe(200);
    expect(await (await guestRead('guest-book')).json()).toMatchObject({ entries: [expect.objectContaining({ id: 'ana-note' })] });
    expect(await (await guestRead('gallery')).json()).toMatchObject({ photos: [
      expect.objectContaining({ id: anonymous, taker_first_name: null }),
      expect.objectContaining({ id: named, taker_first_name: 'Mei' }),
    ] });
    expect((await preview()).status).toBe(200);
  });

  it.each([{ actor: 'bo' }, { open: false }, { fewHosts: false }])('returns 404 on every route for %j', async options => {
    expect((await call(root, options)).status).toBe(404);
    expect((await call(root + '/photos', options)).status).toBe(404);
    expect((await call(root + '/photos/' + named, options)).status).toBe(404);
    expect((await call(root + '/ana-note/review', { ...noteReview('pass'), ...options })).status).toBe(404);
    expect((await call(root + '/photos/' + named, { ...photoReview('pass'), ...options })).status).toBe(404);
    expect(getPhoto).not.toHaveBeenCalled();
    expect(db.sqlite.prepare("SELECT status FROM session_guest_book WHERE id = 'ana-note'").get()).toEqual({ status: 'included' });
  });
});

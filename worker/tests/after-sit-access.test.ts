import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { afterSitRoutes } from '../src/afterSitAccess';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

type Env = { DB: D1Database };
let db: SqliteD1;

const routes = afterSitRoutes<Env>({
  requireHost: async request => {
    const accountId = request.headers.get('Test-Host');
    return accountId ? { accountId } : { error: new Response(null, { status: 403 }) };
  },
  requireUser: async request => {
    const userId = request.headers.get('Test-User');
    return userId ? { userId } : { error: new Response(null, { status: 401 }) };
  },
  limit: async () => null,
});
const issuePath = '/api/admin/events/:eventId/after-sit/:attendeeId';
const recapPath = '/api/after-sit/recap';
const setupPath = '/api/after-sit/setup';

async function call(method: string, path: string, headers: Record<string, string> = {}, body?: unknown,
  params: Record<string, string> = {}) {
  const route = routes.find(([verb, pattern]) => verb === method && pattern === path);
  if (!route) return new Response(null, { status: 404 });
  const request = new Request(`https://teajia.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  // The Launch 1 additions are checked in first-table-contract.test.ts; this file keeps the closed shape.
  return route[2](request, { DB: db as unknown as D1Database, FIRST_TABLE_OPEN: 'false' } as never, params);
}

async function issue(attendeeId = 'attendee', accountId = 'shop-a', eventId = 'event-a') {
  return call('POST', issuePath, { 'Test-Host': accountId }, undefined, { attendeeId, eventId });
}

async function newCredential() {
  const response = await issue();
  expect(response.status).toBe(200);
  const data = await response.json() as { credential: string; expires_at: string };
  expect(data.credential).toMatch(/^[a-f0-9]{64}$/);
  expect(Date.parse(data.expires_at)).toBeGreaterThan(Date.now());
  return data.credential;
}

const recap = (credential: string) => call('POST', recapPath, {}, { credential });
const save = (credential: string, userId?: string, action = 'save', selectedShop?: string) =>
  call('POST', setupPath, {
    ...(userId ? { 'Test-User': userId } : {}),
    ...(selectedShop ? { 'X-Teajia-Account': selectedShop } : {}),
  }, { credential, action });

beforeEach(() => {
  db = new SqliteD1('migrations', '0128');
  seedIdentity(db, { userId: 'guest', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'different', accountId: 'shop-b' });
  seedIdentity(db, { userId: 'duplicate', accountId: 'shop-a' });
  db.exec(`
    UPDATE users SET email_verified_at = '2026-11-23' WHERE id IN ('guest', 'duplicate');
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status) VALUES
      ('event-a', 'shop-a', 'one', 'Tea evening', '2026-11-22', 'completed'),
      ('event-b', 'shop-b', 'two', 'Other shop sit', '2026-11-22', 'completed'),
      ('event-next', 'shop-a', 'next', 'Next sit', '2026-11-22', 'published');
    INSERT INTO event_attendees (id, account_id, event_id, full_name, email, phone_number, magic_token, status, attended) VALUES
      ('attendee', 'shop-a', 'event-a', 'Guest Full Name', 'guest@test.dev', '+15550001000', 'legacy-token', 'confirmed', 1),
      ('no-show', 'shop-a', 'event-a', 'No Show', 'duplicate@test.dev', null, 'no-show-token', 'confirmed', 0),
      ('other', 'shop-b', 'event-b', 'Other Shop', null, null, 'other-token', 'confirmed', 1),
      ('future', 'shop-a', 'event-next', 'Future', null, null, 'future-token', 'confirmed', 1);
    INSERT INTO event_tea_menu (id, account_id, event_id, custom_name, custom_description, brew_order, reveal_date) VALUES
      ('second-tea', 'shop-a', 'event-a', 'Red tea', 'Private memo', 2, null),
      ('first-tea', 'shop-a', 'event-a', 'White tea', null, 1, null),
      ('future-tea', 'shop-a', 'event-a', 'Unrevealed tea', null, 3, '2099-01-01'),
      ('other-tea', 'shop-b', 'event-a', 'Cross-shop tea', null, 4, null);
    INSERT INTO event_attendee_recaps (event_id, account_id, session_notes) VALUES
      ('event-a', 'shop-a', 'A quiet evening with two teas.');
    INSERT INTO event_post_session (event_id, account_id, session_notes, host_notes, gallery_images) VALUES
      ('event-a', 'shop-a', 'Draft recap', 'Host diary', '["private-photo"]');
  `);
});

afterEach(() => db.close());

describe('after-sit access', () => {
  it('opens only the approved recap after an explicit POST and leaves attendance, private saves and link untouched', async () => {
    const credential = await newCredential();
    const before = db.sqlite.prepare('SELECT * FROM after_sit_access').get();
    expect(before?.credential_hash).not.toBe(credential);
    expect((await call('GET', recapPath)).status).toBe(404);
    expect((await call('GET', setupPath)).status).toBe(404);
    const response = await recap(credential);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(await response.json()).toEqual({
      event: { id: 'event-a', title: 'Tea evening', event_date: '2026-11-22' },
      host_note: 'A quiet evening with two teas.',
      teas: [{ id: 'first-tea', name: 'White tea', path: null }, { id: 'second-tea', name: 'Red tea', path: null }],
      // Launch 1 additions: nothing set, nothing shown; no thanks_ref or kept while the flag is off.
      playlist_url: null,
      reading: null,
    });
    expect(db.sqlite.prepare('SELECT * FROM after_sit_access').get()).toEqual(before);
    expect(db.sqlite.prepare("SELECT user_id FROM event_attendees WHERE id = 'attendee'").get()).toEqual({ user_id: null });
    expect(db.sqlite.prepare('SELECT count(*) AS count FROM private_kept_setups').get()).toEqual({ count: 0 });
  });

  it('shares only the recorded served tea names and IDs and keeps existing snapshots independent', async () => {
    const credential = await newCredential();
    expect((await save(credential, 'guest')).status).toBe(200);
    db.exec(`
      UPDATE event_post_session SET tea_ledger = '{"served_teas":[{"id":"actual-chest-tea","name":"Stored White","source":"chest","source_id":"private-chest-ref"},{"id":"actual-shop-tea","name":"Poured Red","source":"shop","source_id":"private-stock-ref","shop_slug":"shop-a"}]}' WHERE event_id = 'event-a';
    `);
    expect(await (await recap(credential)).json()).toMatchObject({
      teas: [{ id: 'actual-chest-tea', name: 'Stored White' }, { id: 'actual-shop-tea', name: 'Poured Red' }],
    });
    expect((await save(credential, 'guest')).status).toBe(200);
    expect(db.sqlite.prepare('SELECT teas_json FROM private_kept_setups').get()).toEqual({
      teas_json: '[{"id":"first-tea","name":"White tea"},{"id":"second-tea","name":"Red tea"}]',
    });
  });

  it('requires the gather account and the exact confirmed attended seat of a completed sit', async () => {
    const params = { attendeeId: 'attendee', eventId: 'event-a' };
    expect((await call('POST', issuePath, {}, undefined, params)).status).toBe(403);
    expect((await issue('attendee', 'shop-b')).status).toBe(404);
    expect((await issue('other', 'shop-a', 'event-b')).status).toBe(404);
    expect((await issue('no-show')).status).toBe(404);
    expect((await issue('future', 'shop-a', 'event-next')).status).toBe(404);
    expect((await issue('attendee', 'shop-a', 'event-next')).status).toBe(404);
    expect((await issue()).status).toBe(200);
  });

  it('keeps every copied link working until expiry, explicit revocation or attendance correction', async () => {
    const expired = await newCredential();
    db.exec('UPDATE after_sit_access SET expires_at = unixepoch() - 1');
    expect((await recap(expired)).status).toBe(404);
    // Copying the link again adds one; the link the guest already has keeps working.
    const first = await newCredential();
    const active = await newCredential();
    expect((await recap(first)).status).toBe(200);
    expect((await recap(active)).status).toBe(200);
    db.exec('UPDATE after_sit_extra_access SET expires_at = unixepoch() - 1');
    expect((await recap(active)).status).toBe(404);
    expect((await recap(first)).status).toBe(200);
    const again = await newCredential();
    expect((await recap(again)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM after_sit_extra_access').get()).toEqual({ n: 1 });
    const params = { attendeeId: 'attendee', eventId: 'event-a' };
    expect((await call('DELETE', issuePath, { 'Test-Host': 'shop-b' }, undefined, params)).status).toBe(404);
    expect((await call('DELETE', issuePath, { 'Test-Host': 'shop-a' }, undefined, params)).status).toBe(200);
    for (const link of [first, again]) {
      expect((await recap(link)).status).toBe(404);
      expect((await save(link, 'guest')).status).toBe(404);
    }

    const corrected = await newCredential();
    const correctedCopy = await newCredential();
    db.exec("UPDATE event_attendees SET attended = 0 WHERE id = 'attendee'");
    db.exec("UPDATE event_attendees SET attended = 1 WHERE id = 'attendee'");
    expect((await recap(corrected)).status).toBe(404);
    expect((await save(corrected, 'guest')).status).toBe(404);
    expect((await recap(correctedCopy)).status).toBe(404);
  });

  it('keeps a leaked link, an old management token, wrong identity, and duplicate contact away from private saves', async () => {
    const credential = await newCredential();
    expect((await recap('legacy-token')).status).toBe(404);
    expect((await save('legacy-token', 'guest')).status).toBe(404);
    expect((await save(credential)).status).toBe(401);
    expect((await save(credential, 'different')).status).toBe(403);
    expect((await save(credential, 'different', 'status')).status).toBe(403);
    expect((await save(credential, 'different', 'remove')).status).toBe(403);
    db.exec("UPDATE event_attendees SET email = 'guest@test.dev' WHERE id = 'no-show'");
    expect((await save(credential, 'guest')).status).toBe(403);
    expect(db.sqlite.prepare('SELECT count(*) AS count FROM private_kept_setups').get()).toEqual({ count: 0 });
  });

  it('connects one save to the verified attendee, with owner access across shops and no rebinding on status', async () => {
    const credential = await newCredential();
    expect(await (await save(credential, 'guest', 'status')).json()).toEqual({ saved: false });
    expect(db.sqlite.prepare("SELECT user_id FROM event_attendees WHERE id = 'attendee'").get()).toEqual({ user_id: null });
    const saved = await (await save(credential, 'guest')).json();
    expect(saved).toMatchObject({ saved: true, can_add_photos: true });
    expect(await (await save(credential, 'guest')).json()).toEqual(saved);
    expect(await (await save(credential, 'guest', 'status', 'shop-b')).json()).toMatchObject({ saved: true, can_add_photos: true });
    expect((await save(credential, 'different', 'status')).status).toBe(403);
    expect(db.sqlite.prepare('SELECT user_id, event_id, account_id FROM private_kept_setups').all())
      .toEqual([{ user_id: 'guest', event_id: 'event-a', account_id: 'shop-a' }]);
    expect(await (await save(credential, 'guest', 'remove')).json()).toEqual({ saved: false });
    expect(db.sqlite.prepare('SELECT count(*) AS count FROM private_kept_setups').get()).toEqual({ count: 0 });
  });
});

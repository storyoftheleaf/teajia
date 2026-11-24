import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const BALI = 'acc_teajia_bali';
const OTHER = 'other-store';
const PUBLIC = '/api/public/connected-sit-demo';
const OWNER = '/api/admin/events/connected-sit-demo';
const SECRET = 'demo-routes-test-only';
let db: SqliteD1;

async function request(method: string, path: string, actor?: { userId: string; accountId: string }) {
  const headers = new Headers();
  if (actor) {
    headers.set('X-Teajia-Account', actor.accountId);
    headers.set('Authorization', 'Bearer ' + await signedToken(SECRET, {
      sub: actor.userId,
      active_account_id: actor.accountId,
    }));
  }
  return worker.fetch(
    new Request('https://teajia.test' + path, { method, headers }),
    { DB: db, JWT_SECRET: SECRET } as unknown as Parameters<typeof worker.fetch>[1],
  );
}

beforeEach(() => {
  db = new SqliteD1('migrations', '0117');
  seedIdentity(db, { userId: 'bali-owner', accountId: BALI });
  seedIdentity(db, { userId: 'bali-staff', accountId: BALI, role: 'staff', bundles: ['gather', 'publish'] });
  seedIdentity(db, { userId: 'other-owner', accountId: OTHER });
  db.exec(`INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status)
    VALUES ('existing-sit', 'acc_teajia_bali', 'existing-sit', 'Existing sit', '2026-11-20', 'completed', 'public', 'published')`);
});

afterEach(() => db.close());

describe('connected sit demo availability and removal', () => {
  it('serves fresh public and owner status and persists removal without changing the session', async () => {
    const owner = { userId: 'bali-owner', accountId: BALI };
    for (const [verb, path, actor] of [['GET', PUBLIC], ['POST', PUBLIC], ['GET', OWNER, owner]] as const) {
      const response = await request(verb, path, actor);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({ available: true });
    }

    const removed = await request('DELETE', OWNER, owner);
    expect(removed.status).toBe(200);
    expect(removed.headers.get('Cache-Control')).toBe('no-store');
    expect(await removed.json()).toEqual({ available: false });
    expect(await (await request('GET', OWNER, owner)).json()).toEqual({ available: false });

    for (const verb of ['GET', 'POST']) {
      const status = await request(verb, PUBLIC);
      expect(status.status).toBe(404);
      expect(status.headers.get('Cache-Control')).toBe('no-store');
      expect(await status.json()).toEqual({ available: false });
    }

    expect((await request('DELETE', OWNER, owner)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT feature, enabled, enabled_by FROM account_features WHERE account_id = ?').all(BALI))
      .toEqual([{ feature: 'connected_sit_demo', enabled: 0, enabled_by: 'bali-owner' }]);
    expect(db.sqlite.prepare('SELECT title, lifecycle_status, recap_status FROM events WHERE id = ?').get('existing-sit'))
      .toEqual({ title: 'Existing sit', lifecycle_status: 'completed', recap_status: 'published' });
  });

  it('denies anonymous users, Bali staff and owners of other accounts', async () => {
    for (const method of ['GET', 'DELETE']) {
      const anonymous = await request(method, OWNER);
      expect(anonymous.status).toBe(401);
      expect(anonymous.headers.get('Cache-Control')).toBe('no-store');
      expect((await request(method, OWNER, { userId: 'bali-staff', accountId: BALI })).status).toBe(403);
      expect((await request(method, OWNER, { userId: 'other-owner', accountId: OTHER })).status).toBe(404);
      expect((await request(method, OWNER, { userId: 'other-owner', accountId: BALI })).status).toBe(403);
    }
    expect((await request('GET', PUBLIC)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT enabled FROM account_features WHERE account_id = ?').all(BALI)).toEqual([]);
  });

  it('keeps the default demo unavailable when the Bali shop is private or suspended', async () => {
    db.sqlite.prepare('UPDATE accounts SET public_enabled = 0 WHERE id = ?').run(BALI);
    expect((await request('GET', PUBLIC)).status).toBe(404);
    db.sqlite.prepare("UPDATE accounts SET public_enabled = 1, status = 'suspended' WHERE id = ?").run(BALI);
    const status = await request('POST', PUBLIC);
    expect(status.status).toBe(404);
    expect(await status.json()).toEqual({ available: false });
  });
});

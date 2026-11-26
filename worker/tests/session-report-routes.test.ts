import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

// The three report routes (Launch 3, J5): closed with the flag off, anyone may
// file, only the platform owner reads and resolves, and the reporter is never
// in the owner's list.
const SECRET = 'session-report-routes-secret';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed() {
  const db = new SqliteD1('migrations'); databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', platformRole: 'platform_owner' });
  seedIdentity(db, { userId: 'guest', accountId: 'other' });
  db.sqlite.exec(`INSERT INTO events (id, account_id, slug, title, event_date, status, total_capacity)
    VALUES ('sit', 'shop', 'sit', 'Evening tea', '2026-12-01', 'active', 8)`);
  return db;
}

async function call(db: SqliteD1, method: string, path: string, opts: { user?: string; body?: object; open?: boolean } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (opts.user) headers.set('Authorization', `Bearer ${await signedToken(SECRET, { sub: opts.user, email: `${opts.user}@test.dev` })}`);
  return worker.fetch(new Request(`https://worker.test${path}`, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined }),
    { DB: db, JWT_SECRET: SECRET, PROVIDER_LIMITER: { limit: async () => ({ success: true }) }, ANYONE_HOSTS_OPEN: opts.open === false ? 'false' : 'true' } as never,
    { waitUntil: () => undefined } as never);
}

describe('session report routes', () => {
  it('answer 404 while the launch is closed', async () => {
    const db = seed();
    expect((await call(db, 'POST', '/api/session-reports', { body: { target_kind: 'session', target_id: 'sit' }, open: false })).status).toBe(404);
    expect((await call(db, 'GET', '/api/admin/session-reports', { user: 'owner', open: false })).status).toBe(404);
  });

  it('let anyone file, and only the owner read and resolve, without the reporter', async () => {
    const db = seed();
    expect((await call(db, 'POST', '/api/session-reports', { user: 'guest', body: { target_kind: 'session', target_id: 'sit', reason: 'Odd' } })).status).toBe(201);
    expect((await call(db, 'POST', '/api/session-reports', { body: { target_kind: 'session', target_id: 'nothing' } })).status).toBe(404);
    expect((await call(db, 'GET', '/api/admin/session-reports', { user: 'guest' })).status).toBe(403);
    const listed = await call(db, 'GET', '/api/admin/session-reports', { user: 'owner' });
    expect(listed.status).toBe(200);
    const text = await listed.text();
    const { reports } = JSON.parse(text) as { reports: Array<{ id: string; label: string }> };
    expect(reports).toHaveLength(1);
    expect(reports[0].label).toBe('Evening tea');
    expect(text).not.toContain('guest');
    expect((await call(db, 'POST', `/api/admin/session-reports/${reports[0].id}/resolve`, { user: 'guest', body: { status: 'acted' } })).status).toBe(403);
    const resolved = await call(db, 'POST', `/api/admin/session-reports/${reports[0].id}/resolve`, { user: 'owner', body: { status: 'acted' } });
    expect(resolved.status).toBe(200);
    expect(db.sqlite.prepare('SELECT status, resolved_by FROM session_reports').get()).toEqual({ status: 'acted', resolved_by: 'owner' });
  });
});

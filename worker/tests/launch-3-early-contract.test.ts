import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Launch 3's early contract: the contribution line on a session, and the reports table.
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const secret = 'launch-3-early';

async function setup() {
  const db = new SqliteD1('migrations'); databases.push(db);
  seedIdentity(db, { userId: 'host', accountId: 'shop', bundles: ['gather'] });
  db.sqlite.exec(`
    UPDATE accounts SET public_enabled = 1, status = 'active' WHERE id = 'shop';
    INSERT INTO events (id, account_id, slug, title, event_date, status, public_visibility, total_capacity)
    VALUES ('sit', 'shop', 'courtyard', 'Tea in the courtyard', '2026-12-01T18:00', 'active', 'unlisted', 8);
  `);
  const token = await signedToken(secret, { sub: 'host', email: 'host@test.dev', active_account_id: 'shop', role: 'owner' });
  const send = async (path: string, method = 'GET', body?: unknown) => worker.fetch(new Request(`https://app.test${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: secret } as never, { waitUntil: () => undefined } as never);
  return { db, send };
}

describe('Launch 3 early contract', () => {
  it('saves the contribution line and shows it on the public answer', async () => {
    const { send } = await setup();
    const saved = await send('/api/admin/events/sit', 'PUT', { contribution_kind: 'contribution', contribution_note: '  Bring what you like  ' });
    expect(saved.status, await saved.clone().text()).toBeLessThan(300);
    const body = await (await send('/api/events/courtyard/public')).json() as Record<string, unknown>;
    expect(body).toMatchObject({ contribution_kind: 'contribution', contribution_note: 'Bring what you like' });
    expect((await send('/api/admin/events/sit', 'PUT', { contribution_kind: null, contribution_note: '' })).status).toBeLessThan(300);
    expect(await (await send('/api/events/courtyard/public')).json()).toMatchObject({ contribution_kind: null, contribution_note: null });
  });

  it('refuses an unknown kind and a note over 140 characters', async () => {
    const { send } = await setup();
    expect((await send('/api/admin/events/sit', 'PUT', { contribution_kind: 'tips' })).status).toBe(400);
    expect((await send('/api/admin/events/sit', 'PUT', { contribution_note: 'x'.repeat(141) })).status).toBe(400);
  });

  it('has the reports table with its checks', async () => {
    const { db } = await setup();
    db.sqlite.prepare("INSERT INTO session_reports (id, target_kind, target_id) VALUES ('r1', 'session', 'sit')").run();
    expect(() => db.sqlite.prepare("INSERT INTO session_reports (id, target_kind, target_id) VALUES ('r2', 'shop', 'x')").run()).toThrow();
    expect(db.sqlite.prepare("SELECT status FROM session_reports WHERE id = 'r1'").get()).toEqual({ status: 'open' });
  });
});

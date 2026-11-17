import { expect, it, vi } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

it.each(['successive', 'concurrent'] as const)('preserves the first structured completion across %s calls and member reopen', async (mode) => {
  const db = new SqliteD1();
  const secret = 'structured-completion-fixture';
  const host = seedIdentity(db, { userId: 'host', accountId: 'fixture-shop' });
  const guest = seedIdentity(db, { userId: 'guest', accountId: 'fixture-shop', role: 'viewer', bundles: [] });
  db.exec(`
    INSERT INTO tasting_sessions (id, account_id, created_by_user_id, invite_token, created_at)
    VALUES ('session', 'fixture-shop', 'host', 'fixture-invite', '2026-11-17T01:00:00.000Z');
    INSERT INTO tasting_session_members (id, session_id, user_id, joined_at)
    VALUES ('member', 'session', 'guest', '2026-11-17T01:01:00.000Z');
    INSERT INTO tasting_session_teas (id, session_id, tea_name)
    VALUES ('tea', 'session', 'Fixture oolong');
    INSERT INTO tasting_session_verdicts (id, session_id, session_tea_id, user_id, tasting_data, submitted_at)
    VALUES ('verdict', 'session', 'tea', 'guest', '{"quality":8}', '2026-11-17T01:02:00.000Z');
    CREATE TEMP TABLE completion_writes (completed_at TEXT NOT NULL);
    CREATE TEMP TRIGGER record_completion AFTER UPDATE OF completed_at ON tasting_sessions
    WHEN NEW.id = 'session'
    BEGIN
      INSERT INTO completion_writes VALUES (NEW.completed_at);
    END;
  `);

  const firstTime = '2026-11-17T01:05:00.000Z';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(firstTime));

  async function call(path: string, actor: typeof host, method = 'GET') {
    const token = await signedToken(secret, {
      sub: actor.userId, email: actor.email, active_account_id: actor.accountId,
    });
    return worker.fetch(new Request(`https://fixture.test/api/sessions/session${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': actor.accountId },
    }), { DB: db, JWT_SECRET: secret } as any);
  }

  try {
    expect((await call('/complete', guest, 'POST')).status).toBe(403);
    const complete = () => call('/complete', host, 'POST');
    let responses: Response[];
    if (mode === 'concurrent') {
      responses = await Promise.all([complete(), complete()]);
    } else {
      const first = await complete();
      vi.setSystemTime(new Date('2026-11-17T01:06:00.000Z'));
      responses = [first, await complete()];
    }
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    }

    const reopened = await call('', guest);
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toMatchObject({
      session: { status: 'completed', completed_at: firstTime },
      my_verdicts: [{ id: 'verdict', tasting_data: '{"quality":8}' }],
    });
    expect(db.sqlite.prepare('SELECT completed_at FROM completion_writes').all())
      .toEqual([{ completed_at: firstTime }]);
  } finally {
    vi.useRealTimers();
    db.close();
  }
});

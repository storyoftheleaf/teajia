import { describe, expect, it } from 'vitest';
import worker from '../src/index';

class ExistingUserJoinDb {
  writes = 0;

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const statement = {
      bind: (..._values: unknown[]) => statement,
      first: async () => {
        if (normalized.includes('from tasting_join_codes')) return {
          code: '123456', session_id: 'session-1', account_id: 'account-1', expires_at: '2999-01-01T00:00:00.000Z', revoked_at: null,
        };
        if (normalized.includes('from tasting_sessions')) return {
          id: 'session-1', account_id: 'account-1', status: 'active', max_participants: 8, title: 'Tea session',
        };
        if (normalized.includes('count(*)') && normalized.includes('tasting_session_members')) return { c: 0 };
        if (normalized.includes('from users where lower(email)')) return {
          id: 'owner-1', email: 'owner@example.com', name: 'Owner', username: null, role: 'owner', platform_role: 'platform_owner', session_version: 0,
        };
        return null;
      },
      run: async () => { this.writes += 1; return { success: true, meta: { changes: 1 } }; },
    };
    return statement;
  }
}

describe('join-code identity boundary', () => {
  it('never authenticates an existing account from an unverified email claim', async () => {
    const db = new ExistingUserJoinDb();
    const response = await worker.fetch(new Request('https://test.dev/api/auth/join-code/redeem', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
      body: JSON.stringify({ code: '123456', first_name: 'Attacker', email: 'owner@example.com' }),
    }), { DB: db, JWT_SECRET: 'secret', JOIN_CODE_LIMITER: { limit: async () => ({ success: true }) } } as any);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'This email already has an account. Sign in before joining the session.',
      code: 'existing_account_requires_sign_in',
    });
    expect(db.writes).toBe(0);
  });
});

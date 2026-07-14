import { describe, expect, it } from 'vitest';
import { mcpFetch } from '../src/mcp';

type TokenRow = {
  id: string;
  account_id: string;
  user_id: string;
  user_email: string;
  revoked_at: string | null;
  scopes: string;
  creator_tier: string;
  expires_at: number;
};

type LiveAuthState = {
  token: TokenRow | null;
  user: { id: string; email: string; platform_role: string | null } | null;
  account: { status: string } | null;
  membership: { role: string; permissions: string | null; status: string } | null;
  failOn?: 'token' | 'user' | 'account' | 'membership';
};

const TOKEN = 'tjmcp_live_auth_test';
const ACTIVE_TOKEN: TokenRow = {
  id: 'token-1',
  account_id: 'account-1',
  user_id: 'user-1',
  user_email: 'owner@old.test',
  revoked_at: null,
  scopes: JSON.stringify(['inventory:read']),
  creator_tier: 'account_owner',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

class LiveAuthDb {
  constructor(readonly state: LiveAuthState) {}

  prepare(sql: string) {
    const normalized = normalizeSql(sql);
    let values: unknown[] = [];
    const statement = {
      bind: (...input: unknown[]) => {
        values = input;
        return statement;
      },
      first: async () => {
        if (normalized.includes('from mcp_tokens where token_hash = ?')) {
          if (this.state.failOn === 'token') throw new Error('token store unavailable');
          return this.state.token;
        }
        if (normalized.includes('from users where id = ?')) {
          if (this.state.failOn === 'user') throw new Error('user store unavailable');
          return this.state.user?.id === values[0] ? this.state.user : null;
        }
        if (normalized.includes('from accounts where id = ?')) {
          if (this.state.failOn === 'account') throw new Error('account store unavailable');
          return this.state.account;
        }
        if (normalized.includes('from account_members')) {
          if (this.state.failOn === 'membership') throw new Error('membership store unavailable');
          const membership = this.state.membership;
          return membership?.status === 'active' ? membership : null;
        }
        return null;
      },
      run: async () => ({ success: true, meta: { changes: 1 } }),
    };
    return statement;
  }
}

function state(overrides: Partial<LiveAuthState> = {}): LiveAuthState {
  return {
    token: { ...ACTIVE_TOKEN },
    user: { id: 'user-1', email: 'owner@current.test', platform_role: null },
    account: { status: 'active' },
    membership: { role: 'owner', permissions: null, status: 'active' },
    ...overrides,
  };
}

async function request(authState: LiveAuthState, method = 'initialize', params?: Record<string, unknown>) {
  return mcpFetch(new Request('https://api.test/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), { DB: new LiveAuthDb(authState) } as any);
}

async function expectUnauthorized(authState: LiveAuthState) {
  const response = await request(authState);
  expect(response.status).toBe(401);
  expect(response.headers.get('www-authenticate')).toContain('Bearer realm="mcp"');
}

describe('MCP live authorization', () => {
  it('rejects a token immediately after its row is revoked', async () => {
    await expectUnauthorized(state({ token: { ...ACTIVE_TOKEN, revoked_at: '2026-07-13 00:00:00' } }));
  });

  it('rejects a previously valid token after its user is deleted', async () => {
    await expectUnauthorized(state({ user: null }));
  });

  it('rejects a previously valid token after its account is suspended', async () => {
    await expectUnauthorized(state({ account: { status: 'suspended' } }));
  });

  it.each([
    ['removed', null],
    ['inactive', { role: 'owner', permissions: null, status: 'inactive' }],
  ])('rejects a previously valid token after membership is %s', async (_label, membership) => {
    await expectUnauthorized(state({ membership }));
  });

  it('rejects owner scopes after the creator is demoted to staff', async () => {
    await expectUnauthorized(state({
      token: { ...ACTIVE_TOKEN, scopes: JSON.stringify(['catalog:write']), creator_tier: 'account_owner' },
      membership: { role: 'staff', permissions: JSON.stringify({ bundles: ['catalog'] }), status: 'active' },
    }));
  });

  it('rejects stored write scopes that exceed a viewer current authority', async () => {
    await expectUnauthorized(state({
      token: { ...ACTIVE_TOKEN, scopes: JSON.stringify(['stock:write']), creator_tier: 'staff' },
      membership: { role: 'viewer', permissions: null, status: 'active' },
    }));
  });

  it('removes platform-owner-only authority immediately after demotion to platform admin', async () => {
    const response = await request(state({
      token: { ...ACTIVE_TOKEN, scopes: JSON.stringify(['admin:write']), creator_tier: 'platform_owner' },
      user: { id: 'user-1', email: 'admin@current.test', platform_role: 'platform_admin' },
      membership: null,
    }), 'tools/call', { name: 'update_exchange_rate', arguments: {} });
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(JSON.parse(body.result.content[0].text)).toMatchObject({ error: 'platform_owner_required' });
  });

  it.each(['token', 'user', 'account', 'membership'] as const)('fails closed when the %s authorization read fails', async failOn => {
    const response = await request(state({ failOn }));
    expect(response.status).toBe(503);
  });

  it('derives platform-owner authority live without requiring membership', async () => {
    const response = await request(state({
      token: { ...ACTIVE_TOKEN, scopes: JSON.stringify(['admin:write']), creator_tier: 'viewer' },
      user: { id: 'user-1', email: 'platform@current.test', platform_role: 'platform_owner' },
      membership: null,
    }), 'tools/list');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toContain('update_exchange_rate');
  });
});

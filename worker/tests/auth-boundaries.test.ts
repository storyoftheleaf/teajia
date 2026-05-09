import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'test-secret';
const ACCOUNT_ID = 'acc_test';

type MembershipRole = 'owner' | 'staff' | 'viewer';

type FakeDbOptions = {
  role?: MembershipRole;
  bundles?: string[];
  platformRole?: string | null;
  accountStatus?: string | null;
  userId?: string;
  email?: string;
  mcpScopes?: string[];
};

function b64encodeUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function signJwt(claims: Record<string, unknown>): Promise<string> {
  const header = b64encodeUtf8(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64encodeUtf8(JSON.stringify({
    sub: 'user_test',
    email: 'staff@example.com',
    name: 'Test User',
    active_account_id: ACCOUNT_ID,
    iat: now,
    exp: now + 3600,
    ...claims,
  }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${sigB64}`;
}

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private sql: string,
    private options: Required<FakeDbOptions>,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first() {
    const sql = normalizeSql(this.sql);
    const { role, bundles, platformRole, accountStatus, userId, email, mcpScopes } = this.options;

    if (sql.includes('from mcp_tokens where token_hash = ?')) {
      return {
        id: 'mcp_token_test',
        account_id: ACCOUNT_ID,
        user_id: userId,
        user_email: email,
        revoked_at: null,
        scopes: JSON.stringify(mcpScopes),
      };
    }
    if (sql.includes('select platform_role from users where id = ?')) {
      return { platform_role: platformRole };
    }
    if (sql.includes('select id, email, platform_role from users where id = ?')) {
      return { id: userId, email, platform_role: platformRole };
    }
    if (sql.includes('select status from accounts where id = ?')) {
      return { status: accountStatus };
    }
    if (sql.includes('from account_members am join accounts a on a.id = am.account_id')) {
      return {
        role,
        permissions: JSON.stringify({ bundles }),
        kind: 'location',
        status: accountStatus,
      };
    }
    return null;
  }

  async all() {
    const sql = normalizeSql(this.sql);
    if (sql.includes('from articles') && sql.includes("where status = 'published'")) {
      return {
        results: [{
          id: 'article_public',
          account_id: ACCOUNT_ID,
          title: 'Public Article',
          slug: 'public-article',
          status: 'published',
          tags: '[]',
        }],
      };
    }
    if (sql.includes('from articles')) {
      return { results: [] };
    }
    return { results: [] };
  }

  async run() {
    return { success: true, meta: { changes: 1 } };
  }
}

class FakeDb {
  constructor(private options: Required<FakeDbOptions>) {}

  prepare(sql: string) {
    return new FakeStatement(sql, this.options);
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    return Promise.all(statements.map(stmt => stmt.run()));
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function makeEnv(options: FakeDbOptions = {}) {
  const merged: Required<FakeDbOptions> = {
    role: options.role ?? 'owner',
    bundles: options.bundles ?? [],
    platformRole: options.platformRole ?? null,
    accountStatus: options.accountStatus ?? 'active',
    userId: options.userId ?? 'user_test',
    email: options.email ?? 'staff@example.com',
    mcpScopes: options.mcpScopes ?? ['inventory:read', 'stock:write', 'customers:read', 'sales:write'],
  };
  return {
    JWT_SECRET,
    DB: new FakeDb(merged),
  } as any;
}

async function authedRequest(
  path: string,
  options: RequestInit & { role?: MembershipRole; bundles?: string[]; platformRole?: string | null } = {},
) {
  const token = await signJwt({ platform_role: options.platformRole ?? null });
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Teajia-Account', ACCOUNT_ID);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Request(`https://worker.test${path}`, { ...options, headers });
}

describe('worker authorization boundaries', () => {
  it('denies admin article reads without the publish bundle', async () => {
    const request = await authedRequest('/api/admin/articles');
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['catalog'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.required_bundle).toBe('publish');
  });

  it('allows admin article reads with the publish bundle', async () => {
    const request = await authedRequest('/api/admin/articles');
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['publish'] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('denies product stock commands without the stock bundle', async () => {
    const request = await authedRequest('/api/products/prod_test/stock', {
      method: 'PUT',
      body: JSON.stringify({ stock_grams: 120 }),
    });
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['catalog'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.required_bundle).toBe('stock');
  });

  it('rejects fields outside a product command domain', async () => {
    const request = await authedRequest('/api/products/prod_test/stock', {
      method: 'PUT',
      body: JSON.stringify({ product_name: 'Not a stock field' }),
    });
    const response = await worker.fetch(request, makeEnv({ role: 'owner' }));
    const body = await response.json() as any;

    expect(response.status).toBe(400);
    expect(body.fields).toContain('product_name');
  });

  it('requires a verified JWT for MCP OAuth approval', async () => {
    const request = new Request('https://worker.test/oauth/authorize/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'client_test',
        redirect_uri: 'https://client.example/callback',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        account_id: ACCOUNT_ID,
      }),
    });
    const response = await worker.fetch(request, makeEnv());
    const body = await response.json() as any;

    expect(response.status).toBe(401);
    expect(body.error).toBe('unauthenticated');
  });

  it('requires owner-tier access for MCP OAuth approval', async () => {
    const request = await authedRequest('/oauth/authorize/decision', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client_test',
        redirect_uri: 'https://client.example/callback',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        account_id: ACCOUNT_ID,
      }),
    });
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['stock', 'sell'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.error).toBe('access_denied');
  });

  it('keeps public article reads unauthenticated', async () => {
    const request = new Request('https://worker.test/api/articles');
    const response = await worker.fetch(request, makeEnv({ role: 'viewer' }));
    const body = await response.json() as any[];

    expect(response.status).toBe(200);
    expect(body[0].slug).toBe('public-article');
  });

  it('filters MCP tools by token scope', async () => {
    const request = new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer tjmcp_test' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const response = await worker.fetch(request, makeEnv({ mcpScopes: ['inventory:read'] }));
    const body = await response.json() as any;
    const toolNames = body.result.tools.map((tool: any) => tool.name);

    expect(response.status).toBe(200);
    expect(toolNames).toContain('search_tea');
    expect(toolNames).not.toContain('find_customer');
    expect(toolNames).not.toContain('record_sale');
  });

  it('treats an explicit empty MCP scope list as no tool access', async () => {
    const request = new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer tjmcp_test' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const response = await worker.fetch(request, makeEnv({ mcpScopes: [] }));
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.result.tools).toEqual([]);
  });

  it('blocks MCP tool calls outside token scope', async () => {
    const request = new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer tjmcp_test' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'find_customer', arguments: { query: 'Adrian' } },
      }),
    });
    const response = await worker.fetch(request, makeEnv({ mcpScopes: ['inventory:read'] }));
    const body = await response.json() as any;
    const payload = JSON.parse(body.result.content[0].text);

    expect(response.status).toBe(200);
    expect(body.result.isError).toBe(true);
    expect(payload.required_scope).toBe('customers:read');
  });
});

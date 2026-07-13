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
  platformAccountId?: string | null;
  customerRelationshipKinds?: string[];
  customerExists?: boolean;
  authDependencyFailure?: boolean;
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
    const { role, bundles, platformRole, accountStatus, userId, email, mcpScopes, platformAccountId, customerExists, authDependencyFailure } = this.options;

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
      if (authDependencyFailure) throw new Error('D1 unavailable');
      return { platform_role: platformRole };
    }
    if (sql.includes('select id, email, platform_role from users where id = ?')) {
      return { id: userId, email, platform_role: platformRole };
    }
    if (sql.includes('select status from accounts where id = ?')) {
      return { status: accountStatus };
    }
    if (sql.includes('select id from teaware_collection where id = ? and account_id = ?')) {
      return { id: 'teaware_test' };
    }
    if (sql.includes('select id from products where id = ? and account_id = ?')) {
      return { id: 'prod_test' };
    }
    if (sql.includes('from customers where id = ? and account_id = ?')) {
      return customerExists ? { id: 'cus_test', account_id: ACCOUNT_ID, name: 'Customer', contacts: '[]', tags: '[]' } : null;
    }
    if (sql.includes('from accounts') && sql.includes('is_platform_owner = 1')) {
      return platformAccountId ? { id: platformAccountId } : null;
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
    if (sql.includes('from contact_relationships') && sql.includes('customer_id')) {
      return { results: this.options.customerRelationshipKinds.map(kind => ({ customer_id: 'cus_test', kind })) };
    }
    if (sql.includes('from invoices where customer_id = ?')) {
      return { results: [{ id: 'invoice-private', customer_id: 'cus_test', account_id: ACCOUNT_ID }] };
    }
    if (sql.includes('from contributors') && sql.includes('display_name')) {
      return { results: [{ id: 'writer', slug: 'writer', display_name: 'Writer', status: 'published' }] };
    }
    // The public list query aliases the table (FROM articles a … WHERE a.status = 'published').
    if (sql.includes('from articles') && sql.includes("status = 'published'")) {
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
    platformAccountId: options.platformAccountId ?? null,
    customerRelationshipKinds: options.customerRelationshipKinds ?? ['buyer'],
    customerExists: options.customerExists ?? true,
    authDependencyFailure: options.authDependencyFailure ?? false,
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
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Request(`https://worker.test${path}`, { ...options, headers });
}

describe('worker authorization boundaries', () => {
  it.each([
    ['/api/generate-chinese-name', 'catalog'],
    ['/api/transcribe', 'catalog'],
    ['/api/extract-from-image', 'catalog'],
    ['/api/upload-image', 'catalog'],
    ['/api/upload-flyer', 'gather'],
  ])('requires the %s provider route to have its capability bundle', async (path, bundle) => {
    const request = await authedRequest(path, { method: 'POST', body: '{}' });
    const denied = await worker.fetch(request, makeEnv({ role: 'staff', bundles: [] }));
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'insufficient_bundle', details: { required_bundle: bundle } });
  });

  it('bounds provider uploads before and after multipart parsing', async () => {
    const env = { ...makeEnv({ role: 'staff', bundles: ['catalog'] }), MEDIA_BUCKET: { put: async () => undefined } };
    const oversized = await authedRequest('/api/upload-image', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(12 * 1024 * 1024) },
      body: '--x--',
    });
    const oversizedResponse = await worker.fetch(oversized, env);
    expect(oversizedResponse.status).toBe(413);
    expect(await oversizedResponse.json()).toMatchObject({ code: 'upload_too_large' });

    const form = new FormData();
    form.set('file', new File([new TextEncoder().encode('not really a png')], 'payload.php.png', { type: 'image/png' }));
    const invalid = await worker.fetch(await authedRequest('/api/upload-image', { method: 'POST', body: form }), env);
    expect(invalid.status).toBe(415);
    expect(await invalid.json()).toMatchObject({ code: 'invalid_media_signature' });
  });

  it('isolates durable provider limits by user and operation and fails closed on binding errors', async () => {
    const keys: string[] = [];
    const limiter = { limit: async ({ key }: { key: string }) => { keys.push(key); return { success: false }; } };
    const env = { ...makeEnv({ role: 'staff', bundles: ['catalog'] }), PROVIDER_LIMITER: limiter };
    for (const path of ['/api/generate-chinese-name', '/api/transcribe']) {
      const response = await worker.fetch(await authedRequest(path, { method: 'POST', body: '{}' }), env);
      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({ code: 'rate_limited' });
    }
    expect(keys).toEqual(['acc_test:user_test:chinese-name', 'acc_test:user_test:transcribe']);

    const broken = { ...makeEnv({ role: 'staff', bundles: ['catalog'] }), PROVIDER_LIMITER: { limit: async () => { throw new Error('offline'); } } };
    const response = await worker.fetch(await authedRequest('/api/generate-chinese-name', { method: 'POST', body: '{}' }), broken);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'rate_limit_unavailable' });
  });
  it('uses stable REST codes for missing auth and auth dependency failures', async () => {
    const missing = await worker.fetch(new Request('https://worker.test/api/customers'), makeEnv());
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: 'Unauthorized', code: 'auth_no_token' });

    const unavailable = await worker.fetch(
      await authedRequest('/api/customers'),
      makeEnv({ authDependencyFailure: true }),
    );
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: expect.any(String), code: 'auth_dependency_unavailable', details: { dependency: 'users' },
    });
  });
  it.each([
    ['account', '/api/accounts/acc_test', 'owner'],
    ['venue space', '/api/admin/venues/venue_test/spaces/space_test', 'gather'],
    ['teaware item', '/api/admin/teaware/teaware_test', 'catalog'],
    ['teaware photo', '/api/admin/teaware/teaware_test/photos/photo_test', 'catalog'],
    ['sample', '/api/admin/samples/sample_test', 'gather'],
    ['sample set', '/api/admin/sample-sets/set_test', 'gather'],
  ])('rejects request-derived SQL identifiers for %s updates', async (_label, path, bundle) => {
    const malicious = 'name = NULL WHERE account_id = ?; --';
    const request = await authedRequest(path, {
      method: 'PUT',
      body: JSON.stringify({ [malicious]: 'attacker-controlled' }),
    });
    const response = await worker.fetch(request, makeEnv({ role: bundle === 'owner' ? 'owner' : 'staff', bundles: bundle === 'owner' ? [] : [bundle] }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.any(String),
      code: 'validation_failed',
      details: { fields: [malicious] },
    });
  });

  it.each([
    ['buyer', 'sell'],
    ['vendor', 'catalog'],
    ['event_guest', 'gather'],
    ['collection_recipient', 'publish'],
    ['contributor', 'publish'],
  ])('authorizes %s customer reads and writes with only the %s bundle', async (kind, bundle) => {
    const env = makeEnv({ role: 'staff', bundles: [bundle], customerRelationshipKinds: [kind] });
    const read = await worker.fetch(await authedRequest('/api/customers/cus_test'), env);
    const write = await worker.fetch(await authedRequest('/api/customers/cus_test', {
      method: 'PUT', body: JSON.stringify({ name: 'Updated' }),
    }), env);
    expect(read.status).toBe(200);
    expect(write.status).toBe(200);
  });

  it('denies customer reads and writes when no relationship capability matches', async () => {
    const env = makeEnv({ role: 'staff', bundles: ['gather'], customerRelationshipKinds: ['buyer'] });
    const read = await worker.fetch(await authedRequest('/api/customers/cus_test'), env);
    const write = await worker.fetch(await authedRequest('/api/customers/cus_test', {
      method: 'PUT', body: JSON.stringify({ name: 'Updated' }),
    }), env);
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
  });

  it('denies the customer list to a no-bundle member', async () => {
    const response = await worker.fetch(
      await authedRequest('/api/customers'),
      makeEnv({ role: 'staff', bundles: [] }),
    );
    expect(response.status).toBe(403);
  });

  it('allows any matching capability for a mixed-relationship customer', async () => {
    const response = await worker.fetch(
      await authedRequest('/api/customers/cus_test'),
      makeEnv({ role: 'staff', bundles: ['gather'], customerRelationshipKinds: ['buyer', 'event_guest'] }),
    );
    expect(response.status).toBe(200);
  });

  it('keeps personal connections and destructive customer deletion owner-only', async () => {
    const staffEnv = makeEnv({ role: 'staff', bundles: ['catalog', 'stock', 'publish', 'gather', 'sell', 'members'], customerRelationshipKinds: ['personal_connection'] });
    expect((await worker.fetch(await authedRequest('/api/customers/cus_test'), staffEnv)).status).toBe(403);
    expect((await worker.fetch(await authedRequest('/api/customers/cus_test', { method: 'DELETE' }), staffEnv)).status).toBe(403);
    expect((await worker.fetch(await authedRequest('/api/customers/cus_test'), makeEnv({ role: 'owner', customerRelationshipKinds: ['personal_connection'] }))).status).toBe(200);
    expect((await worker.fetch(await authedRequest('/api/customers/cus_test'), makeEnv({ platformRole: 'platform_admin', customerRelationshipKinds: ['personal_connection'] }))).status).toBe(200);
    expect((await worker.fetch(await authedRequest('/api/customers/cus_test', { method: 'DELETE' }), makeEnv({ role: 'owner' }))).status).toBe(200);
  });

  it('does not embed customer invoices for a non-sell capability', async () => {
    const response = await worker.fetch(
      await authedRequest('/api/customers/cus_test'),
      makeEnv({ role: 'staff', bundles: ['catalog'], customerRelationshipKinds: ['vendor'] }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ orders: [] });
  });

  it('returns customer not found without disclosing another record', async () => {
    const response = await worker.fetch(
      await authedRequest('/api/customers/missing'),
      makeEnv({ role: 'staff', bundles: ['sell'], customerExists: false }),
    );
    expect(response.status).toBe(404);
  });

  it('bootstraps a membership-free platform owner into the active platform account', async () => {
    const token = await signJwt({
      platform_role: 'platform_owner',
      memberships: [],
      active_account_id: null,
    });
    const request = new Request('https://worker.test/api/accounts/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const response = await worker.fetch(request, makeEnv({
      platformRole: 'platform_owner',
      platformAccountId: 'acc_platform',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      memberships: [],
      active_account_id: 'acc_platform',
    });
  });

  it('denies admin article reads without the publish bundle', async () => {
    const request = await authedRequest('/api/admin/articles');
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['catalog'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.details?.required_bundle).toBe('publish');
  });

  it('allows admin article reads with the publish bundle', async () => {
    const request = await authedRequest('/api/admin/articles');
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['publish'] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('allows publish staff to list safe contributor options while keeping contributor CRUD owner-only', async () => {
    const optionsRequest = await authedRequest('/api/admin/contributor-options');
    const optionsResponse = await worker.fetch(optionsRequest, makeEnv({ role: 'staff', bundles: ['publish'] }));
    expect(optionsResponse.status).toBe(200);
    expect(await optionsResponse.json()).toEqual({ contributors: [{ id: 'writer', slug: 'writer', display_name: 'Writer', status: 'published' }] });

    const crudRequest = await authedRequest('/api/admin/contributors');
    expect((await worker.fetch(crudRequest, makeEnv({ role: 'staff', bundles: ['publish'] }))).status).toBe(403);
  });

  it('denies product stock commands without the stock bundle', async () => {
    const request = await authedRequest('/api/products/prod_test/stock', {
      method: 'PUT',
      body: JSON.stringify({ stock_grams: 120 }),
    });
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['catalog'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: 'insufficient_bundle', details: { required_bundle: 'stock' } });
  });

  it('rejects fields outside a product command domain', async () => {
    const request = await authedRequest('/api/products/prod_test/stock', {
      method: 'PUT',
      body: JSON.stringify({ product_name: 'Not a stock field' }),
    });
    const response = await worker.fetch(request, makeEnv({ role: 'owner' }));
    const body = await response.json() as any;

    expect(response.status).toBe(400);
    expect(body.code).toBe('validation_failed');
    expect(body.details?.fields).toContain('product_name');
  });

  it('does not expose the generic product update route', async () => {
    const response = await worker.fetch(await authedRequest('/api/products/prod_test', {
      method: 'PUT', body: JSON.stringify({ stock_grams: 500 }),
    }), makeEnv({ role: 'staff', bundles: ['catalog'] }));
    expect(response.status).toBe(404);
  });

  it('accepts inventory purpose only through the stock command', async () => {
    const response = await worker.fetch(await authedRequest('/api/products/prod_test/stock', {
      method: 'PUT', body: JSON.stringify({ inventory_purpose: 'working' }),
    }), makeEnv({ role: 'staff', bundles: ['stock'] }));
    expect(response.status).toBe(200);
  });

  it('requires the catalog bundle for source supplied-product reads', async () => {
    const request = await authedRequest('/api/customers/cus_test/products');
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['sell'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.details?.required_bundle).toBe('catalog');
  });

  it('requires the sell bundle for buyer order history reads', async () => {
    const request = await authedRequest('/api/customers/cus_test/orders');
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['gather'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.details?.required_bundle).toBe('sell');
  });

  it('rejects unknown contact relationship filters', async () => {
    const request = await authedRequest('/api/customers?relationship=crm_bucket');
    const response = await worker.fetch(request, makeEnv({ role: 'owner' }));
    const body = await response.json() as any;

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid relationship filter');
  });

  it('keeps owner private contact notes out of staff access', async () => {
    const request = await authedRequest('/api/customers/cus_test/private-notes');
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['sell', 'gather'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.error).toBe('Owner-tier access required for this action');
  });

  it('keeps the relationship audit owner-tier only', async () => {
    const request = await authedRequest('/api/admin/people/relationship-audit');
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['members'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.error).toBe('Owner-tier access required for this action');
  });

  it('keeps contributor contact links owner-tier only', async () => {
    const request = await authedRequest('/api/admin/contributors/person/contact', {
      method: 'PUT',
      body: JSON.stringify({ customer_id: 'cus_test' }),
    });
    const response = await worker.fetch(request, makeEnv({ role: 'staff', bundles: ['publish'] }));
    const body = await response.json() as any;

    expect(response.status).toBe(403);
    expect(body.error).toBe('Owner-tier access required for this action');
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

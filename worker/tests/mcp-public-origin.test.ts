import { describe, expect, it } from 'vitest';
import { mcpFetch, oauthAuthorizationServerMetadata, oauthProtectedResourceMetadata, originOf } from '../src/mcp';
import worker from '../src/index';

const publicHeaders = { 'X-Teajia-Public-Origin': 'https://www.teajia.com' };

describe('MCP public origin metadata', () => {
  it('advertises the Pages origin in protected-resource metadata', async () => {
    const response = oauthProtectedResourceMetadata(new Request('https://teajia-api.lightcodes.workers.dev/.well-known/oauth-protected-resource', { headers: publicHeaders }));
    const body = await response.text();
    expect(body).toContain('https://www.teajia.com/mcp');
    expect(body).not.toContain('workers.dev');
  });

  it('advertises the Pages origin in authorization-server metadata', async () => {
    const response = oauthAuthorizationServerMetadata(new Request('https://teajia-api.lightcodes.workers.dev/.well-known/oauth-authorization-server', { headers: publicHeaders }));
    const body = await response.text();
    expect(body).toContain('https://www.teajia.com/oauth/authorize');
    expect(body).not.toContain('workers.dev');
  });

  it('uses the Pages origin in MCP challenges but rejects arbitrary spoofed origins', async () => {
    const response = await mcpFetch(new Request('https://teajia-api.lightcodes.workers.dev/mcp', { method: 'POST', headers: publicHeaders, body: '{}' }), {} as any);
    expect(response.headers.get('www-authenticate')).toContain('https://www.teajia.com/.well-known/oauth-protected-resource');
    expect(response.headers.get('www-authenticate')).not.toContain('workers.dev');
    expect(originOf(new Request('https://worker.example/mcp', { headers: { 'X-Teajia-Public-Origin': 'https://attacker.example' } }))).toBe('https://worker.example');
    expect(originOf(new Request('https://worker.example/mcp'))).toBe('https://worker.example');
  });
});

class EmptyReadsDb {
  prepare() {
    const statement = {
      bind: () => statement,
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({ success: true, meta: { changes: 0 } }),
    };
    return statement;
  }
}

describe('public MCP rate limiting (audit SEC-5)', () => {
  it('refuses a public MCP request when PUBLIC_MCP_LIMITER is not configured, instead of allowing it', async () => {
    const response = await worker.fetch(new Request('https://api.test/mcp/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.30' },
      body: '{}',
    }), { DB: new EmptyReadsDb() } as never, {} as never);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'Rate limit service unavailable', code: 'rate_limit_unavailable' });
  });

  it('lets a public MCP request through once the durable limiter allows it', async () => {
    const limiter = { limit: async () => ({ success: true }) };
    const response = await worker.fetch(new Request('https://api.test/mcp/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.31' },
      body: '{}',
    }), { DB: new EmptyReadsDb(), PUBLIC_MCP_LIMITER: limiter } as never, {} as never);
    expect(response.status).not.toBe(503);
  });

  it('sends Retry-After on a public MCP 429, matching the limiter window in wrangler.toml', async () => {
    const denyingLimiter = { limit: async () => ({ success: false }) };
    const response = await worker.fetch(new Request('https://api.test/mcp/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.32' },
      body: '{}',
    }), { DB: new EmptyReadsDb(), PUBLIC_MCP_LIMITER: denyingLimiter } as never, {} as never);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('10');
  });
});

class PublicAccountDb {
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const statement = {
      bind: () => statement,
      first: async () => {
        if (normalized.includes('from accounts where')) {
          return {
            id: 'account-1',
            name: 'Test Shop',
            slug: 'test-shop',
            whatsapp_number: '15551234567',
            currency_default: 'USD',
            public_shop_path: null,
          };
        }
        return null;
      },
      all: async () => ({ results: [] }),
      run: async () => ({ success: true, meta: { changes: 0 } }),
    };
    return statement;
  }
}

function preparedOrderRequest(ip: string): Request {
  return new Request('https://api.test/mcp/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'prepare_order', arguments: { items: [{ id: 'nonexistent', grams: 100 }] } },
    }),
  });
}

describe('public prepare_order rate limiting (audit SEC-1, class fix)', () => {
  it('refuses prepare_order when PUBLIC_PREPARE_ORDER_LIMITER is not configured, instead of allowing an unbraked write', async () => {
    const response = await worker.fetch(preparedOrderRequest('203.0.113.40'), {
      DB: new PublicAccountDb(),
      PUBLIC_MCP_LIMITER: { limit: async () => ({ success: true }) },
    } as never, {} as never);
    expect(response.status).toBe(503);
  });

  it('lets prepare_order through once PUBLIC_PREPARE_ORDER_LIMITER allows it', async () => {
    const response = await worker.fetch(preparedOrderRequest('203.0.113.41'), {
      DB: new PublicAccountDb(),
      PUBLIC_MCP_LIMITER: { limit: async () => ({ success: true }) },
      PUBLIC_PREPARE_ORDER_LIMITER: { limit: async () => ({ success: true }) },
    } as never, {} as never);
    expect(response.status).not.toBe(503);
  });
});

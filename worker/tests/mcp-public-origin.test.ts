import { describe, expect, it } from 'vitest';
import { mcpFetch, oauthAuthorizationServerMetadata, oauthProtectedResourceMetadata, originOf } from '../src/mcp';
import worker from '../src/index';
import { INWARD_BALI_LOT } from '../../shared/catalog/inwardOrders';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

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
      all: async () => { const row = await statement.first(); return { results: row == null ? [] : [row] }; },
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
      all: async () => { const row = await statement.first(); return { results: row == null ? [] : [row] }; },
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


it('keeps Inward public but declines direct and name-based preparation until a count is recorded', async () => {
  const db = new SqliteD1('migrations');
  try {
    const { accountId, id } = INWARD_BALI_LOT;
    seedIdentity(db, { accountId, accountSlug: 'teajia-bali' });
    db.sqlite.prepare('UPDATE accounts SET whatsapp_number = ? WHERE id = ?').run('15551234567', accountId);
    const addTea = db.sqlite.prepare(`INSERT INTO products
      (id, account_id, product_name, type, fixed_retail_price_usd, cost_amount, cost_currency,
      cost_currency_source, shipping_rate_per_kg, markup_multiplier, stock_grams, is_public, shown_in_shop, status)
      VALUES (?, ?, ?, 'Dark', 2, NULL, NULL, NULL, NULL, NULL, 600, 1, 1, 'Active')`);
    addTea.run(id, accountId, 'Inward');
    addTea.run('inward-reserve', accountId, 'Inward Reserve');

    let callId = 0;
    const limiter = { limit: async () => ({ success: true }) };
    async function publicTool(name: string, args: object) {
      callId += 1;
      const response = await worker.fetch(new Request('https://api.test/mcp/public?account=teajia-bali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${60 + callId}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: callId, method: 'tools/call', params: { name, arguments: args } }),
      }), { DB: db, PUBLIC_MCP_LIMITER: limiter, PUBLIC_PREPARE_ORDER_LIMITER: limiter } as never, {} as never);
      expect(response.status).toBe(200);
      const result = await response.json() as { result: { content: { text: string }[] } };
      return JSON.parse(result.result.content[0].text);
    }

    const paused = { id, orders_paused: true, in_stock: false, price_per_gram_usd: null };
    expect(await publicTool('get_tea', { id })).toMatchObject(paused);
    expect(await publicTool('search_tea', { query: 'Inward' })).toMatchObject({ matches: [paused, expect.objectContaining({ id: 'inward-reserve' })] });
    expect(await publicTool('browse_catalog', {})).toMatchObject({ items: expect.arrayContaining([expect.objectContaining(paused)]) });
    expect(await publicTool('browse_catalog', { in_stock_only: true })).toMatchObject({ items: [expect.objectContaining({ id: 'inward-reserve' })] });

    const expectPaused = async (items: object[]) => {
      const prepared = await publicTool('prepare_order', { items });
      expect(prepared).toMatchObject({ error: 'ordering_paused' });
      expect(prepared).not.toHaveProperty('whatsapp_url');
    };
    await expectPaused([{ id, grams: 50 }]);
    await expectPaused([{ name: 'Inward', grams: 50 }]);
    await expectPaused([{ id: 'inward-reserve', grams: 50 }, { id, grams: 50 }]);
    db.sqlite.prepare("UPDATE products SET stock_known_at = '2026-11-24' WHERE id = ?").run(id);
    await expectPaused([{ id, grams: 50 }]);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM inquiries').get()).toEqual({ count: 0 });

    db.sqlite.prepare("UPDATE products SET stock_verified_at = '2026-11-24' WHERE id = ?").run(id);
    const counted = { id, in_stock: true, price_per_gram_usd: 2 };
    const detail = await publicTool('get_tea', { id });
    expect(detail).toMatchObject(counted);
    expect(detail).not.toHaveProperty('orders_paused');
    expect(await publicTool('browse_catalog', { in_stock_only: true })).toMatchObject({ items: expect.arrayContaining([expect.objectContaining(counted)]) });
    expect(await publicTool('prepare_order', { items: [{ id, grams: 50 }] })).toMatchObject({
      whatsapp_url: expect.stringContaining('https://wa.me/'),
      lines: [{ ...counted, grams: 50 }],
    });
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM inquiries WHERE source = 'ai_prepared'").get()).toEqual({ count: 1 });
  } finally {
    db.close();
  }
});

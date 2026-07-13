import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { oauthAuthorize, oauthRegister } from '../src/mcp';

class Limiter {
  keys: string[] = [];
  constructor(private outcome: boolean | Error = true) {}
  async limit({ key }: { key: string }) {
    this.keys.push(key);
    if (this.outcome instanceof Error) throw this.outcome;
    return { success: this.outcome };
  }
}

class OAuthDb {
  clients = new Map<string, any>();
  requests: any[] = [];
  inserts = 0;
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase(); let values: any[] = [];
    const statement = {
      bind: (...input: any[]) => { values = input; return statement; },
      first: async () => {
        if (normalized.includes('from oauth_clients where id = ?')) return this.clients.get(values[0]) || null;
        if (normalized.includes('from oauth_clients') && normalized.includes('client_name = ?')) {
          return [...this.clients.values()].find(c => c.client_name === values[0] && c.redirect_uris === values[1] && c.grant_types === values[2] && c.response_types === values[3]) || null;
        }
        if (normalized.includes('from oauth_authorize_requests')) return this.requests.find(r => r.client_id === values[0] && r.redirect_uri === values[1] && r.code_challenge === values[3]) || null;
        return null;
      },
      run: async () => {
        if (normalized.startsWith('insert into oauth_clients')) {
          this.inserts++;
          this.clients.set(values[0], { id: values[0], client_name: values[1], redirect_uris: values[2], grant_types: values[3], response_types: values[4] });
        }
        if (normalized.startsWith('insert into oauth_authorize_requests')) {
          this.inserts++;
          this.requests.push({ id: values[0], client_id: values[1], redirect_uri: values[2], response_type: values[3], code_challenge: values[4] });
        }
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }
}

const registration = (overrides: Record<string, unknown> = {}) => ({
  client_name: 'Claude',
  redirect_uris: ['https://claude.ai/oauth/callback'],
  grant_types: ['authorization_code'],
  response_types: ['code'],
  ...overrides,
});

describe('MCP OAuth write boundaries', () => {
  it('durably rate-limits registration and authorization and fails closed on binding errors', async () => {
    const denied = new Limiter(false);
    const register = await oauthRegister(new Request('https://api.test/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.1' }, body: JSON.stringify(registration()) }), { DB: new OAuthDb(), JWT_SECRET: 'x', OAUTH_REGISTER_LIMITER: denied } as any);
    expect(register.status).toBe(429);
    expect(await register.json()).toMatchObject({ error: 'slow_down' });
    expect(denied.keys).toEqual(['203.0.113.1']);

    const broken = new Limiter(new Error('offline'));
    const authorize = await oauthAuthorize(new Request('https://api.test/oauth/authorize?client_id=x'), { DB: new OAuthDb(), JWT_SECRET: 'x', OAUTH_AUTHORIZE_LIMITER: broken } as any);
    expect(authorize.status).toBe(503);
    expect(await authorize.json()).toMatchObject({ error: 'temporarily_unavailable' });
  });

  it('rejects unbounded or unsupported registration metadata before inserting', async () => {
    const cases = [
      registration({ client_name: 'x'.repeat(121) }),
      registration({ redirect_uris: Array.from({ length: 11 }, (_, i) => `https://claude.ai/cb/${i}`) }),
      registration({ redirect_uris: ['https://claude.ai/' + 'x'.repeat(2050)] }),
      registration({ grant_types: ['implicit'] }),
      registration({ response_types: ['token'] }),
    ];
    for (const body of cases) {
      const db = new OAuthDb();
      const response = await oauthRegister(new Request('https://api.test/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { DB: db, JWT_SECRET: 'x' } as any);
      expect(response.status).toBe(400);
      expect(db.inserts).toBe(0);
    }
  });

  it('reuses an identical registration instead of growing D1 rows', async () => {
    const db = new OAuthDb(); const env = { DB: db, JWT_SECRET: 'x' } as any;
    const make = () => oauthRegister(new Request('https://api.test/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(registration()) }), env);
    const first = await make(); const second = await make();
    expect((await first.json() as any).client_id).toBe((await second.json() as any).client_id);
    expect(db.inserts).toBe(1);
  });

  it('validates client, registered redirect, response type, PKCE, and field bounds before authorization insert', async () => {
    const db = new OAuthDb();
    db.clients.set('client-1', { id: 'client-1', redirect_uris: JSON.stringify(['https://claude.ai/oauth/callback']), grant_types: '["authorization_code"]', response_types: '["code"]' });
    const base = new URLSearchParams({ client_id: 'client-1', redirect_uri: 'https://claude.ai/oauth/callback', response_type: 'code', code_challenge: 'A'.repeat(43), code_challenge_method: 'S256', state: 'state', scope: 'mcp' });
    for (const patch of [
      { client_id: 'missing' },
      { redirect_uri: 'https://claude.ai/other' },
      { response_type: 'token' },
      { code_challenge: 'short' },
      { code_challenge: '*'.repeat(43) },
      { code_challenge_method: 'plain' },
      { state: 'x'.repeat(513) },
      { scope: 'x'.repeat(257) },
      { scope: 'admin' },
    ]) {
      const q = new URLSearchParams(base); Object.entries(patch).forEach(([k, v]) => q.set(k, v));
      const response = await oauthAuthorize(new Request(`https://api.test/oauth/authorize?${q}`), { DB: db, JWT_SECRET: 'x' } as any);
      expect(response.status).toBe(400);
      expect(db.inserts).toBe(0);
    }

    const valid = await oauthAuthorize(new Request(`https://api.test/oauth/authorize?${base}`), { DB: db, JWT_SECRET: 'x' } as any);
    expect(valid.status).toBe(302);
    expect(db.inserts).toBe(1);
    const replay = await oauthAuthorize(new Request(`https://api.test/oauth/authorize?${base}`), { DB: db, JWT_SECRET: 'x' } as any);
    expect(replay.headers.get('location')).toBe(valid.headers.get('location'));
    expect(db.inserts).toBe(1);
  });
});

describe('browser CORS origin boundary', () => {
  async function cors(origin: string) {
    const response = await worker.fetch(new Request('https://api.test/.well-known/oauth-authorization-server', { headers: { Origin: origin } }), { JWT_SECRET: 'x' } as any);
    return response.headers.get('access-control-allow-origin');
  }

  it.each(['https://teajia.com', 'https://www.teajia.com', 'https://teajiafinal.pages.dev', 'https://abc123.teajiafinal.pages.dev'])('allows %s', async origin => {
    expect(await cors(origin)).toBe(origin);
  });

  it.each(['https://teajia.pages.dev', 'https://preview.teajia-staging.pages.dev', 'https://x.y.teajiafinal.pages.dev', 'https://abc.teajiafinal.pages.dev.attacker.com'])('denies %s', async origin => {
    expect(await cors(origin)).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import worker from '../src/index';
import { mcpAdminMintToken } from '../src/mcp';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const SECRET = 'synthetic-consent-only';
const DEFAULTS = ['inventory:read', 'stock:write', 'customers:read', 'sales:read', 'sales:write'];
const CALLBACK = 'https://claude.ai/oauth/callback';
const VERIFIER = 'synthetic-verifier-'.repeat(4);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const OMITTED = Symbol('omitted');
const databases: SqliteD1[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.sqlite.close()); vi.restoreAllMocks(); });

function fixture(schema: 'schema' | 'migrations', role: 'owner' | 'staff' | 'viewer' = 'owner') {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network permitted in consent fixtures'));
  const db = new SqliteD1(schema); databases.push(db);
  seedIdentity(db, { userId: 'consenter', accountId: 'synthetic-account', role });
  db.sqlite.prepare('INSERT INTO oauth_clients (id, client_name, redirect_uris) VALUES (?,?,?)')
    .run('client', 'Synthetic client', JSON.stringify([CALLBACK]));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'consenter', email: 'consenter@test.dev',
    active_account_id: 'synthetic-account', session_version: 0, iat: now, exp: now + 3600 })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const jwt = `${unsigned}.${createHmac('sha256', SECRET).update(unsigned).digest('base64')}`;
  const env = { DB: db, JWT_SECRET: SECRET } as any;
  const request = (path: string, body: object) => worker.fetch(new Request(`https://synthetic.test${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json',
      'X-Teajia-Account': 'synthetic-account' }, body: JSON.stringify(body),
  }), env);
  const decision = (scopes: unknown = OMITTED) => request('/oauth/authorize/decision', {
    client_id: 'client', redirect_uri: CALLBACK, code_challenge: CHALLENGE,
    code_challenge_method: 'S256', account_id: 'synthetic-account',
    ...(scopes === OMITTED ? {} : { scopes }),
  });
  const exchange = (code: string) => request('/oauth/token', { grant_type: 'authorization_code',
    code, client_id: 'client', redirect_uri: CALLBACK, code_verifier: VERIFIER });
  const rows = (table: string) => db.sqlite.prepare(`SELECT * FROM ${table}`).all() as any[];
  return { db, env, request, decision, exchange, rows };
}

for (const schema of ['schema', 'migrations'] as const) describe(`explicit consent (${schema})`, () => {
  it.each([[], ['not-a-scope'], [null], null, 'inventory:read', {}].map(scopes => ({ scopes })))('refuses empty or unusable OAuth selection %j before code/token writes', async ({ scopes }) => {
    const f = fixture(schema);
    const response = await f.decision(scopes);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_scope' });
    expect(f.rows('oauth_codes')).toEqual([]);
    expect(f.rows('mcp_tokens')).toEqual([]);
  });

  it.each([OMITTED, ['inventory:read'], ['inventory:read', 'admin:write', 'inventory:read', 'invalid']].map(scopes => ({ scopes })))('keeps legitimate omitted/default and selected owner scopes through exchange: %j', async ({ scopes }) => {
    const f = fixture(schema);
    const response = await f.decision(scopes);
    expect(response.status).toBe(200);
    const expected = scopes === OMITTED ? DEFAULTS : [...new Set((scopes as string[]).filter(s => s !== 'invalid'))];
    const code = f.rows('oauth_codes')[0];
    expect(JSON.parse(code.scopes)).toEqual(expected);
    const exchanged = await f.exchange(code.code);
    expect(exchanged.status).toBe(200);
    expect((await exchanged.json() as any).scope.split(' ')).toEqual(expected);
    expect(JSON.parse(f.rows('mcp_tokens')[0].scopes)).toEqual(expected);
    expect((await f.exchange(code.code)).status).toBe(400);
    expect(f.rows('mcp_tokens')).toHaveLength(1);
  });

  it.each(['viewer', 'staff'] as const)('preserves existing owner-only approval/mint route for %s', async role => {
    const f = fixture(schema, role);
    expect((await f.decision(['inventory:read'])).status).toBe(403);
    expect((await f.request('/api/admin/mcp-tokens', { label: 'Synthetic', scopes: ['inventory:read'] })).status).toBe(403);
    expect(f.rows('oauth_codes')).toEqual([]);
    expect(f.rows('mcp_tokens')).toEqual([]);
  });

  it.each([[], ['invalid'], null, 'inventory:read'].map(scopes => ({ scopes })))('admin route refuses explicit unusable selection %j without mint/audit writes', async ({ scopes }) => {
    const f = fixture(schema);
    const response = await f.request('/api/admin/mcp-tokens', { label: 'Synthetic', scopes });
    expect(response.status).toBe(400);
    expect(f.rows('mcp_tokens')).toEqual([]);
    expect(f.rows('activity_logs')).toEqual([]);
  });

  it.each([OMITTED, ['inventory:read']].map(scopes => ({ scopes })))('admin mint preserves omitted defaults and narrow selections: %j', async ({ scopes }) => {
    const f = fixture(schema);
    const response = await f.request('/api/admin/mcp-tokens', { label: 'Synthetic',
      ...(scopes === OMITTED ? {} : { scopes }) });
    expect(response.status).toBe(201);
    const expected = scopes === OMITTED ? DEFAULTS : scopes;
    expect((await response.json() as any).scopes).toEqual(expected);
    expect(JSON.parse(f.rows('mcp_tokens')[0].scopes)).toEqual(expected);
  });

  it.each(['viewer', 'staff', 'account_owner', 'platform_owner'] as const)('internal mint retains allowed explicit scopes and never defaults filtered-empty for %s', async tier => {
    const f = fixture(schema);
    const requested = ['inventory:read', 'admin:write'];
    const minted = await mcpAdminMintToken(f.env, 'synthetic-account', 'consenter', 'consenter@test.dev', 'Synthetic', requested as any, tier);
    expect(minted?.scopes).toEqual(tier.endsWith('owner') ? requested : ['inventory:read']);
    const before = f.rows('mcp_tokens').length;
    const rejected = await mcpAdminMintToken(f.env, 'synthetic-account', 'consenter', 'consenter@test.dev', 'Synthetic',
      (tier.endsWith('owner') ? ['invalid'] : ['admin:write']) as any, tier);
    expect(rejected).toBeNull();
    expect(f.rows('mcp_tokens')).toHaveLength(before);
  });

  it.each(['[]', '["invalid"]', 'null', '"inventory:read"', '{broken'])('refuses unusable stored grant %s without consuming code/minting', async stored => {
    const f = fixture(schema);
    await f.decision(['inventory:read']);
    const code = f.rows('oauth_codes')[0];
    f.db.sqlite.prepare('UPDATE oauth_codes SET scopes=? WHERE code=?').run(stored, code.code);
    const response = await f.exchange(code.code);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_grant' });
    expect(f.rows('mcp_tokens')).toEqual([]);
    expect(f.rows('oauth_codes')[0].used_at).toBeNull();
  });

  it('preserves genuinely legacy absent grant defaults', async () => {
    const f = fixture(schema);
    await f.decision(['inventory:read']);
    const code = f.rows('oauth_codes')[0];
    f.db.sqlite.prepare('UPDATE oauth_codes SET scopes=NULL, creator_tier=NULL WHERE code=?').run(code.code);
    expect((await f.exchange(code.code)).status).toBe(200);
    expect(JSON.parse(f.rows('mcp_tokens')[0].scopes)).toEqual(DEFAULTS);
  });

  it.each(['viewer', 'staff'] as const)('re-filters stored %s grants without replacing filtered-empty with defaults', async tier => {
    const f = fixture(schema);
    await f.decision(['inventory:read']);
    const code = f.rows('oauth_codes')[0];
    f.db.sqlite.prepare('UPDATE oauth_codes SET scopes=?, creator_tier=? WHERE code=?')
      .run(JSON.stringify(['admin:write']), tier, code.code);
    expect((await f.exchange(code.code)).status).toBe(400);
    expect(f.rows('mcp_tokens')).toEqual([]);
    expect(f.rows('oauth_codes')[0].used_at).toBeNull();
    f.db.sqlite.prepare('UPDATE oauth_codes SET scopes=? WHERE code=?')
      .run(JSON.stringify(['inventory:read', 'admin:write']), code.code);
    expect((await f.exchange(code.code)).status).toBe(200);
    expect(JSON.parse(f.rows('mcp_tokens')[0].scopes)).toEqual(['inventory:read']);
  });
});

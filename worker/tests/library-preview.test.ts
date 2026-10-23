import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
const ORIGIN = 'http://127.0.0.1:7789';
const LIVE = 'https://www.teajia.com';
const SECRET = 'preview-test-secret';
const verifier = 'a'.repeat(43);
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const digest = async (s: string) => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
const dbs: SqliteD1[] = [];
afterEach(() => dbs.splice(0).forEach(db => db.close()));
async function setup() {
  const db = new SqliteD1('migrations'); dbs.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'a', role: 'owner' });
  seedIdentity(db, { userId: 'outsider', accountId: 'b', role: 'owner' });
  const token = await signedToken(SECRET, { sub: 'owner', email: 'owner@test.dev', name: 'Owner', active_account_id: 'a' });
  const env = { DB: db, JWT_SECRET: SECRET, LOGIN_LIMITER: { limit: async () => ({ success: true }) } } as any;
  const request = (path: string, method = 'GET', body?: unknown, bearer = token, origin = LIVE, account = 'a') => worker.fetch(new Request(`https://api.test${path}`, { method, headers: { Authorization: `Bearer ${bearer}`, Origin: origin, 'Content-Type': 'application/json', 'X-Teajia-Account': account }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
  const grant = async () => {
    const r = await request('/api/dev/library-preview/grants', 'POST', { origin: ORIGIN, challenge: await digest(verifier) });
    expect(r.status).toBe(200); return r.json() as Promise<any>;
  };
  const redeem = (code: string, v = verifier, origin = ORIGIN) => request('/api/dev/library-preview/redeem', 'POST', { code, verifier: v, origin }, '', origin);
  const session = async () => { const g = await grant(); const r = await redeem(g.code); expect(r.status).toBe(200); return { ...g, ...await r.json() as any }; };
  return { db, request, grant, redeem, session, env };
}
describe('Library preview is a separate, read-only capability', () => {
  it('binds PKCE and origin; consumes a code exactly once; stores only hashes', async () => {
    const { db, grant, redeem } = await setup(); const g = await grant();
    expect((await redeem(g.code, 'b'.repeat(43))).status).toBe(403);
    expect((await redeem(g.code, verifier, 'http://localhost:7789')).status).toBe(403);
    const r = await redeem(g.code); expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    const s = await r.json() as any; expect(s.token).toMatch(/^tjlp_[\w-]{43}$/);
    expect((await redeem(g.code)).status).toBe(403);
    const stored = db.sqlite.prepare('SELECT * FROM library_preview_grants').get()!;
    expect(JSON.stringify(stored)).not.toContain(g.code); expect(JSON.stringify(stored)).not.toContain(s.token);
  });
  it('atomically redeems concurrent requests only once', async () => {
    const { grant, redeem } = await setup(); const g = await grant();
    const replies = await Promise.all([redeem(g.code), redeem(g.code)]);
    expect(replies.map(r => r.status).sort()).toEqual([200,403]);
  });
  it('rejects ordinary API writes, auth refresh, MCP and non-GET snapshot before normal routing', async () => {
    const { request, session } = await setup(); const s = await session();
    for (const [path, method] of [['/api/auth/refresh','POST'], ['/api/compass/entries','GET'], ['/api/compass/entries','POST'], ['/mcp','POST'], ['/api/dev/library-preview/snapshot','POST'], ['/api/dev/library-preview/grants','POST']]) {
      expect((await request(path, method, method === 'POST' ? {} : undefined, s.token, ORIGIN)).status, path).toBe(403);
    }
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s.token, LIVE)).status).toBe(403);
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s.token, ORIGIN, 'b')).status).toBe(403);
  });
  it('returns only this account Library fields and linked purchase quantities', async () => {
    const { db, request, session } = await setup();
    for (const [id, account, user] of [['tea-a','a','owner'], ['tea-b','b','outsider']]) {
      db.sqlite.prepare("INSERT INTO tea_compass_entries (id,account_id,user_id,name,vendor_name,price_amount,price_currency,price_per_unit_grams,notes,tasting) VALUES (?,?,?,?,?,500,'Yuan',250,'private note','{\"notes\":\"secret tasting\"}')").run(id, account, user, id, 'Huang Wei');
    }
    db.sqlite.prepare("INSERT INTO purchase_orders(id,account_id,vendor_name,items_json,status,created_at,updated_at) VALUES ('po','a','private supplier contact',?,'ordered',datetime('now'),datetime('now'))").run(JSON.stringify([{name:'tea-a',compass_entry_id:'tea-a',quantity:500,notes:'private line'}, {name:'unrelated',compass_entry_id:'unknown',quantity:900}]));
    const s = await session(); const r = await request('/api/dev/library-preview/snapshot','GET',undefined,s.token,ORIGIN);
    expect(r.status).toBe(200); const data = await r.json() as any;
    expect(data.entries).toHaveLength(1); expect(data.entries[0]).toMatchObject({ id:'tea-a',vendor_name:'Huang Wei',price_amount:500,price_per_unit_grams:250,preview_tasted:true });
    expect(JSON.stringify(data)).not.toMatch(/private note|secret tasting|private supplier contact|private line|tea-b|unrelated/);
    expect(JSON.parse(data.purchaseOrders[0].items_json)).toHaveLength(1);
    expect(data.ledgerDraftsAvailable).toBe(false);
  });
  it('expires both the authorization code and capability', async () => {
    const { db, grant, redeem, session, request } = await setup(); const g = await grant();
    db.sqlite.prepare('UPDATE library_preview_grants SET code_expires_at = 1 WHERE id = ?').run(g.grantId);
    expect((await redeem(g.code)).status).toBe(403);
    const s = await session(); db.sqlite.prepare('UPDATE library_preview_grants SET expires_at = 1 WHERE id = ?').run(s.grantId);
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s.token,ORIGIN)).status).toBe(403);
  });
  it('revokes immediately and invalidates capabilities after logout-all/session version change', async () => {
    const { db, request, session } = await setup(); const s = await session();
    expect((await request(`/api/dev/library-preview/grants/${s.grantId}`, 'DELETE')).status).toBe(200);
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s.token,ORIGIN)).status).toBe(403);
    const s2 = await session(); db.sqlite.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run('owner');
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s2.token,ORIGIN)).status).toBe(403);
  });
  it('lists without Origin for same-origin GET and prevents cross-account revocation', async () => {
    const { request, session } = await setup(); const s = await session();
    const list = await request('/api/dev/library-preview/grants', 'GET', undefined, undefined, '');
    expect(list.status).toBe(200); expect((await list.json() as any).grants[0].id).toBe(s.grantId);
    const other = await signedToken(SECRET, { sub:'outsider',email:'other@test.dev',name:'Other',active_account_id:'b' });
    expect((await request(`/api/dev/library-preview/grants/${s.grantId}`, 'DELETE', undefined, other, LIVE, 'b')).status).toBe(200);
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s.token,ORIGIN)).status).toBe(200);
  });
  it('fails closed on missing limiter and exhausted limiter', async () => {
    const { request, env } = await setup(); delete env.LOGIN_LIMITER;
    expect((await request('/api/dev/library-preview/redeem','POST',{},'',ORIGIN)).status).toBe(503);
    env.LOGIN_LIMITER = { limit: async () => ({ success:false }) };
    expect((await request('/api/dev/library-preview/redeem','POST',{},'',ORIGIN)).status).toBe(429);
  });
  it('refuses access to a suspended account and platform admins cannot issue', async () => {
    const { db, request, session } = await setup(); const s = await session();
    db.sqlite.prepare("UPDATE accounts SET status='suspended' WHERE id='a'").run();
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s.token,ORIGIN)).status).toBe(403);
    db.sqlite.prepare("UPDATE accounts SET status='active' WHERE id='a'").run();
    db.sqlite.prepare("UPDATE users SET platform_role='platform_admin' WHERE id='owner'").run();
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s.token,ORIGIN)).status).toBe(403);
    expect((await request('/api/dev/library-preview/grants','POST',{origin:ORIGIN,challenge:await digest(verifier)})).status).toBe(403);
  });
  it('fails closed after membership removal and refuses non-owners', async () => {
    const { db, request, session, grant, redeem } = await setup(); const s = await session(); const g = await grant();
    db.sqlite.prepare("UPDATE account_members SET role = 'viewer' WHERE user_id = 'owner'").run();
    expect((await request('/api/dev/library-preview/snapshot','GET',undefined,s.token,ORIGIN)).status).toBe(403);
    expect((await redeem(g.code)).status).toBe(403);
    expect((await request('/api/dev/library-preview/grants','POST',{origin:ORIGIN,challenge:await digest(verifier)})).status).toBe(403);
  });
});

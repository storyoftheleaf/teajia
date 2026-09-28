import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/**
 * Both ways into the shop, driven against a real database.
 *
 * Reported 2026-09-28: the email code never arrived, and a password sign-in
 * showed a refused request followed by an accepted one. These pin what each
 * door must do on the FIRST request: a right password is let in once, a wrong
 * one is told so in words, a database that did not answer is not called a
 * wrong password, and a code is either really sent or the refusal says why.
 */

const JWT_SECRET = 'jwt-secret';
const PASSWORD = 'correct horse battery';

async function pbkdf2(password: string): Promise<string> {
  const salt = new Uint8Array(16).fill(7);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' }, key, 256);
  const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:1000:${hex(salt)}:${hex(new Uint8Array(bits))}`;
}

async function shopWithOwner() {
  const db = new SqliteD1();
  const { userId } = seedIdentity(db, { userId: 'owner', accountId: 'acc-shop' });
  db.sqlite.prepare(`UPDATE users SET email = ?, username = ?, password_hash = ?, email_verified_at = datetime('now') WHERE id = ?`)
    .run('owner@teajia.test', 'adrian', await pbkdf2(PASSWORD), userId);
  return db;
}

let ip = 0;
const limiter = { limit: async () => ({ success: true }) };

async function post(db: unknown, path: string, body: unknown, env: Record<string, unknown> = {}) {
  const response = await worker.fetch(new Request(`https://worker.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `signin-${++ip}` },
    body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET, VERIFY_LIMITER: limiter, ...env } as any);
  return { status: response.status, body: await response.json() as any };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('password sign-in', () => {
  it('lets the right password in on the first request, by email or by username', async () => {
    const db = await shopWithOwner();
    for (const identifier of ['owner@teajia.test', 'Adrian']) {
      const first = await post(db, '/api/auth/login', { identifier, password: PASSWORD });
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ token: expect.any(String), user: { id: 'owner' } });
    }
  });

  it('refuses a wrong password in words, without saying which half was wrong', async () => {
    const db = await shopWithOwner();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrong = await post(db, '/api/auth/login', { identifier: 'owner@teajia.test', password: 'nope' });
    const nobody = await post(db, '/api/auth/login', { identifier: 'stranger@teajia.test', password: PASSWORD });
    expect(wrong).toEqual({
      status: 401,
      body: { error: 'That email or username and password do not match. Check both and try again.', code: 'invalid_credentials' },
    });
    expect(nobody).toEqual(wrong);
  });

  it('does not call a database that did not answer a wrong password', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { prepare: () => { throw new Error('D1_ERROR: network connection lost'); } };
    const result = await post(broken, '/api/auth/login', { identifier: 'owner@teajia.test', password: PASSWORD });
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('signin_unavailable');
  });
});

describe('email code sign-in', () => {
  const RESEND = { RESEND_API_KEY: 'resend-key', SENDER_EMAIL: 'hello@teajia.test' };

  it('sends the code by email, and that code signs the owner in', async () => {
    const db = await shopWithOwner();
    const sent: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
    }));

    const requested = await post(db, '/api/verify/request', { contact: 'Owner@Teajia.test', purpose: 'signin', method: 'email' }, RESEND);
    expect(requested.status).toBe(202);
    expect(requested.body).not.toHaveProperty('code');
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.resend.com/emails');
    expect(sent[0].body).toMatchObject({ to: ['owner@teajia.test'], subject: 'Your Teajia sign-in code' });
    const code = sent[0].body.html.match(/<strong>(\d{6})<\/strong>/)[1];

    const confirmed = await post(db, '/api/verify/confirm', { contact: 'owner@teajia.test', code, purpose: 'signin' });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toMatchObject({ token: expect.any(String), user: { id: 'owner' } });
  });

  it('says plainly that email is not switched on, and keeps no code it never sent', async () => {
    const db = await shopWithOwner();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refused = await post(db, '/api/verify/request', { contact: 'owner@teajia.test', purpose: 'signin', method: 'email' });
    expect(refused).toEqual({
      status: 503,
      body: { error: 'Email codes are not switched on yet, so no code was sent.', code: 'email_not_configured', retryable: false },
    });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM verification_challenges').get()).toEqual({ n: 0 });
  });

  it('tells a provider outage apart from a refusal, and only offers a retry for the outage', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    const outage = await post(await shopWithOwner(), '/api/verify/request', { contact: 'owner@teajia.test', purpose: 'signin' }, RESEND);
    expect(outage.body).toMatchObject({ code: 'email_unavailable', retryable: true });

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    const refused = await post(await shopWithOwner(), '/api/verify/request', { contact: 'owner@teajia.test', purpose: 'signin' }, RESEND);
    expect(refused.body).toMatchObject({ code: 'email_rejected', retryable: false });
  });

  it('lets a local sandbox with no email provider walk the whole sign-in when codes are echoed', async () => {
    const db = await shopWithOwner();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const requested = await post(db, '/api/verify/request', { contact: 'owner@teajia.test', purpose: 'signin' }, { DEV_RETURN_VERIFY_CODES: 'true' });
    expect(requested.status).toBe(202);
    const confirmed = await post(db, '/api/verify/confirm', { contact: 'owner@teajia.test', code: requested.body.code, purpose: 'signin' });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.user.id).toBe('owner');
  });
});

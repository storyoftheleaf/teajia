import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

let db: SqliteD1;
const secret = 'test-google-alias';

function environment() {
  return { DB: db, JWT_SECRET: secret, GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'test', APP_URL: 'https://example.test' } as any;
}

async function signIn(subject: string, email: string, verified = true) {
  const env = environment();
  const start = await worker.fetch(new Request('https://example.test/api/auth/google?return=/admin/yixing'), env);
  const state = new URL(start.headers.get('Location')!).searchParams.get('state')!;
  vi.stubGlobal('fetch', vi.fn(async url => Response.json(
    String(url).endsWith('/token') ? { access_token: 'fixture' } : { id: subject, email, verified_email: verified, name: 'Provider name' },
  )));
  const callback = new Request('https://example.test/api/auth/google/callback?' + new URLSearchParams({ state, code: 'fixture' }));
  const response = await worker.fetch(callback, env);
  const url = new URL(response.headers.get('Location')!);
  const token = new URLSearchParams(url.hash.slice(1)).get('oauth_token');
  return { url, claims: token && JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) };
}

beforeEach(() => {
  db = new SqliteD1('schema');
  for (const id of ['primary', 'secondary', 'unlinked']) {
    seedIdentity(db, { userId: id, accountId: id + '-shop', role: id === 'secondary' ? 'owner' : 'staff' });
  }
  db.sqlite.exec(`UPDATE users SET google_id = 'sub-' || id, email_verified_at = datetime('now') WHERE id <> 'unlinked';
    UPDATE users SET session_version=3 WHERE id='primary';
    UPDATE users SET session_version=1 WHERE id='secondary';
    INSERT INTO user_google_login_aliases(google_subject,source_user_id,profile_user_id)
      VALUES ('sub-secondary','secondary','primary');`);
});

afterEach(() => { vi.unstubAllGlobals(); db.close(); });

describe('operator-linked Google sign-ins', () => {
  it.each(['primary', 'secondary'])('authenticates the %s subject to the same profile and holdings', async id => {
    const result = await signIn('sub-' + id, id + '@test.dev');
    expect(result.claims).toMatchObject({ sub: 'primary', name: 'primary', email: 'primary@test.dev', session_version: 3,
      memberships: [{ account_id: 'primary-shop', role: 'staff' }] });
    expect(result.url.searchParams.get('returnTo')).toBe('/admin/yixing');
  });

  it.each(['primary', 'secondary'])('refuses a replacement Google subject presented with the %s email', async id => {
    const result = await signIn('another-subject', id + '@test.dev');
    expect(result.claims).toBeNull();
    expect(result.url.searchParams.get('oauth_error')).toBe('account_error');
    expect(db.sqlite.prepare('SELECT google_id FROM users WHERE id=?').get(id)?.google_id).toBe('sub-' + id);
  });

  it('retains first-time Google linking and existing accounts outside the pair', async () => {
    expect((await signIn('unlinked-sub', 'unlinked@test.dev')).claims.sub).toBe('unlinked');
    expect((await signIn('unlinked-sub', 'unlinked@test.dev')).claims.sub).toBe('unlinked');
    expect((await signIn('sub-secondary', 'secondary@test.dev', false)).claims).toBeNull();
  });

  it('keeps a secondary password from issuing either a second or a more privileged session', async () => {
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('verified-test-password'))).toString('hex');
    db.sqlite.prepare("UPDATE users SET password_hash = ? WHERE id = 'secondary'").run(hash);
    const response = await worker.fetch(new Request('https://example.test/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'secondary@test.dev', password: 'verified-test-password' }),
    }), environment());
    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty('token');
  });

  it('refuses a pre-link secondary session on refresh instead of exchanging its authority', async () => {
    const token = await signedToken(secret, { sub: 'secondary', session_version: 0 });
    const request = new Request('https://example.test/api/auth/refresh', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token },
    });
    expect((await worker.fetch(request, environment())).status).toBe(401);
  });
});

import { expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const path = '/api/admin/catalog-review/teas';
const origin = 'https://teajia.test';
const secret = 'catalog-owner-binding-test';

it('opens the existing packet with its canonical Google profile and keeps separate profiles denied', async () => {
  const db = new SqliteD1('migrations');
  try {
    seedIdentity(db, { userId: 'canonical', accountId: 'bali', role: 'staff', platformRole: 'platform_owner' });
    seedIdentity(db, { userId: 'alternate', accountId: 'bali', platformRole: 'platform_owner' });
    seedIdentity(db, { userId: 'bali-staff', accountId: 'bali', role: 'staff' });
    seedIdentity(db, { userId: 'second-owner', accountId: 'bali' });
    seedIdentity(db, { userId: 'other-owner', accountId: 'other' });
    db.sqlite.exec("UPDATE users SET google_id = 'subject-' || id WHERE id IN ('canonical', 'alternate')");

    const digest = 'a'.repeat(64);
    const items = [{ id: 'tea-37', title: 'Basket', status: 'Identification conflict', digest }];
    const packet = { id: 'tea-37', photos: ['private-test-photo'], evidence: 'The records disagree.' };
    const objects = new Map([
      ['owner-review/bali/catalog-reading/index.json', JSON.stringify({ ownerUserId: 'canonical', items })],
      ['owner-review/bali/catalog-reading/pages/' + digest + '.json', JSON.stringify(packet)],
      ['owner-review/other/catalog-reading/index.json', JSON.stringify({ ownerUserId: 'other-owner', items })],
      ['owner-review/other/catalog-reading/pages/' + digest + '.json', JSON.stringify({ id: 'tea-37', photos: ['other-test-photo'] })],
    ]);
    const get = async (key: string) => {
      const body = objects.get(key);
      return body === undefined ? null : new Response(body);
    };
    const env = {
      DB: db,
      JWT_SECRET: secret,
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      APP_URL: origin,
      ATLAS_BUCKET: { get, head: async (key: string) => objects.has(key) ? {} : null },
    } as unknown as Parameters<typeof worker.fetch>[1];
    const token = (user: string, account = 'bali') => signedToken(secret, {
      sub: user, email: user + '@test.dev', active_account_id: account,
    });
    const read = (bearer?: string, account = 'bali', suffix = '', method = 'GET') => worker.fetch(
      new Request(origin + path + suffix, {
        method,
        headers: bearer ? { Authorization: 'Bearer ' + bearer, 'X-Teajia-Account': account } : {},
      }), env,
    );
    async function signIn(user: 'canonical' | 'alternate') {
      const start = await worker.fetch(new Request(origin + '/api/auth/google?return=/admin/catalog-review/teas'), env);
      const state = new URL(start.headers.get('Location')!).searchParams.get('state')!;
      vi.stubGlobal('fetch', vi.fn(async (input: string) => {
        if (input === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'test-provider-token' });
        expect(input).toBe('https://www.googleapis.com/oauth2/v2/userinfo');
        return Response.json({ id: 'subject-' + user, email: user + '@test.dev', verified_email: true });
      }));
      const callback = await worker.fetch(new Request(origin + '/api/auth/google/callback?' + new URLSearchParams({ state, code: 'test-code' })), env);
      expect(callback.status).toBe(302);
      const location = new URL(callback.headers.get('Location')!);
      const bearer = new URLSearchParams(location.hash.slice(1)).get('oauth_token');
      expect(bearer).toBeTruthy();
      return bearer!;
    }

    const alternate = await signIn('alternate');
    expect((await read(alternate)).status).toBe(403);
    const canonical = await signIn('canonical');
    const index = await read(canonical);
    expect(index.status).toBe(200);
    expect(index.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await index.json()).toEqual([{ id: 'tea-37', title: 'Basket', status: 'Identification conflict' }]);
    const page = await read(canonical, 'bali', '/tea-37');
    expect(page.status).toBe(200);
    expect(await page.json()).toEqual(packet);
    expect((await read(canonical, 'bali', '/tea-37', 'HEAD')).status).toBe(200);

    // The optional one-row alias resolves a fresh Google sign-in to the same
    // canonical subject. It confers no access on the old alternate session.
    db.sqlite.prepare('INSERT INTO user_google_login_aliases (google_subject, source_user_id, profile_user_id) VALUES (?, ?, ?)')
      .run('subject-alternate', 'alternate', 'canonical');
    expect((await read(await signIn('alternate'))).status).toBe(200);
    expect((await read(alternate)).status).toBe(403);
    db.sqlite.prepare('DELETE FROM user_google_login_aliases WHERE google_subject = ?').run('subject-alternate');
    expect((await read(await signIn('alternate'))).status).toBe(403);

    const other = await token('other-owner', 'other');
    expect((await read(other, 'other')).status).toBe(200);
    for (const [bearer, account, status] of [
      [undefined, 'bali', 401],
      [await token('bali-staff'), 'bali', 403],
      [await token('second-owner'), 'bali', 403],
      [other, 'bali', 403],
      [canonical, 'other', 403],
    ] as const) {
      for (const suffix of ['', '/tea-37']) {
        const denied = await read(bearer, account, suffix);
        expect(denied.status).toBe(status);
        expect(denied.headers.get('Cache-Control')).toBe('private, no-store');
        expect(await denied.text()).toBe('');
      }
    }
  } finally {
    vi.unstubAllGlobals();
    db.close();
  }
});

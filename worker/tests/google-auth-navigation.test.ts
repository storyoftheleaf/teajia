import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

const env = {
  JWT_SECRET: 'google-return-test',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  APP_URL: 'https://teajia.com',
  DB: {
    prepare: () => ({
      bind() { return this; },
      first: async () => ({ id: 'user', email: 'tea@example.com', name: 'Tea', role: 'user', session_version: 0 }),
      all: async () => ({ results: [] }),
    }),
  },
} as any;

async function start(returnTo?: string) {
  const query = returnTo === undefined ? '' : `?return=${encodeURIComponent(returnTo)}`;
  const response = await worker.fetch(new Request(`https://api.test/api/auth/google${query}`), env);
  return new URL(response.headers.get('Location')!).searchParams.get('state')!;
}

async function callback(query: Record<string, string>) {
  const response = await worker.fetch(new Request(`https://api.test/api/auth/google/callback?${new URLSearchParams(query)}`), env);
  expect(response.status).toBe(302);
  return new URL(response.headers.get('Location')!);
}

afterEach(() => vi.unstubAllGlobals());

describe('Google sign-in uses the shared sign-in destination', () => {
  it('defaults to sign-in instead of the staff screen', async () => {
    const destination = await callback({ state: await start(), error: 'access_denied' });
    expect(destination.pathname).toBe('/signin');
    expect(destination.searchParams.get('oauth_error')).toBe('access_denied');
  });

  it('preserves a verified return destination when Google is cancelled', async () => {
    const destination = await callback({ state: await start('/admin/inventory?view=low#tea'), error: 'access_denied' });
    expect(destination.pathname).toBe('/signin');
    expect(destination.searchParams.get('returnTo')).toBe('/admin/inventory?view=low#tea');
    expect(destination.searchParams.get('oauth_error')).toBe('access_denied');
  });

  it.each([
    [{}, 'missing_params'],
    [{ code: 'code', state: 'invalid' }, 'invalid_state'],
    [{ error: 'access_denied', state: 'invalid' }, 'invalid_state'],
  ])('keeps unverified callbacks on sign-in: %j', async (query, expectedError) => {
    const destination = await callback(query);
    expect(destination.pathname).toBe('/signin');
    expect(destination.searchParams.get('oauth_error')).toBe(expectedError);
  });

  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil.test'])('rejects unsafe return %j', async returnTo => {
    const destination = await callback({ state: await start(returnTo), error: 'access_denied' });
    expect(destination.origin).toBe('https://teajia.com');
    expect(destination.pathname).toBe('/signin');
    expect(destination.searchParams.has('returnTo')).toBe(false);
  });

  it('places provider errors in the query while retaining the original return fragment', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 400 })));
    const path = '/signin?returnTo=' + encodeURIComponent('/events?upcoming=1#booking');
    const destination = await callback({ state: await start(path), code: 'code' });
    expect(destination.pathname).toBe('/signin');
    expect(destination.searchParams.get('returnTo')).toBe('/events?upcoming=1#booking');
    expect(destination.searchParams.get('oauth_error')).toBe('token_exchange_failed');
  });

  it('delivers the token once through sign-in without losing the intended destination', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
      url.includes('/token') ? { access_token: 'access' } : { id: 'google', email: 'tea@example.com', name: 'Tea', verified_email: true },
    ))));
    const returnTo = '/events?upcoming=1#booking';
    const destination = await callback({ state: await start(returnTo), code: 'code' });
    expect(destination.pathname).toBe('/signin');
    expect(destination.searchParams.get('returnTo')).toBe(returnTo);
    const token = new URLSearchParams(destination.hash.slice(1)).get('oauth_token');
    expect(token?.split('.')).toHaveLength(3);
  });
});

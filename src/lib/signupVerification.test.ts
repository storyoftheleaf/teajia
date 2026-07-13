import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

describe('email-verified signup API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a pending signup without treating it as an authenticated session', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      verification_required: true,
      signup_token: 'pending-secret',
    }), { status: 202, headers: { 'content-type': 'application/json' } }));

    await expect(api.auth.signup('Person@Example.com', 'secret1', 'Person')).resolves.toEqual({
      email: 'Person@Example.com',
      signupToken: 'pending-secret',
    });
  });

  it('submits the six-digit code with its email and purpose-bound signup token', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ token: 'session-token' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(api.auth.verifySignup({
      email: 'person@example.com',
      signupToken: 'pending-secret',
    }, '123456')).resolves.toEqual({ token: 'session-token' });

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/signup\/verify$/), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'person@example.com',
        code: '123456',
        signup_token: 'pending-secret',
      }),
    }));
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  clearPendingSignup,
  restorePendingSignup,
} from './api';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('email-verified signup API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('sessionStorage', memoryStorage());
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
      expiresAt: expect.any(Number),
      recoverableUntil: expect.any(Number),
    });

    const stored = JSON.stringify(restorePendingSignup());
    expect(stored).toContain('pending-secret');
    expect(stored).not.toContain('secret1');
    expect(stored).not.toContain('123456');
  });

  it('submits the six-digit code with its email and purpose-bound signup token', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ token: 'session-token' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(api.auth.verifySignup({
      email: 'person@example.com',
      signupToken: 'pending-secret',
      expiresAt: Date.now() + 60_000,
      recoverableUntil: Date.now() + 120_000,
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

  it('restores an unexpired pending signup after a remount and clears it explicitly', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      verification_required: true,
      signup_token: 'reload-secret',
    }), { status: 202, headers: { 'content-type': 'application/json' } }));
    const pending = await api.auth.signup('reload@example.com', 'secret1', 'Reload');

    expect(restorePendingSignup()).toEqual(pending);
    clearPendingSignup();
    expect(restorePendingSignup()).toBeNull();
  });

  it('keeps purpose-bound proof across code expiry and clears it after the recovery window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T00:00:00Z'));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      verification_required: true,
      signup_token: 'expired-secret',
    }), { status: 202, headers: { 'content-type': 'application/json' } }));
    await api.auth.signup('expired@example.com', 'secret1', 'Expired');
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    const expired = restorePendingSignup();
    expect(expired).toMatchObject({ email: 'expired@example.com', signupToken: 'expired-secret' });
    expect(restorePendingSignup()).toEqual(expired);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      verification_required: true,
      signup_token: 'recovered-secret',
    }), { status: 202, headers: { 'content-type': 'application/json' } }));
    const recovered = await api.auth.resendSignup(expired!);
    expect(recovered.signupToken).toBe('recovered-secret');
    expect(restorePendingSignup()).toEqual(recovered);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(restorePendingSignup()).toBeNull();
    vi.useRealTimers();
  });

  it('resends with the old purpose-bound token and persists the rotated token', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      verification_required: true,
      signup_token: 'rotated-secret',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const pending = {
      email: 'person@example.com',
      signupToken: 'old-secret',
      expiresAt: Date.now() - 1,
      recoverableUntil: Date.now() + 60_000,
    };

    const rotated = await api.auth.resendSignup(pending);

    expect(rotated).toMatchObject({ email: pending.email, signupToken: 'rotated-secret' });
    expect(restorePendingSignup()).toEqual(rotated);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/signup\/resend$/), expect.objectContaining({
      body: JSON.stringify({ email: pending.email, signup_token: 'old-secret' }),
    }));
  });
});

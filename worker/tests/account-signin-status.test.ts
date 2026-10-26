import { describe, expect, it } from 'vitest';
import worker from '../src/index';

async function sessionToken() {
  const encode = (value: unknown) => btoa(JSON.stringify(value));
  const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'reader', email: 'reader@example.com', role: 'user', exp: Math.floor(Date.now() / 1000) + 86400 * 30, session_version: 0 })}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

describe('account sign-in status is explicit and private', () => {
  it.each([
    [{ password_hash: '', google_id: 'provider-private', email_verified_at: '2026-10-17' }, { has_password: false, google_connected: true, email_verified: true }],
    [{ password_hash: 'password-private', google_id: null, email_verified_at: null }, { has_password: true, google_connected: false, email_verified: false }],
  ])('returns safe status flags without provider or password secrets', async (fields, expected) => {
    const user = { id: 'reader', email: 'reader@example.com', role: 'user', session_version: 0, ...fields };
    const env = { JWT_SECRET: 'test-secret', DB: { prepare: () => ({ bind() { return this; }, first: async () => user, all: async () => ({ results: [user] }) }) } } as any;
    const response = await worker.fetch(new Request('https://api.test/api/auth/me', { headers: { Authorization: `Bearer ${await sessionToken()}` } }), env);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject(expected);
    expect(body).not.toHaveProperty('password_hash');
    expect(body).not.toHaveProperty('google_id');
    expect(JSON.stringify(body)).not.toContain('private');
  });
});

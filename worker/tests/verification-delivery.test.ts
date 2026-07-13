import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverVerificationCode } from '../src/verificationDelivery';

const env = {
  RESEND_API_KEY: 'resend-secret-key',
  SENDER_EMAIL: 'verify@teajia.test',
  SENDER_NAME: 'Teajia Verify',
};
const input = { email: 'person@example.test', code: '123456', purpose: 'signin' as const };

afterEach(() => vi.restoreAllMocks());

function expectSafeLogs(spy: ReturnType<typeof vi.spyOn>) {
  const logs = spy.mock.calls.flat().map(String).join(' ');
  expect(logs).not.toContain(input.code);
  expect(logs).not.toContain(input.email);
  expect(logs).not.toContain(env.RESEND_API_KEY);
}

describe('verification email delivery', () => {
  it('sends through Resend and returns the provider message id', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }));
    const result = await deliverVerificationCode(env, input, fetcher as typeof fetch);

    expect(result).toEqual({ delivered: true, providerMessageId: 'email-1' });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init).toMatchObject({ method: 'POST' });
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: 'Teajia Verify <verify@teajia.test>',
      to: [input.email],
      subject: 'Your Teajia sign-in code',
    });
    expect(String(JSON.parse(String(init?.body)).html)).toContain(input.code);
  });

  it('marks provider outages and network failures retryable without logging secrets', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unavailable = await deliverVerificationCode(env, input, vi.fn(async () => new Response('', { status: 503 })) as typeof fetch);
    const networkError = await deliverVerificationCode(env, input, vi.fn(async () => { throw new Error(`network failure ${input.email} ${input.code} ${env.RESEND_API_KEY}`); }) as typeof fetch);

    expect(unavailable).toEqual({ delivered: false, retryable: true, reason: 'provider_unavailable' });
    expect(networkError).toEqual({ delivered: false, retryable: true, reason: 'provider_unavailable' });
    expectSafeLogs(error);
  });

  it.each([408, 429])('marks transient HTTP %s responses retryable', async status => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await deliverVerificationCode(env, input, vi.fn(async () => new Response('', { status })) as typeof fetch);

    expect(result).toEqual({ delivered: false, retryable: true, reason: 'provider_unavailable' });
    expectSafeLogs(error);
  });

  it.each([
    ['malformed JSON', new Response('not-json', { status: 200 })],
    ['missing id', new Response(JSON.stringify({}), { status: 200 })],
    ['empty id', new Response(JSON.stringify({ id: '  ' }), { status: 200 })],
  ])('rejects a 2xx response with %s without leaking delivery data', async (_label, response) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await deliverVerificationCode(env, input, vi.fn(async () => response) as typeof fetch);

    expect(result).toEqual({ delivered: false, retryable: true, reason: 'provider_unavailable' });
    expectSafeLogs(error);
  });

  it('marks provider rejection non-retryable and keeps logs redacted', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await deliverVerificationCode(env, input, vi.fn(async () => new Response('', { status: 422 })) as typeof fetch);

    expect(result).toEqual({ delivered: false, retryable: false, reason: 'provider_rejected' });
    expectSafeLogs(error);
  });

  it('fails safely when provider configuration is missing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi.fn();
    const result = await deliverVerificationCode({}, input, fetcher as typeof fetch);

    expect(result).toEqual({ delivered: false, retryable: false, reason: 'provider_not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
    expectSafeLogs(error);
  });
});

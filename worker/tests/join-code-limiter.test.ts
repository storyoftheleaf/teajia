import { describe, expect, it } from 'vitest';
import worker from '../src/index';

class FakeLimiter {
  keys: string[] = [];
  constructor(private outcomes: Array<boolean | Error>) {}
  async limit({ key }: { key: string }) {
    this.keys.push(key);
    const outcome = this.outcomes.shift() ?? true;
    if (outcome instanceof Error) throw outcome;
    return { success: outcome };
  }
}

async function redeem(env: Record<string, unknown> = {}, ip = '203.0.113.4') {
  const response = await worker.fetch(new Request('https://test.dev/api/auth/join-code/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: '{}',
  }), { DB: { prepare: () => { throw new Error('DB must not be reached'); } }, JWT_SECRET: 'secret', ...env } as any);
  return { status: response.status, body: await response.json() as any };
}

describe('join-code durable limiter', () => {
  it('supports exhaustion and recovery without sharing the verification binding', async () => {
    const join = new FakeLimiter([false, true]);
    const verify = new FakeLimiter([false]);
    expect((await redeem({ JOIN_CODE_LIMITER: join, VERIFY_LIMITER: verify })).status).toBe(429);
    expect((await redeem({ JOIN_CODE_LIMITER: join, VERIFY_LIMITER: verify })).status).toBe(400);
    expect(join.keys).toEqual(['203.0.113.4', '203.0.113.4']);
    expect(verify.keys).toEqual([]);
  });

  it('fails closed on binding exceptions but permits missing local bindings', async () => {
    expect(await redeem({ JOIN_CODE_LIMITER: new FakeLimiter([new Error('offline')]) })).toEqual({
      status: 503,
      body: { error: 'Rate limit service unavailable', code: 'rate_limit_unavailable' },
    });
    expect((await redeem()).status).toBe(400);
  });
});

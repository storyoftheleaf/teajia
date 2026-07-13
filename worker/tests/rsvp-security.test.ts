import { describe, expect, it } from 'vitest';
import worker from '../src/index';

class RsvpDb {
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const statement = {
      bind: () => statement,
      first: async () => {
        if (normalized.includes('from events where slug')) return { id: 'event-1', account_id: 'account-1', total_capacity: 10, claim_window_minutes: 30, requires_approval: 0 };
        if (normalized.includes('from event_attendees')) return { magic_token: 'bearer-secret', status: 'confirmed' };
        return null;
      },
    };
    return statement;
  }
}

async function duplicate(env: Record<string, unknown> = {}) {
  const response = await worker.fetch(new Request('https://test.dev/api/events/tea-night/rsvp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.8' },
    body: JSON.stringify({ full_name: 'Guest', email: 'guest@example.com' }),
  }), { DB: new RsvpDb(), JWT_SECRET: 'secret', ...env } as any);
  return { status: response.status, body: await response.json() as any };
}

describe('public RSVP security', () => {
  it('never discloses the existing RSVP bearer token to a matching public contact', async () => {
    const result = await duplicate();
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, existing: true });
    expect(JSON.stringify(result.body)).not.toContain('bearer-secret');
    expect(result.body).not.toHaveProperty('magic_token');
    expect(result.body).not.toHaveProperty('redirect_url');
  });

  it('uses the durable RSVP limiter and fails closed on binding errors', async () => {
    expect((await duplicate({ RSVP_LIMITER: { limit: async () => ({ success: false }) } })).body).toMatchObject({ code: 'rate_limited' });
    expect((await duplicate({ RSVP_LIMITER: { limit: async () => { throw new Error('offline'); } } })).body).toMatchObject({ code: 'rate_limit_unavailable' });
  });
});

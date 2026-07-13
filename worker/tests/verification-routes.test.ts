import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

type Challenge = { id: string; contact_normalized: string; purpose: string; code_hash: string; expires_at: string; failed_attempts: number; delivered_at: string; consumed_at: string | null; created_at: string };
const deliveryCalls: any[] = [];

class VerificationDb {
  challenges: Challenge[] = [];
  user = { id: 'user-1', email: 'member@example.com', username: 'member', name: 'Member', role: 'staff', platform_role: null };
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase(); let values: any[] = [];
    const statement = {
      bind: (...input: any[]) => { values = input; return statement; },
      first: async () => {
        if (normalized.includes('from verification_challenges')) return this.challenges.filter(row => row.contact_normalized === values[0] && row.purpose === values[1]).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
        if (normalized.includes('from users where lower(email)')) return values[0] === this.user.email ? this.user : null;
        if (normalized.includes('from event_attendees') && normalized.includes('magic_token')) return values[0] === 'magic' && values.includes('guest@example.com') ? { id: 'attendee-1', account_id: 'account-platform', event_id: 'event-1' } : null;
        if (normalized.includes('from customers')) return values.includes('guest@example.com') && (!normalized.includes('account_id = ?') || values.includes('account-platform')) ? { id: 'customer-1', account_id: 'account-platform', name: 'Guest', phone: null, email: 'guest@example.com' } : null;
        if (normalized.includes('from accounts where is_platform_owner')) return { id: 'account-platform' };
        return null;
      },
      all: async () => {
        if (normalized.includes('from account_members')) return { results: [{ account_id: 'account-1', role: 'staff', permissions: '{"bundles":["catalog"]}', slug: 'store', name: 'Store', kind: 'location', is_platform_owner: 0 }] };
        if (normalized.includes('select ea.id as attendee_id')) return { results: normalized.includes('ea.account_id = ?') && values.includes('account-platform') ? [{ attendee_id: 'attendee-1', event_id: 'event-1', title: 'Tea', event_date: '2026-08-01', flyer_image_url: null }] : [{ attendee_id: 'attendee-1', event_id: 'event-1', title: 'Tea' }, { attendee_id: 'attendee-b', event_id: 'event-b', title: 'Other tenant' }] };
        if (normalized.includes('from event_tasting_notes')) return { results: [] };
        if (normalized.includes('from event_attendees')) return { results: [{ magic_token: 'magic', status: 'confirmed', event_id: 'event-1', event_title: 'Tea', event_date: '2026-08-01' }] };
        return { results: [] };
      },
      run: async () => {
        if (normalized.startsWith('insert into verification_challenges')) {
          this.challenges.push({ id: values[0], contact_normalized: values[1], purpose: values[2], code_hash: values[3], expires_at: values[4], failed_attempts: 0, delivered_at: values[5], consumed_at: null, created_at: new Date().toISOString() });
          return { success: true, meta: { changes: 1 } };
        }
        if (normalized.startsWith('update verification_challenges') && normalized.includes('failed_attempts = failed_attempts + 1')) {
          const row = this.challenges.find(item => item.id === values[0] && !item.consumed_at);
          if (!row) return { success: true, meta: { changes: 0 } };
          row.failed_attempts += 1; if (row.failed_attempts >= 3) row.consumed_at = new Date().toISOString();
          return { success: true, meta: { changes: 1 } };
        }
        if (normalized.startsWith('update verification_challenges') && normalized.includes('set consumed_at')) {
          const row = this.challenges.find(item => item.id === values[0] && !item.consumed_at && item.code_hash === values[1] && new Date(item.expires_at) > new Date() && item.failed_attempts < 3);
          if (!row) return { success: true, meta: { changes: 0 } }; row.consumed_at = new Date().toISOString(); return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 0 } };
      },
    }; return statement;
  }
}

let ipSequence = 0;
async function api(db: VerificationDb, path: 'request' | 'confirm', body: any, env: Record<string, unknown> = {}) {
  const response = await worker.fetch(new Request(`https://test.dev/api/verify/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `verification-${++ipSequence}` }, body: JSON.stringify(body) }), { DB: db, JWT_SECRET: 'jwt-secret', RESEND_API_KEY: 'resend-secret', SENDER_EMAIL: 'verify@teajia.test', ...env } as any);
  return { status: response.status, body: await response.json() as any };
}

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

afterEach(() => { vi.restoreAllMocks(); deliveryCalls.length = 0; vi.useRealTimers(); });

describe('purpose-aware verification routes', () => {
  it('uses the dedicated durable limiter and fails closed when it is unavailable', async () => {
    const denied = new FakeLimiter([false, true]);
    expect((await api(new VerificationDb(), 'request', {}, { VERIFY_LIMITER: denied })).status).toBe(429);
    expect((await api(new VerificationDb(), 'request', {}, { VERIFY_LIMITER: denied })).status).toBe(400);
    expect(denied.keys).toHaveLength(2);

    const broken = new FakeLimiter([new Error('binding unavailable')]);
    expect(await api(new VerificationDb(), 'request', {}, { VERIFY_LIMITER: broken })).toEqual({
      status: 503,
      body: { error: 'Rate limit service unavailable', code: 'rate_limit_unavailable' },
    });
  });
  it('delivers normalized sign-in codes, stores only a hash, and issues password-equivalent claims', async () => {
    const db = new VerificationDb(); let issuedCode = '';
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Math.random must not be used'); });
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array: any) => { array[0] = 42; return array; });
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { const payload = JSON.parse(String(init?.body)); deliveryCalls.push(payload); issuedCode = payload.html.match(/<strong>(\d{6})<\/strong>/)[1]; return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }); }));
    const requested = await api(db, 'request', { contact: ' Member@Example.com ', purpose: 'signin' });
    expect(requested).toMatchObject({ status: 202, body: { success: true, retryable: true } });
    expect(requested.body).not.toHaveProperty('code');
    expect(deliveryCalls[0]).toMatchObject({ to: ['member@example.com'] });
    expect(db.challenges[0].code_hash).not.toBe(issuedCode);
    const plainDigest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(issuedCode)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    expect(db.challenges[0].code_hash).not.toBe(plainDigest);
    expect(mathRandom).not.toHaveBeenCalled();
    expect(new Date(db.challenges[0].expires_at).getTime() - new Date(db.challenges[0].created_at).getTime()).toBeCloseTo(600_000, -2);
    const confirmed = await api(db, 'confirm', { contact: 'member@example.com', code: issuedCode, purpose: 'signin' });
    expect(confirmed).toMatchObject({ status: 200, body: { token: expect.any(String), memberships: [expect.objectContaining({ account_id: 'account-1' })], active_account_id: 'account-1' } });
    expect((await api(db, 'confirm', { contact: 'member@example.com', code: issuedCode, purpose: 'signin' })).status).toBe(401);
  });

  it('rejects the right code when verified with the wrong HMAC secret', async () => {
    const db = new VerificationDb();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 })));
    const requested = await api(db, 'request', { contact: 'member@example.com', purpose: 'signin' }, { DEV_RETURN_VERIFY_CODES: 'true', VERIFICATION_CODE_SECRET: 'secret-a' });
    expect((await api(db, 'confirm', { contact: 'member@example.com', code: requested.body.code, purpose: 'signin' }, { VERIFICATION_CODE_SECRET: 'secret-b' })).status).toBe(401);
  });

  it('keeps event confirmation response compatibility and dev echo explicit', async () => {
    const db = new VerificationDb(); let issuedCode = '';
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { const payload = JSON.parse(String(init?.body)); issuedCode = payload.html.match(/<strong>(\d{6})<\/strong>/)[1]; return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }); }));
    const requested = await api(db, 'request', { contact: 'guest@example.com' }, { DEV_RETURN_VERIFY_CODES: 'true' });
    expect(requested.body.code).toBe(issuedCode);
    expect(await api(db, 'confirm', { contact: 'guest@example.com', code: issuedCode })).toMatchObject({ status: 200, body: { customer: expect.any(Object), attendances: expect.any(Array) } });
  });

  it('persists no challenge when delivery fails and returns explicit retryability', async () => {
    const db = new VerificationDb(); vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect(await api(db, 'request', { contact: 'member@example.com', purpose: 'signin' })).toEqual({ status: 503, body: { error: 'We could not send the code.', retryable: true } });
    expect(db.challenges).toEqual([]);
  });

  it('rate-limits resend for sixty seconds and locks after three failures', async () => {
    const db = new VerificationDb(); vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 })));
    await api(db, 'request', { contact: 'member@example.com', purpose: 'signin' });
    expect((await api(db, 'request', { contact: 'member@example.com', purpose: 'signin' })).status).toBe(429);
    for (let attempt = 0; attempt < 3; attempt++) expect((await api(db, 'confirm', { contact: 'member@example.com', code: '000000', purpose: 'signin' })).status).toBe(attempt === 2 ? 429 : 401);
    expect(db.challenges[0].failed_attempts).toBe(3);
  });

  it('rejects expired codes with the same generic sign-in error', async () => {
    const db = new VerificationDb(); vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 })));
    const requested = await api(db, 'request', { contact: 'member@example.com', purpose: 'signin' }, { DEV_RETURN_VERIFY_CODES: 'true' });
    db.challenges[0].expires_at = new Date(Date.now() - 1).toISOString();
    expect(await api(db, 'confirm', { contact: 'member@example.com', code: requested.body.code, purpose: 'signin' })).toEqual({ status: 401, body: { error: 'Invalid or expired verification code' } });
  });

  it('authorizes an email journey with the returned attendance magic token', async () => {
    const db = new VerificationDb();
    const response = await worker.fetch(
      new Request('https://test.dev/api/journey/guest%40example.com?token=magic'),
      { DB: db, JWT_SECRET: 'jwt-secret' } as any,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      customer: { id: 'customer-1', name: 'Guest' },
      sessions_attended: 1,
      seals: [{ event_id: 'event-1', title: 'Tea' }],
    });
  });

  it('does not include another account journey for the same email', async () => {
    const response = await worker.fetch(new Request('https://test.dev/api/journey/guest%40example.com?token=magic'), { DB: new VerificationDb(), JWT_SECRET: 'jwt-secret' } as any);
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.seals).toEqual([{ event_id: 'event-1', title: 'Tea', date: '2026-08-01', flyer_url: null }]);
    expect(JSON.stringify(body)).not.toContain('event-b');
  });
});

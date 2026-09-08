import { describe, expect, it } from 'vitest';
import worker from '../src/index';

/**
 * SEC-1, SEC-2, SEC-5: the checkout inquiry and newsletter endpoints had no
 * rate limit, the consult branch had no length cap, and an absent durable
 * limiter binding was silently permitted rather than refused. This file
 * pins the fix for all three, and the class fix (enforceDurableLimit itself
 * refusing on an absent binding) is proven once here and inherited by every
 * other caller.
 */

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

class WritesOnlyDb {
  rows: Record<string, unknown>[] = [];
  // Fixed answer for the cart branch's own account lookup (getPublicAccountIdBySlug),
  // so a cart payload can reach its post-lookup field checks (Location, Phone)
  // instead of stopping at "Store not found" first.
  accountId = 'acc_cart_test';
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: unknown[] = [];
    const statement = {
      bind: (...next: unknown[]) => { values = next; return statement; },
      first: async () => (normalized.startsWith('select id from accounts') ? { id: this.accountId } : null),
      all: async () => ({ results: [] }),
      run: async () => {
        const table = normalized.startsWith('insert into inquiries') ? 'inquiries'
          : normalized.startsWith('insert or ignore into newsletter_subscribers') ? 'newsletter_subscribers'
          : null;
        if (table) {
          const columns = sql.match(/\(([^)]+)\)/)?.[1].split(',').map((column) => column.trim()) ?? [];
          this.rows.push({ table, ...Object.fromEntries(columns.map((column, index) => [column, values[index]])) });
        }
        return { success: true, meta: { changes: table ? 1 : 0 } };
      },
    };
    return statement;
  }
}

function consultPayload(overrides: Record<string, unknown> = {}) {
  return {
    source: 'consult',
    name: 'A Customer',
    email: 'customer@example.com',
    vision: 'A short, ordinary consult message.',
    ...overrides,
  };
}

function cartPayload(overrides: Record<string, unknown> = {}) {
  return {
    source: 'cart',
    name: 'A Customer',
    email: 'customer@example.com',
    store_slug: 'bali',
    tracking_token: 'a'.repeat(40),
    ref_number: 'REF-0001',
    total_estimate_usd: 10,
    currency: 'USD',
    customer_location: 'Bali',
    phone: '+62 812 0000 0000',
    items: [
      { custom: true, name: 'Custom Tea', category: 'tea', quantityGrams: 50, pricePerGram: 0.2, totalPrice: 10, storeSlug: 'bali' },
    ],
    ...overrides,
  };
}

async function postInquiry(db: WritesOnlyDb, payload: Record<string, unknown>, env: Record<string, unknown> = {}, ip = '203.0.113.20') {
  return worker.fetch(new Request('https://api.test/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(payload),
  }), { DB: db, ...env } as never, {} as never);
}

async function postNewsletter(db: WritesOnlyDb, email: string, env: Record<string, unknown> = {}, ip = '203.0.113.21') {
  return worker.fetch(new Request('https://api.test/api/newsletter/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ email }),
  }), { DB: db, ...env } as never, {} as never);
}

describe('inquiry and newsletter rate limiting (SEC-1, SEC-2)', () => {
  it('refuses the 26th inquiry post in a window once the durable limiter says so', async () => {
    const db = new WritesOnlyDb();
    const outcomes: boolean[] = Array.from({ length: 25 }, () => true);
    outcomes.push(false);
    const limiter = new FakeLimiter(outcomes);
    const statuses: number[] = [];
    for (let i = 0; i < 26; i += 1) {
      const response = await postInquiry(db, consultPayload({ vision: `Vision ${i}` }), { INQUIRY_LIMITER: limiter });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 25).every((status) => status === 201)).toBe(true);
    expect(statuses[25]).toBe(429);
    expect(limiter.keys).toHaveLength(26);
    expect(new Set(limiter.keys)).toEqual(new Set(['inquiry:203.0.113.20']));
    expect(db.rows.filter((row) => row.table === 'inquiries')).toHaveLength(25);
  });

  it('refuses the 6th newsletter post in a window once the durable limiter says so', async () => {
    const db = new WritesOnlyDb();
    const limiter = new FakeLimiter([true, true, true, true, true, false]);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await postNewsletter(db, `person${i}@example.com`, { NEWSLETTER_LIMITER: limiter });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('refuses an inquiry request when INQUIRY_LIMITER is not configured, instead of allowing it', async () => {
    const db = new WritesOnlyDb();
    const response = await postInquiry(db, consultPayload());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Rate limit service unavailable', code: 'rate_limit_unavailable' });
    expect(db.rows).toHaveLength(0);
  });

  it('refuses a newsletter request when NEWSLETTER_LIMITER is not configured, instead of allowing it', async () => {
    const db = new WritesOnlyDb();
    const response = await postNewsletter(db, 'someone@example.com');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Rate limit service unavailable', code: 'rate_limit_unavailable' });
    expect(db.rows).toHaveLength(0);
  });

  it('refuses when a durable binding throws, the same as when it is absent', async () => {
    const db = new WritesOnlyDb();
    const broken = new FakeLimiter([new Error('binding unavailable')]);
    const response = await postInquiry(db, consultPayload(), { INQUIRY_LIMITER: broken });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Rate limit service unavailable', code: 'rate_limit_unavailable' });
  });

  const openLimiter = () => ({ INQUIRY_LIMITER: { limit: async () => ({ success: true }) } });

  it.each([
    { field: 'name', label: 'Name', value: 'x'.repeat(201) },
    { field: 'email', label: 'Contact', value: `${'x'.repeat(195)}@example.com` },
    { field: 'vision', label: 'Message', value: 'x'.repeat(4001) },
    { field: 'referral', label: 'Referral', value: 'x'.repeat(201) },
    { field: 'location', label: 'Location', value: 'x'.repeat(201) },
    { field: 'whatsapp', label: 'WhatsApp', value: 'x'.repeat(51) },
  ])('refuses an over-length consult $field with a 4xx naming the field', async ({ field, label, value }) => {
    const db = new WritesOnlyDb();
    const response = await postInquiry(db, consultPayload({ [field]: value }), openLimiter());
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toContain(label);
    expect(db.rows).toHaveLength(0);
  });

  it.each([
    { field: 'customer_location', label: 'Location', value: 'x'.repeat(201) },
    { field: 'phone', label: 'Phone', value: 'x'.repeat(51) },
    { field: 'ref_number', label: 'Order reference', value: 'x'.repeat(101) },
  ])('refuses an over-length cart $field with a 4xx naming the field', async ({ field, label, value }) => {
    const db = new WritesOnlyDb();
    const response = await postInquiry(db, cartPayload({ [field]: value }), openLimiter());
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toContain(label);
    expect(db.rows).toHaveLength(0);
  });

  it('still accepts and stores an ordinary cart inquiry once past the caps', async () => {
    const db = new WritesOnlyDb();
    const response = await postInquiry(db, cartPayload(), openLimiter());
    expect(response.status).toBe(201);
    expect(db.rows.filter((row) => row.table === 'inquiries')).toHaveLength(1);
  });

  it('refuses too many interests and an over-length interest, each naming the problem', async () => {
    const db = new WritesOnlyDb();
    const tooMany = await postInquiry(db, consultPayload({
      interests: Array.from({ length: 13 }, (_, i) => `Interest ${i}`),
    }), openLimiter());
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json() as { error: string }).error).toContain('Interests');

    const tooLong = await postInquiry(db, consultPayload({ interests: ['x'.repeat(81)] }), openLimiter());
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json() as { error: string }).error).toContain('interest');
  });

  it('refuses an over-length email on the newsletter form, naming the field', async () => {
    const db = new WritesOnlyDb();
    const response = await postNewsletter(db, `${'x'.repeat(250)}@example.com`, {
      NEWSLETTER_LIMITER: { limit: async () => ({ success: true }) },
    });
    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toContain('Email');
    expect(db.rows).toHaveLength(0);
  });

  it('refuses an inquiry whose declared Content-Length is far beyond any legitimate payload, before parsing it', async () => {
    const db = new WritesOnlyDb();
    const response = await worker.fetch(new Request('https://api.test/api/inquiries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.20',
        'Content-Length': String(2 * 1024 * 1024),
      },
      body: JSON.stringify(consultPayload()),
    }), { DB: db, ...openLimiter() } as never, {} as never);
    expect(response.status).toBe(413);
    expect((await response.json() as { error: string }).error).toBe('Upload too large');
    expect(db.rows).toHaveLength(0);
  });

  it('refuses a newsletter signup whose declared Content-Length is far beyond a legitimate payload, before parsing it', async () => {
    const db = new WritesOnlyDb();
    const response = await worker.fetch(new Request('https://api.test/api/newsletter/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.21',
        'Content-Length': String(2 * 1024 * 1024),
      },
      body: JSON.stringify({ email: 'customer@example.com' }),
    }), { DB: db, NEWSLETTER_LIMITER: { limit: async () => ({ success: true }) } } as never, {} as never);
    expect(response.status).toBe(413);
    expect((await response.json() as { error: string }).error).toBe('Upload too large');
    expect(db.rows).toHaveLength(0);
  });

  it('still accepts and stores an ordinary consult inquiry once past the caps', async () => {
    const db = new WritesOnlyDb();
    const response = await postInquiry(db, consultPayload({
      interests: ['Tea sourcing'],
      referral: 'A friend',
      location: 'Bali',
      whatsapp: '+62 812 0000 0000',
    }), openLimiter());
    expect(response.status).toBe(201);
    expect(db.rows).toHaveLength(1);
    expect(String(db.rows[0].message)).toContain('A short, ordinary consult message.');
  });
});

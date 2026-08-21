import { describe, expect, it } from 'vitest';
import worker from '../src/index';

/**
 * GET /api/inquiries/:ref is public — no token, no account. The reference it
 * takes is generated client-side as `TJ-YYYYMMDD-NNN` where NNN is three
 * digits, so 900 requests enumerate an entire day of orders.
 *
 * That shape is fixable (an unguessable token is the real answer, and is
 * still to do). What is NOT acceptable in the meantime is the route handing
 * back who the customer is. These tests hold that line: whatever else this
 * endpoint returns, it never returns a name, an email address, or a phone
 * number.
 */

const INQUIRY_ROW = {
  id: 'inq_1',
  account_id: 'acc_1',
  name: 'Jane Customer',
  email: 'jane@example.com',
  phone: '+62 812 0000 0000',
  items: JSON.stringify([{ name: 'Shui Xian', qty: 2 }]),
  total_usd: 48,
  currency: 'USD',
  message: null,
  source: 'whatsapp',
  ref_number: 'TJ-20260821-137',
  status: 'new',
  created_at: '2026-08-21T00:00:00.000Z',
};

function envReturning(row: unknown) {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => row,
        }),
      }),
    },
  } as any;
}

async function getByRef(ref: string, row: unknown = INQUIRY_ROW) {
  const request = new Request(`https://api.test/api/inquiries/${encodeURIComponent(ref)}`);
  return worker.fetch(request, envReturning(row));
}

describe('the public order lookup does not identify the customer', () => {
  it('returns the order without the name, email or phone that is on the record', async () => {
    const response = await getByRef('TJ-20260821-137');
    expect(response.status).toBe(200);

    const body = await response.json() as Record<string, unknown>;

    // What a customer checking their own order legitimately needs.
    expect(body).toMatchObject({
      status: 'new',
      total_estimate_usd: 48,
      created_at: '2026-08-21T00:00:00.000Z',
    });
    expect(body.items_json).toBe(INQUIRY_ROW.items);

    // What must never cross this boundary.
    expect(body).not.toHaveProperty('customer_name');
    expect(body).not.toHaveProperty('customer_contact');
    expect(body).not.toHaveProperty('customer_location');
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('phone');
  });

  it('leaks nothing identifying anywhere in the serialized response', async () => {
    // A field-by-field check misses a value that reappears under a new name,
    // so assert against the raw text too.
    const response = await getByRef('TJ-20260821-137');
    const text = await response.text();

    expect(text).not.toContain('Jane Customer');
    expect(text).not.toContain('jane@example.com');
    expect(text).not.toContain('+62 812 0000 0000');
  });

  it('still answers not-found for an unknown reference', async () => {
    const response = await getByRef('TJ-20260821-999', null);
    expect(response.status).toBe(404);
  });
});

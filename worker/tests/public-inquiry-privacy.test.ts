import { describe, expect, it } from 'vitest';
import worker from '../src/index';

/**
 * GET /api/inquiries/:token is public — no sign-in, no account. It used to take
 * the human order reference, which the browser builds as `TJ-YYYYMMDD-NNN` with
 * three digits, so 900 requests walked an entire day of orders; and it returned
 * the customer's name, email and phone with every hit.
 *
 * It now takes an unguessable tracking token and returns nothing that
 * identifies anyone. These tests hold both halves of that line, so neither can
 * be undone by accident.
 */

const TOKEN = 'yq7Xn2_a4Kd9pR1sT6uV8wZ0bC3eF5gH';           // 32 base64url chars
const OTHER_TOKEN = 'aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV';

const INQUIRY_ROW = {
  ref_number: 'TJ-20260821-137',
  items: JSON.stringify([{ name: 'Shui Xian', qty: 2 }]),
  status: 'new',
  total_usd: 48,
  currency: 'USD',
  created_at: '2026-08-21T00:00:00.000Z',
  // Columns the row carries in the real table. The handler selects a narrow
  // set, but the fake hands the whole row back so a widened SELECT that starts
  // leaking again fails here rather than in production.
  name: 'Jane Customer',
  email: 'jane@example.com',
  phone: '+62 812 0000 0000',
};

/** Answers the row only when the query binds the SHA-256 of `expectedToken`. */
function envMatchingOnly(expectedToken: string | null) {
  return {
    DB: {
      prepare: () => ({
        bind: (...values: unknown[]) => ({
          first: async () => {
            if (!expectedToken) return null;
            const digest = await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(expectedToken),
            );
            const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
            return values[0] === hash ? INQUIRY_ROW : null;
          },
        }),
      }),
    },
  } as any;
}

async function lookup(token: string) {
  return worker.fetch(
    new Request(`https://api.test/api/inquiries/${encodeURIComponent(token)}`),
    envMatchingOnly(TOKEN),
  );
}

describe('the public order lookup', () => {
  it('answers a valid token with the order and nothing about the customer', async () => {
    const response = await lookup(TOKEN);
    expect(response.status).toBe(200);

    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      status: 'new',
      total_estimate_usd: 48,
      created_at: '2026-08-21T00:00:00.000Z',
    });

    for (const field of ['customer_name', 'customer_contact', 'customer_location', 'name', 'email', 'phone']) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it('leaks nothing identifying anywhere in the response body', async () => {
    // Field-by-field checks miss a value that reappears under a new key, so
    // assert against the raw text as well.
    const text = await (await lookup(TOKEN)).text();
    expect(text).not.toContain('Jane Customer');
    expect(text).not.toContain('jane@example.com');
    expect(text).not.toContain('+62 812 0000 0000');
  });

  it('will not answer the human order reference any more', async () => {
    // This is the point of the change: the guessable identifier is no longer a
    // key to anything.
    const response = await lookup('TJ-20260821-137');
    expect(response.status).toBe(404);
  });

  it('answers not-found for a well-formed token that matches no order', async () => {
    const response = await lookup(OTHER_TOKEN);
    expect(response.status).toBe(404);
  });
});

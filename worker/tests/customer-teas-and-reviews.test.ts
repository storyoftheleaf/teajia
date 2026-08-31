import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * Two surfaces that were asking production for columns it does not have.
 *
 * The customer's tea history read event_tea_menu.tea_type and .origin_region.
 * That table holds a custom NAME for an off-catalogue tea and nothing else, so
 * the page failed rather than falling back the way the COALESCE around it
 * suggested it would.
 *
 * Tea reviews were worse: creating one named five columns that exist nowhere
 * (voice_notes, source_sample_id, verdict, would_buy, status) and listing them
 * filtered and ordered by status, so the feature had never worked at all.
 * Migration 0005 adds them; these tests hold the round trip.
 *
 * Both run on SqliteD1, which loads worker/schema.sql, because a hand-written
 * fake answers a question about a column that does not exist and hides exactly
 * this.
 */

const JWT = 'teas-and-reviews-secret';
const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

async function call(db: SqliteD1, path: string, init: RequestInit = {}) {
  const auth = await signedToken(JWT, {
    sub: 'staff-one', email: 'staff-one@test.dev', name: 'staff-one',
    active_account_id: 'acc-one', platform_role: null,
  });
  const headers = new Headers({ Authorization: `Bearer ${auth}`, 'X-Teajia-Account': 'acc-one' });
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: init.method ?? 'GET', headers, body: init.body,
  }), { DB: db as any, JWT_SECRET: JWT } as any);
}

describe('a customer tea history built from events', () => {
  it('lists a tea tasted at an event, taking its type from the catalogue', async () => {
    const db = database();
    seedIdentity(db, { userId: 'staff-one', accountId: 'acc-one' });

    db.sqlite.exec(`
      INSERT INTO customers (id, account_id, name, email)
        VALUES ('cust-one', 'acc-one', 'Mei', 'mei@test.dev');
      INSERT INTO products (id, account_id, product_name, given_name, type, origin_region)
        VALUES ('prod-one', 'acc-one', 'Shui Xian', 'Water Sprite', 'Yancha', 'Wuyi');
      INSERT INTO events (id, account_id, slug, title, event_date, status)
        VALUES ('ev-one', 'acc-one', 'rock-tea', 'Rock Tea', '2026-05-01', 'active');
      INSERT INTO event_attendees
        (id, event_id, account_id, customer_id, full_name, phone_number, status, magic_token)
        VALUES ('att-one', 'ev-one', 'acc-one', 'cust-one', 'Mei', '1', 'confirmed', 'tok-one');
      INSERT INTO event_tea_menu (id, event_id, account_id, product_id, brew_order)
        VALUES ('menu-one', 'ev-one', 'acc-one', 'prod-one', 1);
      INSERT INTO event_tasting_notes
        (id, account_id, event_id, attendee_id, tea_menu_id, impression)
        VALUES ('note-one', 'acc-one', 'ev-one', 'att-one', 'menu-one', 'Warm stone');
    `);

    const response = await call(db, '/api/customers/cust-one/teas');
    expect(response.status).toBe(200);
    // The route answers a bare array: teas bought, then teas tasted at events.
    const rows = await response.json() as any[];
    // The type comes from the product. The menu row has never carried one.
    expect(rows.map(r => `${r.type}/${r.origin_region}/${r.source}`))
      .toContain('Yancha/Wuyi/tasted_at_event');
  });
});

describe('tea reviews', () => {
  it('writes a review with every field the form sends, and reads it back', async () => {
    const db = database();
    seedIdentity(db, { userId: 'staff-one', accountId: 'acc-one' });

    const created = await call(db, '/api/tea-reviews', {
      method: 'POST',
      body: JSON.stringify({
        tea_key: 'shui-xian',
        rating: 4,
        notes: 'Stone fruit, long finish.',
        // Each of these named a column production did not have.
        voice_notes: [{ url: 'clip-one', seconds: 12 }],
        source_sample_id: 'sample-one',
        verdict: 'keep',
        would_buy: true,
      }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      verdict: 'keep', would_buy: 1, source_sample_id: 'sample-one', status: 'submitted',
    });

    const listed = await call(db, '/api/tea-reviews?tea_key=shui-xian');
    expect(listed.status).toBe(200);
  });

  it('lists reviews for a sample, the filter that names its own column', async () => {
    const db = database();
    seedIdentity(db, { userId: 'staff-one', accountId: 'acc-one' });
    await call(db, '/api/tea-reviews', {
      method: 'POST',
      body: JSON.stringify({ tea_key: 'shui-xian', source_sample_id: 'sample-one', rating: 5 }),
    });

    const response = await call(db, '/api/tea-reviews?source_sample_id=sample-one');
    expect(response.status).toBe(200);
  });
});

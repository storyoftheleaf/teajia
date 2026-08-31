import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * Every page a signed-in customer can open, run against the real schema.
 *
 * These routes were all answering 500 in production before 2026-08-31, and no
 * test noticed, because the suite's hand-written fake databases match SQL by
 * substring and will happily answer a question naming a column that does not
 * exist. Three of these reads asked tea_compass_entries for a `deleted_at` it
 * has never had (the filter belongs to invoices, which are voided rather than
 * removed), and the journey read joined tea_samples on `sample_set_id` when the
 * column is `set_id`. SQLite rejects the whole statement in either case, so the
 * pages failed outright rather than coming back empty.
 *
 * The point of this file is therefore the DATABASE, not the assertions: it runs
 * on SqliteD1, which loads worker/schema.sql, so a column that does not exist
 * cannot be answered by a helpful stub. A 500 here means a real query is asking
 * for something the schema does not have.
 *
 * When adding a route under /api/me, add it below. An empty account is the
 * interesting case: it is the one where a broken query looks like "no data".
 */

const SECRET = 'customer-account-reads-secret';
const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

async function read(db: SqliteD1, path: string, userId: string, accountId: string) {
  const token = await signedToken(SECRET, {
    sub: userId, email: `${userId}@test.dev`, name: userId,
    active_account_id: accountId, platform_role: null,
  });
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId },
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

/** Every GET under /api/me a customer's own pages call. */
const PAGES = [
  '/api/me/profile',
  '/api/me/public-profile',
  '/api/me/profile/favorites',
  '/api/me/profile/payment-methods',
  '/api/me/queue',
  '/api/me/wishlist',
  '/api/me/journey',
  '/api/me/orders',
  '/api/me/samples',
];

describe('customer account reads', () => {
  it('answers every page for an account with nothing in it', async () => {
    const db = database();
    const { userId, accountId } = seedIdentity(db, { userId: 'reader', accountId: 'acc-reads' });

    for (const path of PAGES) {
      const response = await read(db, path, userId, accountId);
      // A refusal is a decision the route meant to make: /profile/favorites
      // answers 409 when the person has no contributor profile, which is
      // correct. A 5xx is the shape a query asking for a missing column takes,
      // and it is the only outcome this sweep is here to catch. The path is in
      // the compared value so a red run names the page rather than a number.
      const failed = response.status >= 500;
      expect(`${path} -> ${failed ? response.status : 'ok'}`).toBe(`${path} -> ok`);
    }
  });

  it('counts and lists a customer own tea, rather than only parsing', async () => {
    const db = database();
    const { userId, accountId } = seedIdentity(db, { userId: 'taster', accountId: 'acc-taster' });

    // A query can reference a wrong column and still look fine on an empty
    // table if the read is never actually exercised, so give it rows to find.
    for (const [id, name, status] of [
      ['entry-queue', 'Queued Oolong', 'available_to_taste'],
      ['entry-want', 'Wished Sheng', 'want'],
    ]) {
      db.sqlite.prepare(`INSERT INTO tea_compass_entries
        (id, user_id, account_id, name, type, status, category)
        VALUES (?, ?, ?, ?, 'Oolong', ?, 'tea')`).run(id, userId, accountId, name, status);
    }

    const profile = await read(db, '/api/me/profile', userId, accountId);
    expect(profile.status).toBe(200);
    expect(await profile.json()).toMatchObject({ queue_count: 1, wishlist_count: 1 });

    const queue = await read(db, '/api/me/queue', userId, accountId);
    const wishlist = await read(db, '/api/me/wishlist', userId, accountId);
    expect((await queue.json() as any).entries.map((e: any) => e.name)).toEqual(['Queued Oolong']);
    expect((await wishlist.json() as any).entries.map((e: any) => e.name)).toEqual(['Wished Sheng']);

    const journey = await read(db, '/api/me/journey', userId, accountId);
    expect(journey.status).toBe(200);
    expect((await journey.json() as any).compass).toHaveLength(2);
  });

  it('reads the journey of someone who has actually attended an event', async () => {
    const db = database();
    const { userId, accountId } = seedIdentity(db, { userId: 'attendee', accountId: 'acc-attendee' });

    // This is the branch an empty account never reaches, and it was still
    // broken after the first round of fixes: the query behind it is assembled
    // at runtime, so it is invisible to a check that reads whole statements,
    // and it asked event_tea_menu for a type and a region it does not have.
    db.sqlite.exec(`
      INSERT INTO customers (id, account_id, name, email, user_id)
        VALUES ('cust-j', '${accountId}', 'Journeyer', 'attendee@test.dev', '${userId}');
      INSERT INTO products (id, account_id, product_name, given_name, type, origin_region)
        VALUES ('prod-j', '${accountId}', 'Bei Dou', 'North Star', 'Yancha', 'Wuyi');
      INSERT INTO events (id, account_id, slug, title, event_date, status)
        VALUES ('ev-j', '${accountId}', 'north-star', 'North Star', '2026-04-01', 'active');
      INSERT INTO event_attendees
        (id, event_id, account_id, customer_id, full_name, phone_number, status, attended, magic_token)
        VALUES ('att-j', 'ev-j', '${accountId}', 'cust-j', 'Journeyer', '9', 'confirmed', 1, 'tok-j');
      INSERT INTO event_tea_menu (id, event_id, account_id, product_id, brew_order)
        VALUES ('menu-j', 'ev-j', '${accountId}', 'prod-j', 1);
      INSERT INTO event_tasting_notes
        (id, account_id, event_id, attendee_id, tea_menu_id, impression)
        VALUES ('note-j', '${accountId}', 'ev-j', 'att-j', 'menu-j', 'Cool granite');
    `);

    const response = await read(db, '/api/me/journey', userId, accountId);
    expect(response.status).toBe(200);
    const journey = await response.json() as any;
    expect(journey.sessionsAttended).toBe(1);
    expect(journey.totalTeas).toBe(1);
    expect(journey.teaTypeMap).toMatchObject({ Yancha: 1 });
  });

  it('reads a sample tasting through the set it belongs to', async () => {
    const db = database();
    const { userId, accountId, email } = seedIdentity(db, { userId: 'sampler', accountId: 'acc-sampler' });

    // The join this covers named a column that does not exist, so the samples
    // half of the journey failed while the compass half would have looked fine.
    db.sqlite.prepare(`INSERT INTO tea_sample_sets (id, name, account_id, user_id)
      VALUES ('set-one', 'Spring box', ?, ?)`).run(accountId, userId);
    db.sqlite.prepare(`INSERT INTO tea_samples (id, name, type, set_id, account_id, user_id)
      VALUES ('sample-one', 'Baozhong', 'Oolong', 'set-one', ?, ?)`).run(accountId, userId);
    db.sqlite.prepare(`INSERT INTO tea_sample_tastings
      (id, sample_id, taster_id, verdict, would_buy, personal_note, account_id)
      VALUES ('tasting-one', 'sample-one', ?, 'keep', 1, 'Bright', ?)`).run(email, accountId);

    const response = await read(db, '/api/me/journey', userId, accountId);
    expect(response.status).toBe(200);
    expect((await response.json() as any).samples).toMatchObject([{ name: 'Baozhong', verdict: 'keep' }]);
  });
});

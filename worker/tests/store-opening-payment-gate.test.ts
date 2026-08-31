import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * A store may be built, stocked and arranged while private. What it may not do
 * is open to buyers with nowhere to send the money.
 *
 * These tests hold the two ends of that rule: the refusal when a store tries to
 * open, and the public shop's own answer about whether it can still be paid,
 * which is what stops a checkout on a store that lost its methods after opening.
 */

const SECRET = 'store-opening-secret';
const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function call(db: SqliteD1, path: string, options: {
  method?: string;
  body?: unknown;
  userId?: string;
  accountId?: string;
  authenticated?: boolean;
} = {}) {
  const userId = options.userId ?? 'user-one';
  const accountId = options.accountId ?? 'acc-one';
  const headers = new Headers({ 'X-Teajia-Account': accountId });
  if (options.authenticated !== false) {
    const token = await signedToken(SECRET, {
      sub: userId,
      email: `${userId}@test.dev`,
      name: userId,
      active_account_id: accountId,
      platform_role: null,
    });
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

/** A tea master with a published profile hosting the account. */
function seedHostProfile(db: SqliteD1, options: { published?: boolean; accountId?: string } = {}) {
  const accountId = options.accountId ?? 'acc-one';
  db.sqlite.prepare(`INSERT INTO contributors
    (id, account_id, user_id, display_name, beginnings, is_published)
    VALUES ('mei-lin', ?, 'user-one', 'Mei Lin', 'Live beginning', ?)`)
    .run(accountId, options.published === false ? 0 : 1);
  db.sqlite.prepare(`INSERT INTO contributor_accounts
    (contributor_id, account_id, is_host) VALUES ('mei-lin', ?, 1)`).run(accountId);
}

function seedPaymentMethod(db: SqliteD1, options: { published?: boolean; accountId?: string | null } = {}) {
  db.sqlite.prepare(`INSERT INTO payment_methods
    (id, contributor_id, account_id, method_type, label, recipient_name, is_published)
    VALUES ('pm-one', 'mei-lin', ?, 'bank_transfer', 'Bank', 'Mei Lin', ?)`)
    .run(options.accountId === undefined ? null : options.accountId, options.published === false ? 0 : 1);
}

describe('opening a store to buyers', () => {
  it('refuses when the tea master has no published payment method, and says which thing is missing', async () => {
    const db = database();
    seedIdentity(db, { publicEnabled: false });
    seedHostProfile(db);

    const response = await call(db, '/api/accounts/acc-one', {
      method: 'PUT',
      body: { public_enabled: true },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'store_has_no_payment_method',
      details: { missing: 'no_payment_method' },
    });

    const row = db.sqlite.prepare('SELECT public_enabled FROM accounts WHERE id = ?').get('acc-one') as any;
    expect(row.public_enabled).toBe(0);
  });

  it('refuses when the payment method exists but was never published', async () => {
    const db = database();
    seedIdentity(db, { publicEnabled: false });
    seedHostProfile(db);
    seedPaymentMethod(db, { published: false });

    const response = await call(db, '/api/accounts/acc-one', { method: 'PUT', body: { public_enabled: true } });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'store_has_no_payment_method' });
  });

  /**
   * The pay page serves only published profiles, so a published method behind an
   * unpublished person is still a dead end. The refusal has to name that, or the
   * tea master fixes the wrong thing.
   */
  it('refuses when the payment method is published but the profile behind it is not', async () => {
    const db = database();
    seedIdentity(db, { publicEnabled: false });
    seedHostProfile(db, { published: false });
    seedPaymentMethod(db);

    const response = await call(db, '/api/accounts/acc-one', { method: 'PUT', body: { public_enabled: true } });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'store_recipient_profile_unpublished' });
  });

  it('refuses when no tea master profile is linked to the store', async () => {
    const db = database();
    seedIdentity(db, { publicEnabled: false });

    const response = await call(db, '/api/accounts/acc-one', { method: 'PUT', body: { public_enabled: true } });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'store_has_no_payment_recipient' });
  });

  it('opens the store once a published method sits behind a published profile', async () => {
    const db = database();
    seedIdentity(db, { publicEnabled: false });
    seedHostProfile(db);
    seedPaymentMethod(db);

    const response = await call(db, '/api/accounts/acc-one', { method: 'PUT', body: { public_enabled: true } });
    expect(response.status).toBe(200);

    const row = db.sqlite.prepare('SELECT public_enabled FROM accounts WHERE id = ?').get('acc-one') as any;
    expect(row.public_enabled).toBe(1);
  });

  /** A method scoped to this very store counts, even though the store is not public yet. */
  it('counts a method scoped to the store being opened', async () => {
    const db = database();
    seedIdentity(db, { publicEnabled: false });
    seedHostProfile(db);
    seedPaymentMethod(db, { accountId: 'acc-one' });

    const response = await call(db, '/api/accounts/acc-one', { method: 'PUT', body: { public_enabled: true } });
    expect(response.status).toBe(200);
  });

  /**
   * Found by opening the screen and pressing Save. The settings form sends every
   * field on every save, the public flag included, so a gate that only asked
   * "is the flag true" refused an ordinary tagline edit on a shop that was
   * already open, locking the tea master out of the screen they would fix the
   * problem on. Only the closed-to-open moment is a decision to open a shop.
   */
  it('lets an already open store keep saving its settings, even with nobody payable', async () => {
    const db = database();
    seedIdentity(db);

    const response = await call(db, '/api/accounts/acc-one', {
      method: 'PUT',
      body: { tagline: 'Quiet tea', public_enabled: true },
    });

    expect(response.status).toBe(200);
    const row = db.sqlite.prepare('SELECT tagline, public_enabled FROM accounts WHERE id = ?').get('acc-one') as any;
    expect(row.tagline).toBe('Quiet tea');
    expect(row.public_enabled).toBe(1);
  });

  /**
   * The settings screen sends the flag as a true/false and SQLite will not bind
   * a boolean, so an unconverted save fails outright rather than saving wrongly.
   */
  it('never blocks closing a store, or saving anything else', async () => {
    const db = database();
    seedIdentity(db);

    const closing = await call(db, '/api/accounts/acc-one', { method: 'PUT', body: { public_enabled: false } });
    expect(closing.status).toBe(200);

    const renaming = await call(db, '/api/accounts/acc-one', { method: 'PUT', body: { tagline: 'Quiet tea' } });
    expect(renaming.status).toBe(200);
  });

  /**
   * The flag is written through from the request body with no coercion, so the
   * string "false" has to read as off. Reading it as on would refuse a save that
   * is closing the shop.
   */
  it('reads a stringified false as closing, not opening', async () => {
    const db = database();
    seedIdentity(db);

    const response = await call(db, '/api/accounts/acc-one', { method: 'PUT', body: { public_enabled: 'false' } });
    expect(response.status).toBe(200);
  });
});

describe('what the public shop says about being paid', () => {
  it('tells the shop it cannot be paid once the methods are gone', async () => {
    const db = database();
    seedIdentity(db);
    seedHostProfile(db);

    const response = await call(db, '/api/s/acc-one', { authenticated: false });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ can_be_paid: false });
  });

  it('tells the shop it can be paid while a published method stands', async () => {
    const db = database();
    seedIdentity(db);
    seedHostProfile(db);
    seedPaymentMethod(db);

    const response = await call(db, '/api/s/acc-one', { authenticated: false });
    expect(await response.json()).toMatchObject({ can_be_paid: true });
  });
});

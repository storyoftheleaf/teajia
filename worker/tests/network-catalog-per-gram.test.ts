import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/*
 * The wholesale catalogue priced a cake by its total cost, not its per-gram
 * cost. `handleNetworkCatalog` read `cost_amount` off the curator's listing
 * and multiplied it straight by the markup, with no division by
 * `quantity_purchased`. A 1,200 CNY cake bought as 2,000 g of leaf costs 0.6
 * CNY a gram; the catalogue quoted 1,200 CNY a gram before the markup even
 * touched it, so a tea that should sell wholesale at 1.80 CNY/g came back at
 * 3,600. The draft order reads its unit price straight off this figure
 * (`WholesaleOrderDraft.tsx`), so the same fault would have opened a purchase
 * form already quoting 2,000 times too much.
 */

const SECRET = 'network-catalog-per-gram-secret';
const CURATOR = 'acc-curator';
const CALLER = 'acc-caller';

const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

/**
 * `handleNetworkCatalog` reads its three lookups with `env.DB.batch([...])`,
 * three SELECTs it destructures as `.results`. The shared `SqliteD1.batch()`
 * always runs each statement as a write (`.run()`, no rows), which is right
 * for the mutation batches the rest of the suite uses it for and wrong for a
 * batch of reads. Wrapped locally rather than widened in the shared helper,
 * same as `asyncDb` in attention-parity.test.ts.
 */
function env(db: SqliteD1) {
  return {
    DB: {
      prepare: (sql: string) => db.prepare(sql),
      batch: (statements: any[]) => Promise.resolve(statements.map(statement => statement.all())),
    },
    JWT_SECRET: SECRET,
    APP_URL: 'https://www.teajia.com',
  } as any;
}

/**
 * A 2,000 g cake the curator bought for 1,200 CNY, marked up 3 times (same
 * number the audit's own worked example uses), with everyone in the scene
 * priced in CNY so no exchange rate enters the arithmetic. `wholesale_margin_defaults`
 * carries a 100 percent tier default so the caller's wholesale price should land
 * on the same figure as the curator's retail price, proving the draft order
 * (which reads `wholesale_price_per_gram_caller`) inherits the fix too.
 */
async function seed(quantityPurchased: number | null = 2000): Promise<SqliteD1> {
  const db = new SqliteD1();
  databases.push(db);

  seedIdentity(db, { userId: 'user-curator', accountId: CURATOR, role: 'owner' });
  seedIdentity(db, { userId: 'user-caller', accountId: CALLER, role: 'owner' });

  db.sqlite.prepare(`UPDATE accounts SET currency_default = 'CNY' WHERE id IN (?, ?)`)
    .run(CURATOR, CALLER);

  db.sqlite.prepare(`INSERT OR REPLACE INTO wholesale_margin_defaults (trust_tier, default_margin_pct)
    VALUES ('basic', 100)`).run();

  db.sqlite.prepare(
    `INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name)
     VALUES ('profile-cake', 'profile-cake', ?, ?, 'A Cake Worth 2000 Grams')`
  ).run(CURATOR, CURATOR);

  db.sqlite.prepare(
    `INSERT INTO product_listings
       (id, account_id, profile_id, status, cost_amount, cost_currency, quantity_purchased, markup_multiplier)
     VALUES ('listing-cake', ?, 'profile-cake', 'active', 1200, 'CNY', ?, 3)`
  ).run(CURATOR, quantityPurchased);

  return db;
}

async function fetchCatalog(db: SqliteD1) {
  const token = await signedToken(SECRET, {
    sub: 'user-caller', email: 'user-caller@test.dev', name: 'user-caller',
    active_account_id: CALLER, platform_role: null,
  });
  const response = await worker.fetch(new Request('https://worker.test/api/network/catalog', {
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': CALLER },
  }), env(db));
  expect(response.status).toBe(200);
  const body = await response.json() as any;
  return body.profiles.find((p: any) => p.id === 'profile-cake');
}

describe('the wholesale catalogue prices by the gram, not by the cake', () => {
  it('quotes a 1,200 CNY, 2,000 g cake at 1.80 a gram, not 3,600', async () => {
    const db = await seed();
    const profile = await fetchCatalog(db);

    expect(profile.retail_currency).toBe('CNY');
    expect(profile.retail_price_per_gram_curator).toBeCloseTo(1.8, 6);
  });

  it('carries the corrected per-gram price into the draft order figure', async () => {
    const db = await seed();
    const profile = await fetchCatalog(db);

    // Same currency both sides and a 100 percent tier margin, so the price the
    // draft order reads (wholesale_price_per_gram_caller) should equal the
    // curator's per-gram retail exactly, not a multiple of it.
    expect(profile.wholesale_currency_caller).toBe('CNY');
    expect(profile.wholesale_price_per_gram_caller).toBeCloseTo(1.8, 6);
  });

  it('quotes nothing for a listing with a cost but no recorded quantity', async () => {
    // Without a quantity there is no honest per-gram figure. The old code read
    // the total cost as if it were per gram; a future edit that restores that
    // reading would put a number here, and this is what stops it.
    const db = await seed(null);
    const profile = await fetchCatalog(db);

    expect(profile.retail_price_per_gram_curator).toBeNull();
  });
});

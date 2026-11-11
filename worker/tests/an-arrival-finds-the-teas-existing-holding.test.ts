import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * An arrival with no product id, for a Curate tea that already has its
 * holding (`products.source_compass_entry_id`, unique per account), receives
 * into that holding instead of inserting a second product and failing on the
 * unique index. The existing guards still run against the found holding.
 */

const SECRET = 'arrival-holding-secret';
const ACCOUNT = 'shop';
const OWNER = 'owner';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed(holding: { purpose?: string; type?: string } = {}) {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  db.sqlite.prepare(`INSERT INTO tea_compass_entries (id, account_id, user_id, name, photos) VALUES ('entry', ?, ?, 'Yiwu', '[]')`).run(ACCOUNT, OWNER);
  db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, status, stock_grams, inventory_purpose, source_compass_entry_id, cost_amount, cost_currency)
    VALUES ('holding', ?, ?, 'Yiwu', 'Draft', 50, ?, 'entry', NULL, NULL)`).run(ACCOUNT, holding.type ?? 'Sheng', holding.purpose ?? 'working');
  db.sqlite.prepare(`INSERT INTO curate_receipt_proposals (id, account_id, compass_entry_id, product_id, product_name, product_type, purpose, quantity, unit, acquisition_kind, idempotency_key, proposed_by_user_id)
    VALUES ('arrival', ?, 'entry', NULL, 'Yiwu', 'Sheng', 'working', 100, 'g', 'purchase', 'manual', ?)`).run(ACCOUNT, OWNER);
  return db;
}

async function accept(db: SqliteD1) {
  const token = await signedToken(SECRET, { sub: OWNER, email: `${OWNER}@test.dev`, active_account_id: ACCOUNT });
  return worker.fetch(new Request('https://app.test/api/curate/receipt-proposals/arrival/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' },
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

describe('accepting an arrival for a tea that already has a holding', () => {
  it('receives into the existing holding rather than creating a second product', async () => {
    const db = seed();
    const response = await accept(db);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ product_id: 'holding', alreadyAccepted: false });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM products').get()).toMatchObject({ n: 1 });
    expect(db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='holding'").get()).toMatchObject({ stock_grams: 150 });
    expect(db.sqlite.prepare('SELECT product_id, delta, balance_after FROM stock_ledger').get()).toMatchObject({ product_id: 'holding', delta: 100, balance_after: 150 });
    expect(db.sqlite.prepare("SELECT status, product_id FROM curate_receipt_proposals WHERE id='arrival'").get()).toMatchObject({ status: 'accepted', product_id: 'holding' });
    expect(db.sqlite.prepare("SELECT draft_product_id FROM tea_compass_entries WHERE id='entry'").get()).toMatchObject({ draft_product_id: 'holding' });
  });

  it('still refuses a purpose conflict with the found holding', async () => {
    const db = seed({ purpose: 'personal' });
    const response = await accept(db);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'purpose_conflict' });
    expect(db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='holding'").get()).toMatchObject({ stock_grams: 50 });
  });

  it('still refuses a unit that does not match the found holding', async () => {
    const db = seed({ type: 'Teaware' });
    const response = await accept(db);
    expect(response.status).toBe(400);
    expect(db.sqlite.prepare("SELECT status FROM curate_receipt_proposals WHERE id='arrival'").get()).toMatchObject({ status: 'pending' });
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { previewCurateMutation, confirmCurateMutation, previewCurateUndo } from '../src/curateMutations';
import type { ToolAuth, ToolEnv } from '../src/mcpTools/registry';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * Merging two Curate teas used to leave the Stock product on the tea that was
 * merged away: `draft_product_id` and `products.source_compass_entry_id`
 * stayed on the dead entry and the surviving tea showed as unlinked. The merge
 * now moves the link, the product's own pointer, its listing mirror and any
 * pending arrival to the survivor in the same recorded batch, so `curate_undo`
 * puts every one of them back. When BOTH teas already have a product, nothing
 * is moved and the preview says so. Driven against the migration ledger, so
 * the given-name triggers (0048) and the unique product identity index run.
 */

const SECRET = 'merge-link-secret';
const ACCOUNT = 'shop';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const auth = { accountId: ACCOUNT, userId: 'owner', tokenId: 'token', userEmail: 'owner@test.dev', creatorTier: 'admin' } as ToolAuth;

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: ACCOUNT, role: 'owner' });
  db.sqlite.exec(`
    INSERT INTO tea_compass_entries (id, account_id, user_id, name, given_name, photos, updated_at) VALUES
      ('loser', '${ACCOUNT}', 'owner', 'Duplicate', NULL, '[]', '2026-11-01T00:00:00.000Z'),
      ('survivor', '${ACCOUNT}', 'owner', 'Keeper', NULL, '[]', '2026-11-01T00:00:00.000Z');
    INSERT INTO products (id, account_id, type, product_name, given_name, source_compass_entry_id, stock_grams, updated_at)
      VALUES ('product', '${ACCOUNT}', 'Oolong', 'Duplicate', 'Shelf name', 'loser', 0, '2026-11-01 00:00:00');
    UPDATE tea_compass_entries SET draft_product_id = 'product', given_name = 'Shelf name', updated_at = '2026-11-01T00:00:00.000Z' WHERE id = 'loser';
    INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name) VALUES ('prof_product', 'shelf-name', '${ACCOUNT}', '${ACCOUNT}', 'Shelf name');
    INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id, source_compass_entry_id, updated_at)
      VALUES ('list_product', '${ACCOUNT}', 'prof_product', 'product', 'loser', '2026-11-01 00:00:00');
  `);
  return { db, env: { DB: db as unknown as D1Database } as ToolEnv };
}

const row = (db: SqliteD1, table: string, id: string) => db.sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as any;
async function confirm(env: ToolEnv, preview: Promise<any>) {
  const ticket = await preview;
  return { preview: ticket, result: await confirmCurateMutation(env, auth, ticket.confirmation_token) };
}
const merge = (env: ToolEnv) => confirm(env, previewCurateMutation(env, auth, { action: 'merge', entity: 'tea', id: 'loser', target_id: 'survivor' }));
const undo = (env: ToolEnv) => confirm(env, previewCurateUndo(env, auth));
const snapshot = (db: SqliteD1) => ({
  loser: row(db, 'tea_compass_entries', 'loser'), survivor: row(db, 'tea_compass_entries', 'survivor'),
  product: row(db, 'products', 'product'), listing: row(db, 'product_listings', 'list_product'),
});

describe('merging two Curate teas moves the Stock product to the survivor', () => {
  it('the survivor takes the product, its listing and its name, and undo puts every one back', async () => {
    const { db, env } = seed();
    const before = snapshot(db);
    const { preview, result } = await merge(env);
    expect(result).toMatchObject({ confirmed: true });
    expect(preview.preview.product_link).toMatchObject({ moved_product_id: 'product', from: 'loser', to: 'survivor' });

    expect(row(db, 'tea_compass_entries', 'loser')).toMatchObject({ merged_into_id: 'survivor', draft_product_id: null });
    // A survivor with no chosen name adopts the shelf's, as linking always has.
    expect(row(db, 'tea_compass_entries', 'survivor')).toMatchObject({ draft_product_id: 'product', given_name: 'Shelf name' });
    expect(row(db, 'products', 'product')).toMatchObject({ source_compass_entry_id: 'survivor', given_name: 'Shelf name', stock_grams: 0 });
    expect(row(db, 'product_listings', 'list_product').source_compass_entry_id).toBe('survivor');

    expect((await undo(env)).result).toMatchObject({ confirmed: true });
    expect(snapshot(db)).toEqual(before);
  });

  it('a survivor with its own chosen name keeps it, and undo gives the shelf its old name back', async () => {
    const { db, env } = seed();
    db.sqlite.exec(`UPDATE tea_compass_entries SET given_name = 'Keeper chosen' WHERE id = 'survivor'`);
    const before = snapshot(db);
    await merge(env);
    expect(row(db, 'tea_compass_entries', 'survivor')).toMatchObject({ draft_product_id: 'product', given_name: 'Keeper chosen' });
    expect(row(db, 'products', 'product')).toMatchObject({ source_compass_entry_id: 'survivor', given_name: 'Keeper chosen' });

    expect((await undo(env)).result).toMatchObject({ confirmed: true });
    expect(snapshot(db)).toEqual(before);
  });

  it('when both teas have their own product nothing is moved and the preview says so', async () => {
    const { db, env } = seed();
    db.sqlite.exec(`
      INSERT INTO products (id, account_id, type, product_name, given_name, source_compass_entry_id)
        VALUES ('other', '${ACCOUNT}', 'Oolong', 'Keeper', NULL, 'survivor');
      UPDATE tea_compass_entries SET draft_product_id = 'other' WHERE id = 'survivor';
    `);
    const { preview, result } = await merge(env);
    expect(result).toMatchObject({ confirmed: true });
    expect(preview.preview.product_link).toMatchObject({ moved_product_id: null, kept_on_merged_tea: ['product'], survivor_products: ['other'] });
    expect(row(db, 'tea_compass_entries', 'loser')).toMatchObject({ merged_into_id: 'survivor', draft_product_id: 'product' });
    expect(row(db, 'products', 'product').source_compass_entry_id).toBe('loser');
    expect(row(db, 'tea_compass_entries', 'survivor').draft_product_id).toBe('other');
    expect(row(db, 'products', 'other').source_compass_entry_id).toBe('survivor');
  });

  it('a pending arrival for the merged-away tea is received into the moved product, not a new one', async () => {
    const { db, env } = seed();
    db.sqlite.exec(`
      INSERT INTO curate_receipt_proposals (id, account_id, compass_entry_id, purpose, quantity, unit, acquisition_kind, acquisition_state, status, idempotency_key, proposed_by_user_id)
        VALUES ('arrival', '${ACCOUNT}', 'loser', 'working', 50, 'g', 'gift', 'ordered', 'pending', 'curate:arrival-1', 'owner');
    `);
    await merge(env);
    // The arrival is history and still names the tea it was ordered for.
    expect(row(db, 'curate_receipt_proposals', 'arrival').compass_entry_id).toBe('loser');

    const token = await signedToken(SECRET, { sub: 'owner', email: 'owner@test.dev', active_account_id: ACCOUNT });
    const response = await worker.fetch(new Request('https://app.test/api/curate/receipt-proposals/arrival/accept', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' }, body: '{}',
    }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    const accepted = await response.json() as any;
    expect(response.status, JSON.stringify(accepted)).toBe(200);
    expect(accepted.product_id).toBe('product');
    expect((db.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE account_id = ?').get(ACCOUNT) as any).n).toBe(1);
    expect(row(db, 'products', 'product')).toMatchObject({ stock_grams: 50, source_compass_entry_id: 'survivor' });
    expect(row(db, 'tea_compass_entries', 'survivor')).toMatchObject({ draft_product_id: 'product', status: 'in_stock' });
    // The archived duplicate is not linked back to the product.
    expect(row(db, 'tea_compass_entries', 'loser').draft_product_id).toBeNull();
  });

  it('an arrival on a merged-away tea that kept its own product still goes to that product', async () => {
    const { db, env } = seed();
    db.sqlite.exec(`
      INSERT INTO products (id, account_id, type, product_name, source_compass_entry_id, stock_grams) VALUES ('other', '${ACCOUNT}', 'Oolong', 'Keeper', 'survivor', 0);
      UPDATE tea_compass_entries SET draft_product_id = 'other' WHERE id = 'survivor';
      INSERT INTO curate_receipt_proposals (id, account_id, compass_entry_id, purpose, quantity, unit, acquisition_kind, status, idempotency_key, proposed_by_user_id)
        VALUES ('arrival', '${ACCOUNT}', 'loser', 'working', 30, 'g', 'gift', 'pending', 'curate:arrival-2', 'owner');
    `);
    await merge(env);
    const token = await signedToken(SECRET, { sub: 'owner', email: 'owner@test.dev', active_account_id: ACCOUNT });
    const response = await worker.fetch(new Request('https://app.test/api/curate/receipt-proposals/arrival/accept', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' }, body: '{}',
    }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(response.status).toBe(200);
    expect(row(db, 'products', 'product').stock_grams).toBe(30);
    expect(row(db, 'products', 'other').stock_grams).toBe(0);
  });

  it('undo still refuses once stock has moved on the product since the merge', async () => {
    const { db, env } = seed();
    await merge(env);
    db.sqlite.exec(`INSERT INTO stock_ledger (id, account_id, product_id, delta, balance_after, reason) VALUES ('move', '${ACCOUNT}', 'product', 10, 10, 'RECEIPT')`);
    const { result } = await undo(env);
    expect(result).toMatchObject({ error: 'stale_preview' });
    expect(row(db, 'tea_compass_entries', 'survivor').draft_product_id).toBe('product');
  });
});

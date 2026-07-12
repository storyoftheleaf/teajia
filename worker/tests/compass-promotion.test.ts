import { describe, expect, it } from 'vitest';
import { migrateCompassPersistedState } from '../../src/lib/teaCompassStore';
import { receiptRequest, ReceiptDb } from './helpers/receiptHarness';

describe('Compass promotion boundary', () => {
  it('keeps legacy links valid and creates Inventory idempotently', async () => {
    const db = ReceiptDb.seeded();
    db.products.set('legacy-product', {
      id: 'legacy-product', account_id: 'account-a', product_name: 'Existing tea', status: 'Draft',
    });
    db.entries.get('entry-a')!.draft_product_id = 'legacy-product';

    const first = await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' });
    const retry = await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' });

    expect(first.status).toBe(200);
    expect(await retry.json()).toMatchObject({ id: 'legacy-product', alreadyPromoted: true });
    expect([...db.products.values()].filter(row => row.account_id === 'account-a')).toHaveLength(1);
  });

  it('repairs a stale legacy link without creating stock or publishing', async () => {
    const db = ReceiptDb.seeded();
    Object.assign(db.entries.get('entry-a')!, { draft_product_id: 'missing-product', buy_quantity_grams: 250 });

    const response = await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' });
    expect(response.status).toBe(201);
    const promoted = await response.json() as any;
    expect(db.entries.get('entry-a')?.draft_product_id).toBe(promoted.id);
    expect(db.products.get(promoted.id)).toMatchObject({
      status: 'Draft', stock_grams: 0, stock_known_at: expect.any(String),
      quantity_purchased: null, is_public: 0, shown_in_shop: 0,
    });
    expect(db.ledger).toHaveLength(0);
  });

  it('collapses concurrent promotion to one linked product', async () => {
    const db = ReceiptDb.seeded();
    const [a, b] = await Promise.all([
      receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' }),
      receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' }),
    ]);
    expect([a.status, b.status].every(status => status === 200 || status === 201)).toBe(true);
    const [one, two] = await Promise.all([a.json(), b.json()]) as any[];
    expect(one.id).toBe(two.id);
    expect([...db.products.values()].filter(row => row.source_compass_entry_id === 'entry-a')).toHaveLength(1);
    expect(db.entries.get('entry-a')?.draft_product_id).toBe(one.id);
  });

  it('rolls back product creation and linking when the atomic batch fails', async () => {
    const db = ReceiptDb.seeded();
    db.failBatchAt = 1;
    const response = await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' });
    expect(response.status).toBe(500);
    expect([...db.products.values()].filter(row => row.account_id === 'account-a')).toHaveLength(0);
    expect(db.entries.get('entry-a')?.draft_product_id).toBeNull();
  });

  it('rejects cross-account and cross-user promotion', async () => {
    const db = ReceiptDb.seeded();
    expect((await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST', accountId: 'account-b' })).status).toBe(404);
    expect((await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST', userId: 'user-b' })).status).toBe(404);
    expect([...db.products.values()].filter(row => row.account_id === 'account-a')).toHaveLength(0);
  });

  it('drops legacy automatic-promotion retries during persisted-state migration', () => {
    const migrated = migrateCompassPersistedState({
      entries: [], pendingEntries: [], pendingPromotions: ['old-auto-promotion'],
    }, 5) as { pendingPromotions?: string[] };
    expect(migrated.pendingPromotions).toEqual([]);
  });
});

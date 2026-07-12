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
    db.entries.get('entry-a')!.draft_product_id = 'missing-product';

    const response = await receiptRequest(db, '/api/compass/entries/entry-a/promote', { method: 'POST' });
    expect(response.status).toBe(201);
    const promoted = await response.json() as any;
    expect(db.entries.get('entry-a')?.draft_product_id).toBe(promoted.id);
    expect(db.products.get(promoted.id)).toMatchObject({
      status: 'Draft', stock_grams: 0, is_public: 0, shown_in_shop: 0,
    });
    expect(db.ledger).toHaveLength(0);
  });

  it('drops legacy automatic-promotion retries during persisted-state migration', () => {
    const migrated = migrateCompassPersistedState({
      entries: [], pendingEntries: [], pendingPromotions: ['old-auto-promotion'],
    }, 5) as { pendingPromotions?: string[] };
    expect(migrated.pendingPromotions).toEqual([]);
  });
});

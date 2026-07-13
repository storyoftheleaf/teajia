import { describe, expect, it } from 'vitest';
import { finalizeCurateImport, validateImportForFinalization, type CurateFinalizeData, type CurateImportFinalizeContext } from '../src/curateImportFinalize';

function data(): CurateFinalizeData {
  return {
    batch: { id: 'batch-a', accountId: 'account-a', journeyId: 'journey-a', reviewState: 'reviewing' },
    groups: [
      { id: 'group-a', vendorId: 'vendor-a', vendorName: 'Chen', position: 0 },
      { id: 'group-b', vendorId: 'vendor-b', vendorName: 'Lin', position: 1 },
    ],
    items: Array.from({ length: 4 }, (_, index) => ({
      id: `item-${index}`, groupId: index < 2 ? 'group-a' : 'group-b', category: 'tea' as const,
      name: `Tea ${index}`, compassEntryId: index === 0 ? 'entry-existing' : null,
      productId: index === 0 ? 'product-existing' : null,
      quantity: 100, unit: 'g' as const, packCount: 2, lineCost: 50, currency: index < 2 ? 'CNY' : 'USD',
      unitCost: 0.5, purpose: 'working' as const, blockingFields: [],
    })),
  };
}

function harness(importData = data()) {
  const receipts: any[] = [];
  const movements: any[] = [];
  let completed: any = null;
  const ctx: CurateImportFinalizeContext = {
    accountId: 'account-a', userId: 'user-a',
    loadImport: async batchId => batchId === importData.batch.id && importData.batch.accountId === 'account-a' ? importData : null,
    loadCompleted: async (_batchId, key) => completed?.idempotencyKey === key ? completed.result : null,
    ensureIdentity: async item => item.compassEntryId ?? `entry-${item.id}`,
    ensureProduct: async (item) => item.productId ?? `product-${item.id}`,
    createReceipt: async (group, lines, key, journeyId) => {
      const receipt = { id: `receipt-${group.id}`, groupId: group.id, key, journeyId, lines: lines.map(line => ({ ...line, id: `line-${line.itemId}` })) };
      receipts.push(receipt); return receipt;
    },
    receiveLine: async (line, key) => { const value = { movementId: `movement-${line.itemId}`, key }; movements.push(value); return value; },
    complete: async (_batchId, idempotencyKey, result) => { completed = { idempotencyKey, result }; },
  };
  return { ctx, receipts, movements };
}

describe('Curate import finalization', () => {
  it('validates resolved vendors and exact physical quantity/cost fields', () => {
    expect(validateImportForFinalization(data())).toEqual([]);
    const invalid = data();
    invalid.groups[0].vendorId = null;
    invalid.items[0].blockingFields = ['priceBasis'];
    invalid.items[1].currency = null;
    expect(validateImportForFinalization(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'vendor', groupId: 'group-a' }),
      expect.objectContaining({ field: 'priceBasis', itemId: 'item-0' }),
      expect.objectContaining({ field: 'currency', itemId: 'item-1' }),
    ]));
  });

  it('creates one received receipt per vendor and movements through the receipt callback', async () => {
    const { ctx, receipts, movements } = harness();
    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');
    expect(result.receipts).toHaveLength(2);
    expect(receipts).toHaveLength(2);
    expect(receipts[0]).toMatchObject({ journeyId: 'journey-a', lines: [
      expect.objectContaining({ originalCostAmount: 50, originalCostCurrency: 'CNY', packCount: 2 }),
      expect.objectContaining({ originalUnitCost: 0.5 }),
    ] });
    expect(movements).toHaveLength(4);
    expect(result.items.map(item => item.productId)).toEqual(['product-existing', 'product-item-1', 'product-item-2', 'product-item-3']);
  });

  it('works without a sourcing run and returns the stored result on retry', async () => {
    const importData = data(); importData.batch.journeyId = null;
    const { ctx, receipts, movements } = harness(importData);
    const first = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');
    const retry = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');
    expect(retry).toEqual(first);
    expect(receipts).toHaveLength(2);
    expect(movements).toHaveLength(4);
    expect(receipts[0].journeyId).toBeNull();
  });

  it('rejects a foreign batch and blocks before any inventory callbacks', async () => {
    const { ctx, receipts, movements } = harness({ ...data(), batch: { ...data().batch, accountId: 'account-b' } });
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toMatchObject({ code: 'not_found' });
    expect(receipts).toHaveLength(0); expect(movements).toHaveLength(0);
  });

  it('rejects ambiguity before creating identities, products, receipts, or movements', async () => {
    const invalid = data(); invalid.items[0].blockingFields = ['priceBasis'];
    const { ctx, receipts, movements } = harness(invalid);
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toMatchObject({ code: 'validation_failed' });
    expect(receipts).toHaveLength(0); expect(movements).toHaveLength(0);
  });
});

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

function harness(importData = data(), failMovementOnce?: string) {
  const receipts: any[] = [];
  const movements: any[] = [];
  const receiptByKey = new Map<string, any>();
  const movementByKey = new Map<string, any>();
  let failed = false;
  let completed: any = null;
  let reservedKey: string | null = null;
  const ctx: CurateImportFinalizeContext = {
    accountId: 'account-a', userId: 'user-a',
    loadImport: async batchId => batchId === importData.batch.id && importData.batch.accountId === 'account-a' ? importData : null,
    loadFinalization: async () => completed ? { idempotencyKey: completed.idempotencyKey, result: completed.result } : reservedKey ? { idempotencyKey: reservedKey, result: null } : null,
    reserveFinalization: async (_batchId, key) => { reservedKey = key; },
    ensureIdentity: async item => item.compassEntryId ?? `entry-${item.id}`,
    ensureProduct: async (item) => item.productId ?? `product-${item.id}`,
    createReceipt: async (group, lines, key, journeyId) => {
      if (receiptByKey.has(key)) return receiptByKey.get(key);
      const receipt = { id: `receipt-${group.id}`, groupId: group.id, key, journeyId, lines: lines.map(line => ({ ...line, id: `line-${line.itemId}` })) };
      receipts.push(receipt); receiptByKey.set(key, receipt); return receipt;
    },
    receiveLine: async (line, key) => {
      if (movementByKey.has(key)) return movementByKey.get(key);
      if (!failed && line.itemId === failMovementOnce) { failed = true; throw new Error('simulated partial failure'); }
      const value = { movementId: `movement-${line.itemId}`, key }; movements.push(value); movementByKey.set(key, value); return value;
    },
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

  it('rejects imports with no groups, no items, or an empty vendor receipt', () => {
    expect(validateImportForFinalization({ ...data(), groups: [] })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'groups' })]));
    expect(validateImportForFinalization({ ...data(), items: [] })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'items' })]));
    const empty = data(); empty.items = empty.items.filter(item => item.groupId !== 'group-b');
    expect(validateImportForFinalization(empty)).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'items', groupId: 'group-b' })]));
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

  it('passes exact decimal provenance to receipts without a binary-float round trip', async () => {
    const importData = data();
    importData.items[0].lineCostExact = '0.3';
    importData.items[0].unitCostExact = '0.001';
    const { ctx, receipts } = harness(importData);
    await finalizeCurateImport(ctx, 'batch-a', 'finish-key');
    expect(receipts[0].lines[0]).toMatchObject({ originalCostAmountExact: '0.3', originalUnitCostExact: '0.001' });
  });

  it('owns the finalization reservation before creating any import result', async () => {
    const { ctx } = harness();
    const events: string[] = [];
    const reserve = ctx.reserveFinalization;
    const ensureIdentity = ctx.ensureIdentity;
    ctx.reserveFinalization = async (...args) => { events.push('reserve'); await reserve(...args); };
    ctx.ensureIdentity = async (...args) => { events.push('identity'); return ensureIdentity(...args); };

    await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(events[0]).toBe('reserve');
    expect(events).toContain('identity');
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

  it('returns a same-key result that completes while this request loses reservation', async () => {
    const { ctx, receipts, movements } = harness();
    const stored = { batchId: 'batch-a', idempotencyKey: 'finish-key', receipts: [], items: [] };
    let loads = 0;
    ctx.loadFinalization = async () => ++loads === 1 ? null : { idempotencyKey: 'finish-key', result: stored };
    ctx.reserveFinalization = async () => { throw new Error('reservation lost'); };

    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).resolves.toEqual(stored);
    expect(receipts).toHaveLength(0);
    expect(movements).toHaveLength(0);
  });

  it('safely resumes when the same key is still in progress after reservation loss', async () => {
    const { ctx, receipts, movements } = harness();
    let loads = 0;
    ctx.loadFinalization = async () => ++loads === 1 ? null : { idempotencyKey: 'finish-key', result: null };
    ctx.reserveFinalization = async () => { throw new Error('reservation lost'); };

    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(result.idempotencyKey).toBe('finish-key');
    expect(receipts).toHaveLength(2);
    expect(movements).toHaveLength(4);
  });

  it('conflicts when reservation loss reveals a different winning key', async () => {
    const { ctx, receipts, movements } = harness();
    let loads = 0;
    ctx.loadFinalization = async () => ++loads === 1 ? null : { idempotencyKey: 'other-key', result: null };
    ctx.reserveFinalization = async () => { throw new Error('reservation lost'); };

    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(receipts).toHaveLength(0);
    expect(movements).toHaveLength(0);
  });

  it('rejects a different finalization key before creating any additional records', async () => {
    const { ctx, receipts, movements } = harness();
    await finalizeCurateImport(ctx, 'batch-a', 'finish-key');
    await expect(finalizeCurateImport(ctx, 'batch-a', 'different-key')).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(receipts).toHaveLength(2); expect(movements).toHaveLength(4);
  });

  it('safely resumes a partial same-key failure without duplicating receipts or movements', async () => {
    const { ctx, receipts, movements } = harness(data(), 'item-1');
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toThrow('simulated partial failure');
    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');
    expect(result.items).toHaveLength(4);
    expect(receipts).toHaveLength(2);
    expect(movements).toHaveLength(4);
  });

  it('rejects a foreign batch and blocks before any inventory callbacks', async () => {
    const { ctx, receipts, movements } = harness({ ...data(), batch: { ...data().batch, accountId: 'account-b' } });
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toMatchObject({ code: 'not_found' });
    expect(receipts).toHaveLength(0); expect(movements).toHaveLength(0);
  });

  it.each(['abandoned', 'pending', 'completed'])('rejects a %s batch before reserving or creating inventory', async reviewState => {
    const invalid = data(); invalid.batch.reviewState = reviewState;
    const { ctx, receipts, movements } = harness(invalid);
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toMatchObject({ code: 'validation_failed' });
    expect(receipts).toHaveLength(0); expect(movements).toHaveLength(0);
  });

  it('rejects ambiguity before creating identities, products, receipts, or movements', async () => {
    const invalid = data(); invalid.items[0].blockingFields = ['priceBasis'];
    const { ctx, receipts, movements } = harness(invalid);
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toMatchObject({ code: 'validation_failed' });
    expect(receipts).toHaveLength(0); expect(movements).toHaveLength(0);
  });

  it('rejects a matched resolution without both existing target identifiers', () => {
    const invalid = data();
    invalid.items[0].duplicateResolution = 'matched';
    invalid.items[0].productId = null;
    expect(validateImportForFinalization(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'duplicateResolution', itemId: 'item-0' }),
    ]));
  });
});

import { describe, expect, it } from 'vitest';
import { finalizeCurateImport, holdingMatchesFinalizeItem, validateImportForFinalization, type CurateFinalizeData, type CurateImportFinalizeContext } from '../src/curateImportFinalize';

function data(): CurateFinalizeData {
  return {
    batch: { id: 'batch-a', accountId: 'account-a', journeyId: 'journey-a', journeyName: 'Yunnan · Spring · 2026', reviewState: 'reviewing' },
    groups: [
      { id: 'group-a', vendorId: 'vendor-a', vendorName: 'Chen', position: 0 },
      { id: 'group-b', vendorId: 'vendor-b', vendorName: 'Lin', position: 1 },
    ],
    items: Array.from({ length: 4 }, (_, index) => ({
      id: `item-${index}`, groupId: index < 2 ? 'group-a' : 'group-b', category: 'tea' as const,
      name: `Tea ${index}`, compassEntryId: index === 0 ? 'entry-existing' : null,
      productId: index === 0 ? 'product-existing' : null,
      disposition: 'received' as const,
      quantity: 100, unit: 'g' as const, packCount: 2, lineCost: 50, currency: index < 2 ? 'CNY' : 'USD',
      unitCost: 0.5, purpose: 'working' as const, blockingFields: [],
    })),
  };
}

type PersistenceBoundary = 'identity' | 'holding' | 'receipt' | 'movement' | 'completion';

function harness(importData = data(), options: { failOnceAt?: PersistenceBoundary; failMovementItem?: string } = {}) {
  const identities: any[] = [];
  const products: any[] = [];
  const receipts: any[] = [];
  const movements: any[] = [];
  const releases: string[] = [];
  const identityByItem = new Map<string, any>();
  const productByItem = new Map<string, any>();
  const receiptByKey = new Map<string, any>();
  const movementByKey = new Map<string, any>();
  const failedBoundaries = new Set<PersistenceBoundary>();
  let completed: any = null;
  let reservedKey: string | null = null;
  const failAfterPersistence = (boundary: PersistenceBoundary, itemId?: string) => {
    if (options.failOnceAt !== boundary || failedBoundaries.has(boundary)) return;
    if (boundary === 'movement' && options.failMovementItem && itemId !== options.failMovementItem) return;
    failedBoundaries.add(boundary);
    throw new Error(`simulated ${boundary} response loss`);
  };
  const ctx: CurateImportFinalizeContext = {
    accountId: 'account-a', userId: 'user-a',
    loadImport: async batchId => batchId === importData.batch.id && importData.batch.accountId === 'account-a' ? importData : null,
    loadFinalization: async () => completed ? { idempotencyKey: completed.idempotencyKey, result: completed.result } : reservedKey ? { idempotencyKey: reservedKey, result: null } : null,
    validateResolutions: async () => {},
    reserveFinalization: async (_batchId, key) => { reservedKey = key; },
    releaseFinalization: async (_batchId, key) => {
      releases.push(key);
      if (reservedKey === key && !completed) reservedKey = null;
    },
    ensureIdentity: async item => {
      if (identityByItem.has(item.id)) return identityByItem.get(item.id);
      const identity = { id: item.compassEntryId ?? `entry-${item.id}`, disposition: item.compassEntryId ? 'reused' : 'created' };
      identities.push(identity); identityByItem.set(item.id, identity);
      failAfterPersistence('identity', item.id);
      return identity;
    },
    ensureProduct: async (item) => {
      if (productByItem.has(item.id)) return productByItem.get(item.id);
      const product = { id: item.productId ?? `product-${item.id}`, disposition: item.productId ? 'reused' : 'created' };
      products.push(product); productByItem.set(item.id, product);
      failAfterPersistence('holding', item.id);
      return product;
    },
    createReceipt: async (group, lines, key, journeyId) => {
      if (receiptByKey.has(key)) return receiptByKey.get(key);
      const receipt = { id: `receipt-${group.id}`, groupId: group.id, key, journeyId, lines: lines.map(line => ({ ...line, id: `line-${line.itemId}` })) };
      receipts.push(receipt); receiptByKey.set(key, receipt);
      failAfterPersistence('receipt');
      return receipt;
    },
    receiveLine: async (line, key) => {
      if (movementByKey.has(key)) return movementByKey.get(key);
      const value = { movementId: `movement-${line.itemId}`, key }; movements.push(value); movementByKey.set(key, value);
      failAfterPersistence('movement', line.itemId);
      return value;
    },
    complete: async (_batchId, idempotencyKey, result) => {
      completed = { idempotencyKey, result };
      failAfterPersistence('completion');
    },
  };
  return { ctx, identities, products, receipts, movements, releases };
}

describe('Curate import finalization', () => {
  const holdingMatches = (
    holding: { accountId: string; compassEntryId: string; category: 'tea' | 'teaware'; purpose: 'working' | 'sample' | 'personal' | null },
    item = data().items[0],
  ) => holdingMatchesFinalizeItem(holding, item, 'entry-existing', 'account-a');

  it('accepts a holding only when account, identity, category, and purpose all match', () => {
    const compatible = { accountId: 'account-a', compassEntryId: 'entry-existing', category: 'tea' as const, purpose: 'working' as const };

    expect(holdingMatches(compatible)).toBe(true);
    expect(holdingMatches({ ...compatible, accountId: 'account-b' })).toBe(false);
    expect(holdingMatches({ ...compatible, compassEntryId: 'entry-other' })).toBe(false);
    expect(holdingMatches({ ...compatible, category: 'teaware' })).toBe(false);
    expect(holdingMatches({ ...compatible, purpose: 'sample' })).toBe(false);
    expect(holdingMatchesFinalizeItem(
      { ...compatible, purpose: 'archive' as never },
      { ...data().items[0], purpose: 'archive' as never },
      'entry-existing',
      'account-a',
    )).toBe(false);
  });

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

  it('requires groups only for stock-bearing items and ignores groups with no receipt lines', () => {
    expect(validateImportForFinalization({ ...data(), groups: [] })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'groups' })]));
    expect(validateImportForFinalization({ ...data(), items: [] })).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'items' })]));
    const empty = data(); empty.items = empty.items.filter(item => item.groupId !== 'group-b');
    expect(validateImportForFinalization(empty)).toEqual([]);
    const orphaned = data(); orphaned.items[0].groupId = 'missing-group';
    expect(validateImportForFinalization(orphaned)).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'vendor', itemId: 'item-0' })]));
  });

  it('requires an explicit normalized disposition for every item', () => {
    const missing = data(); delete (missing.items[0] as Partial<typeof missing.items[number]>).disposition;
    const unknown = data(); (unknown.items[1] as { disposition: string }).disposition = 'ordered';

    expect(validateImportForFinalization(missing)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'disposition', itemId: 'item-0' }),
    ]));
    expect(validateImportForFinalization(unknown as CurateFinalizeData)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'disposition', itemId: 'item-1' }),
    ]));
  });

  it('requires stock, cost, purpose, and a resolved vendor only for stock-bearing items', () => {
    const libraryOnly = data();
    libraryOnly.groups = [];
    libraryOnly.items = [{
      ...libraryOnly.items[0], groupId: 'no-receipt-group', disposition: 'library_only',
      compassEntryId: 'entry-existing', productId: null, duplicateResolution: 'matched',
      quantity: null, unit: null, packCount: null, lineCost: null, currency: null,
      unitCost: null, purpose: null,
    }];
    expect(validateImportForFinalization(libraryOnly)).toEqual([]);

    const inTransit = data();
    inTransit.items[0] = {
      ...inTransit.items[0], disposition: 'in_transit', quantity: null, unit: null,
      packCount: null, lineCost: null, currency: null, unitCost: null, purpose: null,
    };
    expect(validateImportForFinalization(inTransit)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'quantity', itemId: 'item-0' }),
      expect.objectContaining({ field: 'purpose', itemId: 'item-0' }),
    ]));
  });

  it('rejects a stock-bearing item whose purpose is outside the runtime enum', () => {
    const invalid = data();
    invalid.items[0].purpose = 'archive' as never;

    expect(validateImportForFinalization(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'purpose', itemId: 'item-0' }),
    ]));
  });

  it('ignores stock-only review blockers for Library-only items', () => {
    const libraryOnly = data();
    libraryOnly.groups = [];
    libraryOnly.items = [{
      ...libraryOnly.items[0], disposition: 'library_only', groupId: '', productId: null,
      quantity: null, unit: null, packCount: null, lineCost: null, currency: null,
      unitCost: null, purpose: null, blockingFields: ['vendor', 'priceBasis', 'inventoryPurpose'],
    }];

    expect(validateImportForFinalization(libraryOnly)).toEqual([]);

    libraryOnly.items[0].blockingFields.push('year');
    expect(validateImportForFinalization(libraryOnly)).toEqual([
      expect.objectContaining({ field: 'year', itemId: 'item-0' }),
    ]);
  });

  it('does not treat a Library-only vendor group as an empty receipt', () => {
    const mixed = data();
    mixed.items = mixed.items.filter(item => item.groupId === 'group-a');
    mixed.groups[1].vendorId = null;
    mixed.items.push({
      ...data().items[2], disposition: 'library_only', quantity: null, unit: null,
      packCount: null, lineCost: null, currency: null, unitCost: null, purpose: null,
    });

    expect(validateImportForFinalization(mixed)).toEqual([]);
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
    expect(result.items.map(item => [item.identityDisposition, item.holdingDisposition])).toEqual([
      ['reused', 'reused'], ['created', 'created'], ['created', 'created'], ['created', 'created'],
    ]);
    expect(result.receipts.map(receipt => ({ groupId: receipt.groupId, vendorId: receipt.vendorId, vendorName: receipt.vendorName }))).toEqual([
      { groupId: 'group-a', vendorId: 'vendor-a', vendorName: 'Chen' },
      { groupId: 'group-b', vendorId: 'vendor-b', vendorName: 'Lin' },
    ]);
    expect(result.journey).toEqual({ id: 'journey-a', name: 'Yunnan · Spring · 2026' });
  });

  it('creates only an identity and nullable result identifiers for a Library-only item', async () => {
    const importData = data();
    importData.groups = [];
    importData.items = [{
      ...importData.items[1], groupId: 'no-receipt-group', disposition: 'library_only',
      quantity: null, unit: null, packCount: null, lineCost: null, currency: null,
      unitCost: null, purpose: null,
    }];
    const { ctx, identities, products, receipts, movements } = harness(importData);

    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(identities).toHaveLength(1);
    expect(products).toHaveLength(0);
    expect(receipts).toHaveLength(0);
    expect(movements).toHaveLength(0);
    expect(result.items).toEqual([{
      id: 'item-1', disposition: 'library_only', compassEntryId: 'entry-item-1',
      productId: null, receiptId: null, movementId: null,
      identityDisposition: 'created', holdingDisposition: null,
    }]);
  });

  it('creates an in-transit holding and receipt line without applying a movement', async () => {
    const importData = data();
    importData.groups = [importData.groups[0]];
    importData.items = [{ ...importData.items[1], groupId: 'group-a', disposition: 'in_transit' }];
    const { ctx, products, receipts, movements } = harness(importData);

    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(products).toHaveLength(1);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].lines).toEqual([
      expect.objectContaining({ itemId: 'item-1', disposition: 'in_transit' }),
    ]);
    expect(movements).toHaveLength(0);
    expect(result.items[0]).toMatchObject({
      disposition: 'in_transit', productId: 'product-item-1',
      receiptId: 'receipt-group-a', movementId: null, holdingDisposition: 'created',
    });
  });

  it('finalizes received, in-transit, and Library-only items in one mixed batch', async () => {
    const importData = data();
    importData.items[0].disposition = 'received';
    importData.items[1].disposition = 'in_transit';
    for (const item of importData.items.slice(2)) {
      Object.assign(item, {
        disposition: 'library_only', productId: null, quantity: null, unit: null,
        packCount: null, lineCost: null, currency: null, unitCost: null, purpose: null,
      });
    }
    importData.groups[1].vendorId = null;
    const { ctx, identities, products, receipts, movements } = harness(importData);

    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(identities).toHaveLength(4);
    expect(products).toHaveLength(2);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].lines.map((line: any) => [line.itemId, line.disposition])).toEqual([
      ['item-0', 'received'], ['item-1', 'in_transit'],
    ]);
    expect(movements).toHaveLength(1);
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'item-0', disposition: 'received', receiptId: 'receipt-group-a', movementId: 'movement-item-0' }),
      expect.objectContaining({ id: 'item-1', disposition: 'in_transit', receiptId: 'receipt-group-a', movementId: null }),
      expect.objectContaining({ id: 'item-2', disposition: 'library_only', productId: null, receiptId: null, movementId: null }),
      expect.objectContaining({ id: 'item-3', disposition: 'library_only', productId: null, receiptId: null, movementId: null }),
    ]);
  });

  it('reports an identity-linked product discovered during finalization as reused', async () => {
    const importData = data();
    importData.items[1].productId = null;
    const { ctx } = harness(importData);
    ctx.ensureProduct = async item => item.id === 'item-1'
      ? { id: 'product-linked', disposition: 'reused' } as any
      : { id: item.productId ?? `product-${item.id}`, disposition: item.productId ? 'reused' : 'created' } as any;

    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(result.items[1]).toMatchObject({ productId: 'product-linked', holdingDisposition: 'reused' });
  });

  it('passes exact decimal provenance to receipts without a binary-float round trip', async () => {
    const importData = data();
    importData.items[0].lineCostExact = '0.3';
    importData.items[0].unitCostExact = '0.001';
    const { ctx, receipts } = harness(importData);
    await finalizeCurateImport(ctx, 'batch-a', 'finish-key');
    expect(receipts[0].lines[0]).toMatchObject({ originalCostAmountExact: '0.3', originalUnitCostExact: '0.001' });
  });

  it('sanitizes malformed exact cost strings to their validated numeric fallback', async () => {
    const importData = data();
    importData.items[0].lineCostExact = '50 CNY';
    importData.items[0].unitCostExact = '0.5 each';
    expect(validateImportForFinalization(importData)).toEqual([]);
    const { ctx, receipts } = harness(importData);

    await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(receipts[0].lines[0]).toMatchObject({
      originalCostAmountExact: '50',
      originalUnitCostExact: '0.5',
    });
    expect(JSON.stringify(receipts)).not.toContain('50 CNY');
    expect(JSON.stringify(receipts)).not.toContain('0.5 each');
  });

  it('rejects malformed exact costs when no valid numeric fallback exists', () => {
    const invalid = data();
    invalid.items[0].lineCost = null;
    invalid.items[0].unitCost = null;
    invalid.items[0].lineCostExact = 'unknown';
    invalid.items[0].unitCostExact = 'unknown';

    expect(validateImportForFinalization(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'lineCost', itemId: 'item-0' }),
      expect.objectContaining({ field: 'unitCost', itemId: 'item-0' }),
    ]));
  });

  it('round-trips an unrepresentable decimal to receipt provenance without an unsafe number', async () => {
    const importData = data();
    importData.items[0].lineCost = null;
    importData.items[0].unitCost = null;
    importData.items[0].lineCostExact = '999999999999999.99';
    importData.items[0].unitCostExact = '9999999999999.9999';
    expect(validateImportForFinalization(importData)).toEqual([]);
    const { ctx, receipts } = harness(importData);
    await finalizeCurateImport(ctx, 'batch-a', 'finish-key');
    expect(receipts[0].lines[0]).toMatchObject({ originalCostAmount: null, originalCostAmountExact: '999999999999999.99', originalUnitCost: null, originalUnitCostExact: '9999999999999.9999' });
  });

  it('reloads and validates the latest saved import after owning the finalization reservation', async () => {
    const { ctx } = harness();
    const events: string[] = [];
    const loadImport = ctx.loadImport;
    const reserve = ctx.reserveFinalization;
    const validate = ctx.validateResolutions;
    ctx.loadImport = async (...args) => { events.push('load'); return loadImport(...args); };
    ctx.reserveFinalization = async (...args) => { events.push('reserve'); await reserve(...args); };
    ctx.validateResolutions = async (...args) => { events.push('validate'); return validate(...args); };

    await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(events.slice(0, 4)).toEqual(['load', 'reserve', 'load', 'validate']);
  });

  it('finalizes corrections saved while the idempotency reservation is being acquired', async () => {
    const stale = data(); stale.items[0].blockingFields = ['priceBasis'];
    const latest = data();
    const { ctx, receipts, movements } = harness(latest);
    let loads = 0;
    ctx.loadImport = async () => ++loads === 1 ? stale : latest;

    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(loads).toBe(2);
    expect(result.items).toHaveLength(4);
    expect(receipts).toHaveLength(2);
    expect(movements).toHaveLength(4);
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
    const stored = { batchId: 'batch-a', idempotencyKey: 'finish-key', journey: null, receipts: [], items: [] };
    let loads = 0;
    ctx.loadFinalization = async () => ++loads === 1 ? null : { idempotencyKey: 'finish-key', result: stored };
    ctx.reserveFinalization = async () => { throw new Error('reservation lost'); };

    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).resolves.toEqual(stored);
    expect(receipts).toHaveLength(0);
    expect(movements).toHaveLength(0);
  });

  it('does not let a failing same-key retry release another invocation reservation', async () => {
    const { ctx, releases } = harness();
    const reserve = ctx.reserveFinalization;
    await reserve('batch-a', 'finish-key'); // Invocation A owns the reservation.
    ctx.reserveFinalization = async (batchId, key) => {
      if (key === 'finish-key') throw new Error('reservation owned by invocation A');
      return reserve(batchId, key);
    };
    ctx.validateResolutions = async () => { throw new Error('retry B preflight failed'); };

    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toThrow('retry B preflight failed');

    expect(releases).toEqual([]);
    expect(await ctx.loadFinalization('batch-a')).toEqual({ idempotencyKey: 'finish-key', result: null });
    ctx.validateResolutions = async () => {};
    await expect(finalizeCurateImport(ctx, 'batch-a', 'different-key')).rejects.toMatchObject({ code: 'idempotency_conflict' });
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

  it.each<PersistenceBoundary>(['identity', 'holding', 'receipt', 'movement', 'completion'])('retries a lost %s response without duplicating persisted records', async boundary => {
    const { ctx, identities, products, receipts, movements, releases } = harness(data(), { failOnceAt: boundary, failMovementItem: 'item-1' });
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toThrow(`simulated ${boundary} response loss`);

    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(result.items).toHaveLength(4);
    expect(identities).toHaveLength(4);
    expect(products).toHaveLength(4);
    expect(receipts).toHaveLength(2);
    expect(movements).toHaveLength(4);
    expect(new Set(result.items.map(item => item.id)).size).toBe(4);
    expect(releases).toHaveLength(0);
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
    const { ctx, receipts, movements, releases } = harness(invalid);
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toMatchObject({ code: 'validation_failed' });
    expect(receipts).toHaveLength(0); expect(movements).toHaveLength(0);
    expect(releases).toEqual(['finish-key']);
    expect(await ctx.loadFinalization('batch-a')).toBeNull();
  });

  it('releases a same-key reservation when resolution preflight is recoverably invalid', async () => {
    const { ctx, receipts, movements, releases } = harness();
    const issue = new Error('Selected holding is stale');
    let invalid = true;
    ctx.validateResolutions = async () => { if (invalid) throw issue; };

    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).rejects.toThrow('Selected holding is stale');

    expect(await ctx.loadFinalization('batch-a')).toBeNull();
    expect(releases).toEqual(['finish-key']);
    expect(receipts).toHaveLength(0);
    expect(movements).toHaveLength(0);

    invalid = false;
    await expect(finalizeCurateImport(ctx, 'batch-a', 'finish-key')).resolves.toMatchObject({ idempotencyKey: 'finish-key' });
    expect(receipts).toHaveLength(2);
    expect(movements).toHaveLength(4);
  });

  it('allows a matched Library identity without an existing holding and creates one for received stock', async () => {
    const invalid = data();
    invalid.items[0].duplicateResolution = 'matched';
    invalid.items[0].productId = null;
    expect(validateImportForFinalization(invalid)).toEqual([]);

    const { ctx, products } = harness(invalid);
    const result = await finalizeCurateImport(ctx, 'batch-a', 'finish-key');

    expect(products[0]).toMatchObject({ id: 'product-item-0', disposition: 'created' });
    expect(result.items[0]).toMatchObject({ compassEntryId: 'entry-existing', productId: 'product-item-0', holdingDisposition: 'created' });
  });
});

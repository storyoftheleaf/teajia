export type FinalizeUnit = 'g' | 'unit';
export type FinalizePurpose = 'working' | 'sample' | 'personal';
export type FinalizeImportDisposition = 'received' | 'in_transit' | 'library_only';
export type StockBearingFinalizeDisposition = Exclude<FinalizeImportDisposition, 'library_only'>;

export type FinalizeDisposition = 'created' | 'reused';
export interface FinalizeResolution { id: string; disposition: FinalizeDisposition }
export interface CurateFinalizeBatch { id: string; accountId: string; journeyId: string | null; journeyName: string | null; reviewState: string; shippingRatePerKg: number }
export interface CurateFinalizeGroup { id: string; vendorId: string | null; vendorName: string | null; position: number }
export interface CurateFinalizeItem {
  id: string; groupId: string; category: 'tea' | 'teaware'; name: string;
  compassEntryId: string | null; productId: string | null;
  disposition: FinalizeImportDisposition;
  identityDisposition?: FinalizeDisposition;
  duplicateResolution?: 'new' | 'matched' | 'unresolved';
  quantity: number | null; unit: FinalizeUnit | null; packCount: number | null;
  lineCost: number | null; currency: string | null; unitCost: number | null;
  lineCostExact?: string | null; unitCostExact?: string | null;
  transportMode: string | null;
  purpose: FinalizePurpose | null; blockingFields: string[];
}
export interface CurateFinalizeData { batch: CurateFinalizeBatch; groups: CurateFinalizeGroup[]; items: CurateFinalizeItem[] }
export interface FinalizeValidationIssue { field: string; message: string; groupId?: string; itemId?: string }
export interface FinalizeHoldingCandidate {
  accountId: string;
  compassEntryId: string;
  category: CurateFinalizeItem['category'];
  purpose: unknown;
}

export interface FinalizeReceiptLineInput {
  itemId: string; disposition: StockBearingFinalizeDisposition; productId: string; compassEntryId: string; quantity: number; unit: FinalizeUnit;
  purpose: FinalizePurpose; originalCostAmount: number | null; originalCostCurrency: string;
  originalUnitCost: number | null; packCount: number;
  originalCostAmountExact?: string; originalUnitCostExact?: string;
  transportMode: string | null;
}
export interface FinalizeReceiptLine extends FinalizeReceiptLineInput { id: string; receiptId?: string }
export interface FinalizeReceipt { id: string; groupId: string; lines: FinalizeReceiptLine[] }
export interface FinalizeResultReceipt extends FinalizeReceipt { vendorId: string; vendorName: string }
export interface CurateFinalizeResult {
  batchId: string; idempotencyKey: string; journey: { id: string; name: string } | null; receipts: FinalizeResultReceipt[];
  items: Array<{
    id: string; disposition: FinalizeImportDisposition; compassEntryId: string;
    productId: string | null; receiptId: string | null; movementId: string | null;
    identityDisposition: FinalizeDisposition; holdingDisposition: FinalizeDisposition | null;
  }>;
}

export interface CurateImportFinalizeContext {
  accountId: string;
  userId: string;
  loadImport(batchId: string): Promise<CurateFinalizeData | null>;
  loadFinalization(batchId: string): Promise<{ idempotencyKey: string; result: CurateFinalizeResult | null } | null>;
  validateResolutions(data: CurateFinalizeData): Promise<void>;
  reserveFinalization(batchId: string, idempotencyKey: string): Promise<void>;
  releaseFinalization(batchId: string, idempotencyKey: string): Promise<void>;
  ensureIdentity(item: CurateFinalizeItem, batch: CurateFinalizeBatch): Promise<FinalizeResolution>;
  ensureProduct(item: CurateFinalizeItem, compassEntryId: string, identityDisposition: FinalizeDisposition, batch: CurateFinalizeBatch): Promise<FinalizeResolution>;
  createReceipt(group: CurateFinalizeGroup, lines: FinalizeReceiptLineInput[], idempotencyKey: string, journeyId: string | null): Promise<FinalizeReceipt>;
  receiveLine(line: FinalizeReceiptLine, idempotencyKey: string): Promise<{ movementId: string }>;
  complete(batchId: string, idempotencyKey: string, result: CurateFinalizeResult): Promise<void>;
}

export class CurateImportFinalizeError extends Error {
  constructor(readonly code: 'not_found' | 'validation_failed' | 'idempotency_conflict', message: string, readonly issues: FinalizeValidationIssue[] = []) { super(message); }
}

function isStockBearingDisposition(disposition: unknown): disposition is StockBearingFinalizeDisposition {
  return disposition === 'received' || disposition === 'in_transit';
}

export function isFinalizePurpose(purpose: unknown): purpose is FinalizePurpose {
  return purpose === 'working' || purpose === 'sample' || purpose === 'personal';
}

function isExactCost(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value);
}

function exactCostOrFallback(exact: string | null | undefined, fallback: number | null): string {
  return isExactCost(exact) ? exact : String(fallback);
}

const STOCK_ONLY_FIELDS = new Set([
  'vendor', 'product', 'holdingResolution', 'quantity', 'totalQuantityGrams', 'totalUnits',
  'unit', 'weightUnit', 'packCount', 'packWeight', 'priceAmount', 'priceBasis', 'lineCost',
  'lineCostExact', 'currency', 'unitCost', 'unitCostExact', 'purpose', 'inventoryPurpose',
]);

export function holdingMatchesFinalizeItem(
  holding: FinalizeHoldingCandidate,
  item: Pick<CurateFinalizeItem, 'category' | 'purpose'>,
  compassEntryId: string,
  accountId: string,
): boolean {
  return holding.accountId === accountId
    && holding.compassEntryId === compassEntryId
    && holding.category === item.category
    && isFinalizePurpose(holding.purpose)
    && isFinalizePurpose(item.purpose)
    && holding.purpose === item.purpose;
}

export function validateImportForFinalization(data: CurateFinalizeData): FinalizeValidationIssue[] {
  const issues: FinalizeValidationIssue[] = [];
  const stockItems = data.items.filter(item => isStockBearingDisposition(item.disposition));
  if (data.batch.reviewState !== 'reviewing') issues.push({ field: 'reviewState', message: 'Only imports under review can be finalized' });
  if (stockItems.length && !data.groups.length) issues.push({ field: 'groups', message: 'At least one vendor group is required' });
  if (!data.items.length) issues.push({ field: 'items', message: 'At least one inventory item is required' });
  for (const group of data.groups) {
    if (stockItems.some(item => item.groupId === group.id) && !group.vendorId) issues.push({ field: 'vendor', groupId: group.id, message: 'Choose a vendor for this group' });
  }
  const groupIds = new Set(data.groups.map(group => group.id));
  for (const item of data.items) {
    const stockBearing = isStockBearingDisposition(item.disposition);
    if (item.disposition !== 'received' && item.disposition !== 'in_transit' && item.disposition !== 'library_only') issues.push({ field: 'disposition', itemId: item.id, message: 'Choose received, in transit, or Library only' });
    if (item.duplicateResolution === 'matched' && !item.compassEntryId) issues.push({ field: 'duplicateResolution', itemId: item.id, message: 'Matched identity must exist' });
    if (stockBearing && !groupIds.has(item.groupId)) issues.push({ field: 'vendor', itemId: item.id, message: 'Item has no vendor group' });
    for (const field of item.blockingFields) {
      if (stockBearing || !STOCK_ONLY_FIELDS.has(field)) issues.push({ field, itemId: item.id, message: `Review ${field}` });
    }
    if (!stockBearing) {
      if (!item.name.trim()) issues.push({ field: 'name', itemId: item.id, message: 'Inventory name is required' });
      continue;
    }
    if (!Number.isFinite(item.quantity) || Number(item.quantity) <= 0) issues.push({ field: 'quantity', itemId: item.id, message: 'Quantity is required' });
    if (item.unit !== 'g' && item.unit !== 'unit') issues.push({ field: 'unit', itemId: item.id, message: 'Stock unit is required' });
    if (!Number.isFinite(item.packCount) || Number(item.packCount) <= 0) issues.push({ field: 'packCount', itemId: item.id, message: 'Pack count is required' });
    const exactLineCost = isExactCost(item.lineCostExact);
    if (!exactLineCost && (!Number.isFinite(item.lineCost) || Number(item.lineCost) < 0)) issues.push({ field: 'lineCost', itemId: item.id, message: 'Line cost is required' });
    if (!item.currency) issues.push({ field: 'currency', itemId: item.id, message: 'Currency is required' });
    const exactUnitCost = isExactCost(item.unitCostExact);
    if (!exactUnitCost && (!Number.isFinite(item.unitCost) || Number(item.unitCost) < 0)) issues.push({ field: 'unitCost', itemId: item.id, message: 'Unit cost is required' });
    if (!isFinalizePurpose(item.purpose)) issues.push({ field: 'purpose', itemId: item.id, message: 'Inventory purpose must be working, sample, or personal' });
    if (!item.name.trim()) issues.push({ field: 'name', itemId: item.id, message: 'Inventory name is required' });
  }
  return issues.filter((issue, index, all) => all.findIndex(candidate => candidate.field === issue.field && candidate.groupId === issue.groupId && candidate.itemId === issue.itemId) === index);
}

export async function finalizeCurateImport(ctx: CurateImportFinalizeContext, batchId: string, idempotencyKey: string): Promise<CurateFinalizeResult> {
  if (!idempotencyKey.trim() || idempotencyKey.length > 200) throw new CurateImportFinalizeError('idempotency_conflict', 'A valid idempotency key is required');
  const finalization = await ctx.loadFinalization(batchId);
  if (finalization && finalization.idempotencyKey !== idempotencyKey) throw new CurateImportFinalizeError('idempotency_conflict', 'Import was already finalized with a different idempotency key');
  if (finalization?.result) return finalization.result;
  const initial = await ctx.loadImport(batchId);
  if (!initial || initial.batch.accountId !== ctx.accountId) throw new CurateImportFinalizeError('not_found', 'Import not found');
  let reservationOwned = false;
  try {
    await ctx.reserveFinalization(batchId, idempotencyKey);
    reservationOwned = true;
  } catch (error) {
    const raced = await ctx.loadFinalization(batchId);
    if (!raced) throw error;
    if (raced.idempotencyKey !== idempotencyKey) throw new CurateImportFinalizeError('idempotency_conflict', 'Import was already finalized with a different idempotency key');
    if (raced.result) return raced.result;
    // Same-key work is deliberately resumable: every downstream primitive is idempotent.
  }

  let data: CurateFinalizeData;
  try {
    const latest = await ctx.loadImport(batchId);
    if (!latest || latest.batch.accountId !== ctx.accountId) throw new CurateImportFinalizeError('not_found', 'Import not found');
    const issues = validateImportForFinalization(latest);
    if (issues.length) throw new CurateImportFinalizeError('validation_failed', 'Review blocking import fields', issues);
    await ctx.validateResolutions(latest);
    data = latest;
  } catch (error) {
    if (reservationOwned) await ctx.releaseFinalization(batchId, idempotencyKey);
    throw error;
  }

  const resolved = new Map<string, { item: CurateFinalizeItem; identity: FinalizeResolution; holding: FinalizeResolution | null }>();
  for (const item of data.items) {
    const identity = await ctx.ensureIdentity(item, data.batch);
    const holding = isStockBearingDisposition(item.disposition) ? await ctx.ensureProduct(item, identity.id, identity.disposition, data.batch) : null;
    resolved.set(item.id, { item, identity, holding });
  }
  const receipts: FinalizeResultReceipt[] = [];
  const finalizedByItem = new Map<string, CurateFinalizeResult['items'][number]>();
  for (const item of data.items) {
    const resolution = resolved.get(item.id)!;
    finalizedByItem.set(item.id, {
      id: item.id, disposition: item.disposition, compassEntryId: resolution.identity.id,
      productId: resolution.holding?.id ?? null, receiptId: null, movementId: null,
      identityDisposition: resolution.identity.disposition, holdingDisposition: resolution.holding?.disposition ?? null,
    });
  }
  for (const group of [...data.groups].sort((a, b) => a.position - b.position)) {
    const lines: FinalizeReceiptLineInput[] = data.items.filter(item => item.groupId === group.id && isStockBearingDisposition(item.disposition)).map(item => {
      const identity = resolved.get(item.id)!;
      return {
        itemId: item.id, disposition: item.disposition as StockBearingFinalizeDisposition,
        productId: identity.holding!.id, compassEntryId: identity.identity.id,
        quantity: item.quantity!, unit: item.unit!, purpose: item.purpose!, packCount: item.packCount!,
        originalCostAmount: item.lineCost, originalCostCurrency: item.currency!, originalUnitCost: item.unitCost,
        originalCostAmountExact: exactCostOrFallback(item.lineCostExact, item.lineCost), originalUnitCostExact: exactCostOrFallback(item.unitCostExact, item.unitCost),
        transportMode: item.transportMode,
      };
    });
    if (!lines.length) continue;
    const receipt = await ctx.createReceipt(group, lines, `${idempotencyKey}:receipt:${group.id}`, data.batch.journeyId);
    receipts.push({ ...receipt, vendorId: group.vendorId!, vendorName: group.vendorName || 'Unnamed vendor' });
    for (const line of receipt.lines) {
      const resolution = resolved.get(line.itemId)!;
      const finalized = finalizedByItem.get(line.itemId)!;
      finalized.receiptId = receipt.id;
      if (resolution.item.disposition === 'received') {
        const movement = await ctx.receiveLine(line, `${idempotencyKey}:movement:${line.itemId}`);
        finalized.movementId = movement.movementId;
      }
    }
  }
  const result: CurateFinalizeResult = { batchId, idempotencyKey, journey: data.batch.journeyId ? { id: data.batch.journeyId, name: data.batch.journeyName || 'Unnamed sourcing run' } : null, receipts, items: data.items.map(item => finalizedByItem.get(item.id)!) };
  await ctx.complete(batchId, idempotencyKey, result);
  return result;
}

export type FinalizeUnit = 'g' | 'unit';
export type FinalizePurpose = 'working' | 'sample' | 'personal';

export interface CurateFinalizeBatch { id: string; accountId: string; journeyId: string | null; reviewState: string }
export interface CurateFinalizeGroup { id: string; vendorId: string | null; vendorName: string | null; position: number }
export interface CurateFinalizeItem {
  id: string; groupId: string; category: 'tea' | 'teaware'; name: string;
  compassEntryId: string | null; productId: string | null;
  duplicateResolution?: 'new' | 'matched' | 'unresolved';
  quantity: number | null; unit: FinalizeUnit | null; packCount: number | null;
  lineCost: number | null; currency: string | null; unitCost: number | null;
  purpose: FinalizePurpose | null; blockingFields: string[];
}
export interface CurateFinalizeData { batch: CurateFinalizeBatch; groups: CurateFinalizeGroup[]; items: CurateFinalizeItem[] }
export interface FinalizeValidationIssue { field: string; message: string; groupId?: string; itemId?: string }

export interface FinalizeReceiptLineInput {
  itemId: string; productId: string; compassEntryId: string; quantity: number; unit: FinalizeUnit;
  purpose: FinalizePurpose; originalCostAmount: number; originalCostCurrency: string;
  originalUnitCost: number; packCount: number;
}
export interface FinalizeReceiptLine extends FinalizeReceiptLineInput { id: string; receiptId?: string }
export interface FinalizeReceipt { id: string; groupId: string; lines: FinalizeReceiptLine[] }
export interface CurateFinalizeResult {
  batchId: string; idempotencyKey: string; receipts: FinalizeReceipt[];
  items: Array<{ id: string; compassEntryId: string; productId: string; movementId: string }>;
}

export interface CurateImportFinalizeContext {
  accountId: string;
  userId: string;
  loadImport(batchId: string): Promise<CurateFinalizeData | null>;
  loadFinalization(batchId: string): Promise<{ idempotencyKey: string; result: CurateFinalizeResult | null } | null>;
  reserveFinalization(batchId: string, idempotencyKey: string): Promise<void>;
  ensureIdentity(item: CurateFinalizeItem, batch: CurateFinalizeBatch): Promise<string>;
  ensureProduct(item: CurateFinalizeItem, compassEntryId: string): Promise<string>;
  createReceipt(group: CurateFinalizeGroup, lines: FinalizeReceiptLineInput[], idempotencyKey: string, journeyId: string | null): Promise<FinalizeReceipt>;
  receiveLine(line: FinalizeReceiptLine, idempotencyKey: string): Promise<{ movementId: string }>;
  complete(batchId: string, idempotencyKey: string, result: CurateFinalizeResult): Promise<void>;
}

export class CurateImportFinalizeError extends Error {
  constructor(readonly code: 'not_found' | 'validation_failed' | 'idempotency_conflict', message: string, readonly issues: FinalizeValidationIssue[] = []) { super(message); }
}

export function validateImportForFinalization(data: CurateFinalizeData): FinalizeValidationIssue[] {
  const issues: FinalizeValidationIssue[] = [];
  if (data.batch.reviewState !== 'reviewing') issues.push({ field: 'reviewState', message: 'Only imports under review can be finalized' });
  if (!data.groups.length) issues.push({ field: 'groups', message: 'At least one vendor group is required' });
  if (!data.items.length) issues.push({ field: 'items', message: 'At least one inventory item is required' });
  for (const group of data.groups) if (!group.vendorId) issues.push({ field: 'vendor', groupId: group.id, message: 'Choose a vendor for this group' });
  for (const group of data.groups) if (!data.items.some(item => item.groupId === group.id)) issues.push({ field: 'items', groupId: group.id, message: 'Vendor receipt cannot be empty' });
  const groupIds = new Set(data.groups.map(group => group.id));
  for (const item of data.items) {
    if (item.duplicateResolution === 'matched' && (!item.compassEntryId || !item.productId)) issues.push({ field: 'duplicateResolution', itemId: item.id, message: 'Matched identity and holding must both exist' });
    if (!groupIds.has(item.groupId)) issues.push({ field: 'vendor', itemId: item.id, message: 'Item has no vendor group' });
    for (const field of item.blockingFields) issues.push({ field, itemId: item.id, message: `Review ${field}` });
    if (!Number.isFinite(item.quantity) || Number(item.quantity) <= 0) issues.push({ field: 'quantity', itemId: item.id, message: 'Quantity is required' });
    if (item.unit !== 'g' && item.unit !== 'unit') issues.push({ field: 'unit', itemId: item.id, message: 'Stock unit is required' });
    if (!Number.isFinite(item.packCount) || Number(item.packCount) <= 0) issues.push({ field: 'packCount', itemId: item.id, message: 'Pack count is required' });
    if (!Number.isFinite(item.lineCost) || Number(item.lineCost) < 0) issues.push({ field: 'lineCost', itemId: item.id, message: 'Line cost is required' });
    if (!item.currency) issues.push({ field: 'currency', itemId: item.id, message: 'Currency is required' });
    if (!Number.isFinite(item.unitCost) || Number(item.unitCost) < 0) issues.push({ field: 'unitCost', itemId: item.id, message: 'Unit cost is required' });
    if (!item.purpose) issues.push({ field: 'purpose', itemId: item.id, message: 'Inventory purpose is required' });
    if (!item.name.trim()) issues.push({ field: 'name', itemId: item.id, message: 'Inventory name is required' });
  }
  return issues.filter((issue, index, all) => all.findIndex(candidate => candidate.field === issue.field && candidate.groupId === issue.groupId && candidate.itemId === issue.itemId) === index);
}

export async function finalizeCurateImport(ctx: CurateImportFinalizeContext, batchId: string, idempotencyKey: string): Promise<CurateFinalizeResult> {
  if (!idempotencyKey.trim() || idempotencyKey.length > 200) throw new CurateImportFinalizeError('idempotency_conflict', 'A valid idempotency key is required');
  const finalization = await ctx.loadFinalization(batchId);
  if (finalization && finalization.idempotencyKey !== idempotencyKey) throw new CurateImportFinalizeError('idempotency_conflict', 'Import was already finalized with a different idempotency key');
  if (finalization?.result) return finalization.result;
  const data = await ctx.loadImport(batchId);
  if (!data || data.batch.accountId !== ctx.accountId) throw new CurateImportFinalizeError('not_found', 'Import not found');
  const issues = validateImportForFinalization(data);
  if (issues.length) throw new CurateImportFinalizeError('validation_failed', 'Review blocking import fields', issues);
  await ctx.reserveFinalization(batchId, idempotencyKey);

  const resolved = new Map<string, { item: CurateFinalizeItem; compassEntryId: string; productId: string }>();
  for (const item of data.items) {
    const compassEntryId = await ctx.ensureIdentity(item, data.batch);
    const productId = await ctx.ensureProduct(item, compassEntryId);
    resolved.set(item.id, { item, compassEntryId, productId });
  }
  const receipts: FinalizeReceipt[] = [];
  const finalizedItems: CurateFinalizeResult['items'] = [];
  for (const group of [...data.groups].sort((a, b) => a.position - b.position)) {
    const lines: FinalizeReceiptLineInput[] = data.items.filter(item => item.groupId === group.id).map(item => {
      const identity = resolved.get(item.id)!;
      return {
        itemId: item.id, productId: identity.productId, compassEntryId: identity.compassEntryId,
        quantity: item.quantity!, unit: item.unit!, purpose: item.purpose!, packCount: item.packCount!,
        originalCostAmount: item.lineCost!, originalCostCurrency: item.currency!, originalUnitCost: item.unitCost!,
      };
    });
    const receipt = await ctx.createReceipt(group, lines, `${idempotencyKey}:receipt:${group.id}`, data.batch.journeyId);
    receipts.push(receipt);
    for (const line of receipt.lines) {
      const movement = await ctx.receiveLine(line, `${idempotencyKey}:movement:${line.itemId}`);
      finalizedItems.push({ id: line.itemId, compassEntryId: line.compassEntryId, productId: line.productId, movementId: movement.movementId });
    }
  }
  const result = { batchId, idempotencyKey, receipts, items: finalizedItems };
  await ctx.complete(batchId, idempotencyKey, result);
  return result;
}

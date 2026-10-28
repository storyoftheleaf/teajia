import { extractedToStaged, type ColumnMapping, type StagedItem } from './intakeMapping';
import type { CurateImportDetail } from '../../lib/api';
import { enteredCostCell } from '../productUpdatePayload';
import type { api } from '../../lib/api';
export type IntakeSource = {
  id: string; kind: 'sheet'; name: string; headers: string[]; rawRows: Record<string, unknown>[];
  sampleRows: Record<string, unknown>[]; mapping: ColumnMapping; defaultPersonal: boolean; expanded: boolean;
} | { id: string; kind: 'image'; name: string; status: 'extracting' | 'ready' | 'error'; error?: string };
export type IntakeSnapshot = {
  version: 1; savedAt: number; stockCommitted?: boolean; committedRowIds?: string[]; correctionImportId?: string; purchaseReviewIds?: string[]; sources: IntakeSource[]; items: StagedItem[]; batchId: string | null;
  savePurchaseRecord: boolean; shippingTotal: number; shippingCurrency: string;
  pendingPurchaseRecords: Array<Parameters<typeof api.purchaseOrders.create>[0]>; rowErrors: Record<string, string>;
};
export function readIntakeSnapshot(value: unknown): IntakeSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as IntakeSnapshot;
  return state.version === 1 && Number.isFinite(state.savedAt) && Array.isArray(state.items) && Array.isArray(state.sources)
    && Array.isArray(state.pendingPurchaseRecords) ? state : null;
}
export function intakeStorageKey(account: string | null, user: string | null, id: string | null) {
  return `teajia:intake:${account || 'no-account'}:${user || 'no-user'}:${id || 'new'}`;
}
export function loadIntakeSnapshot(key: string) {
  try { return readIntakeSnapshot(JSON.parse(localStorage.getItem(key) || 'null')); } catch { return null; }
}

export function hydrateIntakeItems(detail:CurateImportDetail):StagedItem[]{
  return detail.items.filter(item=>!['accepted','merged','abandoned'].includes(item.review_state)).map(item=>{
    const parsed=item.parsed_data || {};
    const sourceId=item.source_id || `import:${detail.batch.id}`;
    const quantity=item.category==='teaware' ? parsed.totalUnits ?? item.total_units : parsed.totalQuantityGrams ?? item.total_quantity_grams;
    const staged=extractedToStaged({...parsed,givenName:item.name || parsed.englishName || parsed.originalName || 'Unnamed',
      productName:parsed.originalName || '',type:item.category==='teaware'?'Teaware':parsed.type || parsed.classification,
      costAmount:parsed.lineCostExact ?? parsed.lineCost ?? item.line_cost ?? null,
      costCurrency:parsed.currency ?? item.currency,quantityPurchased:quantity,
      vendor:parsed.vendorResolution?.vendorName || '',
    },String(parsed.imageUrl || ''),sourceId,parsed.inventoryPurpose==='personal');
    const arrived=parsed.disposition==='received';
    return {...staged,id:item.id,inventoryPurpose:parsed.inventoryPurpose || 'working',costAmount:enteredCostCell(parsed.lineCostExact ?? parsed.lineCost ?? item.line_cost),
      stockGrams:arrived?staged.stockGrams:0,quantityUnits:arrived?staged.quantityUnits:0};
  });
}

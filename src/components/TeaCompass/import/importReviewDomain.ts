import type { CurateImportDetail, CurateImportItem, CurateImportVendorGroup } from '../../../lib/api';

export interface ImportReviewItemRow {
  item: CurateImportItem;
  blockingFields: string[];
  blockingMessage: string | null;
  ready: boolean;
}

export interface ImportReviewGroupRow extends CurateImportVendorGroup {
  items: ImportReviewItemRow[];
  vendorResolved: boolean;
}

export interface ImportReviewModel {
  groups: ImportReviewGroupRow[];
  readyCount: number;
  needsReviewCount: number;
  currencyTotals: Array<{ currency: string; amount: number }>;
  totalQuantityGrams: number;
  totalUnits: number;
  canFinalize: boolean;
}

const BLOCKING_LABELS: Record<string, string> = {
  vendor: 'vendor', vendor_group_id: 'vendor', duplicate_identity: 'tea identity', compass_entry_id: 'tea identity',
  product_id: 'Inventory holding', proposed_product_id: 'Inventory holding', pack_count: 'pack count',
  pack_weight: 'weight or unit', weight_unit: 'weight or unit', total_quantity_grams: 'weight or unit', total_units: 'quantity',
  price_amount: 'price', line_cost: 'price', price_basis: 'price interpretation', currency: 'currency',
  acquired: 'physical stock status', acquisition_state: 'physical stock status',
};

const joinLabels = (labels: string[]) => {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
};

export const importBlockingMessage = (item: CurateImportItem): string | null => {
  const labels = Array.from(new Set((item.blocking_fields || []).map(field => BLOCKING_LABELS[field] || field.replace(/_/g, ' '))));
  return labels.length ? `Confirm ${joinLabels(labels)}.` : null;
};

const fallbackGroup = (detail: CurateImportDetail): CurateImportVendorGroup => ({
  id: '__ungrouped', batch_id: detail.batch.id, position: Number.MAX_SAFE_INTEGER,
  proposed_vendor_name: 'Vendor not assigned', resolved_vendor_customer_id: null, resolved_vendor_name: null,
  confidence: null, uncertainty: { vendor: 'Choose a vendor for these teas' },
});

export const buildImportReviewModel = (detail: CurateImportDetail): ImportReviewModel => {
  const groups = [...(detail.groups || [])];
  if (detail.items.some(item => !item.vendor_group_id || !groups.some(group => group.id === item.vendor_group_id))) groups.push(fallbackGroup(detail));
  const orderedGroups = groups.sort((a, b) => a.position - b.position).map(group => {
    const rows = detail.items
      .filter(item => group.id === '__ungrouped' ? !item.vendor_group_id || !detail.groups?.some(candidate => candidate.id === item.vendor_group_id) : item.vendor_group_id === group.id)
      .sort((a, b) => a.position - b.position)
      .map(item => {
        const blockingFields = item.blocking_fields || [];
        return { item, blockingFields, blockingMessage: importBlockingMessage(item), ready: blockingFields.length === 0 };
      });
    return { ...group, items: rows, vendorResolved: Boolean(group.resolved_vendor_customer_id) };
  }).filter(group => group.items.length > 0);

  const rows = orderedGroups.flatMap(group => group.items);
  const totals = new Map<string, number>();
  for (const { item } of rows) {
    if (item.currency && Number.isFinite(item.line_cost)) totals.set(item.currency, (totals.get(item.currency) || 0) + Number(item.line_cost));
  }
  const currencyTotals = Array.from(totals, ([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency));
  const readyCount = rows.filter(row => row.ready).length;
  return {
    groups: orderedGroups, readyCount, needsReviewCount: rows.length - readyCount, currencyTotals,
    totalQuantityGrams: rows.reduce((sum, row) => sum + (Number.isFinite(row.item.total_quantity_grams) ? Number(row.item.total_quantity_grams) : 0), 0),
    totalUnits: rows.reduce((sum, row) => sum + (Number.isFinite(row.item.total_units) ? Number(row.item.total_units) : 0), 0),
    canFinalize: rows.length > 0 && rows.every(row => row.ready) && orderedGroups.every(group => group.vendorResolved),
  };
};

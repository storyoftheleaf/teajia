import type { CurateImportDetail, CurateImportFinalizeResult, CurateImportItem, CurateImportReviewedField, CurateImportVendorGroup } from '../../../lib/api';
import type { CurateJourney } from '../types';

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
  inventoryPurpose: 'Inventory purpose', inventory_purpose: 'Inventory purpose',
  duplicateIdentity: 'tea identity', compassEntryId: 'tea identity', productId: 'Inventory holding',
  acquisitionState: 'physical stock status', physicalStock: 'physical stock status', acquiredIntoStock: 'physical stock status',
};

export const filterImportJourneys = (journeys: CurateJourney[], query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return journeys;
  return journeys.filter(journey => [journey.name, journey.season, journey.year].filter(value => value != null).join(' ').toLocaleLowerCase().includes(needle));
};

export const inventoryTargetFromFinalize = (result: CurateImportFinalizeResult): string | null => {
  const first = result.items[0];
  if (!first) return null;
  if ('productId' in first && typeof first.productId === 'string') return first.productId;
  return 'proposed_product_id' in first && typeof first.proposed_product_id === 'string' ? first.proposed_product_id : null;
};

const normalizedBlocker = (field: string) => field.replace(/_/g, '').toLocaleLowerCase();
export const resolveImportBlockingFields = (fields: string[], values: Record<string, unknown>) => fields.filter(field => {
  const key = normalizedBlocker(field);
  if (key === 'packcount') return !(typeof values.packCount === 'number' && values.packCount > 0);
  if (key === 'packweight') return !(typeof values.packWeight === 'number' && values.packWeight > 0);
  if (key === 'weightunit') return !values.weightUnit;
  if (key === 'priceamount') return !((typeof values.priceAmount === 'number' && values.priceAmount >= 0) || (typeof values.priceAmount === 'string' && /^\d+(?:\.\d+)?$/.test(values.priceAmount)));
  if (key === 'pricebasis') return !values.priceBasis || values.priceBasis === 'unknown';
  if (key === 'currency') return !values.currency;
  if (['duplicateidentity', 'compassentryid', 'proposedcompassentryid'].includes(key)) return values.duplicateResolution !== 'new' && !values.proposedCompassEntryId;
  if (['productid', 'proposedproductid', 'inventoryholding'].includes(key)) return values.duplicateResolution !== 'new' && !values.proposedProductId;
  if (['acquisitionstate', 'physicalstock', 'acquiredintostock', 'acquired'].includes(key)) return values.acquired !== true;
  if (['purpose', 'inventorypurpose'].includes(key)) return !values.inventoryPurpose;
  return true;
});

const WORKER_IMPORT_FIELDS = [
  'sourceItemId', 'category', 'originalName', 'englishName', 'packWeight', 'weightUnit', 'packCount',
  'priceAmount', 'currency', 'priceBasis', 'confidence', 'uncertainty', 'evidenceRefs', 'acquired',
  'duplicateResolution', 'proposedCompassEntryId', 'proposedProductId', 'chineseName', 'type', 'form',
  'year', 'originCountry', 'originRegion', 'classification', 'description', 'inventoryPurpose',
] as const;

export const withoutImportDerivedFields = (parsed: Record<string, unknown>) => Object.fromEntries(
  WORKER_IMPORT_FIELDS.filter(field => field in parsed).map(field => [field, parsed[field]]),
);

export interface ImportCorrectionDraft {
  englishName: string | null; originalName: string | null; type: string | null; classification: string | null;
  year: number | null; form: string | null; originRegion: string | null; description: string | null;
  inventoryPurpose: string | null; compassSelection: string | null; productSelection: string | null; acquired: boolean;
  packWeight: number | null; weightUnit: string | null; packCount: number | null; priceAmount: string | null;
  currency: string | null; priceBasis: string;
}

export const buildImportCorrectionParsedData = (parsed: Record<string, unknown>, draft: ImportCorrectionDraft) => {
  const createsIdentity = draft.compassSelection === 'new';
  const proposedCompassEntryId = createsIdentity ? null : draft.compassSelection;
  const proposedProductId = createsIdentity || draft.productSelection === 'new' ? null : draft.productSelection;
  const priceAmount = (() => {
    const source = draft.priceAmount?.trim();
    if (!source || !/^\d+(?:\.\d+)?$/.test(source)) return null;
    const [whole, fraction = ''] = source.split('.');
    const canonicalWhole = whole.replace(/^0+(?=\d)/, '') || '0';
    const canonicalFraction = fraction.replace(/0+$/, '');
    return canonicalFraction ? `${canonicalWhole}.${canonicalFraction}` : canonicalWhole;
  })();
  return {
    ...withoutImportDerivedFields(parsed),
    englishName: draft.englishName, originalName: draft.originalName, type: draft.type,
    classification: draft.classification, year: draft.year, form: draft.form, originRegion: draft.originRegion,
    description: draft.description, inventoryPurpose: draft.inventoryPurpose,
    proposedCompassEntryId, proposedProductId, acquired: draft.acquired,
    duplicateResolution: createsIdentity ? 'new' : proposedCompassEntryId ? 'matched' : 'unresolved',
    packWeight: draft.packWeight, weightUnit: draft.weightUnit, packCount: draft.packCount,
    priceAmount, priceAmountExact: priceAmount, currency: draft.currency, priceBasis: draft.priceBasis,
  };
};

export const normalizeImportDetail = (detail: CurateImportDetail): CurateImportDetail => ({
  ...detail,
  groups: (detail.groups || []).map(group => ({ ...group, confidence: group.confidence ?? group.vendor_confidence ?? null })),
  items: detail.items.map(item => {
    const parsed = item.parsed_data || {};
    return {
      ...item,
      english_name: (parsed.englishName as string | null | undefined) ?? item.english_name,
      original_name: (parsed.originalName as string | null | undefined) ?? item.original_name,
      pack_weight: (parsed.packWeight as number | null | undefined) ?? item.pack_weight,
      weight_unit: (parsed.weightUnit as CurateImportItem['weight_unit']) ?? item.weight_unit,
      pack_count: (parsed.packCount as number | null | undefined) ?? item.pack_count,
      price_amount: (parsed.priceAmount as number | null | undefined) ?? item.price_amount,
      price_amount_exact: (parsed.priceAmountExact as string | null | undefined) ?? item.price_amount_exact,
      currency: (parsed.currency as string | null | undefined) ?? item.currency,
      price_basis: (parsed.priceBasis as CurateImportItem['price_basis']) ?? item.price_basis,
      total_quantity_grams: (parsed.totalQuantityGrams as number | null | undefined) ?? item.total_quantity_grams,
      total_units: (parsed.totalUnits as number | null | undefined) ?? item.total_units,
      line_cost: (parsed.lineCost as number | null | undefined) ?? item.line_cost,
      unit_cost: (parsed.unitCost as number | null | undefined) ?? item.unit_cost,
      blocking_fields: parsed.blockingFields ? (parsed.blockingFields as string[]).map(field => field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)) : item.blocking_fields ?? [],
      proposed_compass_entry_id: (parsed.proposedCompassEntryId as string | null | undefined) ?? item.proposed_compass_entry_id,
      proposed_product_id: (parsed.proposedProductId as string | null | undefined) ?? item.proposed_product_id,
      acquired: (parsed.acquired as boolean | null | undefined) ?? item.acquired,
      duplicate_resolution: (parsed.duplicateResolution as CurateImportItem['duplicate_resolution']) ?? item.duplicate_resolution,
    };
  }),
});

export const reviewedFieldsForImportSave = (item: CurateImportItem, compassSelection: string, productSelection: string): CurateImportReviewedField[] => {
  const blockers = (item.blocking_fields ?? []).map(field => field.replace(/_/g, '').toLocaleLowerCase());
  const identityBlocked = blockers.some(field => ['identity', 'duplicateidentity', 'compassentryid', 'proposedcompassentryid', 'productid', 'proposedproductid', 'inventoryholding'].includes(field));
  return identityBlocked && Boolean(compassSelection || productSelection) ? ['identity'] : [];
};

export const importItemNoun = (items: Array<Pick<CurateImportItem, 'category'>>, count = items.length) => {
  if (items.every(item => item.category === 'tea')) return count === 1 ? 'tea' : 'teas';
  if (items.every(item => item.category === 'teaware')) return count === 1 ? 'teaware item' : 'teaware items';
  return count === 1 ? 'item' : 'items';
};

const joinLabels = (labels: string[]) => {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
};

export const importBlockingMessage = (item: CurateImportItem): string | null => {
  const purpose = item.parsed_data?.inventoryPurpose;
  const fields = [...(item.blocking_fields || []), ...(['working', 'sample', 'personal'].includes(String(purpose)) ? [] : ['inventoryPurpose'])];
  const labels = Array.from(new Set(fields.map(field => BLOCKING_LABELS[field] || field.replace(/_/g, ' '))));
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
        const purpose = item.parsed_data?.inventoryPurpose;
        const blockingFields = [...(item.blocking_fields || []), ...(['working', 'sample', 'personal'].includes(String(purpose)) ? [] : ['inventoryPurpose'])];
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

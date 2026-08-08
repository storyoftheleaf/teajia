import type { CurateImportCanonicalRecord, CurateImportDetail, CurateImportDisposition, CurateImportFinalizeResult, CurateImportInventoryPurpose, CurateImportItem, CurateImportReviewedField, CurateImportVendorGroup } from '../../../lib/api';
import type { CurateJourney } from '../types';

export interface ImportReviewItemRow {
  item: CurateImportItem;
  blockingFields: string[];
  blockingMessage: string | null;
  ready: boolean;
}

export interface ImportReviewGroupRow extends CurateImportVendorGroup {
  items: ImportReviewItemRow[];
  vendorRequired: boolean;
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

export interface ImportMatchOption {
  id: string;
  name: string;
  category?: 'tea' | 'teaware';
  compassEntryId?: string | null;
  purpose?: string | null;
  subtitle?: string | null;
  matchReason?: string;
}

const matchTokens = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);

export const rankImportMatches = <T extends ImportMatchOption>(options: T[], query: string, proposedName = ''): Array<T & { matchReason?: string }> => {
  const queryTokens = matchTokens(query);
  const proposedTokens = matchTokens(proposedName);
  return options.map(option => {
    const nameTokens = matchTokens(option.name);
    const queryMatches = queryTokens.filter(token => nameTokens.some(name => name.includes(token) || token.includes(name))).length;
    const proposalMatches = proposedTokens.filter(token => nameTokens.includes(token)).length;
    const exact = proposedName.trim() && option.name.trim().toLocaleLowerCase() === proposedName.trim().toLocaleLowerCase();
    return { option, score: (exact ? 1000 : 0) + proposalMatches * 10 + queryMatches * 20, matchReason: exact || (proposedTokens.length > 0 && proposalMatches / proposedTokens.length >= 0.6) ? 'Closest existing match' : undefined };
  }).filter(row => !queryTokens.length || queryTokens.every(token => matchTokens(row.option.name).some(name => name.includes(token) || token.includes(name))))
    .sort((a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name))
    .map(({ option, matchReason }) => ({ ...option, ...(matchReason ? { matchReason } : {}) }));
};

export const compatibleImportHoldings = <T extends ImportMatchOption>(options: T[], selection: { category: 'tea' | 'teaware'; compassEntryId: string | null; purpose: string | null; disposition?: CurateImportDisposition | null }): T[] => options.filter(option =>
  selection.disposition !== 'library_only'
  && Boolean(selection.compassEntryId)
  && (!option.category || option.category === selection.category)
  && option.compassEntryId === selection.compassEntryId
  && (!selection.purpose || option.purpose === selection.purpose),
);

export const validateImportHoldingSelection = <T extends ImportMatchOption>(selectedId: string, options: T[], criteria: { category: 'tea' | 'teaware'; compassEntryId: string | null; purpose: string | null; disposition?: CurateImportDisposition | null }): string => {
  if (criteria.disposition === 'library_only') return '';
  if (!selectedId || selectedId === 'new') return selectedId;
  return compatibleImportHoldings(options, criteria).some(option => option.id === selectedId) ? selectedId : '';
};

const BLOCKING_LABELS: Record<string, string> = {
  vendor: 'vendor', vendor_group_id: 'vendor', duplicate_identity: 'tea identity', compass_entry_id: 'tea identity',
  product_id: 'Inventory holding', proposed_product_id: 'Inventory holding', pack_count: 'pack count',
  pack_weight: 'weight or unit', weight_unit: 'weight or unit', total_quantity_grams: 'weight or unit', total_units: 'quantity',
  price_amount: 'price', line_cost: 'price', price_basis: 'price interpretation', currency: 'currency',
  acquired: 'physical stock status', acquisition_state: 'physical stock status',
  inventoryPurpose: 'Inventory purpose', inventory_purpose: 'Inventory purpose',
  cultivar: 'cultivar',
  duplicateIdentity: 'tea identity', compassEntryId: 'tea identity', productId: 'Inventory holding',
  acquisitionState: 'physical stock status', physicalStock: 'physical stock status', acquiredIntoStock: 'physical stock status',
  disposition: 'destination',
};

export const filterImportJourneys = (journeys: CurateJourney[], query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return journeys;
  return journeys.filter(journey => [journey.name, journey.season, journey.year].filter(value => value != null).join(' ').toLocaleLowerCase().includes(needle));
};

export const inventoryTargetFromFinalize = (result: CurateImportFinalizeResult): string | null => {
  return result.items.find(item => item.productId)?.productId || null;
};

const DISPOSITIONS = new Set<CurateImportDisposition>(['received', 'in_transit', 'library_only']);
export const importDisposition = (item: Pick<CurateImportItem, 'parsed_data' | 'disposition' | 'acquired'>): CurateImportDisposition | null => {
  const candidate = item.parsed_data?.disposition ?? item.disposition;
  if (typeof candidate === 'string' && DISPOSITIONS.has(candidate as CurateImportDisposition)) return candidate as CurateImportDisposition;
  return item.acquired === true || item.parsed_data?.acquired === true ? 'received' : null;
};

const normalizedBlocker = (field: string) => field.replace(/_/g, '').toLocaleLowerCase();
export const resolveImportBlockingFields = (fields: string[], values: Record<string, unknown>) => fields.filter(field => {
  const key = normalizedBlocker(field);
  const disposition = DISPOSITIONS.has(values.disposition as CurateImportDisposition) ? values.disposition as CurateImportDisposition : null;
  if (key === 'disposition') return !disposition;
  if (disposition === 'library_only' && ['vendor', 'vendorgroupid', 'productid', 'proposedproductid', 'inventoryholding', 'purpose', 'inventorypurpose', 'acquisitionstate', 'physicalstock', 'acquiredintostock', 'acquired', 'packcount', 'packweight', 'weightunit', 'totalquantitygrams', 'totalunits', 'quantity', 'priceamount', 'linecost', 'pricebasis', 'currency'].includes(key)) return false;
  if (['acquisitionstate', 'physicalstock', 'acquiredintostock', 'acquired'].includes(key)) return false;
  if (key === 'packcount') return !(typeof values.packCount === 'number' && values.packCount > 0);
  if (key === 'packweight') return !(typeof values.packWeight === 'number' && values.packWeight > 0);
  if (key === 'weightunit') return !values.weightUnit;
  if (key === 'priceamount') return !((typeof values.priceAmount === 'number' && values.priceAmount >= 0) || (typeof values.priceAmount === 'string' && /^\d+(?:\.\d+)?$/.test(values.priceAmount)));
  if (key === 'pricebasis') return !values.priceBasis || values.priceBasis === 'unknown';
  if (key === 'currency') return !values.currency;
  if (['duplicateidentity', 'compassentryid', 'proposedcompassentryid', 'productid', 'proposedproductid', 'inventoryholding'].includes(key)) return true;
  if (['purpose', 'inventorypurpose'].includes(key)) return !['working', 'sample', 'personal'].includes(String(values.inventoryPurpose));
  return true;
});

const FIELD_BLOCKER_ALIASES: Record<string, string[]> = {
  englishName: ['englishname', 'englishinventoryname', 'translation', 'name'],
  originalName: ['originalname', 'suppliername'],
  chineseName: ['chinesename'],
  type: ['type', 'teatype'],
  originCountry: ['origincountry'],
  originRegion: ['origin', 'originregion'],
  year: ['year'],
  classification: ['classification', 'production'],
  form: ['form'],
  description: ['description'],
  processingNotes: ['processingnotes'],
  producer: ['producer'],
  packWeight: ['packweight', 'totalquantitygrams', 'quantity'],
  weightUnit: ['weightunit', 'totalquantitygrams', 'quantity'],
  packCount: ['packcount', 'totalunits', 'quantity'],
  priceAmount: ['priceamount', 'linecost', 'price'],
  currency: ['currency'],
  priceBasis: ['pricebasis', 'linecost'],
  disposition: ['disposition', 'acquired', 'acquisitionstate', 'physicalstock', 'acquiredintostock'],
  identity: ['identity', 'duplicateidentity', 'compassentryid', 'proposedcompassentryid'],
  holding: ['productid', 'proposedproductid', 'inventoryholding'],
  inventoryPurpose: ['inventorypurpose', 'purpose'],
  cultivar: ['cultivar', 'varietal'],
};

export const importFieldNeedsConfirmation = (field: keyof typeof FIELD_BLOCKER_ALIASES, blockingFields: string[]) => {
  const blockers = new Set(blockingFields.map(normalizedBlocker));
  return FIELD_BLOCKER_ALIASES[field].some(alias => blockers.has(alias));
};

export const effectiveImportBlockingFields = (item: CurateImportItem): string[] => {
  const disposition = importDisposition(item);
  const purpose = item.parsed_data?.inventoryPurpose;
  return resolveImportBlockingFields([
    ...(item.blocking_fields || []),
    ...(disposition ? [] : ['disposition']),
    ...(disposition !== 'library_only' && !['working', 'sample', 'personal'].includes(String(purpose)) ? ['inventoryPurpose'] : []),
  ], { ...item.parsed_data, disposition, acquired: item.acquired });
};

const exactImportNumber = (value: number | string | null | undefined) => value == null || value === '' ? null : String(value);

const multiplyExactDecimal = (amount: string, count: string): string | null => {
  if (!/^\d+(?:\.\d+)?$/.test(amount) || !/^\d+$/.test(count)) return null;
  const [whole, fraction = ''] = amount.split('.');
  const product = BigInt(`${whole}${fraction}`) * BigInt(count);
  const padded = product.toString().padStart(fraction.length + 1, '0');
  if (!fraction.length) return padded;
  const resultWhole = padded.slice(0, -fraction.length);
  const resultFraction = padded.slice(-fraction.length).replace(/0+$/, '');
  return resultFraction ? `${resultWhole}.${resultFraction}` : resultWhole;
};

export interface ImportQuantityCostDraft {
  packWeight: string;
  weightUnit: string;
  packCount: string;
  priceAmount: string;
  currency: string;
  priceBasis: string;
}

export const importDraftQuantityCostEquation = (draft: ImportQuantityCostDraft): string => {
  const packWeight = draft.packWeight.trim();
  const unit = draft.weightUnit.trim();
  const count = draft.packCount.trim();
  const price = draft.priceAmount.trim();
  const currency = draft.currency.trim();
  const pack = packWeight && unit ? `${packWeight}${unit}` : null;
  const multipliedQuantity = packWeight && count ? multiplyExactDecimal(packWeight, count) : null;
  const quantityTotal = multipliedQuantity
    ? unit === 'count' ? `${multipliedQuantity} ${multipliedQuantity === '1' ? 'unit' : 'units'}` : `${multipliedQuantity}${unit}`
    : null;
  const quantity = pack ? `${pack}${count ? ` × ${count}` : ''}${quantityTotal ? ` = ${quantityTotal}` : ''}` : null;
  const currencyPrefix = currency ? `${currency} ` : '';
  const lineCost = price && count ? multiplyExactDecimal(price, count) : null;
  const cost = price
    ? draft.priceBasis === 'per_pack'
      ? `${currencyPrefix}${price} each${lineCost ? ` = ${currencyPrefix}${lineCost}` : ''}`
      : draft.priceBasis === 'line_total'
        ? `${currencyPrefix}${price} total`
        : `${currencyPrefix}${price} · interpretation needed`
    : null;
  return [quantity, cost].filter(Boolean).join(' · ') || 'Quantity or cost needs review';
};

export const importQuantityCostEquation = (item: CurateImportItem): string => {
  const packWeight = exactImportNumber(item.pack_weight);
  const pack = packWeight && item.weight_unit ? `${packWeight}${item.weight_unit}` : null;
  const count = exactImportNumber(item.pack_count);
  const quantityTotal = exactImportNumber(item.total_quantity_grams) && item.weight_unit !== 'count'
    ? `${exactImportNumber(item.total_quantity_grams)}g`
    : exactImportNumber(item.total_units)
      ? `${exactImportNumber(item.total_units)} ${item.total_units === 1 ? 'unit' : 'units'}`
      : null;
  const price = exactImportNumber(item.price_amount_exact ?? item.parsed_data?.priceAmountExact ?? item.price_amount);
  const lineCost = exactImportNumber(item.line_cost_exact ?? item.parsed_data?.lineCostExact ?? item.line_cost);
  const currency = item.currency ? `${item.currency} ` : '';
  const quantity = pack ? `${pack}${count ? ` × ${count}` : ''}${quantityTotal ? ` = ${quantityTotal}` : ''}` : quantityTotal;
  const cost = price
    ? item.price_basis === 'per_pack'
      ? `${currency}${price} each${lineCost ? ` = ${currency}${lineCost}` : ''}`
      : `${currency}${lineCost ?? price} total`
    : lineCost
      ? `${currency}${lineCost} total`
      : null;
  return [quantity, cost].filter(Boolean).join(' · ') || 'Quantity or cost needs review';
};

const WORKER_IMPORT_FIELDS = [
  'sourceItemId', 'category', 'originalName', 'englishName', 'packWeight', 'weightUnit', 'packCount',
  'priceAmount', 'currency', 'priceBasis', 'confidence', 'uncertainty', 'evidenceRefs', 'acquired',
  'duplicateResolution', 'proposedCompassEntryId', 'proposedProductId', 'chineseName', 'type', 'form',
  'year', 'originCountry', 'originRegion', 'classification', 'cultivar', 'producer', 'description', 'processingNotes', 'tasting', 'tastingSource', 'inventoryPurpose',
  'sourceId', 'sourceExcerpt', 'sourceLanguage', 'provenance', 'fieldProvenance', 'disposition',
  'vendorResolution', 'identityResolution', 'holdingResolution',
] as const;

export const withoutImportDerivedFields = (parsed: Record<string, unknown>) => Object.fromEntries(
  WORKER_IMPORT_FIELDS.filter(field => field in parsed).map(field => [field, parsed[field]]),
);

export interface ImportCorrectionDraft {
  englishName: string | null; originalName: string | null; chineseName?: string | null; type: string | null; classification: string | null;
  year: number | null; form: string | null; originCountry?: string | null; originRegion: string | null; description: string | null;
  cultivar?: string | null; producer?: string | null; processingNotes?: string | null;
  inventoryPurpose: CurateImportInventoryPurpose | null; compassSelection: string | null; productSelection: string | null; acquired: boolean;
  disposition: CurateImportDisposition;
  packWeight: number | null; weightUnit: CurateImportItem['weight_unit']; packCount: number | null; priceAmount: string | null;
  currency: string | null; priceBasis: CurateImportItem['price_basis'];
  identityTouched?: boolean;
  productSelectionTouched?: boolean;
}

export const buildImportCorrectionParsedData = (parsed: Record<string, unknown>, draft: ImportCorrectionDraft) => {
  const identityTouched = draft.identityTouched !== false;
  const productSelectionTouched = draft.productSelectionTouched === true;
  const canonicalIdentityResolution = parsed.identityResolution as { kind?: unknown; compassEntryId?: unknown } | null | undefined;
  const canonicalHoldingResolution = parsed.holdingResolution as { kind?: unknown; productId?: unknown } | null | undefined;
  const canonicalDuplicateResolution = canonicalIdentityResolution?.kind === 'existing'
    ? 'matched'
    : canonicalIdentityResolution?.kind === 'new'
      ? 'new'
      : canonicalIdentityResolution?.kind === 'unresolved'
        ? 'unresolved'
        : null;
  const existingDuplicateResolution = ['new', 'matched', 'unresolved'].includes(String(parsed.duplicateResolution))
    ? parsed.duplicateResolution as CurateImportItem['duplicate_resolution']
    : canonicalDuplicateResolution ?? 'unresolved';
  const existingCompassSelection = typeof parsed.proposedCompassEntryId === 'string'
    ? parsed.proposedCompassEntryId
    : canonicalIdentityResolution?.kind === 'existing' && typeof canonicalIdentityResolution.compassEntryId === 'string'
      ? canonicalIdentityResolution.compassEntryId
      : existingDuplicateResolution === 'new'
        ? 'new'
        : null;
  const existingProductSelection = typeof parsed.proposedProductId === 'string'
    ? parsed.proposedProductId
    : canonicalHoldingResolution?.kind === 'existing' && typeof canonicalHoldingResolution.productId === 'string'
      ? canonicalHoldingResolution.productId
      : canonicalHoldingResolution?.kind === 'new'
        ? 'new'
        : null;
  const compassSelection = identityTouched ? draft.compassSelection : draft.compassSelection ?? existingCompassSelection;
  const productSelection = draft.disposition === 'library_only' ? null : productSelectionTouched ? draft.productSelection : draft.productSelection ?? existingProductSelection;
  const createsIdentity = identityTouched ? compassSelection === 'new' : existingDuplicateResolution === 'new';
  const proposedCompassEntryId = identityTouched ? (createsIdentity ? null : compassSelection) : existingCompassSelection === 'new' ? null : existingCompassSelection;
  const proposedProductId = draft.disposition === 'library_only' || createsIdentity || productSelection === 'new' ? null : productSelection;
  const identityResolution = createsIdentity
    ? { kind: 'new' as const }
    : proposedCompassEntryId
      ? { kind: 'existing' as const, compassEntryId: proposedCompassEntryId }
      : { kind: 'unresolved' as const };
  const holdingResolution = draft.disposition === 'library_only'
    ? null
    : createsIdentity || productSelection === 'new'
      ? { kind: 'new' as const }
      : proposedProductId
        ? { kind: 'existing' as const, productId: proposedProductId }
        : { kind: 'unresolved' as const };
  const priceAmount = (() => {
    const source = draft.priceAmount?.trim();
    if (!source || !/^\d+(?:\.\d+)?$/.test(source)) return null;
    const [whole, fraction = ''] = source.split('.');
    const canonicalWhole = whole.replace(/^0+(?=\d)/, '') || '0';
    const canonicalFraction = fraction.replace(/0+$/, '');
    return canonicalFraction ? `${canonicalWhole}.${canonicalFraction}` : canonicalWhole;
  })();
  const chineseName = draft.chineseName === undefined ? (typeof parsed.chineseName === 'string' ? parsed.chineseName : null) : draft.chineseName;
  return {
    ...withoutImportDerivedFields(parsed),
    englishName: draft.englishName, originalName: draft.originalName, chineseName, type: draft.type,
    classification: draft.classification, cultivar: draft.cultivar ?? null, year: draft.year, form: draft.form, originCountry: draft.originCountry ?? null, originRegion: draft.originRegion,
    description: draft.description, producer: draft.producer ?? null, processingNotes: draft.processingNotes ?? null,
    inventoryPurpose: draft.disposition === 'library_only' ? null : draft.inventoryPurpose,
    proposedCompassEntryId, proposedProductId, identityResolution, holdingResolution,
    disposition: draft.disposition, acquired: draft.disposition === 'received',
    duplicateResolution: identityTouched ? (createsIdentity ? 'new' : proposedCompassEntryId ? 'matched' : 'unresolved') : existingDuplicateResolution,
    packWeight: draft.packWeight, weightUnit: draft.weightUnit, packCount: draft.packCount,
    priceAmount, priceAmountExact: priceAmount, currency: draft.currency, priceBasis: draft.priceBasis,
  } satisfies CurateImportCanonicalRecord & Record<string, unknown>;
};

const normalizedImportAnnotations = (batch: CurateImportDetail['batch']) => {
  if (Array.isArray(batch.analysis_annotations)) return batch.analysis_annotations;
  if (!batch.analysis_annotations_json) return [];
  try {
    const parsed = JSON.parse(batch.analysis_annotations_json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeImportDetail = (detail: CurateImportDetail): CurateImportDetail => ({
  ...detail,
  batch: { ...detail.batch, analysis_annotations: normalizedImportAnnotations(detail.batch) },
  groups: (detail.groups || []).map(group => ({ ...group, confidence: group.confidence ?? group.vendor_confidence ?? null })),
  items: detail.items.map(item => {
    const parsed = item.parsed_data || {};
    const identityResolution = parsed.identityResolution as { kind?: string; compassEntryId?: string } | null | undefined;
    const holdingResolution = parsed.holdingResolution as { kind?: string; productId?: string } | null | undefined;
    const canonicalDuplicateResolution = identityResolution?.kind === 'existing' ? 'matched' : identityResolution?.kind === 'new' ? 'new' : identityResolution?.kind === 'unresolved' ? 'unresolved' : undefined;
    return {
      ...item,
      english_name: 'englishName' in parsed ? (typeof parsed.englishName === 'string' ? parsed.englishName : null) : item.english_name ?? null,
      original_name: 'originalName' in parsed ? (typeof parsed.originalName === 'string' ? parsed.originalName : null) : item.original_name ?? null,
      chinese_name: 'chineseName' in parsed ? (typeof parsed.chineseName === 'string' ? parsed.chineseName : null) : item.chinese_name ?? null,
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
      line_cost_exact: (parsed.lineCostExact as string | null | undefined) ?? item.line_cost_exact,
      unit_cost: (parsed.unitCost as number | null | undefined) ?? item.unit_cost,
      unit_cost_exact: (parsed.unitCostExact as string | null | undefined) ?? item.unit_cost_exact,
      blocking_fields: parsed.blockingFields ? (parsed.blockingFields as string[]).map(field => field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)) : item.blocking_fields ?? [],
      proposed_compass_entry_id: identityResolution?.kind === 'existing' ? identityResolution.compassEntryId ?? null : (parsed.proposedCompassEntryId as string | null | undefined) ?? item.proposed_compass_entry_id,
      proposed_product_id: holdingResolution?.kind === 'existing' ? holdingResolution.productId ?? null : (parsed.proposedProductId as string | null | undefined) ?? item.proposed_product_id,
      acquired: (parsed.acquired as boolean | null | undefined) ?? item.acquired,
      disposition: (parsed.disposition as CurateImportDisposition | null | undefined) ?? item.disposition ?? ((parsed.acquired ?? item.acquired) === true ? 'received' : null),
      duplicate_resolution: (parsed.duplicateResolution as CurateImportItem['duplicate_resolution']) ?? canonicalDuplicateResolution ?? item.duplicate_resolution,
    };
  }),
});

export const reviewedFieldsForImportSave = (item: CurateImportItem, compassSelection: string, productSelection: string, identityTouched: boolean, visibleMaterialFields: CurateImportReviewedField[] = []): CurateImportReviewedField[] => {
  const blockers = (item.blocking_fields ?? []).map(field => field.replace(/_/g, '').toLocaleLowerCase());
  const identityBlocked = blockers.some(field => ['identity', 'duplicateidentity', 'compassentryid', 'proposedcompassentryid', 'productid', 'proposedproductid', 'inventoryholding'].includes(field));
  const reviewed = Array.from(new Set(visibleMaterialFields));
  if (identityTouched && identityBlocked && Boolean(compassSelection || productSelection)) reviewed.push('identity');
  return reviewed;
};

export const importItemNoun = (items: Array<Pick<CurateImportItem, 'category'>>, count = items.length) => {
  if (items.every(item => item.category === 'tea')) return count === 1 ? 'tea' : 'teas';
  if (items.every(item => item.category === 'teaware')) return count === 1 ? 'teaware item' : 'teaware items';
  return count === 1 ? 'item' : 'items';
};

export const importFinalActionLabel = (items: CurateImportItem[]) => {
  const byDisposition = (disposition: CurateImportDisposition) => items.filter(item => importDisposition(item) === disposition);
  const received = byDisposition('received');
  const transit = byDisposition('in_transit');
  const libraryOnly = byDisposition('library_only');
  const clauses = [
    received.length ? `Receive ${received.length} ${importItemNoun(received, received.length)}` : null,
    transit.length ? `hold ${transit.length} ${importItemNoun(transit, transit.length)} in transit` : null,
    libraryOnly.length ? `save ${libraryOnly.length} Library ${libraryOnly.length === 1 ? 'record' : 'records'}` : null,
  ].filter((clause): clause is string => Boolean(clause));
  if (!clauses.length) return `Choose destination for ${items.length} ${importItemNoun(items, items.length)}`;
  if (clauses.length === 1) return `${clauses[0][0].toLocaleUpperCase()}${clauses[0].slice(1)}`;
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`;
  return `${clauses[0]}, ${clauses[1]}, and ${clauses[2]}`;
};

const joinLabels = (labels: string[]) => {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
};

export const importBlockingMessage = (item: CurateImportItem): string | null => {
  const fields = effectiveImportBlockingFields(item);
  const labels = Array.from(new Set(fields.map(field => {
    const key = normalizedBlocker(field);
    if (['duplicateidentity', 'compassentryid', 'proposedcompassentryid'].includes(key)) return item.category === 'tea' ? 'tea identity' : 'teaware identity';
    return BLOCKING_LABELS[field] || field.replace(/_/g, ' ');
  })));
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
        const blockingFields = effectiveImportBlockingFields(item);
        return { item, blockingFields, blockingMessage: importBlockingMessage(item), ready: blockingFields.length === 0 };
      });
    const vendorRequired = rows.some(row => importDisposition(row.item) !== 'library_only');
    return { ...group, items: rows, vendorRequired, vendorResolved: !vendorRequired || Boolean(group.resolved_vendor_customer_id) };
  }).filter(group => group.items.length > 0);

  const rows = orderedGroups.flatMap(group => group.items);
  const totals = new Map<string, { amount: number; complete: boolean }>();
  for (const { item } of rows) {
    if (!item.currency) continue;
    const current = totals.get(item.currency) ?? { amount: 0, complete: true };
    if (Number.isFinite(item.line_cost)) current.amount += Number(item.line_cost);
    else current.complete = false;
    totals.set(item.currency, current);
  }
  const currencyTotals = Array.from(totals, ([currency, total]) => ({ currency, ...total }))
    .filter(total => total.complete)
    .map(({ currency, amount }) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
  const readyCount = rows.filter(row => row.ready).length;
  return {
    groups: orderedGroups, readyCount, needsReviewCount: rows.length - readyCount, currencyTotals,
    totalQuantityGrams: rows.reduce((sum, row) => sum + (Number.isFinite(row.item.total_quantity_grams) ? Number(row.item.total_quantity_grams) : 0), 0),
    totalUnits: rows.reduce((sum, row) => sum + (Number.isFinite(row.item.total_units) ? Number(row.item.total_units) : 0), 0),
    canFinalize: rows.length > 0 && rows.every(row => row.ready) && orderedGroups.every(group => group.vendorResolved),
  };
};

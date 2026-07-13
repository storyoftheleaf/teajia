export type ImportPriceBasis = 'per_pack' | 'line_total' | 'unknown';
export type ImportWeightUnit = 'g' | 'kg' | 'count';
export type ImportCategory = 'tea' | 'teaware';

export interface ImportAnalysisItem {
  sourceItemId: string;
  category: ImportCategory;
  originalName: string | null;
  englishName: string | null;
  packWeight: number | null;
  weightUnit: ImportWeightUnit | null;
  packCount: number | null;
  priceAmount: string | number | null;
  currency: string | null;
  priceBasis: ImportPriceBasis;
  confidence: Record<string, number>;
  uncertainty: Record<string, string>;
  evidenceRefs: string[];
  acquired: boolean | null;
  duplicateResolution: 'new' | 'matched' | 'unresolved';
  proposedCompassEntryId?: string | null;
  proposedProductId?: string | null;
  [key: string]: unknown;
}

export interface ImportAnalysisGroup {
  key: string;
  proposedVendorName: string | null;
  proposedVendorCustomerId?: string | null;
  vendorConfidence?: number | null;
  uncertainty?: Record<string, string>;
  items: ImportAnalysisItem[];
}

export interface ImportAnalysisProposal {
  overview: string;
  language: string;
  groups: ImportAnalysisGroup[];
}

export interface NormalizedImportItem extends Omit<ImportAnalysisItem, 'priceAmount'> {
  priceAmount: number | null;
  totalQuantityGrams: number | null;
  totalUnits: number | null;
  lineCost: number | null;
  unitCost: number | null;
  priceAmountExact: string | null;
  lineCostExact: string | null;
  unitCostExact: string | null;
  blockingFields: string[];
}

export interface NormalizedImportProposal {
  overview: string;
  language: string;
  groups: Array<Omit<ImportAnalysisGroup, 'items'> & { items: NormalizedImportItem[] }>;
}

export interface ImportEvidenceForAnalysis {
  sources: Array<{ id: string; kind: string; text?: string | null; mediaType?: string | null; objectKey?: string | null }>;
}

export interface ImportMatchCandidates {
  vendors: Array<{ id: string; name: string; aliases?: string[] }>;
  journeys: Array<{ id: string; name: string }>;
  identities?: Array<{ id: string; name: string | null; chineseName?: string | null; category: ImportCategory; productId?: string | null; year?: number | null; originCountry?: string | null; originRegion?: string | null; type?: string | null; form?: string | null; classification?: string | null; vendorName?: string | null }>;
  products?: Array<{ id: string; compassEntryId: string | null; name: string | null; category: ImportCategory; purpose?: string | null }>;
}

const IMPORT_ITEM_INPUT_FIELDS = ['sourceItemId', 'category', 'originalName', 'englishName', 'packWeight', 'weightUnit', 'packCount', 'priceAmount', 'currency', 'priceBasis', 'confidence', 'uncertainty', 'evidenceRefs', 'acquired', 'duplicateResolution', 'proposedCompassEntryId', 'proposedProductId', 'chineseName', 'type', 'form', 'year', 'originCountry', 'originRegion', 'classification', 'description', 'inventoryPurpose'] as const;
const IMPORT_ITEM_DERIVED_FIELDS = ['totalQuantityGrams', 'totalUnits', 'priceAmountExact', 'lineCost', 'lineCostExact', 'unitCost', 'unitCostExact', 'blockingFields'] as const;

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${field}`);
  return value as Record<string, unknown>;
}

function rejectUnknown(input: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unknown = Object.keys(input).find(key => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown ${label} field: ${unknown}`);
}

function string(value: unknown, field: string, nullable = false): string | null {
  if (nullable && value == null) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 20_000) throw new Error(`Invalid ${field}`);
  return value;
}

function finiteNonNegative(value: unknown, field: string): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Invalid ${field}`);
  return value;
}

function authoritativeDecimal(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${field}; non-integer prices must be decimal strings`);
    return String(value);
  }
  if (typeof value !== 'string' || value.length > 100 || !/^\d+(?:\.\d+)?$/.test(value.trim())) throw new Error(`Invalid ${field}`);
  const parsed = decimalParts(value);
  if (parsed.coefficient < 0n) throw new Error(`Invalid ${field}`);
  return decimalString(parsed.coefficient, parsed.scale);
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid ${field}`);
  return value.trim() || null;
}

function optionalYear(value: unknown): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || Number(value) < 1000 || Number(value) > 3000) throw new Error('Invalid year');
  return Number(value);
}

function stringRecord(value: unknown, field: string): Record<string, string> {
  const source = record(value, field);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (typeof entry !== 'string' || entry.length > 2000) throw new Error(`Invalid ${field}.${key}`);
    result[key] = entry;
  }
  return result;
}

function confidenceRecord(value: unknown): Record<string, number> {
  const source = record(value, 'confidence');
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1) throw new Error(`Invalid confidence.${key}`);
    result[key] = entry;
  }
  return result;
}

function decodeItem(value: unknown, groupIndex: number, itemIndex: number): ImportAnalysisItem {
  const input = record(value, `groups[${groupIndex}].items[${itemIndex}]`);
  rejectUnknown(input, IMPORT_ITEM_INPUT_FIELDS, 'item');
  const category = string(input.category, 'category');
  if (category !== 'tea' && category !== 'teaware') throw new Error('Invalid category');
  const weightUnit = input.weightUnit == null ? null : string(input.weightUnit, 'weightUnit');
  if (weightUnit !== null && weightUnit !== 'g' && weightUnit !== 'kg' && weightUnit !== 'count') throw new Error('Invalid weightUnit');
  const priceBasis = string(input.priceBasis, 'priceBasis');
  if (priceBasis !== 'per_pack' && priceBasis !== 'line_total' && priceBasis !== 'unknown') throw new Error('Invalid priceBasis');
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.some(entry => typeof entry !== 'string' || entry.length > 1000)) throw new Error('Invalid evidenceRefs');
  const duplicateResolution = input.duplicateResolution == null ? 'unresolved' : string(input.duplicateResolution, 'duplicateResolution');
  if (duplicateResolution !== 'new' && duplicateResolution !== 'matched' && duplicateResolution !== 'unresolved') throw new Error('Invalid duplicateResolution');
  if (input.acquired != null && typeof input.acquired !== 'boolean') throw new Error('Invalid acquired');
  return {
    chineseName: optionalText(input.chineseName, 'chineseName', 500),
    type: optionalText(input.type, 'type', 200), form: optionalText(input.form, 'form', 200),
    year: optionalYear(input.year), originCountry: optionalText(input.originCountry, 'originCountry', 200),
    originRegion: optionalText(input.originRegion, 'originRegion', 500), classification: optionalText(input.classification, 'classification', 500),
    description: optionalText(input.description, 'description', 5000), inventoryPurpose: optionalText(input.inventoryPurpose, 'inventoryPurpose', 100),
    sourceItemId: string(input.sourceItemId, 'sourceItemId')!, category,
    originalName: string(input.originalName, 'originalName', true), englishName: string(input.englishName, 'englishName', true),
    packWeight: finiteNonNegative(input.packWeight, 'packWeight'), weightUnit,
    packCount: finiteNonNegative(input.packCount, 'packCount'), priceAmount: authoritativeDecimal(input.priceAmount, 'priceAmount'),
    currency: string(input.currency, 'currency', true), priceBasis,
    confidence: confidenceRecord(input.confidence), uncertainty: stringRecord(input.uncertainty, 'uncertainty'),
    evidenceRefs: [...input.evidenceRefs] as string[],
    acquired: input.acquired == null ? null : input.acquired,
    duplicateResolution,
    proposedCompassEntryId: string(input.proposedCompassEntryId, 'proposedCompassEntryId', true),
    proposedProductId: string(input.proposedProductId, 'proposedProductId', true),
  };
}

export function decodeImportAnalysisProposal(value: unknown): ImportAnalysisProposal {
  const input = record(value, 'proposal');
  rejectUnknown(input, ['overview', 'language', 'groups'], 'proposal');
  if (!Array.isArray(input.groups) || !input.groups.length || input.groups.length > 100) throw new Error('Invalid groups');
  const proposal = {
    overview: string(input.overview, 'overview')!, language: string(input.language, 'language')!,
    groups: input.groups.map((value, groupIndex) => {
      const group = record(value, `groups[${groupIndex}]`);
      rejectUnknown(group, ['key', 'proposedVendorName', 'proposedVendorCustomerId', 'vendorConfidence', 'uncertainty', 'items'], 'group');
      if (!Array.isArray(group.items) || !group.items.length || group.items.length > 1000) throw new Error(`Invalid groups[${groupIndex}].items`);
      const vendorConfidence = finiteNonNegative(group.vendorConfidence, 'vendorConfidence');
      if (vendorConfidence != null && vendorConfidence > 1) throw new Error('Invalid vendorConfidence');
      return {
        key: string(group.key, 'group.key')!, proposedVendorName: string(group.proposedVendorName, 'proposedVendorName', true),
        proposedVendorCustomerId: string(group.proposedVendorCustomerId, 'proposedVendorCustomerId', true), vendorConfidence,
        uncertainty: group.uncertainty == null ? {} : stringRecord(group.uncertainty, 'group.uncertainty'),
        items: group.items.map((item, itemIndex) => decodeItem(item, groupIndex, itemIndex)),
      };
    }),
  };
  const groupKeys = new Set<string>();
  const sourceItemIds = new Set<string>();
  for (const group of proposal.groups) {
    if (groupKeys.has(group.key)) throw new Error(`Duplicate group key: ${group.key}`);
    groupKeys.add(group.key);
    for (const item of group.items) {
      if (sourceItemIds.has(item.sourceItemId)) throw new Error(`Duplicate sourceItemId: ${item.sourceItemId}`);
      sourceItemIds.add(item.sourceItemId);
    }
  }
  return proposal;
}

function rounded(value: number) { return Number(value.toFixed(8)); }

const ISO_4217_CODES = new Set((Intl as typeof Intl & { supportedValuesOf(key: 'currency'): string[] }).supportedValuesOf('currency'));
const MATERIAL_CONFIDENCE_BLOCKERS: Record<string, string> = {
  vendor: 'vendor', identity: 'identity', translation: 'englishName', englishName: 'englishName', nameTranslation: 'englishName',
  packWeight: 'packWeight', weightUnit: 'weightUnit', quantity: 'packCount', packCount: 'packCount', priceBasis: 'priceBasis',
  price: 'priceAmount', priceAmount: 'priceAmount', currency: 'currency', acquisitionState: 'acquired', acquired: 'acquired',
};
const HAN = /\p{Script=Han}/u;

function canonicalCurrency(value: string | null): string | null {
  if (!value || value === '¥' || value === '￥') return null;
  const code = value.trim().toUpperCase();
  return ISO_4217_CODES.has(code) ? code : null;
}

function decimalParts(value: number | string): { coefficient: bigint; scale: number } {
  const source = String(value).trim().toLowerCase();
  const match = source.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/);
  if (!match) throw new Error('Invalid decimal');
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? 0);
  let coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) { coefficient *= 10n ** BigInt(-scale); scale = 0; }
  return { coefficient, scale };
}

function decimalString(coefficient: bigint, scale: number): string {
  const negative = coefficient < 0n;
  let digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '');
  return `${negative ? '-' : ''}${digits}`;
}

function exact(value: number | string | null): string | null {
  if (value == null) return null;
  const parsed = decimalParts(value);
  return decimalString(parsed.coefficient, parsed.scale);
}

function compatibleMoneyNumber(value: string | null): number | null {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER) return null;
  return exact(number) === value ? number : null;
}

function multiplyExact(left: string, right: number): string {
  const a = decimalParts(left); const b = decimalParts(right);
  return decimalString(a.coefficient * b.coefficient, a.scale + b.scale);
}

function divideExact(left: string, right: number, precision = 18): string {
  const a = decimalParts(left); const b = decimalParts(right);
  const numerator = a.coefficient * 10n ** BigInt(b.scale + precision);
  const denominator = b.coefficient * 10n ** BigInt(a.scale);
  return decimalString(numerator / denominator, precision);
}

export function normalizeImportProposal(value: ImportAnalysisProposal): NormalizedImportProposal {
  const proposal = decodeImportAnalysisProposal(value);
  return {
    ...proposal,
    groups: proposal.groups.map(group => ({
      ...group,
      items: group.items.map(item => {
        const blockingFields: string[] = [];
        const currency = canonicalCurrency(item.currency);
        const block = (field: string) => { if (!blockingFields.includes(field)) blockingFields.push(field); };
        if (item.packWeight == null || item.packWeight <= 0) blockingFields.push('packWeight');
        if (item.weightUnit == null) blockingFields.push('weightUnit');
        if (item.packCount == null || item.packCount <= 0) blockingFields.push('packCount');
        if (item.priceAmount == null) blockingFields.push('priceAmount');
        if (!currency) blockingFields.push('currency');
        if (item.priceBasis === 'unknown') blockingFields.push('priceBasis');
        if (item.acquired !== true) blockingFields.push('acquired');
        if (item.duplicateResolution === 'unresolved') blockingFields.push('duplicateResolution');
        if (item.originalName && HAN.test(item.originalName) && (!item.englishName || HAN.test(item.englishName))) block('englishName');
        for (const [field, confidence] of Object.entries(item.confidence)) if (MATERIAL_CONFIDENCE_BLOCKERS[field] && confidence < 0.8) block(MATERIAL_CONFIDENCE_BLOCKERS[field]);
        for (const field of Object.keys(item.uncertainty)) if (MATERIAL_CONFIDENCE_BLOCKERS[field]) block(MATERIAL_CONFIDENCE_BLOCKERS[field]);
        if ((group.vendorConfidence != null && group.vendorConfidence < 0.8) || Object.keys(group.uncertainty ?? {}).some(field => field === 'vendor')) block('vendor');
        const quantity = item.packWeight != null && item.packWeight > 0 && item.packCount != null && item.packCount > 0
          ? item.packWeight * item.packCount : null;
        const totalQuantityGrams = quantity != null && item.weightUnit !== 'count'
          ? rounded(quantity * (item.weightUnit === 'kg' ? 1000 : 1)) : null;
        const totalUnits = quantity != null && item.weightUnit === 'count' ? rounded(quantity) : null;
        const priceAmountExact = exact(item.priceAmount);
        const lineCostExact = priceAmountExact == null || item.priceBasis === 'unknown' || item.packCount == null
          ? null : item.priceBasis === 'per_pack' ? multiplyExact(priceAmountExact, item.packCount) : priceAmountExact;
        const lineCost = compatibleMoneyNumber(lineCostExact);
        const physicalQuantity = totalQuantityGrams ?? totalUnits;
        const unitCostExact = lineCostExact != null && physicalQuantity != null && physicalQuantity > 0 ? divideExact(lineCostExact, physicalQuantity) : null;
        return {
          ...item, priceAmount: compatibleMoneyNumber(priceAmountExact), currency, totalQuantityGrams, totalUnits, priceAmountExact, lineCostExact, unitCostExact, lineCost,
          unitCost: unitCostExact == null ? null : compatibleMoneyNumber(unitCostExact) == null ? null : rounded(Number(unitCostExact)),
          blockingFields,
        };
      }),
    })),
  };
}

export function renormalizeImportItemData(value: unknown): NormalizedImportItem {
  const input = record(value, 'parsed_data');
  rejectUnknown(input, [...IMPORT_ITEM_INPUT_FIELDS, ...IMPORT_ITEM_DERIVED_FIELDS], 'parsed_data');
  const raw = Object.fromEntries(IMPORT_ITEM_INPUT_FIELDS.filter(key => key in input).map(key => [key, input[key]]));
  if ((raw.priceAmount == null || (typeof raw.priceAmount === 'number' && !Number.isSafeInteger(raw.priceAmount))) && typeof input.priceAmountExact === 'string') raw.priceAmount = input.priceAmountExact;
  return normalizeImportProposal(decodeImportAnalysisProposal({ overview: 'item', language: 'unknown', groups: [{ key: 'item', proposedVendorName: null, items: [raw] }] })).groups[0].items[0];
}

export function buildImportAnalysisPrompt(evidence: ImportEvidenceForAnalysis, candidates: ImportMatchCandidates): string {
  const evidenceText = evidence.sources.map(source => source.text ?? '').join(' ').normalize('NFKD').toLowerCase();
  const bounded = <T extends { name: string | null }>(values: T[]) => values.map((value, index) => ({ value, index, relevant: Boolean(value.name && evidenceText.includes(value.name.normalize('NFKD').toLowerCase())) }))
    .sort((left, right) => Number(right.relevant) - Number(left.relevant) || left.index - right.index).slice(0, 50).map(entry => entry.value);
  const providerCandidates = {
    vendors: bounded(candidates.vendors).map(({ id, name }) => ({ id, name })),
    journeys: bounded(candidates.journeys).map(({ id, name }) => ({ id, name })),
    identities: bounded(candidates.identities ?? []).map(({ id, name, chineseName, category, year, originCountry, originRegion, type, form, classification, vendorName }) => ({ id, name, chineseName, category, year, originCountry, originRegion, type, form, classification, vendorName })),
    products: bounded(candidates.products ?? []).map(({ id, compassEntryId, name, category, purpose }) => ({ id, compassEntryId, name, category, purpose })),
  };
  return [
    'Extract a Curate inventory import as strict JSON. Preserve original Chinese names and translate to concise English.',
    'Each item must include sourceItemId, category, originalName, englishName, packWeight, weightUnit, packCount, priceAmount, currency, priceBasis, acquired, duplicateResolution, confidence, uncertainty, and evidenceRefs. priceAmount must be a JSON decimal string copied from evidence, never a JSON number. Use null or "unresolved" instead of guessing.',
    'Never infer priceBasis when the evidence is ambiguous; return "unknown" and explain uncertainty.',
    'Do not calculate totals. Return evidence values only. Application code performs all arithmetic.',
    'Use only vendor and journey candidates supplied for this account. Never invent candidate ids.',
    `ACCOUNT_CANDIDATES=${JSON.stringify(providerCandidates)}`,
    `EVIDENCE=${JSON.stringify(evidence)}`,
  ].join('\n');
}

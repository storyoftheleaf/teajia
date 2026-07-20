import type { CompassColumn } from './compassCodec';

export type CanonicalImportCategory = 'tea' | 'teaware';
export type CanonicalImportDisposition = 'received' | 'in_transit' | 'library_only';
export type CanonicalImportInventoryPurpose = 'working' | 'sample' | 'personal';
export type CanonicalImportPriceBasis = 'per_pack' | 'line_total' | 'unknown';
export type CanonicalImportWeightUnit = 'g' | 'kg' | 'count';

export type CanonicalVendorResolution =
  | { kind: 'existing'; vendorId: string; vendorName: string | null }
  | { kind: 'new'; vendorName: string }
  | { kind: 'unresolved'; vendorName: string | null }
  | null;

export type CanonicalIdentityResolution =
  | { kind: 'existing'; compassEntryId: string }
  | { kind: 'new' }
  | { kind: 'unresolved' };

export type CanonicalHoldingResolution =
  | { kind: 'existing'; productId: string }
  | { kind: 'new' }
  | { kind: 'unresolved' }
  | null;

export const CANONICAL_IMPORT_FIELDS = [
  'sourceId', 'sourceItemId', 'evidenceRefs', 'sourceExcerpt', 'sourceLanguage',
  'englishName', 'originalName', 'chineseName', 'category', 'type', 'classification',
  'form', 'year', 'originCountry', 'originRegion', 'description',
  'packWeight', 'weightUnit', 'packCount', 'priceAmountExact', 'currency', 'priceBasis',
  'lineCostExact', 'unitCostExact', 'totalQuantityGrams', 'totalUnits',
  'disposition', 'inventoryPurpose', 'vendorResolution', 'identityResolution', 'holdingResolution',
] as const;

export interface CanonicalImportRecord {
  sourceId: string | null;
  sourceItemId: string | null;
  evidenceRefs: string[];
  sourceExcerpt: string | null;
  sourceLanguage: string | null;
  englishName: string | null;
  originalName: string | null;
  chineseName: string | null;
  category: CanonicalImportCategory;
  type: string | null;
  classification: string | null;
  form: string | null;
  year: number | null;
  originCountry: string | null;
  originRegion: string | null;
  description: string | null;
  packWeight: number | null;
  weightUnit: CanonicalImportWeightUnit | null;
  packCount: number | null;
  priceAmountExact: string | null;
  currency: string | null;
  priceBasis: CanonicalImportPriceBasis;
  lineCostExact: string | null;
  unitCostExact: string | null;
  totalQuantityGrams: number | null;
  totalUnits: number | null;
  disposition: CanonicalImportDisposition | null;
  inventoryPurpose: CanonicalImportInventoryPurpose | null;
  vendorResolution: CanonicalVendorResolution;
  identityResolution: CanonicalIdentityResolution;
  holdingResolution: CanonicalHoldingResolution;
}

export type CanonicalProductValues = Partial<Record<
  | 'product_name' | 'given_name' | 'chinese_name' | 'type' | 'classification' | 'form'
  | 'year' | 'origin_country' | 'origin_region' | 'description' | 'vendor_id' | 'vendor'
  | 'inventory_purpose',
  string
>>;

const HAN = /\p{Script=Han}/u;
const SUPPORTED_CURRENCIES = new Set([
  'AUD', 'CNY', 'EUR', 'GBP', 'HKD', 'IDR', 'JPY', 'MYR', 'TWD', 'USD',
]);

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function number(value: unknown): number | null {
  if (typeof value === 'string' && value.trim()) {
    if (!decimalParts(value)) return null;
    value = Number(value);
  }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function year(value: unknown): number | null {
  const normalized = number(value);
  return normalized != null && Number.isInteger(normalized) && normalized >= 1000 && normalized <= 3000
    ? normalized
    : null;
}

function exactDecimal(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    value = String(value);
  }
  const normalized = text(value);
  if (!normalized || normalized.length > 100 || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const significantFraction = fraction.replace(/0+$/, '');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '') || '0';
  return significantFraction ? `${normalizedWhole}.${significantFraction}` : normalizedWhole;
}

interface DecimalParts {
  coefficient: bigint;
  scale: number;
}

function decimalParts(value: unknown): DecimalParts | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'number' && !Number.isFinite(value))) return null;
  const source = String(value).trim();
  if (!source || source.length > 128) return null;
  const match = source.match(/^(\+?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const fraction = match[3] ?? '';
  if (match[2].length + fraction.length > 100) return null;
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) return null;
  let coefficient = BigInt(`${match[2]}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale > 100) return null;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { coefficient, scale };
}

function decimalString(coefficient: bigint, scale: number): string {
  let digits = coefficient.toString().padStart(scale + 1, '0');
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '');
  return digits;
}

function exactProduct(left: unknown, right: unknown, multiplier: bigint): number | null {
  const a = decimalParts(left);
  const b = decimalParts(right);
  if (!a || !b) return null;
  const value = Number(decimalString(a.coefficient * b.coefficient * multiplier, a.scale + b.scale));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function weightUnit(value: unknown): CanonicalImportWeightUnit | null {
  const normalized = text(value)?.toLowerCase();
  if (!normalized) return null;
  if (['g', 'gram', 'grams', 'gm', '克'].includes(normalized)) return 'g';
  if (['kg', 'kilogram', 'kilograms', '公斤', '千克'].includes(normalized)) return 'kg';
  if (['count', 'unit', 'units', 'piece', 'pieces', '个', '件'].includes(normalized)) return 'count';
  return null;
}

function currency(value: unknown): string | null {
  const normalized = text(value)?.toUpperCase();
  if (!normalized) return null;
  if (['RMB', 'YUAN', '元', 'CN¥'].includes(normalized)) return 'CNY';
  if (['NT', 'NT$'].includes(normalized)) return 'TWD';
  if (normalized === 'US$') return 'USD';
  return SUPPORTED_CURRENCIES.has(normalized) ? normalized : null;
}

function disposition(input: Record<string, unknown>): CanonicalImportDisposition | null {
  const normalized = text(input.disposition)?.toLowerCase().replace(/[ -]/g, '_');
  if (normalized === 'received' || normalized === 'in_transit' || normalized === 'library_only') return normalized;
  if (normalized === 'ordered') return 'in_transit';
  return input.acquired === true ? 'received' : null;
}

function inventoryPurpose(value: unknown): CanonicalImportInventoryPurpose | null {
  const normalized = text(value)?.toLowerCase();
  return normalized === 'working' || normalized === 'sample' || normalized === 'personal' ? normalized : null;
}

function priceBasis(value: unknown): CanonicalImportPriceBasis {
  const normalized = text(value)?.toLowerCase().replace(/[ -]/g, '_');
  return normalized === 'per_pack' || normalized === 'line_total' ? normalized : 'unknown';
}

function vendorResolution(input: Record<string, unknown>): CanonicalVendorResolution {
  const candidate = object(input.vendorResolution);
  const kind = text(candidate?.kind)?.toLowerCase();
  const vendorId = text(candidate?.vendorId ?? candidate?.id ?? input.vendorId ?? input.vendor_id);
  const vendorName = text(candidate?.vendorName ?? candidate?.name ?? input.vendorName ?? input.vendor_name);
  if (candidate) {
    if (kind === 'existing') return vendorId
      ? { kind: 'existing', vendorId, vendorName }
      : { kind: 'unresolved', vendorName };
    if (kind === 'new') return vendorName ? { kind: 'new', vendorName } : { kind: 'unresolved', vendorName: null };
    return { kind: 'unresolved', vendorName };
  }
  if (vendorId) return { kind: 'existing', vendorId, vendorName };
  if (vendorName) return { kind: 'new', vendorName };
  return null;
}

function identityResolution(input: Record<string, unknown>): CanonicalIdentityResolution {
  const candidate = object(input.identityResolution);
  const kind = text(candidate?.kind)?.toLowerCase();
  const compassEntryId = text(candidate?.compassEntryId ?? candidate?.id ?? input.proposedCompassEntryId);
  if (kind === 'existing' && compassEntryId) return { kind: 'existing', compassEntryId };
  if (kind === 'new') return { kind: 'new' };
  if (kind === 'unresolved') return { kind: 'unresolved' };
  if (input.duplicateResolution === 'matched' && compassEntryId) return { kind: 'existing', compassEntryId };
  if (input.duplicateResolution === 'new') return { kind: 'new' };
  return { kind: 'unresolved' };
}

function holdingResolution(input: Record<string, unknown>, itemDisposition: CanonicalImportDisposition | null): CanonicalHoldingResolution {
  if (itemDisposition === 'library_only') return null;
  const candidate = object(input.holdingResolution);
  const kind = text(candidate?.kind)?.toLowerCase();
  const productId = text(candidate?.productId ?? candidate?.id ?? input.proposedProductId);
  if (kind === 'existing' && productId) return { kind: 'existing', productId };
  if (kind === 'new') return { kind: 'new' };
  if (kind === 'unresolved') return { kind: 'unresolved' };
  if (productId) return { kind: 'existing', productId };
  return { kind: 'unresolved' };
}

export function normalizeCanonicalImportRecord(value: Record<string, unknown>): CanonicalImportRecord {
  const originalName = text(value.originalName ?? value.original_name);
  const explicitChineseName = text(value.chineseName ?? value.chinese_name);
  const normalizedWeightUnit = weightUnit(value.weightUnit ?? value.weight_unit);
  const packWeight = number(value.packWeight ?? value.pack_weight);
  const packCount = number(value.packCount ?? value.pack_count);
  const suppliedGrams = number(value.totalQuantityGrams ?? value.total_quantity_grams);
  const suppliedUnits = number(value.totalUnits ?? value.total_units);
  const derivedGrams = normalizedWeightUnit === 'g' || normalizedWeightUnit === 'kg'
    ? exactProduct(value.packWeight ?? value.pack_weight, value.packCount ?? value.pack_count, normalizedWeightUnit === 'kg' ? 1000n : 1n)
    : null;
  const derivedUnits = normalizedWeightUnit === 'count'
    ? exactProduct(value.packWeight ?? value.pack_weight, value.packCount ?? value.pack_count, 1n)
    : null;
  const totalQuantityGrams = derivedGrams ?? (normalizedWeightUnit === 'count' ? null : suppliedGrams);
  const totalUnits = derivedUnits ?? (normalizedWeightUnit === 'g' || normalizedWeightUnit === 'kg' ? null : suppliedUnits);
  const itemDisposition = disposition(value);

  return {
    sourceId: text(value.sourceId ?? value.source_id),
    sourceItemId: text(value.sourceItemId ?? value.source_item_id),
    evidenceRefs: Array.isArray(value.evidenceRefs ?? value.evidence_refs)
      ? (value.evidenceRefs ?? value.evidence_refs as unknown[]).map(text).filter((entry): entry is string => entry != null)
      : [],
    sourceExcerpt: text(value.sourceExcerpt ?? value.source_excerpt),
    sourceLanguage: text(value.sourceLanguage ?? value.source_language),
    englishName: text(value.englishName ?? value.english_name ?? value.name),
    originalName,
    chineseName: explicitChineseName ?? (originalName && HAN.test(originalName) ? originalName : null),
    category: value.category === 'teaware' ? 'teaware' : 'tea',
    type: text(value.type),
    classification: text(value.classification),
    form: text(value.form),
    year: year(value.year),
    originCountry: text(value.originCountry ?? value.origin_country),
    originRegion: text(value.originRegion ?? value.origin_region),
    description: text(value.description),
    packWeight,
    weightUnit: normalizedWeightUnit,
    packCount,
    priceAmountExact: exactDecimal(value.priceAmountExact ?? value.price_amount_exact ?? value.priceAmount ?? value.price_amount),
    currency: currency(value.currency ?? value.priceCurrency ?? value.price_currency),
    priceBasis: priceBasis(value.priceBasis ?? value.price_basis),
    lineCostExact: exactDecimal(value.lineCostExact ?? value.line_cost_exact ?? value.lineCost ?? value.buy_total),
    unitCostExact: exactDecimal(value.unitCostExact ?? value.unit_cost_exact ?? value.unitCost ?? value.price_per_unit_grams),
    totalQuantityGrams,
    totalUnits,
    disposition: itemDisposition,
    inventoryPurpose: inventoryPurpose(value.inventoryPurpose ?? value.inventory_purpose ?? value.purpose),
    vendorResolution: vendorResolution(value),
    identityResolution: identityResolution(value),
    holdingResolution: holdingResolution(value, itemDisposition),
  };
}

function present<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value != null)) as T;
}

function resolvedVendor(record: CanonicalImportRecord): { id: string | null; name: string | null } {
  if (record.vendorResolution?.kind === 'existing') {
    return { id: record.vendorResolution.vendorId, name: record.vendorResolution.vendorName };
  }
  return { id: null, name: record.vendorResolution?.vendorName ?? null };
}

export function canonicalImportToCompassValues(record: CanonicalImportRecord): Partial<Record<CompassColumn, unknown>> {
  const vendor = resolvedVendor(record);
  return present({
    name: record.englishName,
    chinese_name: record.chineseName ?? record.originalName,
    category: record.category,
    type: record.type,
    classification: record.classification,
    form: record.form,
    year: record.year,
    origin_country: record.originCountry,
    origin_region: record.originRegion,
    description: record.description,
    notes: record.sourceExcerpt,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    price_amount: record.priceAmountExact,
    price_currency: record.currency,
    price_per_unit_grams: record.unitCostExact,
    buy_quantity_grams: record.totalQuantityGrams,
    buy_quantity_units: record.totalUnits,
    buy_total: record.lineCostExact,
  });
}

export function canonicalImportToProductValues(record: CanonicalImportRecord): CanonicalProductValues {
  const vendor = resolvedVendor(record);
  return present({
    product_name: record.englishName,
    given_name: record.englishName,
    chinese_name: record.chineseName ?? record.originalName,
    type: record.type,
    classification: record.classification,
    form: record.form,
    year: record.year == null ? null : String(record.year),
    origin_country: record.originCountry,
    origin_region: record.originRegion,
    description: record.description,
    vendor_id: vendor.id,
    vendor: vendor.name,
    inventory_purpose: record.inventoryPurpose,
  });
}

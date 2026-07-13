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
  priceAmount: number | null;
  currency: string | null;
  priceBasis: ImportPriceBasis;
  confidence: Record<string, number>;
  uncertainty: Record<string, string>;
  evidenceRefs: string[];
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

export interface NormalizedImportItem extends ImportAnalysisItem {
  totalQuantityGrams: number | null;
  totalUnits: number | null;
  lineCost: number | null;
  unitCost: number | null;
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
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${field}`);
  return value as Record<string, unknown>;
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
  const category = string(input.category, 'category');
  if (category !== 'tea' && category !== 'teaware') throw new Error('Invalid category');
  const weightUnit = input.weightUnit == null ? null : string(input.weightUnit, 'weightUnit');
  if (weightUnit !== null && weightUnit !== 'g' && weightUnit !== 'kg' && weightUnit !== 'count') throw new Error('Invalid weightUnit');
  const priceBasis = string(input.priceBasis, 'priceBasis');
  if (priceBasis !== 'per_pack' && priceBasis !== 'line_total' && priceBasis !== 'unknown') throw new Error('Invalid priceBasis');
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.some(entry => typeof entry !== 'string' || entry.length > 1000)) throw new Error('Invalid evidenceRefs');
  const known = new Set(['sourceItemId', 'category', 'originalName', 'englishName', 'packWeight', 'weightUnit', 'packCount', 'priceAmount', 'currency', 'priceBasis', 'confidence', 'uncertainty', 'evidenceRefs']);
  const extras = Object.fromEntries(Object.entries(input).filter(([key]) => !known.has(key)));
  return {
    ...extras,
    sourceItemId: string(input.sourceItemId, 'sourceItemId')!, category,
    originalName: string(input.originalName, 'originalName', true), englishName: string(input.englishName, 'englishName', true),
    packWeight: finiteNonNegative(input.packWeight, 'packWeight'), weightUnit,
    packCount: finiteNonNegative(input.packCount, 'packCount'), priceAmount: finiteNonNegative(input.priceAmount, 'priceAmount'),
    currency: string(input.currency, 'currency', true), priceBasis,
    confidence: confidenceRecord(input.confidence), uncertainty: stringRecord(input.uncertainty, 'uncertainty'),
    evidenceRefs: [...input.evidenceRefs] as string[],
  };
}

export function decodeImportAnalysisProposal(value: unknown): ImportAnalysisProposal {
  const input = record(value, 'proposal');
  if (!Array.isArray(input.groups) || input.groups.length > 100) throw new Error('Invalid groups');
  return {
    overview: string(input.overview, 'overview')!, language: string(input.language, 'language')!,
    groups: input.groups.map((value, groupIndex) => {
      const group = record(value, `groups[${groupIndex}]`);
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
}

function rounded(value: number) { return Number(value.toFixed(8)); }

export function normalizeImportProposal(value: ImportAnalysisProposal): NormalizedImportProposal {
  const proposal = decodeImportAnalysisProposal(value);
  return {
    ...proposal,
    groups: proposal.groups.map(group => ({
      ...group,
      items: group.items.map(item => {
        const blockingFields: string[] = [];
        if (item.packWeight == null || item.packWeight <= 0) blockingFields.push('packWeight');
        if (item.weightUnit == null) blockingFields.push('weightUnit');
        if (item.packCount == null || item.packCount <= 0) blockingFields.push('packCount');
        if (item.priceAmount == null) blockingFields.push('priceAmount');
        if (!item.currency) blockingFields.push('currency');
        if (item.priceBasis === 'unknown') blockingFields.push('priceBasis');
        const quantity = item.packWeight != null && item.packWeight > 0 && item.packCount != null && item.packCount > 0
          ? item.packWeight * item.packCount : null;
        const totalQuantityGrams = quantity != null && item.weightUnit !== 'count'
          ? rounded(quantity * (item.weightUnit === 'kg' ? 1000 : 1)) : null;
        const totalUnits = quantity != null && item.weightUnit === 'count' ? rounded(quantity) : null;
        const lineCost = item.priceAmount == null || item.priceBasis === 'unknown' || item.packCount == null
          ? null : rounded(item.priceBasis === 'per_pack' ? item.priceAmount * item.packCount : item.priceAmount);
        const physicalQuantity = totalQuantityGrams ?? totalUnits;
        return {
          ...item, totalQuantityGrams, totalUnits, lineCost,
          unitCost: lineCost != null && physicalQuantity != null && physicalQuantity > 0 ? rounded(lineCost / physicalQuantity) : null,
          blockingFields,
        };
      }),
    })),
  };
}

export function buildImportAnalysisPrompt(evidence: ImportEvidenceForAnalysis, candidates: ImportMatchCandidates): string {
  return [
    'Extract a Curate inventory import as strict JSON. Preserve original Chinese names and translate to concise English.',
    'Never infer priceBasis when the evidence is ambiguous; return "unknown" and explain uncertainty.',
    'Do not calculate totals. Return evidence values only. Application code performs all arithmetic.',
    'Use only vendor and journey candidates supplied for this account. Never invent candidate ids.',
    `ACCOUNT_CANDIDATES=${JSON.stringify(candidates)}`,
    `EVIDENCE=${JSON.stringify(evidence)}`,
  ].join('\n');
}

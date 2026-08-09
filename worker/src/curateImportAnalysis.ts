import type { TastingData } from '../../src/types';
import { normalizeImportTasting } from './curateImportTasting';

export type ImportPriceBasis = 'per_pack' | 'line_total' | 'unknown';
export type ImportWeightUnit = 'g' | 'kg' | 'count';
export type ImportCategory = 'tea' | 'teaware';
export type ImportConfidenceField =
  | 'vendor' | 'identity' | 'translation' | 'englishName' | 'nameTranslation'
  | 'originalName' | 'category' | 'packWeight' | 'weightUnit' | 'quantity'
  | 'packCount' | 'priceBasis' | 'price' | 'priceAmount' | 'currency'
  | 'acquisitionState' | 'acquired' | 'duplicateResolution' | 'chineseName'
  | 'type' | 'form' | 'year' | 'originCountry' | 'originRegion'
  | 'classification' | 'cultivar' | 'producer' | 'description' | 'processingNotes' | 'inventoryPurpose'
  | 'tasting' | 'tastingSource';
export type ImportValidationState = 'source_fact' | 'ai_interpretation' | 'canonical_match' | 'validated' | 'not_present' | 'uncertain';
export type ImportAnalysisConfidence = Partial<Record<ImportConfidenceField, number>>;
export type ImportAnalysisValidation = Partial<Record<ImportConfidenceField, ImportValidationState>>;

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
  confidence: ImportAnalysisConfidence;
  validation?: ImportAnalysisValidation;
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
  annotations?: ImportAnalysisAnnotation[];
  groups: ImportAnalysisGroup[];
}

export type ImportAnalysisAnnotationKind = 'heading' | 'note' | 'fee' | 'subtotal' | 'total' | 'ignored_duplicate';
export interface ImportAnalysisAnnotation {
  sourceId: string;
  kind: ImportAnalysisAnnotationKind;
  text: string;
  evidenceRef?: string | null;
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

export interface ImportRecordHints {
  complete: boolean;
  suppliers: Array<{ sourceId: string; name: string; evidenceRef: string; explicit: boolean }>;
  items: Array<{
    sourceId: string;
    sourceItemId: string;
    evidenceRef: string;
    tastingEvidenceRef?: string | null;
    originalName: string;
    packWeight: number;
    weightUnit: ImportWeightUnit;
    packCount: number;
    priceAmount: string;
    currency: string;
    priceBasis: ImportPriceBasis;
    lineTotal: string | null;
    totalQuantityGrams: number | null;
    arithmeticMatches: boolean;
    supplierName?: string | null;
    supplierExplicit?: boolean;
    englishName?: string | null;
    chineseName?: string | null;
    type?: string | null;
    form?: string | null;
    year?: number | null;
    originCountry?: string | null;
    originRegion?: string | null;
    classification?: string | null;
    cultivar?: string | null;
    producer?: string | null;
    description?: string | null;
    processingNotes?: string | null;
    tasting?: TastingData | null;
    tastingSource?: 'source' | null;
  }>;
  ignoredSummaries: Array<{ sourceId: string; text: string; evidenceRef: string }>;
  annotations: Array<{
    sourceId: string;
    kind: 'heading' | 'note' | 'fee' | 'subtotal' | 'total';
    text: string;
    evidenceRef: string;
    amountExact?: string | null;
    currency?: string | null;
    arithmeticMatches?: boolean | null;
  }>;
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });
const CONFIDENCE_FIELDS = [
  'vendor', 'identity', 'translation', 'englishName', 'nameTranslation', 'originalName', 'category',
  'packWeight', 'weightUnit', 'quantity', 'packCount', 'priceBasis', 'price', 'priceAmount', 'currency',
  'acquisitionState', 'acquired', 'duplicateResolution', 'chineseName', 'type', 'form', 'year',
  'originCountry', 'originRegion', 'classification', 'cultivar', 'producer', 'description', 'processingNotes', 'inventoryPurpose',
  'tasting', 'tastingSource',
] as const satisfies readonly ImportConfidenceField[];
const confidenceSchema = {
  type: 'object',
  properties: Object.fromEntries(CONFIDENCE_FIELDS.map(field => [field, nullable({ type: 'number' })])),
  required: [...CONFIDENCE_FIELDS],
  additionalProperties: false,
};
const validationSchema = {
  type: 'object',
  properties: Object.fromEntries(CONFIDENCE_FIELDS.map(field => [field, nullable({ type: 'string', enum: ['source_fact', 'ai_interpretation', 'canonical_match', 'validated', 'not_present', 'uncertain'] })])),
  required: [...CONFIDENCE_FIELDS],
  additionalProperties: false,
};
const tastingSchema = nullable({
  type: 'object',
  properties: {
    body: nullable({ type: 'array', items: { type: 'string' } }),
    finish: nullable({ type: 'array', items: { type: 'string' } }),
    feeling: nullable({ type: 'array', items: { type: 'string' } }),
    flavor: nullable({ type: 'array', items: { type: 'string' } }),
    'liquor-color': nullable({ type: 'array', items: { type: 'string' } }),
    clarity: nullable({ type: 'string', enum: ['clear', 'hazy', 'cloudy'] }),
    huiGan: nullable({ type: 'boolean' }),
    yun: nullable({ type: 'boolean' }),
    qi: nullable({ type: 'boolean' }),
    tangGan: nullable({ type: 'boolean' }),
  },
  required: ['body', 'finish', 'feeling', 'flavor', 'liquor-color', 'clarity', 'huiGan', 'yun', 'qi', 'tangGan'],
  additionalProperties: false,
});
const itemUncertaintySchema = {
  type: 'object',
  properties: Object.fromEntries(CONFIDENCE_FIELDS.map(field => [field, nullable({ type: 'string' })])),
  required: [...CONFIDENCE_FIELDS],
  additionalProperties: false,
};
const groupUncertaintySchema = {
  type: 'object',
  properties: { vendor: nullable({ type: 'string' }) },
  required: ['vendor'],
  additionalProperties: false,
};

export const IMPORT_ANALYSIS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    language: { type: 'string' },
    annotations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceId: { type: 'string' },
          kind: { type: 'string', enum: ['heading', 'note', 'fee', 'subtotal', 'total', 'ignored_duplicate'] },
          text: { type: 'string' },
          evidenceRef: nullable({ type: 'string' }),
        },
        required: ['sourceId', 'kind', 'text', 'evidenceRef'],
        additionalProperties: false,
      },
    },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          proposedVendorName: nullable({ type: 'string' }),
          proposedVendorCustomerId: nullable({ type: 'string' }),
          vendorConfidence: nullable({ type: 'number' }),
          uncertainty: groupUncertaintySchema,
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sourceItemId: { type: 'string' },
                category: { type: 'string', enum: ['tea', 'teaware'] },
                originalName: nullable({ type: 'string' }),
                englishName: nullable({ type: 'string' }),
                packWeight: nullable({ type: 'number' }),
                weightUnit: nullable({ type: 'string', enum: ['g', 'kg', 'count'] }),
                packCount: nullable({ type: 'number' }),
                priceAmount: nullable({ type: 'string' }),
                currency: nullable({ type: 'string' }),
                priceBasis: { type: 'string', enum: ['per_pack', 'line_total', 'unknown'] },
                confidence: confidenceSchema,
                validation: validationSchema,
                uncertainty: itemUncertaintySchema,
                evidenceRefs: { type: 'array', items: { type: 'string' } },
                acquired: nullable({ type: 'boolean' }),
                duplicateResolution: { type: 'string', enum: ['new', 'matched', 'unresolved'] },
                proposedCompassEntryId: nullable({ type: 'string' }),
                proposedProductId: nullable({ type: 'string' }),
                chineseName: nullable({ type: 'string' }),
                type: nullable({ type: 'string' }),
                form: nullable({ type: 'string' }),
                year: nullable({ type: 'integer' }),
                originCountry: nullable({ type: 'string' }),
                originRegion: nullable({ type: 'string' }),
                classification: nullable({ type: 'string' }),
                cultivar: nullable({ type: 'string' }),
                producer: nullable({ type: 'string' }),
                description: nullable({ type: 'string' }),
                processingNotes: nullable({ type: 'string' }),
                tasting: tastingSchema,
                tastingSource: nullable({ type: 'string', enum: ['source', 'common'] }),
                inventoryPurpose: nullable({ type: 'string' }),
              },
              required: ['sourceItemId', 'category', 'originalName', 'englishName', 'packWeight', 'weightUnit', 'packCount', 'priceAmount', 'currency', 'priceBasis', 'confidence', 'validation', 'uncertainty', 'evidenceRefs', 'acquired', 'duplicateResolution', 'proposedCompassEntryId', 'proposedProductId', 'chineseName', 'type', 'form', 'year', 'originCountry', 'originRegion', 'classification', 'cultivar', 'producer', 'description', 'processingNotes', 'tasting', 'tastingSource', 'inventoryPurpose'],
              additionalProperties: false,
            },
          },
        },
        required: ['key', 'proposedVendorName', 'proposedVendorCustomerId', 'vendorConfidence', 'uncertainty', 'items'],
        additionalProperties: false,
      },
    },
  },
  required: ['overview', 'language', 'annotations', 'groups'],
  additionalProperties: false,
} as const;

const IMPORT_ITEM_INPUT_FIELDS = ['sourceItemId', 'category', 'originalName', 'englishName', 'packWeight', 'weightUnit', 'packCount', 'priceAmount', 'currency', 'priceBasis', 'confidence', 'validation', 'uncertainty', 'evidenceRefs', 'acquired', 'duplicateResolution', 'proposedCompassEntryId', 'proposedProductId', 'chineseName', 'type', 'form', 'year', 'originCountry', 'originRegion', 'classification', 'cultivar', 'producer', 'description', 'processingNotes', 'tasting', 'tastingSource', 'inventoryPurpose'] as const;
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

function stringRecord(value: unknown, field: string, allowed?: readonly string[]): Record<string, string> {
  const source = record(value, field);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (allowed && !allowed.includes(key)) throw new Error(`Invalid ${field}.${key}`);
    if (entry == null) continue;
    if (typeof entry !== 'string' || entry.length > 2000) throw new Error(`Invalid ${field}.${key}`);
    result[key] = entry;
  }
  return result;
}

function confidenceRecord(value: unknown): ImportAnalysisConfidence {
  const source = record(value, 'confidence');
  const result: ImportAnalysisConfidence = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!CONFIDENCE_FIELDS.includes(key as ImportConfidenceField)) throw new Error(`Invalid confidence.${key}`);
    if (entry == null) continue;
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1) throw new Error(`Invalid confidence.${key}`);
    result[key as ImportConfidenceField] = entry;
  }
  return result;
}

const VALIDATION_STATES = new Set<ImportValidationState>(['source_fact', 'ai_interpretation', 'canonical_match', 'validated', 'not_present', 'uncertain']);

function validationRecord(value: unknown): ImportAnalysisValidation {
  if (value == null) return {};
  const source = record(value, 'validation');
  const result: ImportAnalysisValidation = {};
  for (const [key, entry] of Object.entries(source)) {
    if (entry == null) continue;
    if (!CONFIDENCE_FIELDS.includes(key as ImportConfidenceField) || typeof entry !== 'string' || !VALIDATION_STATES.has(entry as ImportValidationState)) {
      throw new Error(`Invalid validation.${key}`);
    }
    result[key as ImportConfidenceField] = entry as ImportValidationState;
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
  const evidenceRefs = [...input.evidenceRefs] as string[];
  const duplicateResolution = input.duplicateResolution == null ? 'unresolved' : string(input.duplicateResolution, 'duplicateResolution');
  if (duplicateResolution !== 'new' && duplicateResolution !== 'matched' && duplicateResolution !== 'unresolved') throw new Error('Invalid duplicateResolution');
  if (input.acquired != null && typeof input.acquired !== 'boolean') throw new Error('Invalid acquired');
  const confidence = confidenceRecord(input.confidence);
  const validation = validationRecord(input.validation);
  const uncertainty = stringRecord(input.uncertainty, 'uncertainty', CONFIDENCE_FIELDS);
  const proposedTasting = normalizeImportTasting(input.tasting);
  const hasExactTastingProvenance = proposedTasting != null
    && (input.tastingSource === 'source' || input.tastingSource === 'common')
    && validation.tasting === 'source_fact'
    && validation.tastingSource === 'source_fact'
    && evidenceRefs.some(ref => ref.trim().length > 0);
  if (proposedTasting && !hasExactTastingProvenance && uncertainty.tasting == null) {
    uncertainty.tasting = 'Sensory terms require an exact source reference.';
  }
  const tasting = hasExactTastingProvenance ? proposedTasting : null;
  return {
    chineseName: optionalText(input.chineseName, 'chineseName', 500),
    type: optionalText(input.type, 'type', 200), form: optionalText(input.form, 'form', 200),
    year: optionalYear(input.year), originCountry: optionalText(input.originCountry, 'originCountry', 200),
    originRegion: optionalText(input.originRegion, 'originRegion', 500), classification: optionalText(input.classification, 'classification', 500), cultivar: optionalText(input.cultivar, 'cultivar', 200), producer: optionalText(input.producer, 'producer', 200),
    description: optionalText(input.description, 'description', 5000), processingNotes: optionalText(input.processingNotes, 'processingNotes', 5000),
    tasting, tastingSource: tasting ? 'source' : null,
    inventoryPurpose: optionalText(input.inventoryPurpose, 'inventoryPurpose', 100),
    sourceItemId: string(input.sourceItemId, 'sourceItemId')!, category,
    originalName: string(input.originalName, 'originalName', true), englishName: string(input.englishName, 'englishName', true),
    packWeight: finiteNonNegative(input.packWeight, 'packWeight'), weightUnit,
    packCount: finiteNonNegative(input.packCount, 'packCount'), priceAmount: authoritativeDecimal(input.priceAmount, 'priceAmount'),
    currency: string(input.currency, 'currency', true), priceBasis,
    confidence, validation, uncertainty,
    evidenceRefs,
    acquired: input.acquired == null ? null : input.acquired,
    duplicateResolution,
    proposedCompassEntryId: string(input.proposedCompassEntryId, 'proposedCompassEntryId', true),
    proposedProductId: string(input.proposedProductId, 'proposedProductId', true),
  };
}

export function decodeImportAnalysisProposal(value: unknown): ImportAnalysisProposal {
  const input = record(value, 'proposal');
  rejectUnknown(input, ['overview', 'language', 'annotations', 'groups'], 'proposal');
  if (!Array.isArray(input.groups) || !input.groups.length || input.groups.length > 100) throw new Error('Invalid groups');
  if (input.annotations != null && (!Array.isArray(input.annotations) || input.annotations.length > 500)) throw new Error('Invalid annotations');
  const annotationKinds = new Set<ImportAnalysisAnnotationKind>(['heading', 'note', 'fee', 'subtotal', 'total', 'ignored_duplicate']);
  const proposal = {
    overview: string(input.overview, 'overview')!, language: string(input.language, 'language')!,
    annotations: (input.annotations ?? []).map((value, index) => {
      const annotation = record(value, `annotations[${index}]`);
      rejectUnknown(annotation, ['sourceId', 'kind', 'text', 'evidenceRef'], 'annotation');
      const kind = string(annotation.kind, `annotations[${index}].kind`) as ImportAnalysisAnnotationKind;
      if (!annotationKinds.has(kind)) throw new Error(`Invalid annotation kind: ${kind}`);
      return {
        sourceId: string(annotation.sourceId, `annotations[${index}].sourceId`)!,
        kind,
        text: string(annotation.text, `annotations[${index}].text`)!,
        evidenceRef: optionalText(annotation.evidenceRef, `annotations[${index}].evidenceRef`, 1000),
      };
    }),
    groups: input.groups.map((value, groupIndex) => {
      const group = record(value, `groups[${groupIndex}]`);
      rejectUnknown(group, ['key', 'proposedVendorName', 'proposedVendorCustomerId', 'vendorConfidence', 'uncertainty', 'items'], 'group');
      if (!Array.isArray(group.items) || !group.items.length || group.items.length > 1000) throw new Error(`Invalid groups[${groupIndex}].items`);
      const vendorConfidence = finiteNonNegative(group.vendorConfidence, 'vendorConfidence');
      if (vendorConfidence != null && vendorConfidence > 1) throw new Error('Invalid vendorConfidence');
      return {
        key: string(group.key, 'group.key')!, proposedVendorName: string(group.proposedVendorName, 'proposedVendorName', true),
        proposedVendorCustomerId: string(group.proposedVendorCustomerId, 'proposedVendorCustomerId', true), vendorConfidence,
        uncertainty: group.uncertainty == null ? {} : stringRecord(group.uncertainty, 'group.uncertainty', ['vendor']),
        items: group.items.map((item, itemIndex) => decodeItem(item, groupIndex, itemIndex)),
      };
    }),
  };
  const groupKeys = new Set<string>();
  const sourceItemIds = new Set<string>();
  let itemCount = 0;
  for (const group of proposal.groups) {
    if (groupKeys.has(group.key)) throw new Error(`Duplicate group key: ${group.key}`);
    groupKeys.add(group.key);
    for (const item of group.items) {
      if (++itemCount > 100) throw new Error('analysis_too_many_items');
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
  originalName: 'identity', category: 'identity', duplicateResolution: 'duplicateResolution',
  packWeight: 'packWeight', weightUnit: 'weightUnit', quantity: 'packCount', packCount: 'packCount', priceBasis: 'priceBasis',
  price: 'priceAmount', priceAmount: 'priceAmount', currency: 'currency', acquisitionState: 'acquired', acquired: 'acquired',
};
const MATERIAL_VALIDATION_BLOCKERS: Partial<Record<ImportConfidenceField, string>> = {
  vendor: 'vendor', identity: 'identity', translation: 'englishName', englishName: 'englishName', nameTranslation: 'englishName',
  originalName: 'identity', category: 'identity', packWeight: 'packWeight', weightUnit: 'weightUnit',
  quantity: 'packCount', packCount: 'packCount', priceBasis: 'priceBasis', price: 'priceAmount',
  priceAmount: 'priceAmount', currency: 'currency', acquisitionState: 'acquired', acquired: 'acquired',
  duplicateResolution: 'duplicateResolution',
};
const OPTIONAL_METADATA_FIELDS = ['chineseName', 'type', 'form', 'year', 'originCountry', 'originRegion', 'classification', 'cultivar', 'producer', 'description', 'processingNotes'] as const;
const HAN = /\p{Script=Han}/u;
const DETERMINISTIC_TRANSLATIONS: Record<string, string> = {
  陈年六堡茶: 'Aged Liu Bao Tea',
  陈年旧熟普: 'Aged Ripe Pu-erh Tea',
  北越旧熟普: 'Aged Northern Vietnam Ripe Pu-erh Tea',
};
const TEA_TERMS: Array<{ source: RegExp; english: RegExp }> = [
  { source: /陈年|旧/u, english: /\baged\b|\bold\b/iu },
  { source: /生普|生茶/u, english: /\braw\b/iu },
  { source: /熟普|熟茶/u, english: /\bripe\b/iu },
  { source: /六堡/u, english: /\bliu\s*bao\b/iu },
  { source: /北越/u, english: /\b(?:northern?|north)\s+vietnam\b/iu },
  { source: /白茶/u, english: /\bwhite\s+tea\b/iu },
  { source: /乌龙|烏龍/u, english: /\boolong\b/iu },
  { source: /砖|磚/u, english: /\bbrick\b/iu },
  { source: /饼|餅/u, english: /\bcake\b/iu },
  { source: /散/u, english: /\bloose\b/iu },
];

function deterministicTranslation(originalName: string | null): string | null {
  return originalName ? DETERMINISTIC_TRANSLATIONS[comparable(originalName)] ?? null : null;
}

function teaTermTranslationMatches(originalName: string, englishName: string): boolean | null {
  const applicable = TEA_TERMS.filter(term => term.source.test(originalName));
  if (!applicable.length) return null;
  const missingRequiredTerm = applicable.some(term => !term.english.test(englishName));
  const contradictoryExtraTerm = TEA_TERMS.some(term => term.english.test(englishName) && !term.source.test(originalName));
  return !missingRequiredTerm && !contradictoryExtraTerm;
}

function requiresSeparateEnglishName(originalName: string, englishName: string | null, language: string): boolean {
  if (HAN.test(originalName)) return true;
  if (/[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}]/u.test(originalName)) return true;
  if (/^en(?:glish)?(?:[-_]|$)/iu.test(language)) return false;
  if (!/^(?:mixed|unknown)$/iu.test(language)) return true;
  return /[^\x00-\x7f]/u.test(originalName)
    || Boolean(englishName && comparable(originalName) !== comparable(englishName));
}

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

function addExact(left: string, right: string): string {
  const a = decimalParts(left); const b = decimalParts(right);
  const scale = Math.max(a.scale, b.scale);
  const leftCoefficient = a.coefficient * 10n ** BigInt(scale - a.scale);
  const rightCoefficient = b.coefficient * 10n ** BigInt(scale - b.scale);
  return decimalString(leftCoefficient + rightCoefficient, scale);
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
        const validation: ImportAnalysisValidation = { ...item.validation };
        for (const field of OPTIONAL_METADATA_FIELDS) {
          if (item[field] == null && validation[field] == null) validation[field] = 'not_present';
        }
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
        const needsTranslation = Boolean(item.originalName && requiresSeparateEnglishName(item.originalName, item.englishName, proposal.language));
        if (item.englishName && HAN.test(item.englishName)) {
          validation.translation = 'uncertain';
          block('englishName');
        }
        if (item.originalName && needsTranslation) {
          const canonical = validation.translation === 'canonical_match'
            && item.duplicateResolution === 'matched'
            && Boolean(item.proposedCompassEntryId);
          const explicitlyUncertain = item.validation?.translation === 'uncertain'
            || item.validation?.englishName === 'uncertain'
            || item.validation?.nameTranslation === 'uncertain';
          const hasDistinctEnglishName = Boolean(item.englishName
            && !HAN.test(item.englishName)
            && /[A-Za-z]/u.test(item.englishName)
            && comparable(item.originalName) !== comparable(item.englishName));
          const termMatch = hasDistinctEnglishName && item.englishName ? teaTermTranslationMatches(item.originalName, item.englishName) : false;
          const translationConfidence = item.confidence.translation ?? item.confidence.englishName ?? item.confidence.nameTranslation;
          if (canonical) {
            validation.translation = 'canonical_match';
          } else if (explicitlyUncertain) {
            validation.translation = 'uncertain';
            block('englishName');
          } else if (!hasDistinctEnglishName || termMatch === false) {
            validation.translation = 'uncertain';
            block('englishName');
          } else if (termMatch === true) {
            validation.translation = 'validated';
          } else if (translationConfidence == null || translationConfidence < 0.8) {
            validation.translation = 'uncertain';
            block('englishName');
          } else if (validation.translation == null) {
            validation.translation = 'ai_interpretation';
          }
        }
        const trustedTranslation = validation.translation === 'validated' || validation.translation === 'canonical_match';
        for (const [field, confidence] of Object.entries(item.confidence)) {
          const blocker = MATERIAL_CONFIDENCE_BLOCKERS[field];
          if (blocker && confidence < 0.8 && !(blocker === 'englishName' && trustedTranslation)) block(blocker);
        }
        for (const field of Object.keys(item.uncertainty)) {
          const blocker = MATERIAL_CONFIDENCE_BLOCKERS[field];
          if (blocker && !(blocker === 'englishName' && trustedTranslation)) block(blocker);
        }
        for (const [field, state] of Object.entries(validation)) {
          const blocker = MATERIAL_VALIDATION_BLOCKERS[field as ImportConfidenceField];
          if (state === 'uncertain' && blocker) block(blocker);
        }
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
          ...item, validation, priceAmount: compatibleMoneyNumber(priceAmountExact), currency, totalQuantityGrams, totalUnits, priceAmountExact, lineCostExact, unitCostExact, lineCost,
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

const TOTAL_LINE = /^(?:共计|合计|总计|grand\s+total|total)\s*[:：]?/iu;
const SUBTOTAL_LINE = /^(?:小计|sub\s*total)\s*[:：]?/iu;
const FEE_LINE = /^(?:(?:shipping|freight|delivery|postage|fee)\b|(?:运费|運費|邮费|郵費))\s*[:：]?/iu;
const NOTE_LINE = /^(?:(?:note|notes|remark|remarks)\b|(?:备注|備註|说明|說明))\s*[:：]?/iu;
const GENERIC_HEADER = /^(?:order|invoice|price\s*list|tea\s*list|record|spring\s+order|autumn\s+order)\b/iu;
const EXPLICIT_SUPPLIER = /^(?:supplier|vendor|供应商|供應商)\s*[:：-]\s*(.+)$/iu;
const NUMBER_SOURCE = String.raw`\d+(?:\.\d+)?`;
const MASS_SOURCE = String.raw`(kg|kilograms?|g|grams?|克|公斤|千克)`;
const CURRENCY_SOURCE = String.raw`(CNY|RMB|USD|EUR|GBP|AUD|IDR|TWD|NT\$|¥|￥|元|\$)`;
const MULTIPLIER_SOURCE = String.raw`[x×*]`;

interface ParsedPurchaseLine {
  originalName: string;
  packWeight: number;
  weightUnit: 'g' | 'kg';
  packCount: number;
  priceAmount: string;
  currency: string;
  priceBasis: ImportPriceBasis;
  lineTotal: string | null;
  totalQuantityGrams: number;
  arithmeticMatches: boolean;
}

const cleanItemName = (value: string) => value.replace(/[\s|,;:：—–-]+$/gu, '').trim();
const massUnit = (value: string): 'g' | 'kg' => /^(?:kg|kilograms?|公斤|千克)$/iu.test(value) ? 'kg' : 'g';
const parsedCurrency = (value: string): string => {
  const normalized = value.toUpperCase();
  if (normalized === '元' || normalized === 'RMB') return 'CNY';
  if (normalized === 'NT$') return 'TWD';
  return normalized;
};
type ArithmeticCurrency = string | null | 'mixed';
const mergeArithmeticCurrency = (current: ArithmeticCurrency, next: string): ArithmeticCurrency => (
  current == null ? next : current === next ? current : 'mixed'
);

function annotationMoney(value: string): { amountExact: string; currency: string } | null {
  const currencyFirst = value.match(new RegExp(`${CURRENCY_SOURCE}\\s*(${NUMBER_SOURCE})`, 'iu'));
  if (currencyFirst) return { amountExact: exact(currencyFirst[2])!, currency: parsedCurrency(currencyFirst[1]) };
  const amountFirst = value.match(new RegExp(`(${NUMBER_SOURCE})\\s*${CURRENCY_SOURCE}`, 'iu'));
  if (amountFirst) return { amountExact: exact(amountFirst[1])!, currency: parsedCurrency(amountFirst[2]) };
  return null;
}

function purchaseFacts(
  originalName: string,
  packWeightText: string,
  weightUnitText: string,
  packCountText: string,
  priceAmountText: string,
  currencyText: string,
  priceBasis: ImportPriceBasis,
  explicitLineTotal?: string,
): ParsedPurchaseLine | null {
  const name = cleanItemName(originalName);
  const packWeightExact = exact(packWeightText);
  const packCountExact = exact(packCountText);
  const priceAmount = exact(priceAmountText);
  if (!name || packWeightExact == null || packCountExact == null || priceAmount == null) return null;
  const packWeight = Number(packWeightExact);
  const packCount = Number(packCountExact);
  if (!Number.isFinite(packWeight) || !Number.isFinite(packCount) || packWeight <= 0 || packCount <= 0) return null;
  const unit = massUnit(weightUnitText);
  const computedLineTotal = priceBasis === 'per_pack' ? multiplyExact(priceAmount, packCount) : priceBasis === 'line_total' ? priceAmount : null;
  const lineTotal = explicitLineTotal == null ? computedLineTotal : exact(explicitLineTotal);
  const quantityInSourceUnit = multiplyExact(packWeightExact, packCount);
  const gramsExact = unit === 'kg' ? multiplyExact(quantityInSourceUnit, 1000) : quantityInSourceUnit;
  const totalQuantityGrams = Number(gramsExact);
  if (!Number.isFinite(totalQuantityGrams)) return null;
  return {
    originalName: name,
    packWeight,
    weightUnit: unit,
    packCount,
    priceAmount,
    currency: parsedCurrency(currencyText),
    priceBasis,
    lineTotal,
    totalQuantityGrams,
    arithmeticMatches: lineTotal != null && computedLineTotal != null && lineTotal === computedLineTotal,
  };
}

function parsePurchaseLine(value: string): ParsedPurchaseLine | null {
  const chineseSlash = value.match(new RegExp(
    `^(.+?)\\s*(${NUMBER_SOURCE})\\s*${CURRENCY_SOURCE}\\s*[/／]\\s*(${NUMBER_SOURCE})\\s*${MASS_SOURCE}\\s*${MULTIPLIER_SOURCE}\\s*(${NUMBER_SOURCE})(?:\\s*=\\s*(${NUMBER_SOURCE})\\s*(?:CNY|RMB|元|¥|￥)?)?\\s*$`, 'iu',
  ));
  if (chineseSlash) return purchaseFacts(chineseSlash[1], chineseSlash[4], chineseSlash[5], chineseSlash[6], chineseSlash[2], chineseSlash[3], 'per_pack', chineseSlash[7]);

  const columns = value.match(new RegExp(
    `^(.+?)(?:\\t|\\s*[|,]\\s*|\\s{2,})(${NUMBER_SOURCE})\\s*${MASS_SOURCE}(?:\\t|\\s*[|,]\\s*|\\s{2,})(${NUMBER_SOURCE})(?:\\t|\\s*[|,]\\s*|\\s{2,})${CURRENCY_SOURCE}\\s*(${NUMBER_SOURCE})\\s*(?:line\\s*total|total)\\s*$`, 'iu',
  ));
  if (columns) return purchaseFacts(columns[1], columns[2], columns[3], columns[4], columns[6], columns[5], 'line_total');

  const weightFirst = value.match(new RegExp(
    `^(.+?)(?:\\s*[|,]\\s*|\\s+)(${NUMBER_SOURCE})\\s*${MASS_SOURCE}\\s*${MULTIPLIER_SOURCE}\\s*(${NUMBER_SOURCE})\\s*(@|[,|])\\s*${CURRENCY_SOURCE}\\s*(${NUMBER_SOURCE})(?:\\s*(each|per\\s+pack|line\\s*total|total))?(?:\\s*=\\s*(${NUMBER_SOURCE}))?\\s*$`, 'iu',
  ));
  if (weightFirst) {
    const label = weightFirst[8] ?? '';
    const basis: ImportPriceBasis = /^(?:line\s*total|total)$/iu.test(label)
      ? 'line_total'
      : /^(?:each|per\s+pack)$/iu.test(label) || weightFirst[5] === '@'
        ? 'per_pack'
        : 'unknown';
    return purchaseFacts(weightFirst[1], weightFirst[2], weightFirst[3], weightFirst[4], weightFirst[7], weightFirst[6], basis, weightFirst[9]);
  }

  const countFirst = value.match(new RegExp(
    `^(.+?)(?:\\s*[|,]\\s*|\\s+)(${NUMBER_SOURCE})\\s*${MULTIPLIER_SOURCE}\\s*(${NUMBER_SOURCE})\\s*${MASS_SOURCE}(?:\\s*[|,]\\s*|\\s+)(${NUMBER_SOURCE})\\s*${CURRENCY_SOURCE}\\s*(each|per\\s+pack|line\\s*total|total)?\\s*$`, 'iu',
  ));
  if (countFirst) {
    const basis: ImportPriceBasis = /^(?:line\s*total|total)$/iu.test(countFirst[7] ?? '')
      ? 'line_total'
      : /^(?:each|per\s+pack)$/iu.test(countFirst[7] ?? '') ? 'per_pack' : 'unknown';
    return purchaseFacts(countFirst[1], countFirst[3], countFirst[4], countFirst[2], countFirst[5], countFirst[6], basis);
  }

  const totalWeight = value.match(new RegExp(
    `^(.+?)(?:\\s*[|,]\\s*|\\s{2,})(${NUMBER_SOURCE})\\s*${MASS_SOURCE}\\s+total(?:\\s*[|,]\\s*|\\s{2,})${CURRENCY_SOURCE}\\s*(${NUMBER_SOURCE})\\s*(?:line\\s*total|total)?\\s*$`, 'iu',
  ));
  if (totalWeight) return purchaseFacts(totalWeight[1], totalWeight[2], totalWeight[3], '1', totalWeight[5], totalWeight[4], 'line_total');

  return null;
}

const comparable = (value: string | null | undefined) => (value ?? '').normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase();

type ImportRecordLine = { lineIndex: number; text: string; normalized: string; evidenceRef: string; start: number };

function tastingFromLabeledDescription(value: string): TastingData | null {
  const tasting: TastingData = {};
  const flavor = [
    [/\bwildflowers?\b|\bfloral\b/iu, 'floral'],
    [/\bhoney\b/iu, 'honey'],
    [/\b(?:orchard\s+)?fruit\b/iu, 'fruity'],
    [/\bcitrus\b/iu, 'citrus'],
    [/\bfresh\b/iu, 'fresh'],
    [/\bsweetness\b|\bsweet\b/iu, 'sweet'],
    [/\bbitterness\b|\bbitter\b/iu, 'bitter'],
  ].flatMap(([pattern, term]) => (pattern as RegExp).test(value) ? [term as string] : []);
  if (flavor.length) tasting.flavor = flavor;
  if (/\bfull-mouthed\b|\bthick,?\s+viscous\s+body\b/iu.test(value)) tasting.body = ['full'];
  const finish = [
    [/\blong\s+(?:hui-gan|finish|aftertaste)\b/iu, 'finish-long'],
    [/\bhui-gan\b/iu, 'hui-gan'],
    [/\bshengjin\b/iu, 'salivating'],
  ].flatMap(([pattern, term]) => (pattern as RegExp).test(value) ? [term as string] : []);
  if (finish.length) tasting.finish = finish;
  if (/\byellow-gold\b|\bgold(?:en)?\s+liquor\b/iu.test(value)) tasting['liquor-color'] = ['gold'];
  if (/\bclear\b[^.;]*\bliquor\b/iu.test(value)) tasting.clarity = 'clear';
  if (/\bhui-gan\b/iu.test(value)) tasting.huiGan = true;
  return Object.keys(tasting).length ? tasting : null;
}

function labeledTeaRecord(sourceId: string, lines: ImportRecordLine[]): ImportRecordHints['items'][number] | null {
  const facts = new Map<string, { value: string; line: ImportRecordLine; valueStart: number }>();
  for (const line of lines) {
    const match = line.text.match(/^([^:]+):\s*(.+)$/u);
    if (!match) continue;
    const valueStart = line.start + match[0].indexOf(match[2]);
    facts.set(match[1].trim().toLocaleLowerCase(), { value: match[2].trim(), line, valueStart });
  }
  const name = facts.get('name');
  const vendor = facts.get('vendor');
  const format = facts.get('format and weight');
  const prices = facts.get('current price variants');
  const description = facts.get('description');
  const processing = facts.get('processing notes');
  const excerpt = facts.get('source excerpt');
  if (!name || !vendor || !format || !prices || !description || !processing || !excerpt) return null;

  const weight = format.value.match(/(\d+(?:\.\d+)?)\s*(g|kg)\s+per\s+(?:cake|pack)\b/iu);
  const price = prices.value.match(/\b(USD|CNY|EUR|GBP|AUD|IDR|TWD)\s+(\d+(?:\.\d+)?)\s+for\s+one\s+\d+(?:\.\d+)?\s*(?:g|kg)\b/iu);
  if (!weight || !price) return null;
  const harvest = facts.get('harvest')?.value.match(/\b(\d{4})\b/u);
  const origin = facts.get('origin')?.value ?? null;
  const material = facts.get('plant material')?.value ?? null;
  const cultivar = material?.match(/^(primitive small-leaf population)\b/iu)?.[1] ?? material;
  const typeValue = facts.get('type')?.value ?? '';
  const excerptRef = `${sourceId}:${excerpt.valueStart}-${excerpt.valueStart + excerpt.value.length}`;
  const tastingEvidenceRef = `${sourceId}:${description.valueStart}-${description.valueStart + description.value.length}`;
  const tasting = tastingFromLabeledDescription(description.value);
  return {
    sourceId,
    sourceItemId: `record:${sourceId}:${name.line.lineIndex}`,
    evidenceRef: excerptRef,
    tastingEvidenceRef,
    originalName: name.value,
    englishName: name.value,
    packWeight: Number(weight[1]),
    weightUnit: weight[2].toLocaleLowerCase() as ImportWeightUnit,
    packCount: 1,
    priceAmount: price[2],
    currency: price[1].toUpperCase(),
    priceBasis: 'per_pack',
    lineTotal: price[2],
    totalQuantityGrams: weight[2].toLocaleLowerCase() === 'kg' ? Number(weight[1]) * 1000 : Number(weight[1]),
    arithmeticMatches: true,
    supplierName: vendor.value,
    supplierExplicit: true,
    type: /(?:raw\s+pu-?erh|sheng)/iu.test(typeValue) ? 'Sheng' : null,
    form: /\bcake\b/iu.test(format.value) ? 'Cake' : null,
    year: harvest ? Number(harvest[1]) : null,
    originCountry: origin?.match(/(?:^|,\s*)(China)\s*$/iu)?.[1] ?? null,
    originRegion: origin?.replace(/,\s*China\s*$/iu, '') ?? null,
    cultivar,
    producer: facts.get('producer/brand')?.value ?? null,
    description: description.value,
    processingNotes: processing.value,
    tasting,
    tastingSource: tasting ? 'source' : null,
  };
}

export function buildImportRecordHints(evidence: ImportEvidenceForAnalysis): ImportRecordHints {
  const hints: ImportRecordHints = { complete: false, suppliers: [], items: [], ignoredSummaries: [], annotations: [] };
  let unexplainedLines = 0;
  for (const source of evidence.sources) {
    if (!source.text) continue;
    const lines = [...source.text.matchAll(/[^\r\n]+/gu)].map((match, lineIndex) => {
      const raw = match[0];
      const leading = raw.length - raw.trimStart().length;
      const text = raw.trim();
      const start = (match.index ?? 0) + leading;
      return { lineIndex, text, normalized: text.normalize('NFKC'), evidenceRef: `${source.id}:${start}-${start + text.length}`, start };
    }).filter(line => line.text);
    const labeledRecord = labeledTeaRecord(source.id, lines);
    if (labeledRecord) {
      hints.items.push(labeledRecord);
      const vendorLine = lines.find(line => /^vendor:/iu.test(line.text));
      hints.suppliers.push({ sourceId: source.id, name: labeledRecord.supplierName!, evidenceRef: vendorLine?.evidenceRef ?? labeledRecord.evidenceRef, explicit: true });
      continue;
    }
    let activeSupplier: string | null = null;
    let activeSupplierExplicit = false;
    let sourceItemCount = 0;
    let sourceLineCost = '0';
    let sectionLineCost = '0';
    let sourceFees = '0';
    let sourceCurrency: ArithmeticCurrency = null;
    let sectionCurrency: ArithmeticCurrency = null;
    let feeCurrency: ArithmeticCurrency = null;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const explicitSupplier = line.normalized.match(EXPLICIT_SUPPLIER);
      if (explicitSupplier) {
        activeSupplier = explicitSupplier[1].trim();
        activeSupplierExplicit = true;
        sectionLineCost = '0';
        sectionCurrency = null;
        hints.suppliers.push({ sourceId: source.id, name: activeSupplier, evidenceRef: line.evidenceRef, explicit: true });
        continue;
      }
      const summaryKind = SUBTOTAL_LINE.test(line.normalized) ? 'subtotal' : TOTAL_LINE.test(line.normalized) ? 'total' : null;
      if (summaryKind) {
        const money = annotationMoney(line.normalized);
        const expected = summaryKind === 'subtotal' ? sectionLineCost : addExact(sourceLineCost, sourceFees);
        const expectedCurrency = summaryKind === 'subtotal'
          ? sectionCurrency
          : feeCurrency == null ? sourceCurrency : sourceCurrency == null ? feeCurrency : sourceCurrency === feeCurrency ? sourceCurrency : 'mixed';
        const arithmeticMatches = money == null ? null : money.amountExact === expected
          && expectedCurrency !== null
          && expectedCurrency !== 'mixed'
          && money.currency === expectedCurrency;
        hints.ignoredSummaries.push({ sourceId: source.id, text: line.text, evidenceRef: line.evidenceRef });
        hints.annotations.push({
          sourceId: source.id, kind: summaryKind, text: line.text, evidenceRef: line.evidenceRef,
          amountExact: money?.amountExact ?? null, currency: money?.currency ?? null, arithmeticMatches,
        });
        continue;
      }
      const purchase = parsePurchaseLine(line.normalized);
      if (purchase) {
        hints.items.push({
          sourceId: source.id,
          sourceItemId: `record:${source.id}:${line.lineIndex}`,
          evidenceRef: line.evidenceRef,
          ...purchase,
          supplierName: activeSupplier,
          supplierExplicit: activeSupplierExplicit,
        });
        sourceItemCount += 1;
        if (purchase.lineTotal != null) {
          sourceLineCost = addExact(sourceLineCost, purchase.lineTotal);
          sectionLineCost = addExact(sectionLineCost, purchase.lineTotal);
        }
        sourceCurrency = mergeArithmeticCurrency(sourceCurrency, purchase.currency);
        sectionCurrency = mergeArithmeticCurrency(sectionCurrency, purchase.currency);
        continue;
      }
      const plainSupplierName = !GENERIC_HEADER.test(line.normalized)
        && /^[\p{L}\p{M}.'’ -]{2,100}$/u.test(line.text)
        && line.text.trim().split(/\s+/).length <= 6;
      const beginsUnlabelledSection = sourceItemCount > 0
        && Boolean(lines[index + 1] && parsePurchaseLine(lines[index + 1].normalized));
      const supplierCandidate = plainSupplierName
        && ((sourceItemCount === 0 && activeSupplier == null) || beginsUnlabelledSection);
      if (supplierCandidate) {
        activeSupplier = line.text;
        activeSupplierExplicit = false;
        sectionLineCost = '0';
        sectionCurrency = null;
        hints.suppliers.push({ sourceId: source.id, name: line.text, evidenceRef: line.evidenceRef, explicit: false });
      } else if (FEE_LINE.test(line.normalized)) {
        const money = annotationMoney(line.normalized);
        if (money) {
          sourceFees = addExact(sourceFees, money.amountExact);
          feeCurrency = mergeArithmeticCurrency(feeCurrency, money.currency);
        }
        hints.annotations.push({
          sourceId: source.id, kind: 'fee', text: line.text, evidenceRef: line.evidenceRef,
          amountExact: money?.amountExact ?? null, currency: money?.currency ?? null,
        });
      } else if (NOTE_LINE.test(line.normalized)) {
        hints.annotations.push({ sourceId: source.id, kind: 'note', text: line.text, evidenceRef: line.evidenceRef });
      } else if (!/[\d¥￥$]|\b(?:CNY|RMB|USD|EUR|GBP|AUD|IDR|TWD|kg|grams?|total)\b/iu.test(line.normalized)) {
        hints.annotations.push({ sourceId: source.id, kind: sourceItemCount === 0 || GENERIC_HEADER.test(line.normalized) ? 'heading' : 'note', text: line.text, evidenceRef: line.evidenceRef });
      } else {
        unexplainedLines += 1;
      }
    }
  }
  hints.complete = hints.items.length > 0
    && unexplainedLines === 0
    && hints.items.every(item => item.arithmeticMatches)
    && hints.items.every(item => canonicalCurrency(item.currency) != null)
    && hints.annotations.every(annotation => annotation.arithmeticMatches !== false);
  return hints;
}

export function applyImportRecordHints(proposal: ImportAnalysisProposal, hints: ImportRecordHints, candidates?: ImportMatchCandidates): ImportAnalysisProposal {
  if (!hints.complete || !hints.items.length) return proposal;
  const providerItems = proposal.groups.flatMap(group => group.items);
  const used = new Set<ImportAnalysisItem>();
  const items = hints.items.map(hint => {
    const translated = providerItems.find(item => !used.has(item) && (
      item.sourceItemId === hint.sourceItemId
      || comparable(item.originalName) === comparable(hint.originalName)
      || comparable(item.originalName).includes(comparable(hint.originalName))
    ));
    if (!translated) throw new Error('analysis_missing_record_item');
    used.add(translated);
    const uncertainty = { ...translated.uncertainty };
    for (const field of ['packWeight', 'weightUnit', 'quantity', 'packCount', 'priceBasis', 'price', 'priceAmount', 'currency', 'acquisitionState', 'acquired']) delete uncertainty[field];
    const sourceIdentityNames = [hint.originalName, translated.chineseName].filter((name): name is string => Boolean(name));
    const canonicalIdentity = candidates?.identities?.find(identity => identity.category === translated.category
      && sourceIdentityNames.some(sourceName => (
        comparable(identity.chineseName) === comparable(sourceName)
        || comparable(identity.name) === comparable(sourceName)
      )));
    const confidence = { ...translated.confidence };
    const validation = { ...translated.validation };
    for (const field of OPTIONAL_METADATA_FIELDS) if (hint[field] != null) {
      confidence[field] = 1;
      validation[field] = 'source_fact';
      delete uncertainty[field];
    }
    if (canonicalIdentity?.name) {
      confidence.translation = 1;
      confidence.identity = 1;
      validation.translation = 'canonical_match';
      delete uncertainty.translation;
      delete uncertainty.englishName;
      delete uncertainty.nameTranslation;
      delete uncertainty.identity;
      delete uncertainty.duplicateResolution;
    }
    if (hint.tasting) {
      confidence.tasting = 1;
      confidence.tastingSource = 1;
      validation.tasting = 'source_fact';
      validation.tastingSource = 'source_fact';
      delete uncertainty.tasting;
      delete uncertainty.tastingSource;
    }
    const evidenceRefs = [...new Set([hint.evidenceRef, hint.tastingEvidenceRef].filter((ref): ref is string => Boolean(ref)))];
    return {
      ...translated,
      sourceItemId: hint.sourceItemId,
      originalName: hint.originalName,
      chineseName: translated.chineseName ?? (HAN.test(hint.originalName) ? hint.originalName : null),
      englishName: canonicalIdentity?.name ?? translated.englishName,
      packWeight: hint.packWeight,
      weightUnit: hint.weightUnit,
      packCount: hint.packCount,
      priceAmount: hint.priceAmount,
      currency: hint.currency,
      priceBasis: hint.priceBasis,
      acquired: true,
      evidenceRefs,
      confidence,
      validation,
      uncertainty,
      duplicateResolution: canonicalIdentity ? 'matched' as const : translated.duplicateResolution,
      proposedCompassEntryId: canonicalIdentity?.id ?? translated.proposedCompassEntryId,
      proposedProductId: canonicalIdentity?.productId ?? translated.proposedProductId,
      ...Object.fromEntries(OPTIONAL_METADATA_FIELDS.flatMap(field => hint[field] == null ? [] : [[field, hint[field]]])),
      ...(hint.tasting ? { tasting: hint.tasting, tastingSource: 'source' as const } : {}),
    };
  });
  const itemGroups = new Map<string, { sourceId: string; supplier: string | null; supplierExplicit: boolean; items: ImportAnalysisItem[] }>();
  for (let index = 0; index < items.length; index++) {
    const hint = hints.items[index];
    const key = `${hint.sourceId}:${hint.supplierName ?? ''}`;
    const entry = itemGroups.get(key) ?? { sourceId: hint.sourceId, supplier: hint.supplierName ?? null, supplierExplicit: hint.supplierExplicit === true, items: [] };
    entry.items.push(items[index]);
    itemGroups.set(key, entry);
  }
  return {
    ...proposal,
    groups: [...itemGroups.values()].map((entry, index) => {
      const providerGroup = proposal.groups.find(group => comparable(group.proposedVendorName) === comparable(entry.supplier))
        ?? proposal.groups[index]
        ?? proposal.groups[0];
      const providerConfirmed = Boolean(entry.supplier && comparable(providerGroup.proposedVendorName) === comparable(entry.supplier));
      const exactVendor = entry.supplier ? candidates?.vendors.find(vendor => [vendor.name, ...(vendor.aliases ?? [])]
        .some(name => comparable(name) === comparable(entry.supplier))) : undefined;
      const vendorTrusted = entry.supplierExplicit || providerConfirmed || Boolean(exactVendor);
      const uncertainty = { ...(providerGroup.uncertainty ?? {}) };
      if (vendorTrusted) delete uncertainty.vendor;
      else uncertainty.vendor = entry.supplier
        ? 'Confirm whether the inferred section heading is the supplier.'
        : 'No explicit supplier was found in the record.';
      return {
        ...providerGroup,
        key: `record:${entry.sourceId}:${index}`,
        proposedVendorName: entry.supplier ?? providerGroup.proposedVendorName,
        proposedVendorCustomerId: exactVendor?.id ?? (entry.supplier && !providerConfirmed ? null : providerGroup.proposedVendorCustomerId),
        vendorConfidence: vendorTrusted ? 1 : null,
        uncertainty,
        items: entry.items,
      };
    }),
  };
}

export function buildImportRecordFallbackProposal(hints: ImportRecordHints): ImportAnalysisProposal {
  if (!hints.complete || !hints.items.length) throw new Error('analysis_record_hints_incomplete');
  const itemGroups = new Map<string, { sourceId: string; supplier: string | null; supplierExplicit: boolean; items: typeof hints.items }>();
  for (const hint of hints.items) {
    const key = `${hint.sourceId}:${hint.supplierName ?? ''}`;
    const entry = itemGroups.get(key) ?? { sourceId: hint.sourceId, supplier: hint.supplierName ?? null, supplierExplicit: hint.supplierExplicit === true, items: [] };
    entry.items.push(hint);
    itemGroups.set(key, entry);
  }
  return {
    overview: `Recovered ${hints.items.length} purchased ${hints.items.length === 1 ? 'item' : 'items'} from the record; translation and identity need review.`,
    language: hints.items.some(item => /\p{Script=Han}/u.test(item.originalName)) ? 'zh' : 'unknown',
    annotations: hints.annotations.map(annotation => ({
      sourceId: annotation.sourceId,
      kind: annotation.kind,
      text: annotation.text,
      evidenceRef: annotation.evidenceRef,
    })),
    groups: [...itemGroups.values()].map((entry, index) => ({
      key: `record:${entry.sourceId}:${index}`,
      proposedVendorName: entry.supplier,
      proposedVendorCustomerId: null,
      vendorConfidence: entry.supplierExplicit ? 1 : null,
      uncertainty: entry.supplierExplicit ? {} : {
        vendor: entry.supplier
          ? 'Confirm whether the inferred section heading is the supplier.'
          : 'No explicit supplier was found in the record.',
      },
      items: entry.items.map(hint => {
        const englishName = hint.englishName ?? deterministicTranslation(hint.originalName) ?? (/\p{Script=Latin}/u.test(hint.originalName) ? hint.originalName : null);
        const sourceFacts = Object.fromEntries(OPTIONAL_METADATA_FIELDS.flatMap(field => hint[field] == null ? [] : [[field, hint[field]]]));
        const sourceFactConfidence = Object.fromEntries(OPTIONAL_METADATA_FIELDS.flatMap(field => hint[field] == null ? [] : [[field, 1]]));
        const sourceFactValidation = Object.fromEntries(OPTIONAL_METADATA_FIELDS.flatMap(field => hint[field] == null ? [] : [[field, 'source_fact']]));
        return {
          sourceItemId: hint.sourceItemId,
          category: 'tea' as const,
          originalName: hint.originalName,
          chineseName: HAN.test(hint.originalName) ? hint.originalName : null,
          englishName,
          packWeight: hint.packWeight,
          weightUnit: hint.weightUnit,
          packCount: hint.packCount,
          priceAmount: hint.priceAmount,
          currency: hint.currency,
          priceBasis: hint.priceBasis,
          confidence: {
            originalName: 1, packWeight: 1, weightUnit: 1, packCount: 1,
            priceAmount: 1, currency: 1, priceBasis: 1, acquired: 1,
            ...(englishName ? { translation: 1 } : {}),
            ...(hint.tasting ? { tasting: 1, tastingSource: 1 } : {}),
            ...sourceFactConfidence,
          },
          validation: {
            originalName: 'source_fact' as const, englishName: 'source_fact' as const,
            packWeight: 'source_fact' as const, weightUnit: 'source_fact' as const, packCount: 'source_fact' as const,
            priceAmount: 'source_fact' as const, currency: 'source_fact' as const, priceBasis: 'source_fact' as const,
            translation: englishName ? 'validated' as const : 'uncertain' as const,
            ...(hint.tasting ? { tasting: 'source_fact' as const, tastingSource: 'source_fact' as const } : {}),
            ...sourceFactValidation,
          },
          uncertainty: {
            ...(englishName ? {} : { englishName: 'Translation provider unavailable; review the original name.' }),
            duplicateResolution: 'Choose whether this is a new or existing Curate identity.',
          },
          evidenceRefs: [...new Set([hint.evidenceRef, hint.tastingEvidenceRef].filter((ref): ref is string => Boolean(ref)))],
          acquired: true,
          duplicateResolution: 'unresolved' as const,
          ...sourceFacts,
          ...(hint.tasting ? { tasting: hint.tasting, tastingSource: 'source' as const } : {}),
        };
      }),
    })),
  };
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
  const recordHints = buildImportRecordHints(evidence);
  return [
    'Interpret this free-form vendor record as an inventory import. The record may mix languages, arbitrary ordering, blank lines, conversational notes, photos, tables, prices, and totals.',
    'Classify meaning before extracting: identify suppliers, tea or teaware items, quantities, prices, totals, headings, and notes. A supplier, heading, subtotal, total, shipping charge, or note is never an inventory item.',
    'Return every non-item heading, note, shipping/fee, subtotal, total, or ignored duplicate in the top-level annotations array with its sourceId, kind, exact source text, and evidenceRef when available.',
    'Preserve every original non-English product name and translate it into a concise, natural English product name. Put the original in originalName and the translation in englishName; never leave price, weight, count, or totals inside either name.',
    'Use explicit pack size and count to describe acquired stock. Application code derives total grams from packWeight × packCount and converts kg to grams.',
    'Each item must include sourceItemId, category, originalName, englishName, packWeight, weightUnit, packCount, priceAmount, currency, priceBasis, acquired, duplicateResolution, confidence, uncertainty, and evidenceRefs. priceAmount must be a JSON decimal string copied from evidence, never a JSON number. Use null or "unresolved" instead of guessing.',
    'Never infer priceBasis when the evidence is ambiguous; return "unknown" and explain uncertainty.',
    'Identify the tea itself, not only the words on the record. Fill type, form, year, originCountry, originRegion, classification, and description for every tea item you can recognise, using both the record and general tea knowledge. A well-known name is enough: "陈年六堡茶 / Aged Liu Bao" is a Dark tea from Guangxi, China.',
    'type must be one of Green, White, Yellow, Oolong, Red, Dark, Sheng, Shou, Herbal. Use Red for Chinese hong cha, and Sheng or Shou rather than a generic puerh label. form must be one of Loose, Cake, Brick, Tuo, Ball, Bag. originCountry is a country name such as China, Taiwan, Japan; originRegion is the growing area such as Guangxi, Yiwu, Alishan.',
    'classification is the production or grade descriptor the trade would use, such as "traditional basket-fermented", "first flush", or "competition grade". description is one or two neutral sentences about what the tea is. Leave either null rather than writing marketing copy.',
    'processingNotes preserves processing facts. For exact-record sensory terms, use taxonomy IDs, tastingSource "source", source_fact validation for tasting and tastingSource, and an exact evidence range. Otherwise both sensory fields must be null.',
    'cultivar is the tea plant the leaf came from, when the record names it or the tea is only ever made from one, such as Rou Gui, Shui Xian, Tie Guan Yin, Cui Yu, Jin Xuan, Fuding Da Bai, Yabukita. Use the plant name alone, not the finished tea name, and leave it null when more than one plant is plausible.',
    'producer is the factory, house or brand that made the tea, when the record names one: Menghai Tea Factory, Xiaguan, Zhong Cha, Dayi, Tongqinghao, Wuzhou. This is never the supplier the buyer purchased from, which is recorded separately as the vendor. Leave it null when the record only names a seller.',
    'Mark every field you filled from general knowledge rather than the record as "ai_interpretation" in validation, and leave it null when you are not confident. A blank field is better than a wrong one, but a recognisable tea should not come back blank.',
    'Do not use invoice-level totals to multiply item quantities. Treat totals only as consistency checks. For an item written as unit-price / pack-size × count = line-total, use priceBasis "per_pack", priceAmount as the unit price, and packCount as the explicit count.',
    'When RECORD_HINTS.complete is true, copy each hinted sourceItemId and evidenceRef exactly, return exactly those hinted items, and retain the hinted numeric facts. Translate and enrich the product identities yourself.',
    'Inferred supplier names are suggestions only. Use an explicit supplier hint as proposedVendorName; otherwise independently confirm that an inferred name is a supplier rather than a heading before returning it as proposedVendorName, and report vendor uncertainty when it is not confirmed.',
    'In the user-facing overview, call the submitted material a record or records, never evidence.',
    'Use only vendor and journey candidates supplied for this account. Never invent candidate ids.',
    `ACCOUNT_CANDIDATES=${JSON.stringify(providerCandidates)}`,
    `RECORD_HINTS=${JSON.stringify(recordHints)}`,
    `EVIDENCE=${JSON.stringify(evidence)}`,
  ].join('\n');
}

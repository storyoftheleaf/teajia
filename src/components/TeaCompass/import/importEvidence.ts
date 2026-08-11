import Papa from 'papaparse';
import type { CurateImportCanonicalField, CurateImportProvenanceState, CurateImportValidationState } from '../../../lib/api';

export const IMPORT_PROVENANCE_LABELS: Record<CurateImportProvenanceState, string> = {
  source_fact: 'Source fact',
  canonical_match: 'Canonical match',
  ai_interpretation: 'AI interpretation',
  user_edit: 'User edit',
  not_present: 'Not present',
  uncertain: 'Uncertain',
};
const SOURCE_FACT_FIELDS = new Set<CurateImportCanonicalField>([
  'originalName', 'chineseName', 'packWeight', 'weightUnit', 'packCount', 'priceAmountExact', 'currency',
  'priceBasis', 'lineCostExact', 'unitCostExact', 'totalQuantityGrams', 'totalUnits',
]);
const CANONICAL_IDENTITY_FIELDS = new Set<CurateImportCanonicalField>([
  'englishName', 'originalName', 'chineseName', 'category', 'type', 'classification', 'cultivar', 'producer', 'form', 'year',
  'originCountry', 'originRegion', 'description', 'processingNotes',
]);
const VALIDATION_FIELD_ALIASES: Partial<Record<CurateImportCanonicalField, string[]>> = {
  englishName: ['englishName', 'nameTranslation', 'translation'],
  priceAmountExact: ['priceAmountExact', 'priceAmount', 'price'],
  lineCostExact: ['lineCostExact', 'priceAmount', 'price'],
  unitCostExact: ['unitCostExact', 'priceAmount', 'price'],
  totalQuantityGrams: ['totalQuantityGrams', 'quantity', 'packWeight', 'packCount', 'weightUnit'],
  totalUnits: ['totalUnits', 'quantity', 'packCount', 'weightUnit'],
  disposition: ['disposition', 'acquisitionState', 'acquired'],
};
const VALIDATION_TO_PROVENANCE: Record<CurateImportValidationState, CurateImportProvenanceState> = {
  source_fact: 'source_fact',
  canonical_match: 'canonical_match',
  ai_interpretation: 'ai_interpretation',
  validated: 'ai_interpretation',
  not_present: 'not_present',
  uncertain: 'uncertain',
};

function validationProvenance(parsed: Record<string, unknown>, field: CurateImportCanonicalField) {
  const validation = parsed.validation;
  if (!validation || typeof validation !== 'object' || Array.isArray(validation)) return undefined;
  const values = validation as Record<string, unknown>;
  const aliases = VALIDATION_FIELD_ALIASES[field] ?? [field];
  for (const alias of aliases) {
    const candidate = values[alias];
    if (typeof candidate === 'string' && candidate in VALIDATION_TO_PROVENANCE) {
      return VALIDATION_TO_PROVENANCE[candidate as CurateImportValidationState];
    }
  }
  return undefined;
}

export function importSourceExcerpt(parsed: Record<string, unknown>, _legacyText: string | null | undefined): string | null {
  const excerpt = typeof parsed.sourceExcerpt === 'string' ? parsed.sourceExcerpt : null;
  return excerpt?.length ? excerpt : null;
}

export function importFieldProvenance(
  parsed: Record<string, unknown>,
  field: CurateImportCanonicalField,
  fieldValue: unknown,
  manuallyCorrectedFields: string[] = [],
): { state: CurateImportProvenanceState; label: string } {
  const normalizedCorrections = manuallyCorrectedFields.map(value => (value.split('.').at(-1) ?? value).replace(/_/g, '').toLocaleLowerCase());
  const normalizedField = field.replace(/_/g, '').toLocaleLowerCase();
  let state: CurateImportProvenanceState | undefined;
  if (normalizedCorrections.includes(normalizedField)) state = 'user_edit';
  if (!state) {
    const map = (parsed.fieldProvenance ?? parsed.provenance) as Record<string, unknown> | undefined;
    const candidate = map?.[field];
    if (typeof candidate === 'string' && candidate in IMPORT_PROVENANCE_LABELS) state = candidate as CurateImportProvenanceState;
  }
  if (!state) {
    const uncertainty = parsed.uncertainty as Record<string, unknown> | undefined;
    const snakeField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (uncertainty?.[field] || uncertainty?.[snakeField]) state = 'uncertain';
  }
  if (!state) state = validationProvenance(parsed, field);
  if (!state && (fieldValue == null || fieldValue === '')) state = 'not_present';
  if (!state && SOURCE_FACT_FIELDS.has(field)) state = 'source_fact';
  if (!state && CANONICAL_IDENTITY_FIELDS.has(field)) {
    const identityResolution = parsed.identityResolution as { kind?: unknown } | null | undefined;
    if (identityResolution?.kind === 'existing') state = 'canonical_match';
  }
  if (!state) state = 'ai_interpretation';
  return { state, label: IMPORT_PROVENANCE_LABELS[state] };
}

const rowText = (row: unknown): string => {
  if (typeof row === 'string') return row.trim();
  if (!row || typeof row !== 'object') return String(row ?? '').trim();
  return Object.values(row as Record<string, unknown>).map(value => String(value ?? '').trim()).filter(Boolean).join(' — ');
};

/** Extracts reviewable text while the original File remains the immutable evidence upload. */
export async function extractImportEvidence(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const textBearing = file.type.startsWith('text/') || ['txt', 'csv', 'json'].includes(extension || '');
  if (!textBearing) return '';
  const exact = await file.text();
  if (extension === 'csv' || file.type === 'text/csv') {
    const matrix = Papa.parse<string[]>(exact, { header: false, skipEmptyLines: true }).data;
    if (!matrix.length) return '';
    const knownHeaders = new Set(['name', 'tea', 'item', 'product', 'description', 'price', 'cost', 'weight', 'quantity', 'qty', 'type', 'category']);
    const first = matrix[0].map(value => value.trim().toLowerCase());
    const hasHeader = first.some(value => knownHeaders.has(value)) && first.every(value => !/^\d+(?:\.\d+)?$/.test(value));
    return matrix.slice(hasHeader ? 1 : 0).map(row => rowText(row)).filter(Boolean).join('\n');
  }
  if (extension === 'json' || file.type === 'application/json') {
    try {
      const parsed = JSON.parse(exact);
      return (Array.isArray(parsed) ? parsed : [parsed]).map(rowText).filter(Boolean).join('\n');
    } catch { return exact; }
  }
  return exact;
}

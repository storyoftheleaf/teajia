import taxonomy from '../data/teajia-tasting-taxonomy.json';
import cultivarStories from './stories/cultivars.json';
import { CULTIVARS } from './generated/cultivars';
import { RESEARCH_REGIONS } from './generated/regions';
import { PRODUCERS } from './generated/producers';
import { STYLES } from './generated/styles';
import { MARKS } from './generated/marks';
import { NAMED_TEAS } from './generated/namedTeas';
import type { ResearchBundle } from './research';
import type {
  PublicResearchSource,
  ResearchSource,
  WisdomCitation,
  WisdomEntryKind,
} from './types';

export type ResearchEntryRecord = object & { id: string };
export type ResearchEntryRecords = Record<WisdomEntryKind, ResearchEntryRecord[]>;

const ENTRY_KINDS: WisdomEntryKind[] = ['cultivar', 'region', 'producer', 'style', 'mark', 'namedTea'];
const PUBLIC_USAGES = new Set(['usable', 'qualified']);
const RESEARCH_SOURCE_KINDS = new Set([
  'scientific',
  'governmental',
  'institutional',
  'producer-primary',
  'specialist-retailer',
  'book',
  'other',
]);
const RESEARCH_SOURCE_TRUST = new Set(['primary', 'strong', 'qualified', 'lead-only']);
const STABLE_SOURCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DEFAULT_ENTRY_RECORDS: ResearchEntryRecords = {
  cultivar: CULTIVARS.map(entry => ({
    ...entry,
    ...(cultivarStories[entry.id as keyof typeof cultivarStories] ?? {}),
  })),
  region: RESEARCH_REGIONS,
  producer: PRODUCERS,
  style: STYLES,
  mark: MARKS,
  namedTea: NAMED_TEAS,
};

const byStableId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id);

function fieldExists(record: ResearchEntryRecord, path: string): boolean {
  let value: unknown = record;
  for (const segment of path.split('.')) {
    if (!segment || !value || typeof value !== 'object'
      || !Object.prototype.hasOwnProperty.call(value, segment)) return false;
    value = (value as Record<string, unknown>)[segment];
  }
  return value !== undefined;
}

function entryIndex(records: ResearchEntryRecords) {
  return Object.fromEntries(ENTRY_KINDS.map(kind => [
    kind,
    new Map(records[kind].map(record => [String(record.id), record])),
  ])) as Record<WisdomEntryKind, Map<string, ResearchEntryRecord>>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Returns every validation problem in deterministic order. An empty array is valid. */
export function validateResearchBundle(
  bundle: ResearchBundle,
  records: ResearchEntryRecords = DEFAULT_ENTRY_RECORDS,
): string[] {
  const errors: string[] = [];
  const entries = entryIndex(records);
  const sources = new Map<string, ResearchSource | PublicResearchSource>();
  const sourceRecords = bundle.sources
    .map((source, index) => ({ source, index }))
    .sort((left, right) => String(left.source?.id ?? '').localeCompare(String(right.source?.id ?? ''))
      || left.index - right.index);
  for (const { source, index } of sourceRecords) {
    const sourceRecord = source as unknown as Record<string, unknown>;
    const requiredFields = ['id', 'publisher', 'title', 'kind', 'accessedAt', 'trust'] as const;
    for (const field of requiredFields) {
      if (!isNonEmptyString(sourceRecord[field])) {
        errors.push(`Research source at index ${index} has invalid ${field}`);
      }
    }

    const sourceId = isNonEmptyString(sourceRecord.id) ? sourceRecord.id : '';
    const label = sourceId || `at index ${index}`;
    if (sourceId && !STABLE_SOURCE_ID.test(sourceId)) {
      errors.push(`Research source at index ${index} has invalid id ${sourceId}`);
    }
    if (isNonEmptyString(sourceRecord.kind) && !RESEARCH_SOURCE_KINDS.has(sourceRecord.kind)) {
      errors.push(`Research source ${label} has invalid kind ${sourceRecord.kind}`);
    }
    if (isNonEmptyString(sourceRecord.trust) && !RESEARCH_SOURCE_TRUST.has(sourceRecord.trust)) {
      errors.push(`Research source ${label} has invalid trust ${sourceRecord.trust}`);
    }
    if (isNonEmptyString(sourceRecord.accessedAt) && !isIsoDate(sourceRecord.accessedAt)) {
      errors.push(`Research source ${label} has invalid accessedAt ${sourceRecord.accessedAt}`);
    }
    if (sourceRecord.url !== undefined && !isHttpUrl(sourceRecord.url)) {
      errors.push(`Research source ${label} has invalid url ${String(sourceRecord.url)}`);
    }

    if (sources.has(sourceId)) errors.push(`Duplicate research source id ${sourceId}`);
    sources.set(sourceId, source);
  }

  const citations = new Map<string, WisdomCitation>();
  for (const citation of bundle.citations.slice().sort(byStableId)) {
    if (citations.has(citation.id)) errors.push(`Duplicate citation id ${citation.id}`);
    citations.set(citation.id, citation);
    const kindEntries = entries[citation.entryKind];
    const entry = kindEntries?.get(citation.entryId);
    if (!entry) {
      errors.push(`Citation ${citation.id} references unknown ${citation.entryKind} entry ${citation.entryId}`);
    } else {
      for (const field of [...citation.fields].sort()) {
        if (!fieldExists(entry, field)) {
          errors.push(`Citation ${citation.id} references unknown field ${field} on ${citation.entryKind}:${citation.entryId}`);
        }
      }
    }
    if (citation.fields.length === 0) errors.push(`Citation ${citation.id} must reference at least one field`);
    if (citation.sourceIds.length === 0) errors.push(`Citation ${citation.id} must reference at least one source`);
    for (const sourceId of [...citation.sourceIds].sort()) {
      if (!sources.has(sourceId)) errors.push(`Citation ${citation.id} references unknown source ${sourceId}`);
    }
    if (citation.usage === 'qualified' && !citation.qualification?.trim()) {
      errors.push(`Qualified citation ${citation.id} requires a qualification`);
    }
  }

  const taxonomyTerms = new Map(
    taxonomy.categories.map(category => [
      category.id,
      new Set(category.groups.flatMap(group => group.terms.map(term => term.id))),
    ]),
  );

  const profiles = bundle.potentialProfiles.slice().sort((left, right) =>
    `${left.entryKind}:${left.entryId}`.localeCompare(`${right.entryKind}:${right.entryId}`));
  for (const profile of profiles) {
    const scope = `${profile.entryKind}:${profile.entryId}`;
    if (!entries[profile.entryKind]?.has(profile.entryId)) {
      errors.push(`Potential profile ${scope} references an unknown entry`);
    }
    const tasting = profile.tasting as unknown;
    if (!tasting || typeof tasting !== 'object' || Array.isArray(tasting)) {
      errors.push(`Potential profile ${scope} tasting must be an object`);
    } else {
      for (const [categoryId, values] of Object.entries(tasting)) {
        const allowed = taxonomyTerms.get(categoryId);
        if (!allowed) {
          errors.push(`Potential profile ${scope} has unsupported tasting category ${categoryId}`);
          continue;
        }
        if (!Array.isArray(values)) {
          errors.push(`Potential profile ${scope} category ${categoryId} must be an array`);
          continue;
        }
        for (const termId of [...values].sort()) {
          if (!allowed.has(termId)) errors.push(`Potential profile ${scope} has invalid ${categoryId} id ${termId}`);
        }
      }
    }

    let hasPublicCitation = false;
    for (const citationId of [...profile.citationIds].sort()) {
      const citation = citations.get(citationId);
      if (!citation) {
        errors.push(`Potential profile ${scope} references unknown citation ${citationId}`);
        continue;
      }
      if (citation.entryKind !== profile.entryKind || citation.entryId !== profile.entryId) {
        errors.push(`Potential profile ${scope} citation ${citationId} targets ${citation.entryKind}:${citation.entryId}`);
      }
      if (citation.usage === 'held_back') {
        errors.push(`Potential profile ${scope} cannot cite held-back citation ${citationId}`);
      }
      if (PUBLIC_USAGES.has(citation.usage)) hasPublicCitation = true;
    }
    if (!hasPublicCitation) errors.push(`Potential profile ${scope} has no usable or qualified citation`);
  }

  return errors;
}

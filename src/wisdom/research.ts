import taxonomy from '../data/teajia-tasting-taxonomy.json';
import cultivarStories from './stories/cultivars.json';
import { CULTIVARS } from './generated/cultivars';
import { RESEARCH_REGIONS } from './generated/regions';
import { PRODUCERS } from './generated/producers';
import { STYLES } from './generated/styles';
import { MARKS } from './generated/marks';
import { NAMED_TEAS } from './generated/namedTeas';
import { RESEARCH_SOURCES } from './generated/researchSources';
import { WISDOM_CITATIONS } from './generated/citations';
import { WISDOM_POTENTIAL_PROFILES } from './generated/potentialProfiles';
import type {
  PublicResearchSource,
  ResearchSource,
  WisdomCitation,
  WisdomEntryKind,
  WisdomPotentialProfile,
} from './types';

export interface ResearchBundle {
  sources: ResearchSource[];
  citations: WisdomCitation[];
  potentialProfiles: WisdomPotentialProfile[];
}

export interface PublicResearchBundle {
  sources: PublicResearchSource[];
  citations: WisdomCitation[];
  potentialProfiles: WisdomPotentialProfile[];
}

export type ResearchReadableBundle = ResearchBundle | PublicResearchBundle;
export type ResearchEntryRecords = Record<WisdomEntryKind, Array<Record<string, unknown>>>;

export const RESEARCH_BUNDLE: PublicResearchBundle = {
  sources: RESEARCH_SOURCES,
  citations: WISDOM_CITATIONS,
  potentialProfiles: WISDOM_POTENTIAL_PROFILES,
};

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

function publicSource(source: ResearchSource | PublicResearchSource): PublicResearchSource {
  const { id, publisher, title, url, kind, accessedAt, publishedAt } = source;
  return { id, publisher, title, url, kind, accessedAt, publishedAt };
}

function publicCitations(bundle: ResearchReadableBundle): WisdomCitation[] {
  return bundle.citations
    .filter(citation => PUBLIC_USAGES.has(citation.usage))
    .slice()
    .sort(byStableId);
}

function selectorArguments(
  bundleOrKind: ResearchReadableBundle | WisdomEntryKind,
  kindOrId: WisdomEntryKind | string,
  maybeId?: string,
): [ResearchReadableBundle, WisdomEntryKind, string] {
  return typeof bundleOrKind === 'string'
    ? [RESEARCH_BUNDLE, bundleOrKind, kindOrId]
    : [bundleOrKind, kindOrId as WisdomEntryKind, maybeId ?? ''];
}

export function getEntryCitations(
  bundle: ResearchReadableBundle,
  entryKind: WisdomEntryKind,
  entryId: string,
): WisdomCitation[];
export function getEntryCitations(entryKind: WisdomEntryKind, entryId: string): WisdomCitation[];
export function getEntryCitations(
  bundleOrKind: ResearchReadableBundle | WisdomEntryKind,
  kindOrId: WisdomEntryKind | string,
  maybeId?: string,
): WisdomCitation[] {
  const [bundle, entryKind, entryId] = selectorArguments(bundleOrKind, kindOrId, maybeId);
  return publicCitations(bundle)
    .filter(citation => citation.entryKind === entryKind && citation.entryId === entryId);
}

export function getEntryResearchSources(
  bundle: ResearchReadableBundle,
  entryKind: WisdomEntryKind,
  entryId: string,
): PublicResearchSource[];
export function getEntryResearchSources(entryKind: WisdomEntryKind, entryId: string): PublicResearchSource[];
export function getEntryResearchSources(
  bundleOrKind: ResearchReadableBundle | WisdomEntryKind,
  kindOrId: WisdomEntryKind | string,
  maybeId?: string,
): PublicResearchSource[] {
  const [bundle, entryKind, entryId] = selectorArguments(bundleOrKind, kindOrId, maybeId);
  const sourceIds = new Set(
    getEntryCitations(bundle, entryKind, entryId).flatMap(citation => citation.sourceIds),
  );
  return bundle.sources
    .filter(source => sourceIds.has(source.id))
    .map(publicSource)
    .sort(byStableId);
}

export function getEntryPotentialProfile(
  bundle: ResearchReadableBundle,
  entryKind: WisdomEntryKind,
  entryId: string,
): WisdomPotentialProfile | null;
export function getEntryPotentialProfile(entryKind: WisdomEntryKind, entryId: string): WisdomPotentialProfile | null;
export function getEntryPotentialProfile(
  bundleOrKind: ResearchReadableBundle | WisdomEntryKind,
  kindOrId: WisdomEntryKind | string,
  maybeId?: string,
): WisdomPotentialProfile | null {
  const [bundle, entryKind, entryId] = selectorArguments(bundleOrKind, kindOrId, maybeId);
  return bundle.potentialProfiles.find(
    profile => profile.entryKind === entryKind && profile.entryId === entryId,
  ) ?? null;
}

function fieldExists(record: Record<string, unknown>, path: string): boolean {
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
  ])) as Record<WisdomEntryKind, Map<string, Record<string, unknown>>>;
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
      if (PUBLIC_USAGES.has(citation.usage)) hasPublicCitation = true;
    }
    if (!hasPublicCitation) errors.push(`Potential profile ${scope} has no usable or qualified citation`);
  }

  return errors;
}

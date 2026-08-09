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

/** Returns every validation problem in deterministic order. An empty array is valid. */
export function validateResearchBundle(
  bundle: ResearchReadableBundle,
  records: ResearchEntryRecords = DEFAULT_ENTRY_RECORDS,
): string[] {
  const errors: string[] = [];
  const entries = entryIndex(records);
  const sources = new Map<string, ResearchSource | PublicResearchSource>();
  for (const source of bundle.sources.slice().sort(byStableId)) {
    if (sources.has(source.id)) errors.push(`Duplicate research source id ${source.id}`);
    sources.set(source.id, source);
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
    for (const [categoryId, values] of Object.entries(profile.tasting)) {
      if (!Array.isArray(values)) continue;
      const allowed = taxonomyTerms.get(categoryId);
      for (const termId of [...values].sort()) {
        if (!allowed?.has(termId)) errors.push(`Potential profile ${scope} has invalid ${categoryId} id ${termId}`);
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

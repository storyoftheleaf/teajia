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

export const RESEARCH_BUNDLE: PublicResearchBundle = {
  sources: RESEARCH_SOURCES,
  citations: WISDOM_CITATIONS,
  potentialProfiles: WISDOM_POTENTIAL_PROFILES,
};

const PUBLIC_USAGES = new Set(['usable', 'qualified']);
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

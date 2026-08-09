import { resolveLineage, resolveRecord, type TeaReferenceProduct } from './productIdentity';
import {
  getEntryCitations,
  RESEARCH_BUNDLE,
  type PublicResearchBundle,
} from './research';
import type {
  PublicResearchSource,
  WisdomCitation,
  WisdomEntryKind,
  WisdomPotentialProfile,
} from './types';

export interface ProductResearchResolution {
  entryKind: WisdomEntryKind;
  entryId: string;
  profile: WisdomPotentialProfile;
  citations: WisdomCitation[];
  sources: PublicResearchSource[];
}

export function resolveProductResearch(
  product: TeaReferenceProduct,
  bundle: PublicResearchBundle = RESEARCH_BUNDLE,
): ProductResearchResolution | null {
  const record = resolveRecord(product);
  const lineage = resolveLineage(product);
  const scopes: Array<[WisdomEntryKind, string | undefined]> = [
    ['namedTea', record.namedTea?.id],
    ['producer', record.producer?.id],
    ['cultivar', lineage.cultivar?.id],
    ['region', lineage.region?.id],
    ['style', record.style?.id],
  ];

  for (const [entryKind, entryId] of scopes) {
    if (!entryId) continue;
    const profile = bundle.potentialProfiles.find(candidate =>
      candidate.entryKind === entryKind && candidate.entryId === entryId,
    );
    if (!profile) continue;

    const publicCitations = getEntryCitations(bundle, entryKind, entryId);
    const citedIds = new Set(profile.citationIds);
    const citations = publicCitations.filter(citation => citedIds.has(citation.id));
    if (citations.length === 0) continue;
    const profileSourceIds = new Set(citations.flatMap(citation => citation.sourceIds));
    const sources = bundle.sources
      .filter(source => profileSourceIds.has(source.id))
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id));

    return {
      entryKind,
      entryId,
      profile,
      citations,
      sources,
    };
  }

  return null;
}

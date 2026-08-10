/**
 * Citation-aware receiving for Tea Reference handoffs.
 *
 * This module is deliberately pure. It plans a receiving pass and returns a
 * projected in-memory state, but it has no filesystem, API, database, product,
 * inventory, approval, assimilation, or publication surface.
 */

export type ReceivingAction = 'create' | 'update' | 'no-op' | 'conflict' | 'held';
export type ReceivingResourceType = 'source' | 'citation' | 'entity' | 'fact';

export type PublisherRole =
  | 'institute'
  | 'registry'
  | 'standards_body'
  | 'academic'
  | 'archive'
  | 'producer'
  | 'trade_association'
  | 'specialist_editorial'
  | 'retailer_reseller'
  | 'community'
  | string;

export type ReferenceEntityKind =
  | 'tea_family'
  | 'tea_style'
  | 'named_tea'
  | 'cultivar'
  | 'region'
  | 'major_region'
  | 'tea_area'
  | 'mountain'
  | 'village'
  | 'locality'
  | 'producer'
  | 'factory'
  | 'brand'
  | 'mark'
  | 'recipe'
  | 'glossary_term'
  | 'taxonomy_term'
  | 'exact_lot'
  | string;

export type GeographicLevel = 'region' | 'major_region' | 'tea_area' | 'mountain' | 'village' | 'locality';
export type FactRegister =
  | 'reference'
  | 'common_characteristics'
  | 'cultivar_potential'
  | 'exact_lot_source_description'
  | 'personal_tasting';

export interface ReferenceSource {
  sourceId: string;
  publisher: string;
  publisherRole: PublisherRole;
  title: string;
  author: string;
  publishedDate: string;
  accessedDate: string;
  url: string;
}

export interface ReferenceCitation {
  citationId: string;
  sourceId: string;
  /** An audit pointer only. The evidence text itself remains outside public data. */
  evidenceId: string;
}

export interface ReferenceEntity {
  entityId: string;
  canonicalEntityId: string;
  label: string;
  sourceLabel: string;
  entityKind: ReferenceEntityKind;
  geographicLevel?: GeographicLevel;
  parentEntityId?: string;
}

export interface ReferenceFact {
  factId: string;
  entityId: string;
  field: string;
  scope: string;
  register: FactRegister;
  publicText: string;
  citationIds: string[];
}

export interface PrivateVerificationRecord {
  resourceType: 'entity' | 'fact';
  resourceId: string;
  status: 'held' | 'conflict' | 'ready_for_private_review';
  register: FactRegister | 'entity_resolution';
  reason: string;
  candidateValue?: unknown;
  evidenceIds: string[];
  sourceRoles: PublisherRole[];
}

export interface ReferenceReceivingState {
  schemaVersion: 1;
  sources: ReferenceSource[];
  citations: ReferenceCitation[];
  entities: ReferenceEntity[];
  facts: ReferenceFact[];
  verification: PrivateVerificationRecord[];
}

export interface WebsiteHandoffCitation extends ReferenceSource {
  citationId: string;
  evidenceId: string;
}

export interface WebsiteHandoffEntity {
  resolutionId: string;
  canonicalEntityId: string;
  preferredLabel: string;
  sourceLabel: string;
  entityKind: ReferenceEntityKind;
  websiteHolding: string;
  proposedAction: string;
  resolutionStatus: string;
  reason: string;
  claimIds: readonly string[];
}

export interface WebsiteHandoffClaim {
  claimId: string;
  resolutionId: string;
  canonicalEntityId: string;
  subject: string;
  entityKind: ReferenceEntityKind;
  claimScope: string;
  websiteHolding: string;
  websiteField: string;
  candidateValue: unknown;
  qualifiers: Record<string, unknown>;
  assertingPublisherRole: PublisherRole;
  compatibility: string;
  citationId: string;
  proposedAction: string;
  holdReason: string;
  payloadSha256: string;
}

export interface WebsiteHandoff {
  manifest: {
    schemaVersion: number;
    siteModel: string;
    mode: string;
    claimsSha256: string;
    sourceSnapshotSha256: string;
    entityCount: number;
    claimCount: number;
    citationCount: number;
    readyToPublishCount: number;
    heldBackCount: number;
    payloadSha256: string;
  };
  entities: readonly WebsiteHandoffEntity[];
  claims: readonly WebsiteHandoffClaim[];
  citations: readonly WebsiteHandoffCitation[];
  heldBack: ReadonlyArray<{ claimId: string; reason: string }>;
}

export interface ReceivingOperation {
  action: ReceivingAction;
  resourceType: ReceivingResourceType;
  resourceId: string;
  reason: string;
  candidate?: Partial<ReferenceSource & ReferenceCitation & ReferenceEntity & ReferenceFact>;
}

export interface PublicCitation {
  label: string;
  url: string;
}

export interface PublicReferenceStatement {
  id: string;
  label: string;
  text: string;
  excerpt?: string;
  citation: PublicCitation;
}

export interface PublicReferenceEntry {
  id: string;
  label: string;
  entityKind: ReferenceEntityKind;
  kindLabel: string;
  statements: PublicReferenceStatement[];
  reportUrl: string;
}

export interface PublicReferenceSection {
  id: string;
  label: string;
  description: string;
  entries: PublicReferenceEntry[];
}

export interface PublicReferencePreview {
  title: string;
  deck: string;
  sourceCount: number;
  entryCount: number;
  sections: PublicReferenceSection[];
  geographicScale: Array<{ id: GeographicLevel; label: string; count: number }>;
  sources: Array<{
    sourceId: string;
    publisher: string;
    publisherRoleLabel: string;
    title: string;
    author: string;
    publishedDate: string;
    url: string;
  }>;
  reportUrl: string;
}

export interface WebsiteReceivingPreview {
  manifest: {
    schemaVersion: 1;
    mode: 'preview-only';
    inputPayloadSha256: string;
    sourceSnapshotSha256: string;
  };
  summary: { create: number; update: number; noOp: number; conflict: number; held: number };
  operations: ReceivingOperation[];
  projectedState: ReferenceReceivingState;
  privateVerification: PrivateVerificationRecord[];
  publicPreview: PublicReferencePreview;
}

export interface WebsiteReceivingPublicTransport {
  manifest: {
    schemaVersion: 1;
    mode: 'preview-only';
  };
  publicPreview: PublicReferencePreview;
}

export const EMPTY_RECEIVING_STATE: ReferenceReceivingState = Object.freeze({
  schemaVersion: 1,
  sources: Object.freeze([]) as unknown as ReferenceSource[],
  citations: Object.freeze([]) as unknown as ReferenceCitation[],
  entities: Object.freeze([]) as unknown as ReferenceEntity[],
  facts: Object.freeze([]) as unknown as ReferenceFact[],
  verification: Object.freeze([]) as unknown as PrivateVerificationRecord[],
});

const GEOGRAPHIC_LEVELS = new Set<ReferenceEntityKind>([
  'region',
  'major_region',
  'tea_area',
  'mountain',
  'village',
  'locality',
]);

const ENTITY_ORDER: ReferenceEntityKind[] = [
  'tea_family',
  'tea_style',
  'taxonomy_term',
  'glossary_term',
  'major_region',
  'region',
  'tea_area',
  'mountain',
  'village',
  'locality',
  'cultivar',
  'producer',
  'factory',
  'brand',
  'mark',
  'recipe',
  'named_tea',
];

const SECTION_COPY: Record<string, { label: string; description: string }> = {
  tea_family: { label: 'Tea families', description: 'Broad tea identities, cited independently of any individual lot.' },
  tea_style: { label: 'Tea styles', description: 'Recognised processing or style identities within a tea family.' },
  taxonomy_term: { label: 'Reference terms', description: 'Language used to describe tea identity and geographic scale.' },
  glossary_term: { label: 'Reference terms', description: 'Language used to describe tea identity and geographic scale.' },
  major_region: { label: 'Major regions', description: 'Broad production regions kept distinct from their areas, mountains, and villages.' },
  region: { label: 'Regions', description: 'Tea-growing regions described at their stated geographic level.' },
  tea_area: { label: 'Tea areas', description: 'Producing areas kept distinct from mountains and villages.' },
  mountain: { label: 'Mountains', description: 'Named mountains, never collapsed into a broader region.' },
  village: { label: 'Villages', description: 'Named villages, kept separate from marketed areas and exact-lot origin.' },
  locality: { label: 'Localities', description: 'Specific localities recorded at the scale the source states.' },
};

const KIND_LABELS: Record<string, string> = {
  tea_family: 'Tea family',
  tea_style: 'Tea style',
  taxonomy_term: 'Reference term',
  glossary_term: 'Reference term',
  major_region: 'Major region',
  region: 'Region',
  tea_area: 'Tea area',
  mountain: 'Mountain',
  village: 'Village',
  locality: 'Locality',
};

const SCOPE_LABELS: Record<string, string> = {
  identity: 'Identity',
  geography: 'Geography',
  historical: 'History',
  legal: 'Definition',
  cultivar_potential: 'Potential characteristics',
  common_characteristics: 'Common characteristics',
  processing: 'Processing',
  storage: 'Storage',
  brewing: 'Brewing',
};

const ROLE_LABELS: Record<string, string> = {
  institute: 'Institute',
  registry: 'Registry',
  standards_body: 'Standards body',
  academic: 'Academic',
  archive: 'Archive',
  producer: 'Producer',
  trade_association: 'Trade association',
  specialist_editorial: 'Specialist editorial',
  retailer_reseller: 'Retailer or reseller',
  community: 'Independent commentary',
};

function cloneState(state: ReferenceReceivingState): ReferenceReceivingState {
  return {
    schemaVersion: 1,
    sources: state.sources.map(source => ({ ...source })),
    citations: state.citations.map(citation => ({ ...citation })),
    entities: state.entities.map(entity => ({ ...entity })),
    facts: state.facts.map(fact => ({ ...fact, citationIds: [...fact.citationIds] })),
    verification: state.verification.map(record => ({ ...record, evidenceIds: [...record.evidenceIds], sourceRoles: [...record.sourceRoles] })),
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function same(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right);
}

function sourceFromCitation(citation: WebsiteHandoffCitation): ReferenceSource {
  return {
    sourceId: citation.sourceId,
    publisher: citation.publisher,
    publisherRole: citation.publisherRole,
    title: citation.title,
    author: citation.author,
    publishedDate: citation.publishedDate,
    accessedDate: citation.accessedDate,
    url: citation.url,
  };
}

function uniqueSources(citations: readonly WebsiteHandoffCitation[]): ReferenceSource[] {
  const sources = new Map<string, ReferenceSource>();
  for (const citation of [...citations].sort((left, right) => left.citationId.localeCompare(right.citationId))) {
    const source = sourceFromCitation(citation);
    const prior = sources.get(source.sourceId);
    if (!prior) sources.set(source.sourceId, source);
    else if (!same(prior, source)) {
      throw new Error(`Source metadata differs within one handoff: ${source.sourceId}`);
    }
  }
  return [...sources.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

function factRegister(claim: WebsiteHandoffClaim): FactRegister {
  if (claim.claimScope === 'personal_tasting') return 'personal_tasting';
  if (claim.claimScope === 'exact_lot' || claim.entityKind === 'exact_lot') return 'exact_lot_source_description';
  if (claim.claimScope === 'common_characteristics') return 'common_characteristics';
  if (claim.claimScope === 'cultivar_potential') return 'cultivar_potential';
  return 'reference';
}

function entityCandidate(entity: WebsiteHandoffEntity): ReferenceEntity {
  return {
    entityId: entity.resolutionId,
    canonicalEntityId: entity.canonicalEntityId,
    label: entity.preferredLabel || entity.sourceLabel,
    sourceLabel: entity.sourceLabel,
    entityKind: entity.entityKind,
    ...(GEOGRAPHIC_LEVELS.has(entity.entityKind) ? { geographicLevel: entity.entityKind as GeographicLevel } : {}),
  };
}

function reportUrl(subject: string): string {
  return `mailto:hello@teajia.com?subject=${encodeURIComponent(`Report an inaccuracy: ${subject}`)}`;
}

function publishedYear(value: string): string {
  return /^\d{4}/.test(value) ? value.slice(0, 4) : '';
}

function citationLabel(source: ReferenceSource): string {
  const details = [source.title, publishedYear(source.publishedDate)].filter(Boolean).join(' (').replace(/\((\d{4})$/, '($1)');
  return [source.publisher, details].filter(Boolean).join(', ');
}

function minimalExcerpt(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < 24 || /[\u3400-\u9fff]/u.test(text)) return undefined;
  if (text.length <= 150) return text;
  const clipped = text.slice(0, 147).replace(/\s+\S*$/, '').replace(/[\s,.;:]+$/, '');
  return `${clipped}…`;
}

function ordinaryReferenceText(claim: WebsiteHandoffClaim): string {
  switch (claim.claimScope) {
    case 'common_characteristics':
      return `One cited source describes characteristics associated with ${claim.subject}. These are broad reference notes, not a description of any particular lot.`;
    case 'cultivar_potential':
      return `The cited source describes potential characteristics associated with ${claim.subject}. Expression still depends on growing and making conditions.`;
    case 'geography':
      return `The cited source discusses the place of ${claim.subject} within Pu’er geography.`;
    case 'historical':
      return `The cited source records historical context for ${claim.subject}.`;
    case 'processing':
      return `The cited source discusses processing language associated with ${claim.subject}.`;
    case 'storage':
      return `The cited source discusses storage context associated with ${claim.subject}.`;
    case 'identity':
      return `The cited source discusses how ${claim.subject} is named and understood.`;
    default:
      return `The cited source records reference context for ${claim.subject}.`;
  }
}

function publicPreviewFor(
  handoff: WebsiteHandoff,
  sources: ReferenceSource[],
  excludedSourceIds: ReadonlySet<string>,
  excludedCitationIds: ReadonlySet<string>,
): PublicReferencePreview {
  const citations = new Map(handoff.citations.map(citation => [citation.citationId, citation]));
  const sourceIndex = new Map(sources.map(source => [source.sourceId, source]));
  const entries = [...handoff.entities]
    .sort((left, right) => {
      const kind = ENTITY_ORDER.indexOf(left.entityKind) - ENTITY_ORDER.indexOf(right.entityKind);
      return kind || (left.preferredLabel || left.sourceLabel).localeCompare(right.preferredLabel || right.sourceLabel);
    })
    .map(entity => {
      const statements: PublicReferenceStatement[] = [];
      const seenScopes = new Set<string>();
      const claims = handoff.claims
        .filter(claim => claim.resolutionId === entity.resolutionId || entity.claimIds.includes(claim.claimId))
        .filter(claim => !['exact_lot', 'personal_tasting'].includes(claim.claimScope) && claim.entityKind !== 'exact_lot')
        .filter(claim => {
          const citation = citations.get(claim.citationId);
          return !excludedCitationIds.has(claim.citationId) && Boolean(citation) && !excludedSourceIds.has(citation?.sourceId || '');
        })
        .sort((left, right) => left.claimId.localeCompare(right.claimId));
      for (const claim of claims) {
        if (seenScopes.has(claim.claimScope) || statements.length >= 4) continue;
        const citation = citations.get(claim.citationId);
        const source = citation ? sourceIndex.get(citation.sourceId) : undefined;
        if (!citation || !source?.url) continue;
        seenScopes.add(claim.claimScope);
        const excerpt = minimalExcerpt(claim.candidateValue);
        statements.push({
          id: claim.claimId,
          label: SCOPE_LABELS[claim.claimScope] || 'Reference note',
          text: ordinaryReferenceText(claim),
          ...(excerpt ? { excerpt } : {}),
          citation: { label: citationLabel(source), url: source.url },
        });
      }
      const label = entity.preferredLabel || entity.sourceLabel;
      return {
        id: entity.resolutionId,
        label,
        entityKind: entity.entityKind,
        kindLabel: KIND_LABELS[entity.entityKind] || 'Reference entry',
        statements,
        reportUrl: reportUrl(label),
      } satisfies PublicReferenceEntry;
    });

  const sectionMap = new Map<string, PublicReferenceEntry[]>();
  for (const entry of entries) {
    const sectionId = entry.entityKind === 'glossary_term' ? 'taxonomy_term' : entry.entityKind;
    if (!sectionMap.has(sectionId)) sectionMap.set(sectionId, []);
    sectionMap.get(sectionId)?.push(entry);
  }
  const sectionOrder = ENTITY_ORDER.map(kind => kind === 'glossary_term' ? 'taxonomy_term' : kind)
    .filter((kind, index, all) => all.indexOf(kind) === index);
  const sections = sectionOrder
    .map(id => {
      const sectionEntries = sectionMap.get(id) || [];
      const copy = SECTION_COPY[id];
      return copy && sectionEntries.length > 0 ? { id, ...copy, entries: sectionEntries } : null;
    })
    .filter((section): section is PublicReferenceSection => Boolean(section));

  const geographicScale: PublicReferencePreview['geographicScale'] = [
    { id: 'major_region', label: 'Major regions', count: entries.filter(entry => entry.entityKind === 'major_region').length },
    { id: 'tea_area', label: 'Tea areas', count: entries.filter(entry => entry.entityKind === 'tea_area').length },
    { id: 'mountain', label: 'Mountains', count: entries.filter(entry => entry.entityKind === 'mountain').length },
    { id: 'village', label: 'Villages', count: entries.filter(entry => entry.entityKind === 'village').length },
  ];

  return {
    title: 'Pu’er reference',
    deck: 'A cited guide to tea families, styles, terminology, and growing places.',
    sourceCount: sources.length,
    entryCount: entries.length,
    sections,
    geographicScale,
    sources: sources.map(source => ({
      sourceId: source.sourceId,
      publisher: source.publisher,
      publisherRoleLabel: ROLE_LABELS[source.publisherRole] || source.publisherRole.replace(/_/g, ' '),
      title: source.title,
      author: source.author,
      publishedDate: source.publishedDate,
      url: source.url,
    })),
    reportUrl: reportUrl('Tea Reference'),
  };
}

function operationOrder(left: ReceivingOperation, right: ReceivingOperation): number {
  const resourceOrder: ReceivingResourceType[] = ['source', 'citation', 'entity', 'fact'];
  const resource = resourceOrder.indexOf(left.resourceType) - resourceOrder.indexOf(right.resourceType);
  if (resource) return resource;
  if (left.resourceType === 'entity' && right.resourceType === 'entity') {
    const leftKind = left.candidate?.entityKind || '';
    const rightKind = right.candidate?.entityKind || '';
    const kind = ENTITY_ORDER.indexOf(leftKind) - ENTITY_ORDER.indexOf(rightKind);
    if (kind) return kind;
  }
  return left.resourceId.localeCompare(right.resourceId);
}

function validateHandoff(handoff: WebsiteHandoff): void {
  if (!handoff || typeof handoff !== 'object') throw new Error('Website handoff must be an object');
  if (handoff.manifest?.schemaVersion !== 1) throw new Error('Website handoff schemaVersion must be 1');
  if (handoff.manifest?.mode !== 'preview-only') throw new Error('Website handoff must be preview-only');
  for (const key of ['entities', 'claims', 'citations', 'heldBack'] as const) {
    if (!Array.isArray(handoff[key])) throw new Error(`Website handoff ${key} must be an array`);
  }
  if (handoff.manifest.entityCount !== handoff.entities.length) throw new Error('Website handoff entity count does not match its manifest');
  if (handoff.manifest.claimCount !== handoff.claims.length) throw new Error('Website handoff claim count does not match its manifest');
  if (handoff.manifest.citationCount !== handoff.citations.length) throw new Error('Website handoff citation count does not match its manifest');
  if (handoff.manifest.heldBackCount !== handoff.heldBack.length) throw new Error('Website handoff held count does not match its manifest');

  const entityIds = new Set<string>();
  for (const entity of handoff.entities) {
    if (entityIds.has(entity.resolutionId)) throw new Error(`Duplicate entity resolution: ${entity.resolutionId}`);
    entityIds.add(entity.resolutionId);
  }
  const citationIds = new Set<string>();
  for (const citation of handoff.citations) {
    if (citationIds.has(citation.citationId)) throw new Error(`Duplicate citation: ${citation.citationId}`);
    citationIds.add(citation.citationId);
  }
  const claimIds = new Set<string>();
  for (const claim of handoff.claims) {
    if (claimIds.has(claim.claimId)) throw new Error(`Duplicate claim: ${claim.claimId}`);
    if (!citationIds.has(claim.citationId)) throw new Error(`Claim ${claim.claimId} has a missing citation: ${claim.citationId}`);
    if (!entityIds.has(claim.resolutionId)) throw new Error(`Claim ${claim.claimId} has a missing entity resolution: ${claim.resolutionId}`);
    claimIds.add(claim.claimId);
  }
}

const FORBIDDEN_PUBLIC_KEYS = new Set([
  'evidenceId',
  'evidenceIds',
  'candidateValue',
  'reason',
  'status',
  'operations',
  'verification',
  'privateVerification',
  'projectedState',
  'holdReason',
]);

const FORBIDDEN_PUBLIC_MARKER = /(?:^|[^a-z0-9])(?:exact[ _-]lot|personal[ _-]tasting)(?:[^a-z0-9]|$)/i;

function validatePublicProjection(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_PUBLIC_MARKER.test(value)) throw new Error('Unsafe public preview: forbidden private marker');
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) throw new Error('Unsafe public preview: repeated or cyclic object');
  seen.add(value);
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(key) || /sha256$/i.test(key) || FORBIDDEN_PUBLIC_MARKER.test(key)) {
      throw new Error(`Unsafe public preview: forbidden private key ${key}`);
    }
    validatePublicProjection(entry, seen);
  }
}

export function publicTransportFor(preview: WebsiteReceivingPreview): WebsiteReceivingPublicTransport {
  validatePublicProjection(preview.publicPreview);
  return {
    manifest: { schemaVersion: 1, mode: 'preview-only' },
    publicPreview: structuredClone(preview.publicPreview),
  };
}

export function previewWebsiteHandoff(
  handoff: WebsiteHandoff,
  currentState: ReferenceReceivingState = EMPTY_RECEIVING_STATE,
): WebsiteReceivingPreview {
  validateHandoff(handoff);
  const projectedState = cloneState(currentState);
  const sources = uniqueSources(handoff.citations);
  const operations: ReceivingOperation[] = [];
  const verification: PrivateVerificationRecord[] = [];

  const currentSources = new Map(projectedState.sources.map(source => [source.sourceId, source]));
  for (const source of sources) {
    const current = currentSources.get(source.sourceId);
    let action: ReceivingAction = 'create';
    let reason = 'Source metadata is new to the receiving snapshot.';
    if (current && (current.url !== source.url || current.publisherRole !== source.publisherRole)) {
      action = 'conflict';
      reason = 'Source identity changed: URL or publisher role differs from the receiving snapshot.';
    } else if (current && same(current, source)) {
      action = 'no-op';
      reason = 'Source metadata is unchanged.';
    } else if (current) {
      action = 'update';
      reason = 'Source metadata changed without changing source identity.';
    }
    operations.push({ action, resourceType: 'source', resourceId: source.sourceId, reason, candidate: source });
    if (action === 'create') projectedState.sources.push(source);
    if (action === 'update') projectedState.sources = projectedState.sources.map(entry => entry.sourceId === source.sourceId ? source : entry);
  }

  const currentCitations = new Map(projectedState.citations.map(citation => [citation.citationId, citation]));
  for (const input of [...handoff.citations].sort((left, right) => left.citationId.localeCompare(right.citationId))) {
    const citation: ReferenceCitation = { citationId: input.citationId, sourceId: input.sourceId, evidenceId: input.evidenceId };
    const current = currentCitations.get(citation.citationId);
    const action: ReceivingAction = !current ? 'create' : same(current, citation) ? 'no-op' : 'conflict';
    const reason = action === 'create'
      ? 'Citation pointer is new to the receiving snapshot.'
      : action === 'no-op'
        ? 'Citation pointer is unchanged.'
        : 'Citation identity is immutable and points to different source evidence.';
    operations.push({ action, resourceType: 'citation', resourceId: citation.citationId, reason, candidate: citation });
    if (action === 'create') projectedState.citations.push(citation);
  }

  const citations = new Map(handoff.citations.map(citation => [citation.citationId, citation]));
  for (const input of [...handoff.entities].sort((left, right) => left.resolutionId.localeCompare(right.resolutionId))) {
    const candidate = entityCandidate(input);
    const geographicGap = candidate.geographicLevel && !candidate.parentEntityId;
    const reason = geographicGap
      ? `The ${candidate.geographicLevel} level has no verified parent entity in the handoff; it cannot be flattened into a generic region.`
      : input.reason || 'Entity mapping requires private verification.';
    operations.push({ action: 'held', resourceType: 'entity', resourceId: candidate.entityId, reason, candidate });
    verification.push({
      resourceType: 'entity',
      resourceId: candidate.entityId,
      status: 'held',
      register: 'entity_resolution',
      reason,
      candidateValue: candidate,
      evidenceIds: [],
      sourceRoles: [],
    });
  }

  for (const claim of [...handoff.claims].sort((left, right) => left.claimId.localeCompare(right.claimId))) {
    const register = factRegister(claim);
    const citation = citations.get(claim.citationId);
    const sourceRole = claim.assertingPublisherRole || citation?.publisherRole || '';
    const producerRoleViolation = ['producer', 'factory', 'brand'].includes(claim.entityKind)
      && sourceRole === 'retailer_reseller';
    let reason = claim.holdReason || 'Fact requires private verification.';
    if (register === 'personal_tasting') reason = 'Source capture cannot create personal tasting.';
    if (register === 'exact_lot_source_description') reason = 'Exact-lot source description stays with its exact lot, outside shared Tea Reference facts.';
    if (producerRoleViolation) reason = 'A retailer or reseller cannot establish producer, factory, or brand identity by being the publisher.';
    const candidate: Partial<ReferenceFact> = {
      factId: claim.claimId,
      entityId: claim.resolutionId,
      field: claim.websiteField,
      scope: claim.claimScope,
      register,
      citationIds: [claim.citationId],
    };
    operations.push({ action: 'held', resourceType: 'fact', resourceId: claim.claimId, reason, candidate });
    verification.push({
      resourceType: 'fact',
      resourceId: claim.claimId,
      status: 'held',
      register,
      reason,
      candidateValue: claim.candidateValue,
      evidenceIds: citation?.evidenceId ? [citation.evidenceId] : [],
      sourceRoles: sourceRole ? [sourceRole] : [],
    });
  }

  operations.sort(operationOrder);
  projectedState.sources.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  projectedState.citations.sort((left, right) => left.citationId.localeCompare(right.citationId));
  verification.sort((left, right) => left.resourceType.localeCompare(right.resourceType) || left.resourceId.localeCompare(right.resourceId));
  const projectedVerification = new Map(
    projectedState.verification.map(record => [`${record.resourceType}:${record.resourceId}`, record]),
  );
  for (const record of verification) projectedVerification.set(`${record.resourceType}:${record.resourceId}`, record);
  projectedState.verification = [...projectedVerification.values()]
    .sort((left, right) => left.resourceType.localeCompare(right.resourceType) || left.resourceId.localeCompare(right.resourceId));

  const summary = { create: 0, update: 0, noOp: 0, conflict: 0, held: 0 };
  for (const operation of operations) {
    if (operation.action === 'no-op') summary.noOp += 1;
    else summary[operation.action] += 1;
  }

  const excludedSourceIds = new Set(
    operations.filter(operation => operation.resourceType === 'source' && operation.action === 'conflict')
      .map(operation => operation.resourceId),
  );
  const excludedCitationIds = new Set(
    operations.filter(operation => operation.resourceType === 'citation' && operation.action === 'conflict')
      .map(operation => operation.resourceId),
  );
  const publicSources = sources.filter(source => !excludedSourceIds.has(source.sourceId));

  return {
    manifest: {
      schemaVersion: 1,
      mode: 'preview-only',
      inputPayloadSha256: handoff.manifest.payloadSha256,
      sourceSnapshotSha256: handoff.manifest.sourceSnapshotSha256,
    },
    summary,
    operations,
    projectedState,
    privateVerification: verification,
    publicPreview: publicPreviewFor(handoff, publicSources, excludedSourceIds, excludedCitationIds),
  };
}

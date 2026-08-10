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
  parentEntityId?: string;
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
    /** Opaque provenance from the capture package; the website handoff cannot reconstruct it. */
    claimsSha256: OpaqueProvenanceSha256;
    /** Opaque provenance from the source snapshot; the website handoff cannot reconstruct it. */
    sourceSnapshotSha256: OpaqueProvenanceSha256;
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

type OpaqueProvenanceSha256 = string;

export interface ReceivingOperation {
  action: ReceivingAction;
  resourceType: ReceivingResourceType;
  resourceId: string;
  reason: string;
  candidate?: Partial<ReferenceSource & ReferenceCitation & ReferenceEntity & ReferenceFact>;
}

export interface PublicCitation {
  sourceId: string;
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
  parentId?: string;
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

export interface WebsiteExactEvidence {
  evidenceId: string;
  sourceId: string;
  exact: string;
  heading: string;
  section: string;
  page: number | string | null;
  start: number;
  end: number;
  prefix: string;
  suffix: string;
  excerptSha256: string;
  extractorVersion: string;
  confidence: number | null;
}

export interface PrivateReviewProduct {
  id: string;
  givenName: string;
  productName: string;
  type: string;
  year?: number;
  originCountry: string;
  originRegion: string;
  status: string;
}

export interface PrivateReviewEvidence {
  evidenceId: string;
  exact: string;
  heading: string;
  section: string;
  page: number | string | null;
  prefix: string;
  suffix: string;
  citation: {
    citationId: string;
    sourceId: string;
    publisher: string;
    publisherRole: PublisherRole;
    title: string;
    author: string;
    publishedDate: string;
    url: string;
  };
}

export interface PrivateReviewHierarchyNode {
  resourceId: string;
  label: string;
  entityKind: ReferenceEntityKind;
}

export interface PrivateReviewHierarchy {
  level?: GeographicLevel;
  parent?: PrivateReviewHierarchyNode;
  children: PrivateReviewHierarchyNode[];
  issue?: string;
}

export interface PrivateReviewProductCandidate {
  productId: string;
  label: string;
  type: string;
  year?: number;
  originCountry: string;
  originRegion: string;
  status: string;
  matchBasis: string[];
}

export interface PrivateReviewItem {
  resourceType: 'entity' | 'fact';
  resourceId: string;
  status: 'held' | 'conflict';
  subject: string;
  entityKind: ReferenceEntityKind;
  websiteHolding: string;
  reviewReason: string;
  field?: string;
  scope?: string;
  candidateValue?: unknown;
  proposedPublicWording?: string;
  hierarchy: PrivateReviewHierarchy;
  evidence: PrivateReviewEvidence[];
  productReview: {
    matchTerms: string[];
    candidates: PrivateReviewProductCandidate[];
  };
}

export interface WebsiteReceivingPrivateReview {
  manifest: {
    schemaVersion: 1;
    mode: 'private-review';
  };
  summary: { entities: number; facts: number };
  items: PrivateReviewItem[];
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

const PUBLIC_ENTITY_KINDS = new Set<ReferenceEntityKind>([
  'tea_family', 'tea_style', 'region', 'major_region', 'tea_area', 'mountain',
  'village', 'locality',
]);
// Mirrored from scripts/tea-reference-capture/schema.mjs and the destination
// vocabulary in website-handoff.mjs. Keep this browser-safe receiver independent
// of the capture package's Node-side module graph; contract regressions cover it.
const ENTITY_KINDS = new Set<ReferenceEntityKind>([
  ...PUBLIC_ENTITY_KINDS, 'named_tea', 'cultivar', 'producer', 'factory', 'brand',
  'mark', 'recipe', 'glossary_term', 'taxonomy_term', 'exact_lot',
  'germplasm_accession', 'recognized_garden', 'recognized_tree',
]);
const PUBLISHER_ROLES = new Set<PublisherRole>([
  'institute', 'registry', 'standards_body', 'academic', 'archive', 'producer',
  'trade_association', 'specialist_editorial', 'retailer_reseller', 'community',
]);
const FACT_REGISTERS = new Set<FactRegister>([
  'reference', 'common_characteristics', 'cultivar_potential',
  'exact_lot_source_description', 'personal_tasting',
]);
const PUBLIC_FACT_REGISTERS = new Set<FactRegister>([
  'reference', 'common_characteristics', 'cultivar_potential',
]);
const CLAIM_SCOPES = new Set([
  'identity', 'geography', 'historical', 'legal', 'cultivar_potential',
  'common_characteristics', 'processing', 'storage', 'brewing', 'exact_lot',
  'personal_tasting', 'relationship',
]);
const PUBLIC_CLAIM_SCOPES = new Set([
  'identity', 'geography', 'historical', 'legal', 'cultivar_potential',
  'common_characteristics', 'processing', 'storage', 'brewing',
]);
const WEBSITE_FIELDS = new Set([
  'description', 'commonCharacteristics', 'history', 'processing', 'storage',
  'brewing', 'sourceDescription', 'personalTasting', 'definition',
  'potentialProfile', 'relationships',
]);
const PUBLIC_WEBSITE_FIELDS = new Set([
  'description', 'commonCharacteristics', 'history', 'processing', 'storage', 'brewing',
]);
const WEBSITE_HOLDINGS = new Set([
  'vocabulary', 'namedTeas', 'styles', 'cultivars', 'regions', 'producers',
  'marks', 'glossary', 'newHolding', 'none',
]);
const COMPATIBILITY_STATUSES = new Set(['compatible', 'requires_model_extension', 'prohibited']);
const ENTITY_RESOLUTION_STATUSES = new Set([
  'resolved', 'private_verification', 'duplicate_candidate', 'hold_unresolved', 'conflict',
]);
const PROPOSED_ACTIONS = new Set(['create', 'update', 'no-op', 'hold', 'conflict']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

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
    facts: state.facts.map(fact => ({ ...fact, citationIds: [...fact.citationIds].sort(codepointCompare) })),
    verification: state.verification.map(record => ({
      ...record,
      evidenceIds: [...record.evidenceIds].sort(codepointCompare),
      sourceRoles: [...record.sourceRoles].sort(codepointCompare),
    })),
  };
}

function codepointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON does not permit non-finite numbers');
    return value;
  }
  if (Array.isArray(value)) return value.map(item => canonicalValue(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter(key => (value as Record<string, unknown>)[key] !== undefined)
        .sort(codepointCompare)
        .map(key => [key, canonicalValue((value as Record<string, unknown>)[key])]),
    );
  }
  throw new Error(`Unsupported canonical JSON value: ${typeof value}`);
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/** Browser-safe synchronous SHA-256 used only for bounded preview handoff integrity. */
function sha256(value: string): string {
  const input = new TextEncoder().encode(value);
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + constants[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map(word => word.toString(16).padStart(8, '0')).join('');
}

export function canonicalPayloadSha256(
  handoff: Pick<WebsiteHandoff, 'entities' | 'claims' | 'citations' | 'heldBack'>,
): string {
  return sha256(JSON.stringify(canonicalValue({
    entities: handoff.entities,
    claims: handoff.claims,
    citations: handoff.citations,
    heldBack: handoff.heldBack,
  })));
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => codepointCompare(left, right))
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
  for (const citation of [...citations].sort((left, right) => codepointCompare(left.citationId, right.citationId))) {
    const source = sourceFromCitation(citation);
    const prior = sources.get(source.sourceId);
    if (!prior) sources.set(source.sourceId, source);
    else if (!same(prior, source)) {
      throw new Error(`Source metadata differs within one handoff: ${source.sourceId}`);
    }
  }
  return [...sources.values()].sort((left, right) => codepointCompare(left.sourceId, right.sourceId));
}

function factRegister(claim: WebsiteHandoffClaim): FactRegister {
  if (claim.claimScope === 'personal_tasting') return 'personal_tasting';
  if (claim.claimScope === 'exact_lot' || claim.entityKind === 'exact_lot') return 'exact_lot_source_description';
  if (claim.claimScope === 'common_characteristics') return 'common_characteristics';
  if (claim.claimScope === 'cultivar_potential') return 'cultivar_potential';
  return 'reference';
}

function entityCandidate(
  entity: WebsiteHandoffEntity,
  parentIds: ReadonlyMap<string, string>,
): ReferenceEntity {
  return {
    entityId: entity.resolutionId,
    canonicalEntityId: entity.canonicalEntityId,
    label: entity.preferredLabel || entity.sourceLabel,
    sourceLabel: entity.sourceLabel,
    entityKind: entity.entityKind,
    ...(GEOGRAPHIC_LEVELS.has(entity.entityKind) ? { geographicLevel: entity.entityKind as GeographicLevel } : {}),
    ...(parentIds.has(entity.resolutionId) ? { parentEntityId: parentIds.get(entity.resolutionId) } : {}),
  };
}

interface ParentResolution {
  parentIds: Map<string, string>;
  unsafeEntityReasons: Map<string, string>;
}

function resolvedParentEntityIds(entities: readonly WebsiteHandoffEntity[]): ParentResolution {
  const entityByResolutionId = new Map(entities.map(entity => [entity.resolutionId, entity]));
  const resolutionByEntityId = new Map<string, string>();
  for (const entity of entities) {
    const identifiers = [entity.resolutionId, entity.canonicalEntityId.trim()].filter(Boolean);
    for (const identifier of identifiers) {
      const existing = resolutionByEntityId.get(identifier);
      if (existing && existing !== entity.resolutionId) {
        throw new Error(`Entity identifier resolves to more than one entity: ${identifier}`);
      }
      resolutionByEntityId.set(identifier, entity.resolutionId);
    }
  }

  const parentIds = new Map<string, string>();
  const unsafeEntityReasons = new Map<string, string>();
  for (const entity of entities) {
    if (entity.parentEntityId === undefined) continue;
    const parentEntityId = entity.parentEntityId.trim();
    if (!parentEntityId) {
      unsafeEntityReasons.set(entity.resolutionId, `Entity ${entity.resolutionId} has a blank parent entity ID.`);
      continue;
    }
    const parentResolutionId = resolutionByEntityId.get(parentEntityId);
    if (!parentResolutionId) {
      unsafeEntityReasons.set(entity.resolutionId, `Entity ${entity.resolutionId} has an unresolved parent entity ID: ${parentEntityId}.`);
      continue;
    }
    if (parentResolutionId === entity.resolutionId) {
      unsafeEntityReasons.set(entity.resolutionId, `Entity ${entity.resolutionId} cannot reference itself as its parent.`);
      continue;
    }
    const parent = entityByResolutionId.get(parentResolutionId)!;
    const geographicRank: Record<GeographicLevel, number> = {
      region: 0,
      major_region: 0,
      tea_area: 1,
      mountain: 2,
      village: 3,
      locality: 4,
    };
    if (GEOGRAPHIC_LEVELS.has(entity.entityKind)) {
      const childRank = geographicRank[entity.entityKind as GeographicLevel];
      const parentRank = GEOGRAPHIC_LEVELS.has(parent.entityKind)
        ? geographicRank[parent.entityKind as GeographicLevel]
        : -1;
      if (parentRank < 0 || parentRank >= childRank) {
        unsafeEntityReasons.set(entity.resolutionId, `Entity ${entity.resolutionId} has an incompatible geographic parent.`);
        continue;
      }
    } else if (entity.entityKind === 'tea_style' && parent.entityKind !== 'tea_family') {
      unsafeEntityReasons.set(entity.resolutionId, `Entity ${entity.resolutionId} has an incompatible tea-style parent.`);
      continue;
    }
    parentIds.set(entity.resolutionId, parentResolutionId);
  }

  for (const start of parentIds.keys()) {
    const path: string[] = [];
    const position = new Map<string, number>();
    let current: string | undefined = start;
    while (current && parentIds.has(current)) {
      const cycleStart = position.get(current);
      if (cycleStart !== undefined) {
        for (const entityId of path.slice(cycleStart)) {
          unsafeEntityReasons.set(entityId, `Entity ${entityId} belongs to a cyclic parent hierarchy.`);
          parentIds.delete(entityId);
        }
        break;
      }
      position.set(current, path.length);
      path.push(current);
      current = parentIds.get(current);
    }
  }
  return { parentIds, unsafeEntityReasons };
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

function normalizedReviewText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function reviewTextContains(value: string, term: string): boolean {
  const haystack = normalizedReviewText(value);
  const needle = normalizedReviewText(term);
  return Boolean(needle) && ` ${haystack} `.includes(` ${needle} `);
}

function productReviewFor(
  subject: string,
  products: readonly PrivateReviewProduct[],
): PrivateReviewItem['productReview'] {
  const matchTerms = [subject.trim()].filter(Boolean);
  const searchableFields: Array<keyof Pick<PrivateReviewProduct, 'givenName' | 'productName' | 'type' | 'originCountry' | 'originRegion'>> = [
    'givenName', 'productName', 'type', 'originCountry', 'originRegion',
  ];
  const candidates = products.flatMap(product => {
    const matchBasis = searchableFields.filter(field => (
      matchTerms.some(term => reviewTextContains(product[field], term))
    ));
    if (matchBasis.length === 0) return [];
    return [{
      productId: product.id,
      label: product.givenName || product.productName || product.id,
      type: product.type,
      ...(product.year === undefined ? {} : { year: product.year }),
      originCountry: product.originCountry,
      originRegion: product.originRegion,
      status: product.status,
      matchBasis,
    }];
  }).sort((left, right) => codepointCompare(left.productId, right.productId));
  return { matchTerms, candidates };
}

function hierarchyForReview(
  entity: WebsiteHandoffEntity,
  entitiesById: ReadonlyMap<string, WebsiteHandoffEntity>,
  parentIds: ReadonlyMap<string, string>,
  unsafeEntityReasons: ReadonlyMap<string, string>,
): PrivateReviewHierarchy {
  const nodeFor = (candidate: WebsiteHandoffEntity): PrivateReviewHierarchyNode => ({
    resourceId: candidate.resolutionId,
    label: candidate.preferredLabel || candidate.sourceLabel,
    entityKind: candidate.entityKind,
  });
  const parentId = parentIds.get(entity.resolutionId);
  const parent = parentId ? entitiesById.get(parentId) : undefined;
  const children = [...parentIds.entries()]
    .filter(([, candidateParentId]) => candidateParentId === entity.resolutionId)
    .map(([childId]) => entitiesById.get(childId))
    .filter((child): child is WebsiteHandoffEntity => Boolean(child))
    .map(nodeFor)
    .sort((left, right) => codepointCompare(left.resourceId, right.resourceId));
  return {
    ...(GEOGRAPHIC_LEVELS.has(entity.entityKind) ? { level: entity.entityKind as GeographicLevel } : {}),
    ...(parent ? { parent: nodeFor(parent) } : {}),
    children,
    ...(unsafeEntityReasons.has(entity.resolutionId)
      ? { issue: unsafeEntityReasons.get(entity.resolutionId)! }
      : {}),
  };
}

export function privateReviewFor({
  handoff,
  preview,
  evidence,
  products,
}: {
  handoff: WebsiteHandoff;
  preview: WebsiteReceivingPreview;
  evidence: readonly WebsiteExactEvidence[];
  products: readonly PrivateReviewProduct[];
}): WebsiteReceivingPrivateReview {
  validateHandoff(handoff);
  const evidenceById = new Map<string, WebsiteExactEvidence>();
  for (const item of [...evidence].sort((left, right) => codepointCompare(left.evidenceId, right.evidenceId))) {
    requireId(item.evidenceId, 'Private review evidenceId');
    requireId(item.sourceId, `Private review evidence ${item.evidenceId} sourceId`);
    requireEvidenceText(item.exact, `Private review evidence ${item.evidenceId} exact`);
    if (evidenceById.has(item.evidenceId)) throw new Error(`Duplicate private review exact evidence: ${item.evidenceId}`);
    evidenceById.set(item.evidenceId, item);
  }

  const operationsByResource = new Map(
    preview.operations
      .filter(operation => operation.resourceType === 'entity' || operation.resourceType === 'fact')
      .map(operation => [`${operation.resourceType}:${operation.resourceId}`, operation]),
  );
  const citationsById = new Map(handoff.citations.map(citation => [citation.citationId, citation]));
  const claimsById = new Map(handoff.claims.map(claim => [claim.claimId, claim]));
  const entitiesById = new Map(handoff.entities.map(entity => [entity.resolutionId, entity]));
  const { parentIds, unsafeEntityReasons } = resolvedParentEntityIds(handoff.entities);

  const evidenceForClaim = (claim: WebsiteHandoffClaim): PrivateReviewEvidence => {
    const citation = citationsById.get(claim.citationId);
    const exact = citation ? evidenceById.get(citation.evidenceId) : undefined;
    if (!citation || !exact || exact.sourceId !== citation.sourceId) {
      throw new Error(`Private review requires exact evidence for held fact ${claim.claimId}.`);
    }
    return {
      evidenceId: exact.evidenceId,
      exact: exact.exact,
      heading: exact.heading,
      section: exact.section,
      page: exact.page,
      prefix: exact.prefix,
      suffix: exact.suffix,
      citation: {
        citationId: citation.citationId,
        sourceId: citation.sourceId,
        publisher: citation.publisher,
        publisherRole: citation.publisherRole,
        title: citation.title,
        author: citation.author,
        publishedDate: citation.publishedDate,
        url: citation.url,
      },
    };
  };

  const items: PrivateReviewItem[] = [];
  for (const record of preview.privateVerification) {
    if (record.status !== 'held' && record.status !== 'conflict') continue;
    const operation = operationsByResource.get(`${record.resourceType}:${record.resourceId}`);
    if (!operation || (operation.action !== 'held' && operation.action !== 'conflict')) continue;

    if (record.resourceType === 'entity') {
      const entity = entitiesById.get(record.resourceId);
      if (!entity) throw new Error(`Private review entity is missing from the handoff: ${record.resourceId}`);
      const claims = entity.claimIds
        .map(claimId => claimsById.get(claimId))
        .filter((claim): claim is WebsiteHandoffClaim => Boolean(claim));
      items.push({
        resourceType: 'entity',
        resourceId: entity.resolutionId,
        status: record.status,
        subject: entity.preferredLabel || entity.sourceLabel,
        entityKind: entity.entityKind,
        websiteHolding: entity.websiteHolding,
        reviewReason: record.reason,
        candidateValue: record.candidateValue,
        hierarchy: hierarchyForReview(entity, entitiesById, parentIds, unsafeEntityReasons),
        evidence: claims.map(evidenceForClaim),
        productReview: productReviewFor(entity.preferredLabel || entity.sourceLabel, products),
      });
      continue;
    }

    const claim = claimsById.get(record.resourceId);
    if (!claim) throw new Error(`Private review fact is missing from the handoff: ${record.resourceId}`);
    const entity = entitiesById.get(claim.resolutionId);
    if (!entity) throw new Error(`Private review fact has no entity context: ${claim.claimId}`);
    items.push({
      resourceType: 'fact',
      resourceId: claim.claimId,
      status: record.status,
      subject: claim.subject,
      entityKind: claim.entityKind,
      websiteHolding: claim.websiteHolding,
      reviewReason: record.reason,
      field: claim.websiteField,
      scope: claim.claimScope,
      candidateValue: claim.candidateValue,
      proposedPublicWording: ordinaryReferenceText(claim),
      hierarchy: hierarchyForReview(entity, entitiesById, parentIds, unsafeEntityReasons),
      evidence: [evidenceForClaim(claim)],
      productReview: productReviewFor(claim.subject, products),
    });
  }

  items.sort((left, right) => (
    codepointCompare(left.resourceType, right.resourceType)
    || codepointCompare(left.resourceId, right.resourceId)
  ));
  return {
    manifest: { schemaVersion: 1, mode: 'private-review' },
    summary: {
      entities: items.filter(item => item.resourceType === 'entity').length,
      facts: items.filter(item => item.resourceType === 'fact').length,
    },
    items,
  };
}

function hasAllowedUrlScheme(value: string, schemes: readonly string[]): boolean {
  try {
    return schemes.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function hasPublicEntitySemantics(entity: WebsiteHandoffEntity): boolean {
  if (!PUBLIC_ENTITY_KINDS.has(entity.entityKind) || entity.resolutionStatus === 'conflict') return false;
  if (entity.entityKind === 'tea_family') return entity.websiteHolding === 'vocabulary';
  if (entity.entityKind === 'tea_style') return entity.websiteHolding === 'styles';
  if (GEOGRAPHIC_LEVELS.has(entity.entityKind)) return entity.websiteHolding === 'regions';
  return entity.websiteHolding === 'vocabulary';
}

function hasPublicClaimSemantics(claim: WebsiteHandoffClaim): boolean {
  const register = factRegister(claim);
  if (!PUBLIC_ENTITY_KINDS.has(claim.entityKind)
    || !PUBLIC_CLAIM_SCOPES.has(claim.claimScope)
    || !PUBLIC_FACT_REGISTERS.has(register)
    || !PUBLIC_WEBSITE_FIELDS.has(claim.websiteField)
    || !['compatible', 'requires_model_extension'].includes(claim.compatibility)
    || claim.proposedAction === 'conflict') return false;

  const allowedFieldsByScope: Record<string, readonly string[]> = {
    identity: ['description'],
    geography: ['description'],
    historical: ['history', 'description'],
    legal: ['description'],
    cultivar_potential: ['commonCharacteristics'],
    common_characteristics: ['commonCharacteristics'],
    processing: ['processing'],
    storage: ['storage'],
    brewing: ['brewing'],
  };
  return Boolean(allowedFieldsByScope[claim.claimScope]?.includes(claim.websiteField));
}

function publicPreviewFor(
  handoff: WebsiteHandoff,
  sources: ReferenceSource[],
  excludedSourceIds: ReadonlySet<string>,
  excludedCitationIds: ReadonlySet<string>,
): PublicReferencePreview {
  const citations = new Map(handoff.citations.map(citation => [citation.citationId, citation]));
  const sourceIndex = new Map(sources.map(source => [source.sourceId, source]));
  const { parentIds, unsafeEntityReasons } = resolvedParentEntityIds(handoff.entities);
  const reachableSourceIds = new Set<string>();
  const publiclyVisibleEntityIds = new Set(
    handoff.entities
      .filter(entity => hasPublicEntitySemantics(entity) && !unsafeEntityReasons.has(entity.resolutionId))
      .map(entity => entity.resolutionId),
  );
  let removedUnsafeDescendant = true;
  while (removedUnsafeDescendant) {
    removedUnsafeDescendant = false;
    for (const entityId of [...publiclyVisibleEntityIds]) {
      const parentId = parentIds.get(entityId);
      if (parentId && !publiclyVisibleEntityIds.has(parentId)) {
        publiclyVisibleEntityIds.delete(entityId);
        removedUnsafeDescendant = true;
      }
    }
  }
  const entries = [...handoff.entities]
    .filter(entity => publiclyVisibleEntityIds.has(entity.resolutionId))
    .sort((left, right) => {
      const kind = ENTITY_ORDER.indexOf(left.entityKind) - ENTITY_ORDER.indexOf(right.entityKind);
      return kind || codepointCompare(left.preferredLabel || left.sourceLabel, right.preferredLabel || right.sourceLabel);
    })
    .map(entity => {
      const statements: PublicReferenceStatement[] = [];
      const seenScopes = new Set<string>();
      const claims = handoff.claims
        .filter(claim => claim.resolutionId === entity.resolutionId && hasPublicClaimSemantics(claim))
        .filter(claim => {
          const citation = citations.get(claim.citationId);
          return !excludedCitationIds.has(claim.citationId) && Boolean(citation) && !excludedSourceIds.has(citation?.sourceId || '');
        })
        .sort((left, right) => codepointCompare(left.claimId, right.claimId));
      for (const claim of claims) {
        if (seenScopes.has(claim.claimScope) || statements.length >= 4) continue;
        const citation = citations.get(claim.citationId);
        const source = citation ? sourceIndex.get(citation.sourceId) : undefined;
        if (!citation || !source?.url) continue;
        if (!hasAllowedUrlScheme(source.url, ['http:', 'https:'])) continue;
        seenScopes.add(claim.claimScope);
        reachableSourceIds.add(source.sourceId);
        const excerpt = minimalExcerpt(claim.candidateValue);
        statements.push({
          id: claim.claimId,
          label: SCOPE_LABELS[claim.claimScope] || 'Reference note',
          text: ordinaryReferenceText(claim),
          ...(excerpt ? { excerpt } : {}),
          citation: { sourceId: source.sourceId, label: citationLabel(source), url: source.url },
        });
      }
      const label = entity.preferredLabel || entity.sourceLabel;
      return {
        id: entity.resolutionId,
        label,
        entityKind: entity.entityKind,
        kindLabel: KIND_LABELS[entity.entityKind] || 'Reference entry',
        ...(parentIds.has(entity.resolutionId) ? { parentId: parentIds.get(entity.resolutionId) } : {}),
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

  const publicSources = sources.filter(source => reachableSourceIds.has(source.sourceId));

  return {
    title: 'Pu’er reference',
    deck: 'A cited guide to tea families, styles, terminology, and growing places.',
    sourceCount: publicSources.length,
    entryCount: entries.length,
    sections,
    geographicScale,
    sources: publicSources.map(source => ({
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
  return codepointCompare(left.resourceId, right.resourceId);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string, allowBlank = false): string {
  if (typeof value !== 'string' || (!allowBlank && !value.trim())) throw new Error(`${path} must be a non-blank string`);
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${path} contains control characters`);
  return value;
}

function requireEvidenceText(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be a non-blank string`);
  // Exact source passages may preserve normal line breaks and tabs from the
  // reviewed workbook. Reject only control bytes that cannot be displayed.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new Error(`${path} contains control characters`);
  }
  return value;
}

function requireId(value: unknown, path: string, allowBlank = false): string {
  const id = requireString(value, path, allowBlank);
  if (id || !allowBlank) {
    if (!ID_PATTERN.test(id)) throw new Error(`${path} is not a valid identifier`);
  }
  return id;
}

function requireHash(value: unknown, path: string): string {
  const hash = requireString(value, path);
  if (!HASH_PATTERN.test(hash)) throw new Error(`${path} must be a lowercase SHA-256 hash`);
  return hash;
}

function requireCount(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${path} must be a non-negative safe integer`);
  return value as number;
}

function requireAllowed(value: unknown, allowed: ReadonlySet<string>, path: string): string {
  const text = requireString(value, path);
  if (!allowed.has(text)) throw new Error(`${path} has unsupported value ${text}`);
  return text;
}

function validateHandoff(handoff: WebsiteHandoff): void {
  if (!handoff || typeof handoff !== 'object') throw new Error('Website handoff must be an object');
  const manifest = requireRecord(handoff.manifest, 'Website handoff manifest');
  if (manifest.schemaVersion !== 1) throw new Error('Website handoff schemaVersion must be 1');
  if (manifest.mode !== 'preview-only') throw new Error('Website handoff must be preview-only');
  if (manifest.siteModel !== 'tea-wisdom-v1') throw new Error('Website handoff siteModel must be tea-wisdom-v1');
  requireHash(manifest.claimsSha256, 'Website handoff manifest claimsSha256');
  requireHash(manifest.sourceSnapshotSha256, 'Website handoff manifest sourceSnapshotSha256');
  requireHash(manifest.payloadSha256, 'Website handoff manifest payloadSha256');
  const entityCount = requireCount(manifest.entityCount, 'Website handoff manifest entityCount');
  const claimCount = requireCount(manifest.claimCount, 'Website handoff manifest claimCount');
  const citationCount = requireCount(manifest.citationCount, 'Website handoff manifest citationCount');
  const readyCount = requireCount(manifest.readyToPublishCount, 'Website handoff manifest readyToPublishCount');
  const heldCount = requireCount(manifest.heldBackCount, 'Website handoff manifest heldBackCount');
  for (const key of ['entities', 'claims', 'citations', 'heldBack'] as const) {
    if (!Array.isArray(handoff[key])) throw new Error(`Website handoff ${key} must be an array`);
  }
  if (canonicalPayloadSha256(handoff) !== manifest.payloadSha256) {
    throw new Error('Website handoff payload SHA-256 does not match its canonical payload');
  }
  if (entityCount !== handoff.entities.length) throw new Error('Website handoff entity count does not match its manifest');
  if (claimCount !== handoff.claims.length) throw new Error('Website handoff claim count does not match its manifest');
  if (citationCount !== handoff.citations.length) throw new Error('Website handoff citation count does not match its manifest');
  if (heldCount !== handoff.heldBack.length) throw new Error('Website handoff held count does not match its manifest');
  if (readyCount + heldCount !== claimCount) throw new Error('Website handoff ready and held counts do not account for every claim');

  const entityIds = new Set<string>();
  for (const entity of handoff.entities) {
    requireRecord(entity, 'Website handoff entity');
    requireId(entity.resolutionId, 'Entity resolutionId');
    requireId(entity.canonicalEntityId, `Entity ${entity.resolutionId} canonicalEntityId`, true);
    if (entity.parentEntityId !== undefined) requireId(entity.parentEntityId, `Entity ${entity.resolutionId} parentEntityId`);
    requireString(entity.preferredLabel, `Entity ${entity.resolutionId} preferredLabel`, true);
    requireString(entity.sourceLabel, `Entity ${entity.resolutionId} sourceLabel`);
    requireAllowed(entity.entityKind, ENTITY_KINDS as ReadonlySet<string>, `Entity ${entity.resolutionId} entityKind`);
    requireAllowed(entity.websiteHolding, WEBSITE_HOLDINGS, `Entity ${entity.resolutionId} websiteHolding`);
    requireAllowed(entity.proposedAction, PROPOSED_ACTIONS, `Entity ${entity.resolutionId} proposedAction`);
    requireAllowed(entity.resolutionStatus, ENTITY_RESOLUTION_STATUSES, `Entity ${entity.resolutionId} resolutionStatus`);
    requireString(entity.reason, `Entity ${entity.resolutionId} reason`);
    if (!Array.isArray(entity.claimIds)) throw new Error(`Entity ${entity.resolutionId} claimIds must be an array`);
    entity.claimIds.forEach((claimId, index) => requireId(claimId, `Entity ${entity.resolutionId} claimIds[${index}]`));
    if (entityIds.has(entity.resolutionId)) throw new Error(`Duplicate entity resolution: ${entity.resolutionId}`);
    entityIds.add(entity.resolutionId);
  }
  const citationIds = new Set<string>();
  for (const citation of handoff.citations) {
    requireRecord(citation, 'Website handoff citation');
    requireId(citation.citationId, 'Citation citationId');
    requireId(citation.sourceId, `Citation ${citation.citationId} sourceId`);
    requireId(citation.evidenceId, `Citation ${citation.citationId} evidenceId`);
    requireString(citation.publisher, `Citation ${citation.citationId} publisher`);
    requireAllowed(citation.publisherRole, PUBLISHER_ROLES as ReadonlySet<string>, `Citation ${citation.citationId} publisherRole`);
    requireString(citation.title, `Citation ${citation.citationId} title`);
    requireString(citation.author, `Citation ${citation.citationId} author`, true);
    requireString(citation.publishedDate, `Citation ${citation.citationId} publishedDate`, true);
    requireString(citation.accessedDate, `Citation ${citation.citationId} accessedDate`);
    const url = requireString(citation.url, `Citation ${citation.citationId} url`);
    if (!hasAllowedUrlScheme(url, ['http:', 'https:'])) throw new Error(`Citation ${citation.citationId} URL must use HTTP or HTTPS`);
    if (citationIds.has(citation.citationId)) throw new Error(`Duplicate citation: ${citation.citationId}`);
    citationIds.add(citation.citationId);
  }
  const claimIds = new Set<string>();
  for (const claim of handoff.claims) {
    requireRecord(claim, 'Website handoff claim');
    requireId(claim.claimId, 'Claim claimId');
    requireId(claim.resolutionId, `Claim ${claim.claimId} resolutionId`);
    requireId(claim.canonicalEntityId, `Claim ${claim.claimId} canonicalEntityId`, true);
    requireString(claim.subject, `Claim ${claim.claimId} subject`);
    requireAllowed(claim.entityKind, ENTITY_KINDS as ReadonlySet<string>, `Claim ${claim.claimId} entityKind`);
    requireAllowed(claim.claimScope, CLAIM_SCOPES, `Claim ${claim.claimId} claimScope`);
    requireAllowed(claim.websiteHolding, WEBSITE_HOLDINGS, `Claim ${claim.claimId} websiteHolding`);
    requireAllowed(claim.websiteField, WEBSITE_FIELDS, `Claim ${claim.claimId} websiteField`);
    if (!Object.prototype.hasOwnProperty.call(claim, 'candidateValue')) throw new Error(`Claim ${claim.claimId} candidateValue is required`);
    requireRecord(claim.qualifiers, `Claim ${claim.claimId} qualifiers`);
    requireAllowed(claim.assertingPublisherRole, PUBLISHER_ROLES as ReadonlySet<string>, `Claim ${claim.claimId} assertingPublisherRole`);
    requireAllowed(claim.compatibility, COMPATIBILITY_STATUSES, `Claim ${claim.claimId} compatibility`);
    requireId(claim.citationId, `Claim ${claim.claimId} citationId`);
    requireAllowed(claim.proposedAction, PROPOSED_ACTIONS, `Claim ${claim.claimId} proposedAction`);
    requireString(claim.holdReason, `Claim ${claim.claimId} holdReason`, claim.proposedAction !== 'hold');
    requireHash(claim.payloadSha256, `Claim ${claim.claimId} payloadSha256`);
    if (claimIds.has(claim.claimId)) throw new Error(`Duplicate claim: ${claim.claimId}`);
    if (!citationIds.has(claim.citationId)) throw new Error(`Claim ${claim.claimId} has a missing citation: ${claim.citationId}`);
    if (!entityIds.has(claim.resolutionId)) throw new Error(`Claim ${claim.claimId} has a missing entity resolution: ${claim.resolutionId}`);
    claimIds.add(claim.claimId);
  }

  const entities = new Map(handoff.entities.map(entity => [entity.resolutionId, entity]));
  const citations = new Map(handoff.citations.map(citation => [citation.citationId, citation]));
  for (const claim of handoff.claims) {
    const entity = entities.get(claim.resolutionId)!;
    const citation = citations.get(claim.citationId)!;
    if (claim.entityKind !== entity.entityKind || claim.canonicalEntityId !== entity.canonicalEntityId) {
      throw new Error(`Claim ${claim.claimId} does not match its entity resolution`);
    }
    if (claim.assertingPublisherRole !== citation.publisherRole) {
      throw new Error(`Claim ${claim.claimId} publisher role does not match its citation`);
    }
  }
  for (const entity of handoff.entities) {
    const seen = new Set<string>();
    for (const claimId of entity.claimIds) {
      if (seen.has(claimId)) throw new Error(`Entity ${entity.resolutionId} repeats claim ${claimId}`);
      seen.add(claimId);
      const claim = handoff.claims.find(candidate => candidate.claimId === claimId);
      if (!claim || claim.resolutionId !== entity.resolutionId) {
        throw new Error(`Entity ${entity.resolutionId} has an invalid claim reference: ${claimId}`);
      }
    }
  }

  const heldClaimIds = new Set<string>();
  for (const held of handoff.heldBack) {
    requireRecord(held, 'Website handoff heldBack record');
    const claimId = requireId(held.claimId, 'Held claimId');
    const reason = requireString(held.reason, `Held claim ${claimId} reason`);
    if (heldClaimIds.has(claimId)) throw new Error(`Duplicate held claim reference: ${claimId}`);
    const claim = handoff.claims.find(candidate => candidate.claimId === claimId);
    if (!claim) throw new Error(`Held claim has a missing claim reference: ${claimId}`);
    if (claim.proposedAction !== 'hold') throw new Error(`Held claim ${claimId} is not proposed as held`);
    if (reason !== claim.holdReason) throw new Error(`Held claim ${claimId} reason does not match the claim`);
    heldClaimIds.add(claimId);
  }
  for (const claim of handoff.claims) {
    if ((claim.proposedAction === 'hold') !== heldClaimIds.has(claim.claimId)) {
      throw new Error(`Claim ${claim.claimId} held status does not match heldBack`);
    }
  }
}

function validateCurrentState(state: ReferenceReceivingState): void {
  if (!state || typeof state !== 'object') throw new Error('Current receiving state must be an object');
  if (state.schemaVersion !== 1) throw new Error('Current receiving state schemaVersion must be 1');
  for (const key of ['sources', 'citations', 'entities', 'facts', 'verification'] as const) {
    if (!Array.isArray(state[key])) throw new Error(`Current receiving state ${key} must be an array`);
  }

  const sourceIds = new Set<string>();
  for (const source of state.sources) {
    requireRecord(source, 'Current source');
    const sourceId = requireId(source.sourceId, 'Current source sourceId');
    if (sourceIds.has(sourceId)) throw new Error(`Duplicate current source: ${sourceId}`);
    sourceIds.add(sourceId);
    requireString(source.publisher, `Current source ${sourceId} publisher`);
    requireAllowed(source.publisherRole, PUBLISHER_ROLES as ReadonlySet<string>, `Current source ${sourceId} publisherRole`);
    requireString(source.title, `Current source ${sourceId} title`);
    requireString(source.author, `Current source ${sourceId} author`, true);
    requireString(source.publishedDate, `Current source ${sourceId} publishedDate`, true);
    requireString(source.accessedDate, `Current source ${sourceId} accessedDate`);
    const url = requireString(source.url, `Current source ${sourceId} url`);
    if (!hasAllowedUrlScheme(url, ['http:', 'https:'])) throw new Error(`Current source ${sourceId} URL must use HTTP or HTTPS`);
  }

  const citationIds = new Set<string>();
  for (const citation of state.citations) {
    requireRecord(citation, 'Current citation');
    const citationId = requireId(citation.citationId, 'Current citation citationId');
    if (citationIds.has(citationId)) throw new Error(`Duplicate current citation: ${citationId}`);
    citationIds.add(citationId);
    const sourceId = requireId(citation.sourceId, `Current citation ${citationId} sourceId`);
    requireId(citation.evidenceId, `Current citation ${citationId} evidenceId`);
    if (!sourceIds.has(sourceId)) throw new Error(`Current citation ${citationId} has a missing source: ${sourceId}`);
  }

  const entityIds = new Set<string>();
  for (const entity of state.entities) {
    requireRecord(entity, 'Current entity');
    const entityId = requireId(entity.entityId, 'Current entity entityId');
    if (entityIds.has(entityId)) throw new Error(`Duplicate current entity: ${entityId}`);
    entityIds.add(entityId);
    requireId(entity.canonicalEntityId, `Current entity ${entityId} canonicalEntityId`, true);
    requireString(entity.label, `Current entity ${entityId} label`);
    requireString(entity.sourceLabel, `Current entity ${entityId} sourceLabel`);
    requireAllowed(entity.entityKind, ENTITY_KINDS as ReadonlySet<string>, `Current entity ${entityId} entityKind`);
    if (entity.geographicLevel !== undefined) {
      requireAllowed(entity.geographicLevel, GEOGRAPHIC_LEVELS as ReadonlySet<string>, `Current entity ${entityId} geographicLevel`);
      if (entity.geographicLevel !== entity.entityKind) throw new Error(`Current entity ${entityId} geographic level does not match its kind`);
    }
    if (entity.parentEntityId !== undefined) requireId(entity.parentEntityId, `Current entity ${entityId} parentEntityId`);
  }
  const currentEntityIndex = new Map(state.entities.map(entity => [entity.entityId, entity]));
  for (const entity of state.entities) {
    if (entity.parentEntityId && !entityIds.has(entity.parentEntityId)) {
      throw new Error(`Current entity ${entity.entityId} has a missing parent: ${entity.parentEntityId}`);
    }
    const visited = new Set<string>();
    let cursor: ReferenceEntity | undefined = entity;
    while (cursor?.parentEntityId) {
      if (visited.has(cursor.entityId)) throw new Error(`Current entity ${entity.entityId} has a cyclic parent hierarchy`);
      visited.add(cursor.entityId);
      cursor = currentEntityIndex.get(cursor.parentEntityId);
    }
  }

  const factIds = new Set<string>();
  for (const fact of state.facts) {
    requireRecord(fact, 'Current fact');
    const factId = requireId(fact.factId, 'Current fact factId');
    if (factIds.has(factId)) throw new Error(`Duplicate current fact: ${factId}`);
    factIds.add(factId);
    const entityId = requireId(fact.entityId, `Current fact ${factId} entityId`);
    if (!entityIds.has(entityId)) throw new Error(`Current fact ${factId} has a missing entity: ${entityId}`);
    requireAllowed(fact.field, WEBSITE_FIELDS, `Current fact ${factId} field`);
    requireAllowed(fact.scope, CLAIM_SCOPES, `Current fact ${factId} scope`);
    requireAllowed(fact.register, FACT_REGISTERS as ReadonlySet<string>, `Current fact ${factId} register`);
    requireString(fact.publicText, `Current fact ${factId} publicText`);
    if (!Array.isArray(fact.citationIds) || fact.citationIds.length === 0) {
      throw new Error(`Current fact ${factId} citationIds must be a non-empty array`);
    }
    const seenCitationIds = new Set<string>();
    for (const citationId of fact.citationIds) {
      requireId(citationId, `Current fact ${factId} citationId`);
      if (seenCitationIds.has(citationId)) throw new Error(`Current fact ${factId} repeats citation ${citationId}`);
      if (!citationIds.has(citationId)) throw new Error(`Current fact ${factId} has a missing citation: ${citationId}`);
      seenCitationIds.add(citationId);
    }
  }

  const verificationIds = new Set<string>();
  for (const record of state.verification) {
    requireRecord(record, 'Current verification record');
    if (!['entity', 'fact'].includes(record.resourceType)) throw new Error('Current verification resourceType is unsupported');
    requireId(record.resourceId, 'Current verification resourceId');
    if (!['held', 'conflict', 'ready_for_private_review'].includes(record.status)) {
      throw new Error(`Current verification ${record.resourceId} status is unsupported`);
    }
    if (record.register !== 'entity_resolution') {
      requireAllowed(record.register, FACT_REGISTERS as ReadonlySet<string>, `Current verification ${record.resourceId} register`);
    }
    requireString(record.reason, `Current verification ${record.resourceId} reason`);
    if (!Array.isArray(record.evidenceIds) || !Array.isArray(record.sourceRoles)) {
      throw new Error(`Current verification ${record.resourceId} evidenceIds and sourceRoles must be arrays`);
    }
    record.evidenceIds.forEach((evidenceId, index) => requireId(evidenceId, `Current verification ${record.resourceId} evidenceIds[${index}]`));
    record.sourceRoles.forEach((role, index) => requireAllowed(role, PUBLISHER_ROLES as ReadonlySet<string>, `Current verification ${record.resourceId} sourceRoles[${index}]`));
    const key = `${record.resourceType}:${record.resourceId}`;
    if (verificationIds.has(key)) throw new Error(`Duplicate current verification: ${key}`);
    verificationIds.add(key);
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

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateNoPrivateData(value: unknown, activePath = new Set<object>()): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_PUBLIC_MARKER.test(value)) throw new Error('Unsafe public preview: forbidden private marker');
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (activePath.has(value)) throw new Error('Unsafe public preview: cyclic object');
  activePath.add(value);
  try {
    for (const key of Reflect.ownKeys(value)) {
      const keyText = String(key);
      if (FORBIDDEN_PUBLIC_KEYS.has(keyText) || /sha256$/i.test(keyText) || FORBIDDEN_PUBLIC_MARKER.test(keyText)) {
        throw new Error(`Unsafe public preview: forbidden private key ${keyText}`);
      }
      validateNoPrivateData(Reflect.get(value, key), activePath);
    }
  } finally {
    activePath.delete(value);
  }
}

function publicObject(value: unknown, allowedKeys: readonly string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unsafe public preview: ${path} must be an object`);
  }
  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new Error(`Unsafe public preview: unknown ${path} key ${String(key)}`);
    }
  }
  for (const key of allowedKeys) {
    if (!hasOwn(value, key)) throw new Error(`Unsafe public preview: missing ${path} key ${key}`);
  }
  return value as Record<string, unknown>;
}

function publicArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Unsafe public preview: ${path} must be an array`);
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      throw new Error(`Unsafe public preview: unknown ${path} key ${String(key)}`);
    }
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!hasOwn(value, index)) throw new Error(`Unsafe public preview: sparse ${path}`);
  }
  return value;
}

function publicString(value: unknown, path: string): void {
  if (typeof value !== 'string') throw new Error(`Unsafe public preview: ${path} must be a string`);
}

function publicCount(value: unknown, path: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`Unsafe public preview: ${path} must be a non-negative integer`);
  }
}

function validatePublicCitation(value: unknown, path: string): void {
  const citation = publicObject(value, ['sourceId', 'label', 'url'], path);
  publicString(citation.sourceId, `${path}.sourceId`);
  publicString(citation.label, `${path}.label`);
  publicString(citation.url, `${path}.url`);
  if (!hasAllowedUrlScheme(citation.url as string, ['http:', 'https:'])) {
    throw new Error(`Unsafe public preview: ${path}.url must use HTTP or HTTPS`);
  }
}

function validatePublicStatement(value: unknown, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unsafe public preview: ${path} must be an object`);
  }
  const keys = hasOwn(value, 'excerpt')
    ? ['id', 'label', 'text', 'excerpt', 'citation']
    : ['id', 'label', 'text', 'citation'];
  const statement = publicObject(value, keys, path);
  publicString(statement.id, `${path}.id`);
  publicString(statement.label, `${path}.label`);
  if (!new Set(Object.values(SCOPE_LABELS)).has(statement.label as string)) {
    throw new Error(`Unsafe public preview: ${path}.label is not a public fact scope`);
  }
  publicString(statement.text, `${path}.text`);
  if (hasOwn(statement, 'excerpt')) publicString(statement.excerpt, `${path}.excerpt`);
  validatePublicCitation(statement.citation, `${path}.citation`);
}

function validatePublicEntry(value: unknown, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unsafe public preview: ${path} must be an object`);
  }
  const keys = hasOwn(value, 'parentId')
    ? ['id', 'label', 'entityKind', 'kindLabel', 'parentId', 'statements', 'reportUrl']
    : ['id', 'label', 'entityKind', 'kindLabel', 'statements', 'reportUrl'];
  const entry = publicObject(value, keys, path);
  publicString(entry.id, `${path}.id`);
  publicString(entry.label, `${path}.label`);
  publicString(entry.entityKind, `${path}.entityKind`);
  if (!PUBLIC_ENTITY_KINDS.has(entry.entityKind as ReferenceEntityKind)) {
    throw new Error(`Unsafe public preview: ${path}.entityKind is not public`);
  }
  publicString(entry.kindLabel, `${path}.kindLabel`);
  if (hasOwn(entry, 'parentId')) publicString(entry.parentId, `${path}.parentId`);
  publicArray(entry.statements, `${path}.statements`)
    .forEach((statement, index) => validatePublicStatement(statement, `${path}.statements[${index}]`));
  publicString(entry.reportUrl, `${path}.reportUrl`);
  if (!hasAllowedUrlScheme(entry.reportUrl as string, ['mailto:'])) {
    throw new Error(`Unsafe public preview: ${path}.reportUrl must use mailto`);
  }
}

function validatePublicSection(value: unknown, path: string): void {
  const section = publicObject(value, ['id', 'label', 'description', 'entries'], path);
  publicString(section.id, `${path}.id`);
  if (!PUBLIC_ENTITY_KINDS.has(section.id as ReferenceEntityKind)) {
    throw new Error(`Unsafe public preview: ${path}.id is not a public entity kind`);
  }
  publicString(section.label, `${path}.label`);
  publicString(section.description, `${path}.description`);
  publicArray(section.entries, `${path}.entries`)
    .forEach((entry, index) => validatePublicEntry(entry, `${path}.entries[${index}]`));
}

function validateGeographicScale(value: unknown, path: string): void {
  const scale = publicObject(value, ['id', 'label', 'count'], path);
  publicString(scale.id, `${path}.id`);
  if (!GEOGRAPHIC_LEVELS.has(scale.id as ReferenceEntityKind)) {
    throw new Error(`Unsafe public preview: ${path}.id must be a geographic level`);
  }
  publicString(scale.label, `${path}.label`);
  publicCount(scale.count, `${path}.count`);
}

function validatePublicSource(value: unknown, path: string): void {
  const source = publicObject(
    value,
    ['sourceId', 'publisher', 'publisherRoleLabel', 'title', 'author', 'publishedDate', 'url'],
    path,
  );
  for (const key of ['sourceId', 'publisher', 'publisherRoleLabel', 'title', 'author', 'publishedDate', 'url']) {
    publicString(source[key], `${path}.${key}`);
  }
  if (!new Set(Object.values(ROLE_LABELS)).has(source.publisherRoleLabel as string)) {
    throw new Error(`Unsafe public preview: ${path}.publisherRoleLabel is not public`);
  }
  if (!hasAllowedUrlScheme(source.url as string, ['http:', 'https:'])) {
    throw new Error(`Unsafe public preview: ${path}.url must use HTTP or HTTPS`);
  }
}

function validatePublicProjection(value: unknown): asserts value is PublicReferencePreview {
  validateNoPrivateData(value);
  const preview = publicObject(
    value,
    ['title', 'deck', 'sourceCount', 'entryCount', 'sections', 'geographicScale', 'sources', 'reportUrl'],
    'publicPreview',
  );
  publicString(preview.title, 'publicPreview.title');
  publicString(preview.deck, 'publicPreview.deck');
  publicCount(preview.sourceCount, 'publicPreview.sourceCount');
  publicCount(preview.entryCount, 'publicPreview.entryCount');
  publicArray(preview.sections, 'publicPreview.sections')
    .forEach((section, index) => validatePublicSection(section, `publicPreview.sections[${index}]`));
  publicArray(preview.geographicScale, 'publicPreview.geographicScale')
    .forEach((scale, index) => validateGeographicScale(scale, `publicPreview.geographicScale[${index}]`));
  publicArray(preview.sources, 'publicPreview.sources')
    .forEach((source, index) => validatePublicSource(source, `publicPreview.sources[${index}]`));
  publicString(preview.reportUrl, 'publicPreview.reportUrl');
  if (!hasAllowedUrlScheme(preview.reportUrl as string, ['mailto:'])) {
    throw new Error('Unsafe public preview: publicPreview.reportUrl must use mailto');
  }

  const sections = preview.sections as PublicReferenceSection[];
  const sources = preview.sources as PublicReferencePreview['sources'];
  const sourceIndex = new Map(sources.map(source => [source.sourceId, source]));
  if (sourceIndex.size !== sources.length) throw new Error('Unsafe public preview: duplicate sourceId');
  const entries = sections.flatMap(section => section.entries);
  if (preview.entryCount !== entries.length) throw new Error('Unsafe public preview: entryCount mismatch');
  if (preview.sourceCount !== sources.length) throw new Error('Unsafe public preview: sourceCount mismatch');
  const entryIds = new Set<string>();
  const reachableSourceIds = new Set<string>();
  for (const section of sections) {
    for (const entry of section.entries) {
      if (entry.entityKind !== section.id) throw new Error('Unsafe public preview: section/entity kind mismatch');
      if (entryIds.has(entry.id)) throw new Error('Unsafe public preview: duplicate entry ID');
      entryIds.add(entry.id);
      for (const statement of entry.statements) {
        const source = sourceIndex.get(statement.citation.sourceId);
        if (!source || source.url !== statement.citation.url) {
          throw new Error('Unsafe public preview: citation does not match its source metadata');
        }
        reachableSourceIds.add(source.sourceId);
      }
    }
  }
  for (const entry of entries) {
    if (entry.parentId && !entryIds.has(entry.parentId)) {
      throw new Error('Unsafe public preview: parentId does not resolve to a public entry');
    }
  }
  if (reachableSourceIds.size !== sources.length) throw new Error('Unsafe public preview: unreachable source metadata');
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
  validateCurrentState(currentState);
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
  for (const input of [...handoff.citations].sort((left, right) => codepointCompare(left.citationId, right.citationId))) {
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
  const { parentIds, unsafeEntityReasons } = resolvedParentEntityIds(handoff.entities);
  const currentEntities = new Map(projectedState.entities.map(candidate => [candidate.entityId, candidate]));
  for (const input of [...handoff.entities].sort((left, right) => codepointCompare(left.resolutionId, right.resolutionId))) {
    const candidate = entityCandidate(input, parentIds);
    const geographicGap = candidate.geographicLevel
      && !['region', 'major_region'].includes(candidate.geographicLevel)
      && !candidate.parentEntityId;
    const parentProblem = unsafeEntityReasons.get(candidate.entityId);
    const retailerProducerAssertion = ['producer', 'factory', 'brand'].includes(candidate.entityKind)
      && handoff.claims.some(claim => claim.resolutionId === candidate.entityId && claim.assertingPublisherRole === 'retailer_reseller');
    let action: ReceivingAction;
    let reason: string;
    const current = currentEntities.get(candidate.entityId);
    if (parentProblem || geographicGap || retailerProducerAssertion || input.proposedAction === 'hold'
      || ['hold_unresolved', 'private_verification', 'duplicate_candidate'].includes(input.resolutionStatus)) {
      action = 'held';
      reason = retailerProducerAssertion
        ? 'A retailer or reseller cannot establish producer, factory, or brand identity by being the publisher.'
        : parentProblem
        || (geographicGap
          ? `The ${candidate.geographicLevel} level has no verified parent entity in the handoff; it cannot be flattened into a generic region.`
          : input.reason || 'Entity mapping requires private verification.');
    } else if (input.proposedAction === 'conflict' || input.resolutionStatus === 'conflict') {
      action = 'conflict';
      reason = input.reason || 'Entity resolution is conflicted.';
    } else if (!current) {
      action = 'create';
      reason = 'Entity is new to the receiving snapshot.';
    } else if (current.canonicalEntityId !== candidate.canonicalEntityId || current.entityKind !== candidate.entityKind) {
      action = 'conflict';
      reason = 'Entity identity changed: canonical ID or entity kind differs from the receiving snapshot.';
    } else if (same(current, candidate)) {
      action = 'no-op';
      reason = 'Entity is unchanged.';
    } else {
      action = 'update';
      reason = 'Entity metadata changed without changing entity identity.';
    }
    operations.push({ action, resourceType: 'entity', resourceId: candidate.entityId, reason, candidate });
    if (action === 'create') projectedState.entities.push(candidate);
    if (action === 'update') projectedState.entities = projectedState.entities.map(entry => entry.entityId === candidate.entityId ? candidate : entry);
    if (action === 'held' || action === 'conflict') {
      verification.push({
        resourceType: 'entity',
        resourceId: candidate.entityId,
        status: action,
        register: 'entity_resolution',
        reason,
        candidateValue: candidate,
        evidenceIds: [],
        sourceRoles: [],
      });
    }
  }

  const currentFacts = new Map(projectedState.facts.map(candidate => [candidate.factId, candidate]));
  for (const claim of [...handoff.claims].sort((left, right) => codepointCompare(left.claimId, right.claimId))) {
    const register = factRegister(claim);
    const citation = citations.get(claim.citationId);
    const sourceRole = claim.assertingPublisherRole || citation?.publisherRole || '';
    const producerRoleViolation = ['producer', 'factory', 'brand'].includes(claim.entityKind)
      && sourceRole === 'retailer_reseller';
    const candidate: ReferenceFact = {
      factId: claim.claimId,
      entityId: claim.resolutionId,
      field: claim.websiteField,
      scope: claim.claimScope,
      register,
      publicText: ordinaryReferenceText(claim),
      citationIds: [claim.citationId],
    };
    const current = currentFacts.get(candidate.factId);
    let action: ReceivingAction;
    let reason: string;
    if (register === 'personal_tasting') {
      action = 'held';
      reason = 'Source capture cannot create personal tasting.';
    } else if (register === 'exact_lot_source_description') {
      action = 'held';
      reason = 'Exact-lot source description stays with its exact lot, outside shared Tea Reference facts.';
    } else if (producerRoleViolation) {
      action = 'held';
      reason = 'A retailer or reseller cannot establish producer, factory, or brand identity by being the publisher.';
    } else if (unsafeEntityReasons.has(claim.resolutionId)) {
      action = 'held';
      reason = unsafeEntityReasons.get(claim.resolutionId)!;
    } else if (claim.proposedAction === 'hold' || claim.compatibility === 'prohibited') {
      action = 'held';
      reason = claim.holdReason || 'Fact requires private verification.';
    } else if (claim.proposedAction === 'conflict') {
      action = 'conflict';
      reason = claim.holdReason || 'Fact is conflicted.';
    } else if (!current) {
      action = 'create';
      reason = 'Fact is new to the receiving snapshot.';
    } else if (current.entityId !== candidate.entityId || current.register !== candidate.register) {
      action = 'conflict';
      reason = 'Fact identity changed: entity or register differs from the receiving snapshot.';
    } else if (same(current, candidate)) {
      action = 'no-op';
      reason = 'Fact is unchanged.';
    } else {
      action = 'update';
      reason = 'Fact content or citation metadata changed without changing fact identity.';
    }
    operations.push({ action, resourceType: 'fact', resourceId: claim.claimId, reason, candidate });
    if (action === 'create') projectedState.facts.push(candidate);
    if (action === 'update') projectedState.facts = projectedState.facts.map(entry => entry.factId === candidate.factId ? candidate : entry);
    if (action === 'held' || action === 'conflict') {
      verification.push({
        resourceType: 'fact',
        resourceId: claim.claimId,
        status: action,
        register,
        reason,
        candidateValue: claim.candidateValue,
        evidenceIds: citation?.evidenceId ? [citation.evidenceId] : [],
        sourceRoles: sourceRole ? [sourceRole] : [],
      });
    }
  }

  operations.sort(operationOrder);
  projectedState.sources.sort((left, right) => codepointCompare(left.sourceId, right.sourceId));
  projectedState.citations.sort((left, right) => codepointCompare(left.citationId, right.citationId));
  projectedState.entities.sort((left, right) => codepointCompare(left.entityId, right.entityId));
  projectedState.facts.sort((left, right) => codepointCompare(left.factId, right.factId));
  verification.sort((left, right) => codepointCompare(left.resourceType, right.resourceType) || codepointCompare(left.resourceId, right.resourceId));
  const incomingVerificationKeys = new Set(
    operations
      .filter(operation => operation.resourceType === 'entity' || operation.resourceType === 'fact')
      .map(operation => `${operation.resourceType}:${operation.resourceId}`),
  );
  const projectedVerification = new Map(
    projectedState.verification
      .filter(record => !incomingVerificationKeys.has(`${record.resourceType}:${record.resourceId}`))
      .map(record => [`${record.resourceType}:${record.resourceId}`, record]),
  );
  for (const record of verification) projectedVerification.set(`${record.resourceType}:${record.resourceId}`, record);
  projectedState.verification = [...projectedVerification.values()]
    .sort((left, right) => codepointCompare(left.resourceType, right.resourceType) || codepointCompare(left.resourceId, right.resourceId));

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

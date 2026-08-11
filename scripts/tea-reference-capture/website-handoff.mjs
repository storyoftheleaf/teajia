import { canonicalJson, sha256 } from './canonical.mjs';

const HOLDING_BY_KIND = Object.freeze({
  tea_family: 'vocabulary',
  named_tea: 'namedTeas',
  tea_style: 'styles',
  cultivar: 'cultivars',
  region: 'regions',
  major_region: 'regions',
  tea_area: 'regions',
  mountain: 'regions',
  village: 'regions',
  locality: 'regions',
  producer: 'producers',
  factory: 'producers',
  brand: 'producers',
  mark: 'marks',
  recipe: 'marks',
  glossary_term: 'glossary',
  taxonomy_term: 'glossary',
});

const FIELD_BY_SCOPE = Object.freeze({
  identity: 'description',
  geography: 'description',
  historical: 'history',
  legal: 'definition',
  cultivar_potential: 'potentialProfile',
  common_characteristics: 'commonCharacteristics',
  processing: 'processing',
  storage: 'storage',
  brewing: 'brewing',
  relationship: 'relationships',
  exact_lot: 'sourceDescription',
});

const STRUCTURALLY_PROHIBITED = new Set(['exact_lot', 'recognized_tree']);

function token(value) {
  return String(value ?? '').normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase();
}

function citationId(claim) {
  return `CITATION-${token(claim.sourceId)}-${token(claim.evidenceId)}`;
}

function resolutionMap(capture) {
  const map = new Map();
  for (const resolution of capture.entityResolution ?? []) {
    for (const claimId of resolution.claimIds ?? []) map.set(claimId, resolution);
  }
  return map;
}

function sourceMap(capture) {
  return new Map((capture.sources ?? []).map((packet) => [packet.source.sourceId, packet]));
}

function destinationFor(claim) {
  if (STRUCTURALLY_PROHIBITED.has(claim.entityKind) || claim.claimScope === 'exact_lot') {
    return { websiteHolding: 'none', websiteField: FIELD_BY_SCOPE[claim.claimScope] || 'none', compatibility: 'prohibited' };
  }
  const websiteHolding = HOLDING_BY_KIND[claim.entityKind] || 'newHolding';
  return {
    websiteHolding,
    websiteField: FIELD_BY_SCOPE[claim.claimScope] || claim.predicate || 'description',
    // Tea Reference currently has no field-level citation model. Even fields
    // with an obvious destination need that support before this can be loaded
    // without discarding evidence.
    compatibility: 'requires_model_extension',
  };
}

function holdReasonFor(claim, resolution, destination) {
  if (destination.compatibility === 'prohibited') {
    return claim.entityKind === 'exact_lot' || claim.claimScope === 'exact_lot'
      ? 'An exact lot belongs with its exact lot record, not in the shared Tea Reference catalogue.'
      : 'This entity is intentionally held outside the public Tea Reference catalogue.';
  }
  if (claim.claimScope === 'common_characteristics' || claim.claimScope === 'cultivar_potential') {
    return 'Keep this as cited potential or common characteristics, separate from exact-lot descriptions and Adrian tasting; the website needs a dedicated cited field.';
  }
  if (claim.status === 'held' && claim.uncertaintyReason) return claim.uncertaintyReason;
  if (resolution?.proposedAction === 'private_verification') return resolution.reason;
  if (resolution?.reason) return resolution.reason;
  return 'Preview only: the website needs field-level citation support and an approved entity mapping before publication.';
}

export function buildWebsiteHandoff(capture) {
  const resolutions = resolutionMap(capture);
  const sources = sourceMap(capture);
  const citationsById = new Map();
  const claims = [...(capture.claims ?? [])]
    .sort((left, right) => left.claimId.localeCompare(right.claimId))
    .map((claim) => {
      const packet = sources.get(claim.sourceId);
      const resolution = resolutions.get(claim.claimId);
      const destination = destinationFor(claim);
      const id = citationId(claim);
      citationsById.set(id, Object.freeze({
        citationId: id,
        sourceId: claim.sourceId,
        evidenceId: claim.evidenceId,
        publisher: packet?.source.publisher || '',
        publisherRole: packet?.source.publisherRole || claim.assertingPublisherRole || '',
        title: packet?.metadata.title || '',
        author: packet?.metadata.author || '',
        publishedDate: packet?.metadata.publishedDate || '',
        accessedDate: packet?.retrieval.accessedDate || '',
        url: packet?.source.url || '',
      }));
      return Object.freeze({
        claimId: claim.claimId,
        resolutionId: resolution?.resolutionId || '',
        canonicalEntityId: resolution?.canonicalId || '',
        subject: claim.subject,
        entityKind: claim.entityKind,
        claimScope: claim.claimScope,
        websiteHolding: destination.websiteHolding,
        websiteField: destination.websiteField,
        candidateValue: claim.value,
        qualifiers: claim.qualifiers || {},
        assertingPublisherRole: claim.assertingPublisherRole || packet?.source.publisherRole || '',
        compatibility: destination.compatibility,
        citationId: id,
        proposedAction: 'hold',
        holdReason: holdReasonFor(claim, resolution, destination),
        payloadSha256: claim.payloadSha256,
      });
    });

  const entities = [...(capture.entityResolution ?? [])]
    .sort((left, right) => left.resolutionId.localeCompare(right.resolutionId))
    .map((resolution) => Object.freeze({
      resolutionId: resolution.resolutionId,
      canonicalEntityId: resolution.canonicalId || '',
      preferredLabel: resolution.preferredLabel || resolution.subject,
      sourceLabel: resolution.subject,
      entityKind: resolution.entityKind,
      websiteHolding: destinationFor({ entityKind: resolution.entityKind, claimScope: 'identity', predicate: 'description' }).websiteHolding,
      proposedAction: 'hold',
      resolutionStatus: resolution.proposedAction,
      reason: resolution.reason,
      claimIds: [...(resolution.claimIds ?? [])].sort(),
    }));
  const citations = [...citationsById.values()].sort((left, right) => left.citationId.localeCompare(right.citationId));
  const heldBack = claims.map(({ claimId, holdReason }) => Object.freeze({ claimId, reason: holdReason }));
  const payload = Object.freeze({ entities: Object.freeze(entities), claims: Object.freeze(claims), citations: Object.freeze(citations), heldBack: Object.freeze(heldBack) });
  const manifest = Object.freeze({
    schemaVersion: 1,
    siteModel: 'tea-wisdom-v1',
    mode: 'preview-only',
    claimsSha256: capture.manifest?.claimsSha256 || '',
    sourceSnapshotSha256: capture.manifest?.sourceSnapshotSha256 || '',
    entityCount: entities.length,
    claimCount: claims.length,
    citationCount: citations.length,
    readyToPublishCount: 0,
    heldBackCount: heldBack.length,
    payloadSha256: sha256(canonicalJson(payload)),
  });
  return Object.freeze({ manifest, ...payload });
}

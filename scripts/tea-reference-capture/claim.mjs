import { canonicalJson, sha256, stableId } from './canonical.mjs';

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

export function createClaimDraft({
  source,
  evidenceId,
  subject,
  predicate,
  value,
  claimScope,
  entityKind,
  sourceTerm = '',
  qualifiers = {},
  modality = 'stated',
  status = 'captured',
  uncertaintyReason = '',
}) {
  if (!source || typeof source !== 'object') throw new Error('Claim source is required');
  const scope = requireText(claimScope, 'Claim scope');
  if (scope === 'personal_tasting') throw new Error('Hermes cannot create personal tasting claims');
  if (!source.permittedClaimScopes?.includes(scope)) throw new Error(`Claim scope is not permitted for source ${source.sourceId}: ${scope}`);
  const kind = requireText(entityKind, 'Entity kind');
  if (!source.permittedEntityKinds?.includes(kind)) throw new Error(`Entity kind is not permitted for source ${source.sourceId}: ${kind}`);

  const normalized = {
    sourceId: requireText(source.sourceId, 'Source ID'),
    evidenceId: requireText(evidenceId, 'Evidence ID'),
    subject: requireText(subject, 'Subject'),
    predicate: requireText(predicate, 'Predicate'),
    value,
    claimScope: scope,
    entityKind: kind,
    sourceTerm: String(sourceTerm || '').trim(),
    qualifiers,
    modality: String(modality || 'stated').trim(),
    assertingPublisherRole: requireText(source.publisherRole, 'Publisher role'),
  };

  let resolvedStatus = status;
  let resolvedUncertainty = String(uncertaintyReason || '').trim();
  if (source.publisherRole === 'retailer_reseller' && normalized.predicate === 'producer') {
    resolvedStatus = 'held';
    resolvedUncertainty = 'A retailer or reseller cannot be treated as the producer without separate exact maker evidence.';
  }
  if (kind === 'germplasm_accession' && normalized.predicate === 'entity_kind' && String(value).toLowerCase() === 'cultivar') {
    resolvedStatus = 'held';
    resolvedUncertainty = 'A germplasm accession is not automatically an industry cultivar.';
  }

  const claimId = stableId('claim', [normalized.sourceId, normalized.evidenceId, normalized.subject, normalized.predicate, normalized.value, scope]);
  const payload = { claimId, ...normalized, status: resolvedStatus, uncertaintyReason: resolvedUncertainty };
  const payloadSha256 = sha256(canonicalJson(payload));

  return Object.freeze({
    ...payload,
    payloadSha256,
    idempotencyKey: `tea-reference-capture:v1:${claimId}:${payloadSha256}`,
  });
}

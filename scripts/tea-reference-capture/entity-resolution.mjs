import { stableId } from './canonical.mjs';

export function normalizeEntityLabel(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[’'ʻ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

const AUTHORITY_ENTITIES = Object.freeze([
  Object.freeze({
    canonicalId: 'tea-family:puer',
    entityKind: 'tea_family',
    preferredLabel: 'Pu’er tea',
    parentCanonicalId: '',
    nativeAliases: Object.freeze(['普洱', '普洱茶']),
    romanizedAliases: Object.freeze(['Puer', 'Pu er', 'Pu-erh', 'Puerh', 'Pu’er tea']),
  }),
  Object.freeze({
    canonicalId: 'tea-style:sheng-puer',
    entityKind: 'tea_style',
    preferredLabel: 'Sheng Pu’er',
    parentCanonicalId: 'tea-family:puer',
    nativeAliases: Object.freeze(['普洱生茶', '生普', '生茶']),
    romanizedAliases: Object.freeze(['Sheng Puer', 'Sheng Puerh', 'Sheng Pu-erh', 'Raw Puer', 'Raw Pu-erh']),
  }),
  Object.freeze({
    canonicalId: 'tea-style:shou-puer',
    entityKind: 'tea_style',
    preferredLabel: 'Shou Pu’er',
    parentCanonicalId: 'tea-family:puer',
    nativeAliases: Object.freeze(['普洱熟茶', '熟普', '熟茶']),
    romanizedAliases: Object.freeze(['Shou Puer', 'Shu Puer', 'Shou Puerh', 'Ripe Puer', 'Ripe Pu-erh']),
  }),
]);

function authorityIndex(authorities) {
  const index = new Map();
  for (const entity of authorities) {
    index.set(`${entity.entityKind}\u001f${normalizeEntityLabel(entity.preferredLabel)}`, { entity, basis: 'canonical_label' });
    for (const alias of entity.nativeAliases) index.set(`${entity.entityKind}\u001f${normalizeEntityLabel(alias)}`, { entity, basis: 'curated_native_alias' });
    for (const alias of entity.romanizedAliases) index.set(`${entity.entityKind}\u001f${normalizeEntityLabel(alias)}`, { entity, basis: 'curated_romanized_alias' });
  }
  return index;
}

export function buildEntityResolutionPreview(claims, { authorities = AUTHORITY_ENTITIES } = {}) {
  const candidates = new Map();
  for (const claim of claims) {
    const key = [claim.entityKind, claim.subject].join('\u001f');
    if (!candidates.has(key)) candidates.set(key, { subject: claim.subject, entityKind: claim.entityKind, claimIds: new Set(), sourceIds: new Set() });
    candidates.get(key).claimIds.add(claim.claimId);
    candidates.get(key).sourceIds.add(claim.sourceId);
  }

  const duplicateCounts = new Map();
  for (const candidate of candidates.values()) {
    const key = `${candidate.entityKind}\u001f${normalizeEntityLabel(candidate.subject)}`;
    duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
  }
  const index = authorityIndex(authorities);
  const preview = [];
  for (const candidate of candidates.values()) {
    const normalizedLabel = normalizeEntityLabel(candidate.subject);
    const kindKey = `${candidate.entityKind}\u001f${normalizedLabel}`;
    const authority = index.get(kindKey);
    const duplicate = duplicateCounts.get(kindKey) > 1;
    let proposedAction = 'hold_unresolved';
    let reason = 'No authority identifier or exact curated alias supports a merge.';
    let duplicateClusterId = '';
    if (authority) {
      proposedAction = 'private_verification';
      reason = authority.basis === 'curated_romanized_alias'
        ? 'A curated romanization proposes this entity, but romanization alone never permits an automatic merge.'
        : 'An exact curated label proposes this entity; Adrian must privately verify the mapping before assimilation.';
      duplicateClusterId = authority.entity.canonicalId;
    } else if (duplicate) {
      proposedAction = 'duplicate_candidate';
      reason = 'The same normalized name appears more than once within one entity kind; review context before merging.';
      duplicateClusterId = stableId('duplicate', [candidate.entityKind, normalizedLabel]);
    }
    preview.push(Object.freeze({
      resolutionId: stableId('resolution', [candidate.entityKind, candidate.subject]),
      subject: candidate.subject,
      entityKind: candidate.entityKind,
      normalizedLabel,
      canonicalId: authority?.entity.canonicalId || '',
      preferredLabel: authority?.entity.preferredLabel || '',
      parentCanonicalId: authority?.entity.parentCanonicalId || '',
      matchBasis: authority?.basis || (duplicate ? 'same_kind_normalized_name' : 'unresolved'),
      proposedAction,
      reason,
      duplicateClusterId,
      autoMerge: false,
      claimIds: Object.freeze([...candidate.claimIds].sort()),
      sourceIds: Object.freeze([...candidate.sourceIds].sort()),
    }));
  }
  return Object.freeze(preview.sort((left, right) => left.resolutionId.localeCompare(right.resolutionId)));
}

export { AUTHORITY_ENTITIES };

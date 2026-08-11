import { canonicalJson, stableId } from './canonical.mjs';
import { normalizeEntityLabel } from './entity-resolution.mjs';

const SINGLE_VALUE_PREDICATES = new Set([
  'development_year',
  'founded_year',
  'origin',
  'parentage',
  'producer',
  'registration_number',
  'release_year',
]);

const NARRATIVE_PREDICATES = new Set([
  'common_characteristics',
  'source_description',
  'study_abstract',
]);

function normalizedValue(value) {
  if (typeof value === 'string') return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
  return canonicalJson(value);
}

function classify(group) {
  const values = new Set(group.map(({ value }) => normalizedValue(value)));
  const scopes = new Set(group.map(({ claimScope }) => claimScope));
  const hasStudyScope = group.some(({ qualifiers }) => qualifiers?.studyScoped || qualifiers?.evidenceType === 'individual_study');
  const predicate = group[0].predicate;
  if (values.size === 1) {
    return {
      classification: 'supporting_information',
      reason: 'Independent claims state the same normalized value.',
    };
  }
  if (hasStudyScope || predicate === 'study_abstract') {
    return {
      classification: 'different_scope_or_method',
      reason: 'The claims summarize different studies, samples, or methods and are not directly contradictory.',
    };
  }
  if (scopes.size > 1 || NARRATIVE_PREDICATES.has(predicate)) {
    return {
      classification: 'different_scope_or_method',
      reason: 'The claims are attributed descriptions or use different scopes; both may be true in context.',
    };
  }
  if (SINGLE_VALUE_PREDICATES.has(predicate)) {
    return {
      classification: 'genuine_contradiction',
      reason: 'Different values are asserted for a normally single-valued fact and require private verification.',
    };
  }
  return {
    classification: 'different_scope_or_method',
    reason: 'The predicate may accept multiple values; retain the claims side by side until their scope is reviewed.',
  };
}

export function classifyClaimRelationships(claims) {
  const groups = new Map();
  for (const claim of claims) {
    const key = [claim.entityKind, normalizeEntityLabel(claim.subject), claim.predicate].join('\u001f');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(claim);
  }

  const relationships = [];
  for (const [key, group] of groups) {
    const distinctSourceCount = new Set(group.map(({ sourceId }) => sourceId)).size;
    if (group.length < 2 || distinctSourceCount < 2) continue;
    const result = classify(group);
    relationships.push(Object.freeze({
      relationshipId: stableId('relationship', [key, result.classification]),
      classification: result.classification,
      reason: result.reason,
      subject: group[0].subject,
      entityKind: group[0].entityKind,
      predicate: group[0].predicate,
      distinctSourceCount,
      distinctValueCount: new Set(group.map(({ value }) => normalizedValue(value))).size,
      claims: Object.freeze([...group].sort((left, right) => left.claimId.localeCompare(right.claimId))),
    }));
  }
  return Object.freeze(relationships.sort((left, right) => left.relationshipId.localeCompare(right.relationshipId)));
}

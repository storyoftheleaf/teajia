import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyClaimRelationships } from '../claim-relationships.mjs';

function claim(overrides = {}) {
  return {
    claimId: overrides.claimId || `claim-${Math.random()}`,
    sourceId: overrides.sourceId || 'source-a',
    subject: overrides.subject || 'Pu’er tea',
    entityKind: overrides.entityKind || 'tea_family',
    claimScope: overrides.claimScope || 'geography',
    predicate: overrides.predicate || 'study_abstract',
    value: overrides.value || 'Study result A',
    qualifiers: overrides.qualifiers || {},
  };
}

test('different study abstracts are different scope, not a contradiction', () => {
  const groups = classifyClaimRelationships([
    claim({ claimId: 'a', sourceId: 'paper-a', value: 'Eighty-five samples from three prefectures.', qualifiers: { studyScoped: true } }),
    claim({ claimId: 'b', sourceId: 'paper-b', value: 'Samples from twelve mountains.', qualifiers: { studyScoped: true } }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].classification, 'different_scope_or_method');
  assert.match(groups[0].reason, /study|method|sample/i);
});

test('the same normalized value from independent sources is supporting information', () => {
  const groups = classifyClaimRelationships([
    claim({ claimId: 'a', sourceId: 'registry-a', predicate: 'development_year', value: '1981', claimScope: 'identity' }),
    claim({ claimId: 'b', sourceId: 'registry-b', predicate: 'development_year', value: ' 1981 ', claimScope: 'identity' }),
  ]);
  assert.equal(groups[0].classification, 'supporting_information');
  assert.equal(groups[0].distinctSourceCount, 2);
});

test('different single-valued identity facts form a genuine contradiction candidate', () => {
  const groups = classifyClaimRelationships([
    claim({ claimId: 'a', sourceId: 'registry-a', predicate: 'development_year', value: '1981', claimScope: 'identity' }),
    claim({ claimId: 'b', sourceId: 'registry-b', predicate: 'development_year', value: '1982', claimScope: 'identity' }),
  ]);
  assert.equal(groups[0].classification, 'genuine_contradiction');
  assert.match(groups[0].reason, /single-valued/i);
});

test('different attributed characteristic prose is different scope rather than contradictory', () => {
  const groups = classifyClaimRelationships([
    claim({ claimId: 'a', sourceId: 'source-a', predicate: 'common_characteristics', value: 'Floral aroma.', claimScope: 'common_characteristics' }),
    claim({ claimId: 'b', sourceId: 'source-b', predicate: 'common_characteristics', value: 'Mineral finish.', claimScope: 'common_characteristics' }),
  ]);
  assert.equal(groups[0].classification, 'different_scope_or_method');
});

test('single claims do not create relationship groups', () => {
  assert.deepEqual(classifyClaimRelationships([claim({ claimId: 'a' })]), []);
});

test('multiple paragraphs from one source are not treated as cross-source relationships', () => {
  assert.deepEqual(classifyClaimRelationships([
    claim({ claimId: 'a', sourceId: 'article-a', predicate: 'source_description', value: 'Yiwu is a broad marketed area.' }),
    claim({ claimId: 'b', sourceId: 'article-a', predicate: 'source_description', value: 'Yiwu is also a town name.' }),
  ]), []);
});

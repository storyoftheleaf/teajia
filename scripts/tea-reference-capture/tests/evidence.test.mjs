import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalJson, sha256, stableId } from '../canonical.mjs';
import { createEvidence, normalizeCapturedText } from '../evidence.mjs';

test('canonical JSON is identical regardless of object insertion order', () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
});

test('canonical JSON sorts nested objects but preserves array order', () => {
  assert.equal(canonicalJson({ z: [{ b: 2, a: 1 }, 'x'] }), '{"z":[{"a":1,"b":2},"x"]}');
});

test('normalization preserves paragraphs while removing unstable spacing', () => {
  assert.equal(normalizeCapturedText(' Alpha  beta \n\n Gamma\t delta '), 'Alpha beta\n\nGamma delta');
});

test('evidence stores an exact contained excerpt and character positions', () => {
  const evidence = createEvidence({ sourceId: 's1', normalizedText: 'alpha beta gamma', exact: 'beta', heading: 'Profile' });
  assert.equal(evidence.start, 6);
  assert.equal(evidence.end, 10);
  assert.equal(evidence.exact, 'beta');
  assert.equal(evidence.excerptSha256, sha256('beta'));
  assert.equal(evidence.prefix, 'alpha ');
  assert.equal(evidence.suffix, ' gamma');
});

test('evidence rejects an excerpt absent from normalized text', () => {
  assert.throws(() => createEvidence({ sourceId: 's1', normalizedText: 'alpha', exact: 'beta' }), /not found/i);
});

test('stable IDs do not change for the same semantic key', () => {
  assert.equal(stableId('claim', ['s1', 'subject', 'predicate']), stableId('claim', ['s1', 'subject', 'predicate']));
});


import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEntityResolutionPreview } from '../entity-resolution.mjs';

function claim({ claimId, sourceId, subject, entityKind }) {
  return { claimId, sourceId, subject, entityKind };
}

test('native Chinese aliases propose one known Pu’er entity without auto-merging', () => {
  const preview = buildEntityResolutionPreview([
    claim({ claimId: 'a', sourceId: 'cn-a', subject: '普洱生茶', entityKind: 'tea_style' }),
    claim({ claimId: 'b', sourceId: 'cn-b', subject: '生普', entityKind: 'tea_style' }),
  ]);
  assert.equal(preview.length, 2);
  assert.equal(preview.every(({ canonicalId }) => canonicalId === 'tea-style:sheng-puer'), true);
  assert.equal(preview.every(({ proposedAction }) => proposedAction === 'private_verification'), true);
  assert.equal(preview.every(({ autoMerge }) => autoMerge === false), true);
  assert.equal(preview.every(({ parentCanonicalId }) => parentCanonicalId === 'tea-family:puer'), true);
});

test('romanized aliases are explicitly held for private verification', () => {
  const [candidate] = buildEntityResolutionPreview([
    claim({ claimId: 'a', sourceId: 'en-a', subject: 'Sheng Puerh', entityKind: 'tea_style' }),
  ]);
  assert.equal(candidate.matchBasis, 'curated_romanized_alias');
  assert.equal(candidate.proposedAction, 'private_verification');
  assert.match(candidate.reason, /romanization/i);
});

test('same normalized names within one entity kind become duplicate candidates only', () => {
  const preview = buildEntityResolutionPreview([
    claim({ claimId: 'a', sourceId: 'a', subject: 'Lao Ban Zhang', entityKind: 'village' }),
    claim({ claimId: 'b', sourceId: 'b', subject: 'Lao  Ban-Zhang', entityKind: 'village' }),
  ]);
  assert.equal(preview.every(({ duplicateClusterId }) => duplicateClusterId), true);
  assert.equal(preview.every(({ proposedAction }) => proposedAction === 'duplicate_candidate'), true);
  assert.equal(preview.every(({ autoMerge }) => autoMerge === false), true);
});

test('the same text across different entity kinds is never clustered together', () => {
  const preview = buildEntityResolutionPreview([
    claim({ claimId: 'a', sourceId: 'a', subject: 'Yiwu', entityKind: 'tea_area' }),
    claim({ claimId: 'b', sourceId: 'b', subject: 'Yiwu', entityKind: 'named_tea' }),
  ]);
  assert.equal(preview.every(({ duplicateClusterId }) => duplicateClusterId === ''), true);
  assert.equal(preview.every(({ proposedAction }) => proposedAction === 'hold_unresolved'), true);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWebsiteHandoff } from '../website-handoff.mjs';

const source = {
  sourceId: 'specialist-yiwu',
  url: 'https://example.test/yiwu',
  publisher: 'Example Specialist',
  publisherRole: 'specialist_editorial',
};

const capture = {
  manifest: { claimsSha256: 'claims-hash', sourceSnapshotSha256: 'sources-hash' },
  sources: [{
    source,
    metadata: { title: 'Yiwu Tea Region', author: 'Example Researcher', publishedDate: '2024-04-10' },
    retrieval: { accessedDate: '2026-08-10' },
  }],
  claims: [
    {
      claimId: 'CLAIM-REGION', sourceId: source.sourceId, evidenceId: 'EVIDENCE-REGION', subject: 'Yiwu',
      entityKind: 'tea_area', claimScope: 'geography', predicate: 'source_description', value: 'Yiwu is in eastern Xishuangbanna.',
      assertingPublisherRole: 'specialist_editorial', status: 'held', uncertaintyReason: 'Needs private review.', payloadSha256: 'claim-hash-1',
    },
    {
      claimId: 'CLAIM-POTENTIAL', sourceId: source.sourceId, evidenceId: 'EVIDENCE-POTENTIAL', subject: 'Yiwu',
      entityKind: 'tea_area', claimScope: 'common_characteristics', predicate: 'source_description', value: 'Often described as fragrant.',
      assertingPublisherRole: 'specialist_editorial', status: 'held', uncertaintyReason: 'Needs private review.', payloadSha256: 'claim-hash-2',
    },
    {
      claimId: 'CLAIM-LOT', sourceId: source.sourceId, evidenceId: 'EVIDENCE-LOT', subject: '2026 Yiwu cake',
      entityKind: 'exact_lot', claimScope: 'exact_lot', predicate: 'source_description', value: 'Seller description.',
      assertingPublisherRole: 'retailer_reseller', status: 'held', uncertaintyReason: 'Exact lot.', payloadSha256: 'claim-hash-3',
    },
  ],
  entityResolution: [
    {
      resolutionId: 'RESOLUTION-YIWU', subject: 'Yiwu', entityKind: 'tea_area', canonicalId: '', preferredLabel: '',
      proposedAction: 'hold_unresolved', reason: 'No authority identifier.', claimIds: ['CLAIM-POTENTIAL', 'CLAIM-REGION'], sourceIds: [source.sourceId],
    },
    {
      resolutionId: 'RESOLUTION-LOT', subject: '2026 Yiwu cake', entityKind: 'exact_lot', canonicalId: '', preferredLabel: '',
      proposedAction: 'hold_unresolved', reason: 'No authority identifier.', claimIds: ['CLAIM-LOT'], sourceIds: [source.sourceId],
    },
  ],
};

test('website handoff names the site destination without publishing held claims', () => {
  const handoff = buildWebsiteHandoff(capture);

  assert.equal(handoff.manifest.mode, 'preview-only');
  assert.equal(handoff.manifest.readyToPublishCount, 0);
  assert.equal(handoff.manifest.heldBackCount, 3);
  assert.equal(handoff.manifest.claimsSha256, 'claims-hash');

  const geography = handoff.claims.find(({ claimId }) => claimId === 'CLAIM-REGION');
  assert.equal(geography.websiteHolding, 'regions');
  assert.equal(geography.websiteField, 'description');
  assert.equal(geography.claimScope, 'geography');
  assert.equal(geography.candidateValue, 'Yiwu is in eastern Xishuangbanna.');
  assert.equal(geography.assertingPublisherRole, 'specialist_editorial');
  assert.equal(geography.compatibility, 'requires_model_extension');
  assert.equal(geography.proposedAction, 'hold');
  assert.equal(geography.citationId, 'CITATION-SPECIALIST-YIWU-EVIDENCE-REGION');

  const potential = handoff.claims.find(({ claimId }) => claimId === 'CLAIM-POTENTIAL');
  assert.equal(potential.websiteField, 'commonCharacteristics');
  assert.equal(potential.compatibility, 'requires_model_extension');
  assert.match(potential.holdReason, /Adrian tasting/i);

  const exactLot = handoff.claims.find(({ claimId }) => claimId === 'CLAIM-LOT');
  assert.equal(exactLot.websiteHolding, 'none');
  assert.equal(exactLot.compatibility, 'prohibited');
  assert.match(exactLot.holdReason, /exact lot/i);

  assert.deepEqual(handoff.citations[0], {
    citationId: 'CITATION-SPECIALIST-YIWU-EVIDENCE-LOT',
    sourceId: 'specialist-yiwu',
    evidenceId: 'EVIDENCE-LOT',
    publisher: 'Example Specialist',
    publisherRole: 'specialist_editorial',
    title: 'Yiwu Tea Region',
    author: 'Example Researcher',
    publishedDate: '2024-04-10',
    accessedDate: '2026-08-10',
    url: 'https://example.test/yiwu',
  });
  assert.equal('exactSourceText' in handoff.citations[0], false);
});

test('website handoff is deterministically sorted', () => {
  const reversed = { ...capture, claims: [...capture.claims].reverse(), entityResolution: [...capture.entityResolution].reverse() };
  assert.deepEqual(buildWebsiteHandoff(reversed), buildWebsiteHandoff(capture));
});

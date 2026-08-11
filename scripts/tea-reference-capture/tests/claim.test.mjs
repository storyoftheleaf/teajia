import test from 'node:test';
import assert from 'node:assert/strict';

import { createClaimDraft } from '../claim.mjs';

test('a retailer publisher is not silently made the producer', () => {
  const claim = createClaimDraft({
    source: {
      sourceId: 'shop',
      publisherRole: 'retailer_reseller',
      permittedEntityKinds: ['named_tea'],
      permittedClaimScopes: ['exact_lot'],
    },
    evidenceId: 'e1',
    subject: 'tea-1',
    predicate: 'producer',
    value: 'Shop Name',
    claimScope: 'exact_lot',
    entityKind: 'named_tea',
  });
  assert.equal(claim.status, 'held');
  assert.match(claim.uncertaintyReason, /retailer.*producer/i);
});

test('Hermes cannot create Adrian personal tasting', () => {
  assert.throws(() => createClaimDraft({
    source: {
      sourceId: 's1',
      publisherRole: 'specialist_editorial',
      permittedEntityKinds: ['tea_area'],
      permittedClaimScopes: ['personal_tasting'],
    },
    evidenceId: 'e1',
    subject: 'yiwu',
    predicate: 'flavor',
    value: 'floral',
    claimScope: 'personal_tasting',
    entityKind: 'tea_area',
  }), /personal tasting/i);
});

test('an accession remains an accession without cultivar identity evidence', () => {
  const claim = createClaimDraft({
    source: {
      sourceId: 'repo',
      publisherRole: 'registry',
      permittedEntityKinds: ['germplasm_accession'],
      permittedClaimScopes: ['identity'],
    },
    evidenceId: 'e1',
    subject: 'A-12',
    predicate: 'entity_kind',
    value: 'cultivar',
    claimScope: 'identity',
    entityKind: 'germplasm_accession',
  });
  assert.equal(claim.status, 'held');
  assert.match(claim.uncertaintyReason, /accession/i);
});

test('rejects entity kinds or scopes outside the source allowlist', () => {
  const source = {
    sourceId: 's1', publisherRole: 'institute', permittedEntityKinds: ['cultivar'], permittedClaimScopes: ['identity'],
  };
  assert.throws(() => createClaimDraft({
    source, evidenceId: 'e1', subject: 'x', predicate: 'origin', value: 'Yunnan', claimScope: 'geography', entityKind: 'cultivar',
  }), /scope.*not permitted/i);
});

test('creates a stable payload hash and idempotency key', () => {
  const input = {
    source: { sourceId: 's1', publisherRole: 'institute', permittedEntityKinds: ['cultivar'], permittedClaimScopes: ['identity'] },
    evidenceId: 'e1', subject: 'qingxin', predicate: 'native_name', value: '青心烏龍', claimScope: 'identity', entityKind: 'cultivar',
  };
  const first = createClaimDraft(input);
  const second = createClaimDraft(input);
  assert.equal(first.claimId, second.claimId);
  assert.equal(first.payloadSha256, second.payloadSha256);
  assert.equal(first.idempotencyKey, `tea-reference-capture:v1:${first.claimId}:${first.payloadSha256}`);
});

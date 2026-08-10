import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalJson, sha256 } from '../../tea-reference-capture/canonical.mjs';
import { verifyHandoffIntegrity } from '../load-preview.mjs';

function handoff() {
  const payload = {
    entities: [],
    claims: [],
    citations: [],
    heldBack: [],
  };
  return {
    manifest: {
      schemaVersion: 1,
      mode: 'preview-only',
      entityCount: 0,
      claimCount: 0,
      citationCount: 0,
      heldBackCount: 0,
      payloadSha256: sha256(canonicalJson(payload)),
    },
    ...payload,
  };
}

test('accepts an unchanged canonical handoff payload', () => {
  assert.doesNotThrow(() => verifyHandoffIntegrity(handoff()));
});

test('rejects payload tampering under the original manifest hash', () => {
  const input = handoff();
  input.claims.push({ claimId: 'CLAIM-TAMPERED', candidateValue: 'Changed after capture.' });
  assert.throws(() => verifyHandoffIntegrity(input), /integrity.*hash/i);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { canonicalJson, sha256 } from '../../tea-reference-capture/canonical.mjs';
import { loadPublicTransport, verifyHandoffIntegrity } from '../load-preview.mjs';

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
      siteModel: 'tea-wisdom-v1',
      mode: 'preview-only',
      claimsSha256: 'a'.repeat(64),
      sourceSnapshotSha256: 'b'.repeat(64),
      entityCount: 0,
      claimCount: 0,
      citationCount: 0,
      readyToPublishCount: 0,
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

test('loads only the allowlisted public transport from a handoff file', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-public-transport-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const handoffPath = path.join(temp, 'website-handoff.json');
  await fs.writeFile(handoffPath, JSON.stringify(handoff()));

  const transport = await loadPublicTransport({ handoffPath });

  assert.deepEqual(Object.keys(transport), ['manifest', 'publicPreview']);
  assert.deepEqual(transport.manifest, { schemaVersion: 1, mode: 'preview-only' });
  assert.doesNotMatch(
    JSON.stringify(transport),
    /operations|projectedState|privateVerification|evidenceIds?|holdReason|candidateValue|(?:inputPayload|sourceSnapshot|payload)Sha256/i,
  );
});

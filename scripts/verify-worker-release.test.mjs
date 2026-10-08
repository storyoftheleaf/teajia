import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deployedVersion, verifyWorkerRelease } from './verify-worker-release.mjs';
const version = '12345678-1234-1234-1234-123456789abc';
const revision = 'a'.repeat(40);
test('captures one exact version from successful Wrangler deploy output', () => {
  assert.equal(deployedVersion(`Uploaded teajia-api\nCurrent Version ID: ${version}\n`), version);
  assert.throws(() => deployedVersion('Upload failed'));
  assert.throws(() => deployedVersion(`Current Version ID: ${version}\nCurrent Version ID: ${version}`));
});
test('requires both live Git revision and deployment version on each origin', async () => {
  const origins = ['https://api.teajia.com', 'https://teajia-api.lightcodes.workers.dev'];
  const proof = await verifyWorkerRelease({ revision, versionId: version, origins, fetcher: async () => Response.json({ revision, versionId: version }) });
  assert.equal(proof.endpoints.length, 2);
  for (const live of [{ revision: 'b'.repeat(40), versionId: version }, { revision, versionId: 'old' }]) {
    await assert.rejects(verifyWorkerRelease({ revision, versionId: version, origins, attempts: 1, fetcher: async () => Response.json(live) }));
  }
});
test('retries stale propagation without deploying again', async () => {
  let calls = 0;
  const proof = await verifyWorkerRelease({ revision, versionId: version, origins: ['https://api.teajia.com'], attempts: 2, wait: async () => {}, fetcher: async () => Response.json({ revision: ++calls === 1 ? 'old' : revision, versionId: version }) });
  assert.equal(calls, 2);
  assert.equal(proof.status, 'worker_verified');
});

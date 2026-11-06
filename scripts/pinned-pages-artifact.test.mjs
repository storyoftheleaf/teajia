import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadPinnedPagesArtifact } from './pinned-pages-artifact.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const candidate = 'a'.repeat(40), tree = 'b'.repeat(40), versionId = '12345678-1234-1234-1234-123456789abc';
function fixture(changes = {}) {
  const pages = { revision: candidate, tree, runId: 321, runAttempt: 1, buildId: 'build', files: { '/index.html': sha('<html>') } };
  const pagesBytes = Buffer.from(JSON.stringify(pages));
  const result = { state: 'live', candidate, sourceTree: tree, pagesArtifactRunId: 321, pagesArtifactRunAttempt: 1,
    pagesArtifactSha256: sha(pagesBytes), buildId: 'build', worker: { revision: candidate, versionId } };
  const state = { status: 'live', candidate, runId: 321, runAttempt: 1, workerProof: { versionId }, result };
  const run = { id: 321, run_attempt: 1, head_sha: candidate, status: 'completed', conclusion: 'success', path: '.github/workflows/deploy-worker.yml' };
  const row = (id, name) => ({ id, name, expired: false, workflow_run: { id: 321, head_sha: candidate } });
  const listing = { total_count: 2, artifacts: [row(1, 'release-result'), row(2, 'pages-release-artifact')] };
  const api = path => path.includes('/artifacts?') ? listing : run;
  const download = id => id === 1 ? Buffer.from(JSON.stringify(result)) : pagesBytes;
  return { state, run, listing, pages, result, api, download, ...changes };
}
test('downloads exact same-run release result and Pages artifact, then binds raw digest', () => {
  const f = fixture();
  const proven = loadPinnedPagesArtifact(f.state, f);
  assert.deepEqual(proven.artifact, f.pages);
  assert.equal(proven.provenance.pagesArtifactId, 2);
  assert.equal(proven.provenance.pagesArtifactSha256, f.result.pagesArtifactSha256);
});
test('rejects wrong run, head, attempt, missing and duplicate artifacts', () => {
  const cases = [
    f => { f.run.id = 999; },
    f => { f.run.head_sha = 'c'.repeat(40); },
    f => { f.run.run_attempt = 2; },
    f => { f.listing.artifacts.pop(); f.listing.total_count = 1; },
    f => { f.listing.artifacts.push({ ...f.listing.artifacts[1], id: 3 }); f.listing.total_count = 3; },
    f => { f.listing.artifacts[1].workflow_run.head_sha = 'c'.repeat(40); },
    f => { f.listing.total_count = 101; },
  ];
  for (const alter of cases) { const f = fixture(); alter(f); assert.throws(() => loadPinnedPagesArtifact(f.state, f)); }
});
test('rejects altered raw Pages bytes, forged local result and wrong source', () => {
  const cases = [
    f => { f.download = id => id === 1 ? Buffer.from(JSON.stringify(f.result)) : Buffer.from(JSON.stringify({ ...f.pages, buildId: 'forged' })); },
    f => { f.state.result = { ...f.result, buildId: 'forged' }; },
    f => { f.result.sourceTree = 'c'.repeat(40); },
    f => { f.result.pagesArtifactRunAttempt = 2; },
  ];
  for (const alter of cases) { const f = fixture(); alter(f); assert.throws(() => loadPinnedPagesArtifact(f.state, f)); }
});

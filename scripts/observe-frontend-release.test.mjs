import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentUrl, candidateArtifact } from './observe-frontend-release.mjs';
const revision = 'a'.repeat(40);
const check = { name: 'Cloudflare Pages', head_sha: revision, status: 'completed', conclusion: 'success', output: { summary: 'https://abc123.teajiafinal.pages.dev' } };
test('only accepts successful immutable Pages deployment evidence for the exact revision', () => {
  assert.equal(deploymentUrl([check], revision), 'https://abc123.teajiafinal.pages.dev');
  assert.equal(deploymentUrl([{ ...check, head_sha: 'b'.repeat(40) }], revision), undefined);
  assert.equal(deploymentUrl([{ ...check, status: 'in_progress' }], revision), undefined);
  assert.throws(() => deploymentUrl([{ ...check, conclusion: 'failure' }], revision));
  assert.throws(() => deploymentUrl([{ ...check, output: { summary: 'https://abc.teajia.pages.dev' } }], revision));
});
test('protected Pages observer requires exact login, source deployment, and staged public bytes', async () => {
  const origin = 'https://abc123.teajiafinal.pages.dev';
  const project = { name: 'teajiafinal', production_branch: 'main', domains: ['teajia.com', 'www.teajia.com'], canonical_deployment: {
    id: 'deployment-id', environment: 'production', url: origin, latest_stage: { name: 'deploy', status: 'success' },
    deployment_trigger: { metadata: { commit_hash: revision } },
  } };
  const response = host => new Response(null, { status: 302, headers: { location: `${host}/cdn-cgi/access/login/abc123.teajiafinal.pages.dev?token=must-not-persist` } });
  const exact = { revision, buildId: 'build', files: {} };
  let publicCalls = 0;
  const dependencies = { fetcher: async () => response('https://soft-band-fe5b.cloudflareaccess.com'), project: async () => project,
    artifact: (host, source, manifest) => { assert.equal(host, 'https://www.teajia.com'); assert.equal(source, revision); assert.equal(manifest, exact); publicCalls++; return { buildId: 'build', hashes: {} }; } };
  const proven = await candidateArtifact(origin, revision, exact, dependencies);
  assert.equal(proven.protectedHost, true); assert.equal(publicCalls, 1);
  assert.equal(JSON.stringify(proven).includes('must-not-persist'), false);
  await assert.rejects(candidateArtifact(origin, revision, exact, { ...dependencies, fetcher: async () => response('https://attacker.example') }), /auth probe/);
  await assert.rejects(candidateArtifact(origin, revision, exact, { ...dependencies, project: async () => ({ ...project, canonical_deployment: { ...project.canonical_deployment, deployment_trigger: { metadata: { commit_hash: 'x' } } } }) }), /exact production candidate/);
  await assert.rejects(candidateArtifact(origin, revision, exact, { ...dependencies, artifact: () => { throw new Error('wrong public bytes'); } }), /wrong public bytes/);
});

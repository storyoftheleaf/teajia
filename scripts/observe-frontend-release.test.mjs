import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentUrl } from './observe-frontend-release.mjs';
const revision = 'a'.repeat(40);
const check = { name: 'Cloudflare Pages', head_sha: revision, status: 'completed', conclusion: 'success', output: { summary: 'https://abc123.teajiafinal.pages.dev' } };
test('only accepts successful immutable Pages deployment evidence for the exact revision', () => {
  assert.equal(deploymentUrl([check], revision), 'https://abc123.teajiafinal.pages.dev');
  assert.equal(deploymentUrl([{ ...check, head_sha: 'b'.repeat(40) }], revision), undefined);
  assert.equal(deploymentUrl([{ ...check, status: 'in_progress' }], revision), undefined);
  assert.throws(() => deploymentUrl([{ ...check, conclusion: 'failure' }], revision));
  assert.throws(() => deploymentUrl([{ ...check, output: { summary: 'https://abc.teajia.pages.dev' } }], revision));
});

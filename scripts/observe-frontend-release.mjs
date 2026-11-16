#!/usr/bin/env node
// Read-only proof for one Git-triggered Pages release; never deploys or pushes.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { assetPaths } from './publish-verified-release.mjs';
import { canonicalDeployment, projectMetadata, recognizedAccessRedirect, sameDeployment } from './pages-access-proof.mjs';

export function deploymentUrl(checks, revision) {
  const check = checks.find(c => c.name === 'Cloudflare Pages' && c.head_sha === revision);
  if (!check || check.status !== 'completed') return undefined;
  if (check.conclusion !== 'success') throw new Error(`Pages check finished: ${check.conclusion}`);
  const url = (check.output?.summary ?? '').match(/https:\/\/[a-z0-9-]+\.teajiafinal\.pages\.dev\b/)?.[0];
  if (!url) throw new Error('Successful Pages check has no immutable deployment URL');
  return url;
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function read(url) {
  return execFileSync('/usr/bin/curl', ['--disable', '--silent', '--show-error', '--fail', '--proto', '=https', '--max-time', '25', '--max-filesize', '16000000', '--header', 'Cache-Control: no-cache', url], { timeout: 30000, maxBuffer: 16_000_000, stdio: ['ignore', 'pipe', 'pipe'] });
}
function artifact(origin, revision, exact) {
  const version = read(`${origin}/version.json?proof=${revision}`);
  const buildId = JSON.parse(version).buildId;
  if (!buildId) throw new Error('No build number in deployed artifact');
  const html = read(`${origin}/?proof=${revision}`);
  const paths = assetPaths(html.toString());
  if (!paths.some(path => path.endsWith('.js'))) throw new Error('No entry script in deployed artifact');
  const hashes = { '/': digest(html), '/version.json': digest(version) };
  for (const path of Object.keys(exact.files).filter(p => p !== '/index.html' && p !== '/version.json')) hashes[path] = digest(read(`${origin}${path}`));
  if (paths.some(path => !Object.hasOwn(hashes, path)) || buildId !== exact.buildId ||
    Object.entries(hashes).some(([path, value]) => value !== exact.files[path === '/' ? '/index.html' : path])) {
    throw new Error('Pages bytes differ from exact candidate CI artifact');
  }
  return { buildId, hashes };
}
export async function candidateArtifact(origin, revision, exact, dependencies = {}) {
  const fetcher = dependencies.fetcher || fetch;
  const project = dependencies.project || projectMetadata;
  const getArtifact = dependencies.artifact || artifact;
  const probe = await fetcher(`${origin}/version.json?proof=${revision}`, {
    method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  const protectedHost = recognizedAccessRedirect(probe, origin, dependencies.loginOrigin ?? process.env.TEAJIA_ACCESS_LOGIN_ORIGIN);
  await probe.body?.cancel();
  if (!protectedHost && probe.status !== 200) throw new Error(`Immutable auth probe HTTP ${probe.status}`);
  if (!protectedHost) return { direct: getArtifact(origin, revision, exact), protectedHost: false };
  const first = await project();
  const identity = canonicalDeployment(first, revision, origin, first.canonical_deployment?.id);
  const direct = getArtifact('https://www.teajia.com', revision, exact);
  sameDeployment(identity, canonicalDeployment(await project(), revision, origin, first.canonical_deployment.id));
  return { direct, protectedHost: true, cloudflareDeployment: identity };
}
// Retired for coordinated releases: this standalone path had no authenticated
// same-run artifact handoff. The CI publisher plus pinned Read verifier own proof.
export async function observe() {
  throw new Error('Legacy frontend observer retired; use the coordinated release observer and pinned Read verifier');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await observe();

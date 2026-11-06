#!/usr/bin/env node
// Read-only proof for one Git-triggered Pages release; never deploys or pushes.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { assetPaths, proofMatches } from './publish-verified-release.mjs';
import { canonicalDeployment, recognizedAccessRedirect, sameDeployment } from './pages-access-proof.mjs';
import { DEFAULT_LEASE_PATH, releaseProductionLease } from './check-production-release-lease.mjs';

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
export async function projectMetadata() {
  const token = process.env.CLOUDFLARE_API_TOKEN || readFileSync(join(homedir(), '.wrangler/config/default.toml'), 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  if (!token) throw new Error('Existing Cloudflare authentication unavailable');
  const account = process.env.CLOUDFLARE_ACCOUNT_ID || 'fea8f6648edae8cf1e35032a3ae43611';
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/teajiafinal`, {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 200) throw new Error(`Cloudflare Pages metadata HTTP ${response.status}`);
  const body = await response.json();
  if (body.success !== true) throw new Error('Cloudflare Pages metadata unavailable');
  return body.result;
}
export async function candidateArtifact(origin, revision, exact, dependencies = {}) {
  const fetcher = dependencies.fetcher || fetch;
  const project = dependencies.project || projectMetadata;
  const getArtifact = dependencies.artifact || artifact;
  const probe = await fetcher(`${origin}/version.json?proof=${revision}`, {
    method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  const protectedHost = recognizedAccessRedirect(probe, origin);
  await probe.body?.cancel();
  if (!protectedHost && probe.status !== 200) throw new Error(`Immutable auth probe HTTP ${probe.status}`);
  if (!protectedHost) return { direct: getArtifact(origin, revision, exact), protectedHost: false };
  const first = await project();
  const identity = canonicalDeployment(first, revision, origin, first.canonical_deployment?.id);
  const direct = getArtifact('https://www.teajia.com', revision, exact);
  sameDeployment(identity, canonicalDeployment(await project(), revision, origin, first.canonical_deployment.id));
  return { direct, protectedHost: true, cloudflareDeployment: identity };
}
export async function observe(path) {
  const state = JSON.parse(readFileSync(path, 'utf8'));
  if (!/^[a-f0-9]{40}$/.test(state.revision)) throw new Error('Full candidate revision required');
  const exactPath = state.pagesArtifactPath || process.env.PAGES_ARTIFACT_PATH;
  if (!exactPath) throw new Error('Exact Pages CI artifact handoff is required');
  const exact = JSON.parse(readFileSync(exactPath, 'utf8'));
  if (exact.revision !== state.revision || exact.runId !== state.runId || exact.runAttempt !== state.runAttempt ||
    !/^[a-f0-9]{40}$/.test(exact.tree ?? '') || !exact.buildId || !exact.files ||
    Object.entries(exact.files).some(([key, value]) => !/^\/(?:index\.html|version\.json|assets\/[A-Za-z0-9_./-]+\.(?:js|css))$/.test(key) || !/^[a-f0-9]{64}$/.test(value))) {
    throw new Error('Exact Pages CI artifact identity or hashes invalid');
  }
  const commit = JSON.parse(execFileSync('gh', ['api', `repos/storyoftheleaf/teajia/git/commits/${state.revision}`],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 2_000_000, stdio: ['ignore', 'pipe', 'pipe'] }));
  if (commit.sha !== state.revision || commit.tree?.sha !== exact.tree) throw new Error('Exact Pages artifact source tree differs from GitHub candidate');
  const persist = extra => {
    Object.assign(state, extra, { updatedAt: new Date().toISOString() });
    writeFileSync(`${path}.tmp`, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  };
  persist({ pid: process.pid, state: 'observing' });
  while (Date.now() < state.deadline) {
    try {
      const body = JSON.parse(execFileSync('gh', ['api', `repos/storyoftheleaf/teajia/commits/${state.revision}/check-runs`], { encoding: 'utf8', timeout: 30000, maxBuffer: 2_000_000, stdio: ['ignore', 'pipe', 'pipe'] }));
      const url = deploymentUrl(body.check_runs, state.revision);
      if (url) {
        const candidate = await candidateArtifact(url, state.revision, exact);
        const direct = candidate.direct;
        const production = artifact('https://www.teajia.com', state.revision, exact);
        persist({ deploymentUrl: url, buildId: direct.buildId, direct, production,
          proofMethod: candidate.protectedHost ? 'canonical-bytes-and-cloudflare-deployment' : 'direct-immutable-bytes',
          ...(candidate.cloudflareDeployment ? { cloudflareDeployment: candidate.cloudflareDeployment } : {}) });
        if (proofMatches(direct, production)) { persist({ state: 'live', verifiedAt: new Date().toISOString() }); break; }
      }
    } catch (error) {
      // Keep diagnostics bounded and exclude response bodies/credentials.
      const message = error.message?.startsWith('Pages check finished:') ? error.message : 'Deployment proof not yet available';
      persist({ lastError: message });
      if (message.startsWith('Pages check finished:')) { persist({ state: 'failed' }); break; }
    }
    await new Promise(resolve => setTimeout(resolve, 45000));
  }
  if (state.state === 'observing') persist({ state: 'needs_attention', lastError: 'Bounded proof window ended; resume observation without redeploying' });
  await releaseProductionLease(DEFAULT_LEASE_PATH, state.revision, state.runUrl);
  if (process.platform === 'darwin' && !state.notified) {
    const message = state.state === 'live' ? `Taste changes are verified live, build ${state.buildId}.` : 'Taste publication needs attention. Check the saved release status.';
    try { execFileSync('/usr/bin/osascript', ['-e', `display notification ${JSON.stringify(message)} with title "Teajia release"`], { stdio: 'ignore' }); } catch { /* State is the durable result. */ }
    persist({ notified: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await observe(process.argv[2]);

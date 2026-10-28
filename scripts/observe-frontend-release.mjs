#!/usr/bin/env node
// Read-only proof for one Git-triggered Pages release; never deploys or pushes.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { assetPaths, proofMatches } from './publish-verified-release.mjs';
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
function artifact(origin, revision) {
  const version = read(`${origin}/version.json?proof=${revision}`);
  const buildId = JSON.parse(version).buildId;
  if (!buildId) throw new Error('No build number in deployed artifact');
  const html = read(`${origin}/?proof=${revision}`);
  const paths = assetPaths(html.toString());
  if (!paths.some(path => path.endsWith('.js'))) throw new Error('No entry script in deployed artifact');
  const hashes = { '/': digest(html), '/version.json': digest(version) };
  for (const path of paths) hashes[path] = digest(read(`${origin}${path}`));
  return { buildId, hashes };
}
export async function observe(path) {
  const state = JSON.parse(readFileSync(path, 'utf8'));
  if (!/^[a-f0-9]{40}$/.test(state.revision)) throw new Error('Full candidate revision required');
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
        const direct = artifact(url, state.revision);
        const production = artifact('https://www.teajia.com', state.revision);
        persist({ deploymentUrl: url, buildId: direct.buildId, direct, production });
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

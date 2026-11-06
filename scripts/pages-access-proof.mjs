// A protected immutable Pages URL is an authentication boundary, never an asset proof.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
export function recognizedAccessRedirect(response, immutableOrigin, loginOrigin) {
  if (response.status !== 302) return false;
  // This exact origin must be pinned from the owning Access organization's
  // authenticated metadata at activation. Never accept a generic suffix.
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(loginOrigin ?? '')) return false;
  let target;
  try { target = new URL(response.headers.get('location')); } catch { return false; }
  return target.origin === loginOrigin &&
    target.pathname === `/cdn-cgi/access/login/${new URL(immutableOrigin).hostname}`;
}

export function canonicalDeployment(project, candidate, immutableOrigin, deploymentId) {
  const d = project?.canonical_deployment;
  if (project?.name !== 'teajiafinal' || project.production_branch !== 'main' ||
    !project.domains?.includes('teajia.com') || !project.domains?.includes('www.teajia.com') ||
    d?.id !== deploymentId || d.environment !== 'production' ||
    d.latest_stage?.name !== 'deploy' || d.latest_stage?.status !== 'success' ||
    d.deployment_trigger?.metadata?.commit_hash !== candidate ||
    new URL(d.url).origin !== immutableOrigin) {
    throw new Error('Canonical Pages deployment does not prove the exact production candidate');
  }
  return { id: d.id, sourceRevision: candidate, immutableOrigin, environment: d.environment };
}

export function sameDeployment(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Canonical Pages deployment changed during proof');
}

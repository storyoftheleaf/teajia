/** Read-only guard for an automatic main push after a coordinated release. */
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const origins = ['https://api.teajia.com', 'https://teajia-api.lightcodes.workers.dev'];
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const sha = /^[a-f0-9]{40}$/i;

export function decidePush({ candidate, deployment, live }) {
  if (!sha.test(candidate)) throw new Error('Exact push SHA required');
  if (!deployment || deployment.strategy !== 'percentage' ||
      !Array.isArray(deployment.versions) || deployment.versions.length !== 1 ||
      deployment.versions[0].percentage !== 100 || !uuid.test(deployment.versions[0].version_id)) {
    throw new Error('Cloudflare does not report one Worker version at 100%');
  }
  const versionId = deployment.versions[0].version_id;
  if (!Array.isArray(live) || live.length !== origins.length ||
      live.some((entry, index) => entry.origin !== origins[index] ||
        !sha.test(entry.revision ?? '') || !uuid.test(entry.versionId ?? '') ||
        entry.versionId !== versionId || entry.revision !== live[0].revision)) {
    throw new Error('Worker origins disagree with the active Cloudflare deployment');
  }
  return { action: live[0].revision === candidate ? 'skip' : 'check_ancestry',
    candidate, currentRevision: live[0].revision, versionId,
    deploymentId: deployment.id, endpoints: live, checkedAt: new Date().toISOString() };
}

export function assertGitAncestry(currentRevision, candidate, runGit = spawnSync) {
  if (!sha.test(currentRevision) || !sha.test(candidate)) throw new Error('Exact Git revisions required');
  const options = { encoding: 'utf8' };
  const head = runGit('git', ['rev-parse', 'HEAD'], options);
  if (head.error || head.status !== 0 || head.stdout?.trim() !== candidate) {
    throw new Error('Push candidate is not the checked-out HEAD');
  }
  const ancestry = runGit('git', ['merge-base', '--is-ancestor', currentRevision, candidate], options);
  if (ancestry.error || ancestry.status !== 0) {
    throw new Error('Live Worker revision is unknown, newer, or not an ancestor of the push candidate');
  }
}

export async function checkPush({ candidate, accountId, token, fetcher = fetch, checkAncestry = assertGitAncestry }) {
  if (!accountId || !token) throw new Error('Cloudflare credentials required for push guard');
  const getJson = async (url, headers) => {
    const response = await fetcher(url, { headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Push guard read returned ${response.status}`);
    return response.json();
  };
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/teajia-api/deployments?per_page=1`;
  const cloudflare = await getJson(url, { Authorization: `Bearer ${token}` });
  if (cloudflare.success !== true || !Array.isArray(cloudflare.result?.deployments) ||
      cloudflare.result.deployments.length !== 1) throw new Error('Cloudflare deployment read was incomplete');
  const deployment = cloudflare.result.deployments[0];
  const live = [];
  for (const origin of origins) {
    const endpoint = new URL('/api/release', origin);
    endpoint.searchParams.set('proof', `${candidate}-${crypto.randomUUID()}`);
    const value = await getJson(endpoint);
    live.push({ origin, revision: value.revision, versionId: value.versionId });
  }
  const decision = decidePush({ candidate, deployment, live });
  if (decision.action === 'check_ancestry') {
    checkAncestry(decision.currentRevision, candidate);
    decision.action = 'deploy';
  }
  return decision;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = process.env.WORKER_PUSH_GUARD_PATH;
  if (!output) throw new Error('Push guard receipt path required');
  try {
    const receipt = await checkPush({ candidate: process.env.GITHUB_SHA,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN });
    writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `action=${receipt.action}\n`);
    console.log(`Worker push ${receipt.action}: ${receipt.candidate}; active ${receipt.currentRevision}, version ${receipt.versionId}`);
  } catch (error) {
    writeFileSync(output, `${JSON.stringify({ action: 'failed_closed', candidate: process.env.GITHUB_SHA, error: error.message }, null, 2)}\n`);
    throw error;
  }
}

/** CI-only observer. It never deploys or mutates production. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function deployedVersion(log) {
  const versions = [...log.matchAll(/Current Version ID:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi)];
  if (versions.length !== 1) throw new Error('Deploy output must identify exactly one Worker version');
  return versions[0][1];
}

export async function verifyWorkerRelease({ revision, versionId, origins, fetcher = fetch, attempts = 24, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!/^[a-f0-9]{40}$/i.test(revision)) throw new Error('An exact candidate SHA is required');
  const proof = [];
  for (const origin of origins) {
    let error;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const url = new URL('/api/release', origin);
        url.searchParams.set('proof', `${revision}-${Date.now()}`);
        const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(10000), redirect: 'error' });
        if (!response.ok) throw new Error(`Worker proof returned ${response.status}`);
        const live = await response.json();
        if (live.revision !== revision || live.versionId !== versionId) throw new Error('Worker revision/version differs from deployed candidate');
        proof.push({ origin, revision: live.revision, versionId: live.versionId, verifiedAt: new Date().toISOString() });
        error = undefined;
        break;
      } catch (failure) {
        error = failure;
        if (attempt + 1 < attempts) await wait(5000);
      }
    }
    if (error) throw new Error(`${origin}: ${error.message}`);
  }
  return { status: 'worker_verified', revision, versionId, endpoints: proof };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const revision = process.env.CANDIDATE_SHA;
  const output = process.env.WORKER_PROOF_PATH;
  if (!output || !process.env.WORKER_DEPLOY_LOG) throw new Error('Proof and deploy-log paths are required');
  try {
    const versionId = deployedVersion(readFileSync(process.env.WORKER_DEPLOY_LOG, 'utf8'));
    const proof = await verifyWorkerRelease({ revision, versionId, origins: ['https://api.teajia.com', 'https://teajia-api.lightcodes.workers.dev'] });
    writeFileSync(output, `${JSON.stringify(proof, null, 2)}\n`);
    console.log(`Worker proven live: ${revision}, version ${versionId}`);
  } catch (error) {
    writeFileSync(output, `${JSON.stringify({ status: 'worker_verification_failed', revision, error: error.message }, null, 2)}\n`);
    throw error;
  }
}

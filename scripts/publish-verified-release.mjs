#!/usr/bin/env node
// A one-shot CI supervisor. It never retries publication; only read-only proof.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha = value => /^[a-f0-9]{40}$/.test(value || '');
export function validateRelease(candidate, expected) {
  if (!sha(candidate) || !sha(expected)) throw new Error('Candidate and expected main must be full commit SHAs');
}
export function productionDeployment(deployments, candidate) {
  return deployments.find(d => d.environment === 'production' &&
    d.deployment_trigger?.metadata?.commit_hash === candidate);
}
export function assetPaths(html) {
  return [...new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(m => m[1]).filter(p => /^\/assets\/[^?#]+\.(?:js|css)$/.test(p)))].sort();
}
export function proofMatches(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const gitCommand = (...args) => execFileSync('git', args, { encoding: 'utf8', timeout: 60_000 }).trim();

export async function run(env = process.env, initialize = false, dependencies = {}) {
  const fetch = dependencies.fetch || globalThis.fetch;
  const git = dependencies.git || gitCommand;
  const sleep = dependencies.sleep || delay;
  const candidate = env.CANDIDATE_SHA;
  const expected = env.EXPECTED_MAIN_SHA;
  validateRelease(candidate, expected);
  const path = env.RELEASE_STATE_PATH;
  if (!path) throw new Error('RELEASE_STATE_PATH is required');
  const state = {
    candidate, expectedMain: expected, owner: env.GITHUB_ACTOR,
    runner: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    startedAt: new Date().toISOString(), state: 'worker_pending',
    resume: `Download release-result from this run, then run this script with the same CANDIDATE_SHA and EXPECTED_MAIN_SHA. It accepts main already at the candidate and never redeploys.`,
  };
  const persist = (stage, extra = {}) => {
    Object.assign(state, extra, { state: stage, updatedAt: new Date().toISOString() });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state, null, 2) + '\n');
    console.log(JSON.stringify({ state: stage, candidate, ...extra }));
  };
  persist('worker_pending');
  if (initialize === true) return state;
  const deadline = Date.now() + 20 * 60_000;
  const read = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Read failed: ${new URL(url).host} HTTP ${response.status}`);
    return response;
  };
  const cf = async suffix => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/teajiafinal${suffix}`, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(`Pages API failed (${response.status}); check token Pages access`);
    return body.result;
  };
  const worker = async () => {
    const proof = await (await read(`https://api.teajia.com/api/release?revision=${candidate}`)).json();
    if (proof.revision !== candidate || !proof.versionId) throw new Error('Live Worker does not match the candidate');
    return proof;
  };
  const artifact = async origin => {
    const versionBytes = Buffer.from(await (await read(`${origin}/version.json?proof=${candidate}`)).arrayBuffer());
    const version = JSON.parse(versionBytes.toString());
    if (!version.buildId) throw new Error('Missing Pages build ID');
    const html = await (await read(`${origin}/?proof=${candidate}`)).text();
    const assets = assetPaths(html);
    if (!assets.some(p => p.endsWith('.js'))) throw new Error('No built JavaScript asset in deployed HTML');
    const hashes = { '/version.json': hash(versionBytes), '/': hash(html) };
    for (const path of assets) {
      hashes[path] = hash(Buffer.from(await (await read(`${origin}${path}`)).arrayBuffer()));
    }
    return { buildId: version.buildId, hashes };
  };
  try {
    // Verify credentials and Git ancestry before the only frontend publication.
    const project = await cf('');
    if (project.production_branch !== 'main') throw new Error('teajiafinal production branch is not main');
    if (!project.domains?.includes('teajia.com')) throw new Error('teajiafinal does not own teajia.com');
    if (initialize === 'preflight') {
      persist('preflight_passed');
      return state;
    }
    const deployed = JSON.parse(readFileSync(env.WORKER_PROOF_PATH, 'utf8'));
    const workerProof = await worker();
    if (deployed.status !== 'worker_verified' || deployed.revision !== candidate || deployed.versionId !== workerProof.versionId) {
      throw new Error('Worker differs from this run’s recorded deployment artifact');
    }
    persist('worker_verified', { worker: workerProof });
    let main = git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0];
    if (main !== candidate && main !== expected) throw new Error('Main changed; integrate it into a new candidate before publishing');
    if (main !== candidate) {
      git('merge-base', '--is-ancestor', expected, candidate);
      persist('awaiting_main', { publisher: 'local authenticated release observer' });
      while (main === expected && Date.now() < deadline) {
        await sleep(15_000);
        main = git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0];
      }
    }
    if (main !== candidate) throw new Error('Main did not advance to the candidate; inspect the local publisher state');
    persist('pages_pending');
    let deployment;
    while (Date.now() < deadline) {
      deployment = productionDeployment(await cf('/deployments?per_page=20'), candidate);
      const status = deployment?.latest_stage?.status;
      if (['failure', 'canceled'].includes(status)) throw new Error(`Pages deployment ${status}: ${deployment.id}`);
      if (status === 'success') break;
      await sleep(15_000);
    }
    if (deployment?.latest_stage?.status !== 'success') throw new Error('Timed out waiting for candidate Pages deployment; resume observation without redeploying');
    const origin = new URL(deployment.url).origin;
    if (!/^https:\/\/[a-z0-9-]+\.teajiafinal\.pages\.dev$/.test(origin)) throw new Error('Unexpected immutable Pages deployment URL');
    persist('pages_verified', { deploymentId: deployment.id, deploymentUrl: origin });
    const immutable = await artifact(origin);
    persist('live_pending', { proof: immutable });
    let live;
    while (Date.now() < deadline) {
      try {
        live = await artifact('https://teajia.com');
        if (proofMatches(immutable, live)) break;
      } catch { /* Bounded read-only retries allow normal edge propagation. */ }
      await sleep(15_000);
    }
    if (!proofMatches(immutable, live)) throw new Error('Production bytes differ from the candidate deployment; resume observation');
    const finalWorker = await worker();
    if (finalWorker.versionId !== workerProof.versionId) throw new Error('Worker version changed during publication; inspect competing release');
    persist('live', { buildId: immutable.buildId, liveUrl: 'https://teajia.com', completedAt: new Date().toISOString() });
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY,
      `Verified live: [teajia.com](https://teajia.com), build **${immutable.buildId}**, revision \`${candidate}\`.\n\nExact deployment: ${origin}\n`);
    return state;
  } catch (error) {
    persist('failed', { error: error.message });
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--failed')) {
    const path = process.env.RELEASE_STATE_PATH;
    const state = JSON.parse(readFileSync(path, 'utf8'));
    state.state = 'failed';
    state.error ||= 'Release workflow failed before completion; inspect the failed step. Do not redeploy blindly.';
    state.updatedAt = new Date().toISOString();
    writeFileSync(path, JSON.stringify(state, null, 2) + '\n');
  } else {
    await run(process.env, process.argv.includes('--initialize') ? true : process.argv.includes('--preflight') ? 'preflight' : false);
  }
}

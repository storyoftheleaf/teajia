import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalDeployment, projectMetadata, recognizedAccessRedirect, sameDeployment } from './pages-access-proof.mjs';
import { loadPinnedPagesArtifact } from './pinned-pages-artifact.mjs';

const API = 'https://api.teajia.com';
const WORKERS = 'https://teajia-api.lightcodes.workers.dev';
const WWW = 'https://www.teajia.com';
const APEX = 'https://teajia.com';
const exact = (actual, expected, label) => { if (actual !== expected) throw new Error(`${label} mismatch`); };

function release(state) {
  const result = state?.result, worker = state?.workerProof;
  const candidate = state?.candidate;
  if (!/^[a-f0-9]{40}$/.test(candidate ?? '')) throw new Error('Full observer candidate missing');
  exact(state?.status, 'live', 'Observer state');
  exact(state?.candidate, candidate, 'Observer candidate');
  exact(result?.state, 'live', 'Release result state');
  exact(result?.candidate, candidate, 'Release candidate');
  exact(worker?.status, 'worker_verified', 'Worker proof status');
  exact(worker?.revision, candidate, 'Worker proof revision');
  if (!/^[a-f0-9-]{36}$/i.test(worker?.versionId ?? '')) throw new Error('Worker proof version missing');
  exact(result?.worker?.revision, candidate, 'Result Worker revision');
  exact(result?.worker?.versionId, worker.versionId, 'Result Worker version');
  const deployURL = result.deploymentUrl ?? result.deployURL;
  if (!/^https:\/\/[a-z0-9-]+\.teajiafinal\.pages\.dev$/.test(deployURL ?? '')) throw new Error('Immutable Pages URL missing');
  if (result.buildId === undefined || result.buildId === null || result.buildId === '') throw new Error('Build ID missing');
  exact(result.proof?.buildId, result.buildId, 'Pages build ID');
  if (!result.proof?.hashes || typeof result.proof.hashes !== 'object') throw new Error('Recorded public artifact hashes missing');
  return { candidate, deployURL, deploymentId: result.deploymentId, buildId: result.buildId, versionId: worker.versionId,
    hashes: result.proof.hashes, protectedHost: result.proofMethod === 'canonical-bytes-and-cloudflare-deployment' };
}

// Resolve filenames from the exact deployed public entry, not a local build's
// environment-dependent hashes. Never request a Read module body.
async function deployedAssets(pinned, metadata, fetcher) {
  const paths = new Set();
  const entries = Object.entries(pinned.hashes).filter(([path]) => /^\/assets\/[^/]+\.js$/.test(path));
  if (!entries.length) throw new Error('Recorded public JavaScript missing');
  for (const [path, expected] of entries) {
    if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('Recorded artifact hash invalid');
    const response = await fetcher((pinned.protectedHost ? WWW : pinned.deployURL) + path, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    exact(response.status, 200, 'Recorded public JavaScript');
    const bytes = Buffer.from(await response.arrayBuffer());
    exact(createHash('sha256').update(bytes).digest('hex'), expected, 'Recorded public JavaScript bytes');
    for (const match of bytes.toString().matchAll(/\/read-assets\/[A-Za-z0-9_-]+\.js/g)) paths.add(match[0]);
  }
  const key = path => path.match(/^(\/read-assets\/.+)-[A-Za-z0-9_-]{8}\.js$/)?.[1];
  if (paths.size !== metadata.assets.length) throw new Error('Deployed Read asset inventory differs from candidate');
  return metadata.assets.map(row => {
    const identity = key(row.asset);
    const matches = [...paths].filter(path => identity && key(path) === identity);
    if (matches.length !== 1) throw new Error('Deployed Read asset identity is ambiguous');
    return { ...row, asset: matches[0] };
  });
}

async function canonicalVersion(pinned, fetcher) {
  const response = await fetcher(WWW + '/version.json', { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  exact(response.status, 200, 'Canonical version');
  const bytes = Buffer.from(await response.arrayBuffer());
  exact(createHash('sha256').update(bytes).digest('hex'), pinned.hashes['/version.json'], 'Canonical version bytes');
  exact(JSON.parse(bytes.toString()).buildId, pinned.buildId, 'Canonical build ID');
}

async function canonicalPublicGraph(pinned, artifact, fetcher) {
  const files = [APEX, WWW].flatMap(origin => Object.entries(artifact.files).map(([path, expected]) => ({ origin, path, expected })));
  for (let offset = 0; offset < files.length; offset += 6) {
    await Promise.all(files.slice(offset, offset + 6).map(async ({ origin, path, expected }) => {
      const url = path === '/index.html' ? `${origin}/?proof=${pinned.candidate}`
        : path === '/version.json' ? `${origin}/version.json?proof=${pinned.candidate}` : origin + path;
      const response = await fetcher(url, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
      exact(response.status, 200, 'Canonical public artifact');
      const bytes = Buffer.from(await response.arrayBuffer());
      exact(createHash('sha256').update(bytes).digest('hex'), expected, 'Canonical public artifact bytes');
    }));
  }
}

async function json(fetcher, url) {
  const response = await fetcher(url, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (response.status !== 200) throw new Error('Release metadata unavailable');
  try { return await response.json(); } catch { throw new Error('Release metadata invalid'); }
}

function statesOf(value) {
  if (!value?.states || typeof value.states !== 'object' || Array.isArray(value.states)) throw new Error('Publication states unavailable');
  const entries = Object.entries(value.states);
  if (!entries.every(([path, state]) => path.startsWith('/read/') && ['live', 'draft'].includes(state))) throw new Error('Publication states invalid');
  return JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function policy(response, expected, label, javascript = false) {
  exact(response.status, expected, label);
  const cache = (response.headers.get('cache-control') ?? '').toLowerCase().split(',').map(x => x.trim());
  const vary = (response.headers.get('vary') ?? '').toLowerCase().split(',').map(x => x.trim());
  if (!cache.includes('private') || !cache.includes('no-store') || !vary.includes('cookie') || !vary.includes('authorization') || response.headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff') throw new Error(`${label} confidentiality headers missing`);
  if (javascript && !/javascript/i.test(response.headers.get('content-type') ?? '')) throw new Error(`${label} JavaScript type missing`);
  return { status: response.status, cacheControl: response.headers.get('cache-control'), vary: response.headers.get('vary'), nosniff: true, ...(javascript ? { contentType: response.headers.get('content-type') } : {}) };
}

async function head(fetcher, url, expected, label, javascript = false) {
  const response = await fetcher(url, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  return policy(response, expected, label, javascript);
}

export async function verifyReadAcceptance({ state, metadata, artifact, fetcher = fetch, project = projectMetadata, loginOrigin = process.env.TEAJIA_ACCESS_LOGIN_ORIGIN }) {
  const pinned = release(state);
  exact(metadata?.candidate, pinned.candidate, 'Asset metadata candidate');
  if (artifact?.revision !== pinned.candidate || artifact?.runId !== state.runId || artifact?.runAttempt !== state.runAttempt ||
    artifact?.tree !== state.result?.sourceTree || artifact?.buildId !== pinned.buildId || !artifact.files ||
    Object.keys(artifact.files).length !== Object.keys(pinned.hashes).length ||
    Object.entries(pinned.hashes).some(([path, value]) => value !== artifact.files[path === '/' ? '/index.html' : path])) {
    throw new Error('Recorded release differs from exact CI public artifact');
  }
  if (!Array.isArray(metadata.assets) || !metadata.assets.length || !metadata.defaults ||
    metadata.assets.some(row => !/^\/read-assets\/[a-zA-Z0-9_-]+\.js$/.test(row.asset ?? '') ||
      !Array.isArray(row.paths) || !row.paths.length ||
      row.paths.some(path => !Object.hasOwn(metadata.defaults, path) || typeof metadata.defaults[path] !== 'boolean'))) {
    throw new Error('Asset metadata missing or invalid');
  }
  await canonicalVersion(pinned, fetcher);
  const probe = await fetcher(`${pinned.deployURL}/version.json`, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  const protectedNow = recognizedAccessRedirect(probe, pinned.deployURL, loginOrigin);
  await probe.body?.cancel();
  if (!protectedNow && (probe.status !== 200 || pinned.protectedHost)) throw new Error('Immutable Pages Access boundary missing or changed');
  const current = { ...pinned, protectedHost: protectedNow };
  let deploymentBefore;
  if (protectedNow) {
    deploymentBefore = canonicalDeployment(await project(), pinned.candidate, pinned.deployURL, pinned.deploymentId);
    await canonicalPublicGraph(pinned, artifact, fetcher);
  }
  const assets = await deployedAssets(current, metadata, fetcher);
  const before = statesOf(await json(fetcher, `${API}/api/public/read/publish-state`));
  const overrides = Object.fromEntries(JSON.parse(before));
  const live = path => overrides[path] ? overrides[path] === 'live' : metadata.defaults[path] === true;
  const privateAsset = assets.find(row => row.paths?.length && row.paths.every(path => !live(path)));
  const publicAsset = assets.find(row => row.paths?.some(path => live(path)));
  if (!privateAsset || !publicAsset || privateAsset.asset === publicAsset.asset) throw new Error('Private/public Read asset witnesses unavailable');
  const checks = [];
  for (const origin of protectedNow ? [WWW] : [pinned.deployURL, WWW]) {
    checks.push({ host: origin, kind: 'private', asset: privateAsset.asset, ...await head(fetcher, origin + privateAsset.asset, 404, 'Private Read asset') });
    checks.push({ host: origin, kind: 'public', asset: publicAsset.asset, ...await head(fetcher, origin + publicAsset.asset, 200, 'Public Read asset', true) });
  }
  if (protectedNow) {
    for (const asset of [privateAsset.asset, publicAsset.asset]) {
      const response = await fetcher(pinned.deployURL + asset, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!recognizedAccessRedirect(response, pinned.deployURL, loginOrigin)) throw new Error('Immutable Read asset Access boundary missing');
      await response.body?.cancel();
      checks.push({ host: pinned.deployURL, kind: 'access-protected', asset, status: 302 });
    }
  }
  const apex = await fetcher(APEX + privateAsset.asset, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  exact(apex.status, 301, 'Apex redirect');
  exact(apex.headers.get('location'), WWW + privateAsset.asset, 'Apex destination');
  checks.push({ host: APEX, kind: 'redirect', asset: privateAsset.asset, status: 301, destination: WWW + privateAsset.asset });
  for (const origin of [API, WORKERS]) {
    const worker = await json(fetcher, `${origin}/api/release`);
    exact(worker.revision, pinned.candidate, 'Live Worker revision');
    exact(worker.versionId, pinned.versionId, 'Live Worker version');
  }
  exact(statesOf(await json(fetcher, `${API}/api/public/read/publish-state`)), before, 'Publication states');
  await canonicalVersion(pinned, fetcher);
  if (deploymentBefore) sameDeployment(deploymentBefore, canonicalDeployment(await project(), pinned.candidate, pinned.deployURL, pinned.deploymentId));
  return { candidate: pinned.candidate, buildId: pinned.buildId, deployURL: pinned.deployURL, proofMethod: protectedNow ? 'canonical-bytes-and-cloudflare-deployment' : 'direct-immutable-bytes', workerVersion: pinned.versionId, privateAsset: privateAsset.asset, privateOwners: privateAsset.paths, publicAsset: publicAsset.asset, publicOwners: publicAsset.paths, checks, workerOrigins: [API, WORKERS], publicationStatesUnchanged: true, verifiedAt: new Date().toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [statePath, metadataPath, outputPath] = process.argv.slice(2);
  if (!statePath || !metadataPath || !outputPath) throw new Error('Usage: node verify-read-access-acceptance.mjs OBSERVER_STATE METADATA OUTPUT');
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const { artifact, provenance } = loadPinnedPagesArtifact(state);
  const proof = await verifyReadAcceptance({ state, metadata: JSON.parse(readFileSync(metadataPath, 'utf8')), artifact });
  writeFileSync(outputPath, `${JSON.stringify({ ...proof, pagesArtifactProvenance: provenance }, null, 2)}\n`, { mode: 0o600 });
}

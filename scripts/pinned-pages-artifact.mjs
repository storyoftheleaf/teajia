// Authenticate the local Read handoff to one completed GitHub release run.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const REPO = 'storyoftheleaf/teajia';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = value => /^[a-f0-9]{40}$/.test(value ?? '');

export function selectPinnedArtifacts(state, run, listing) {
  if (!sha(state?.candidate) || !Number.isSafeInteger(state?.runId) || state.runId < 1 || state.runAttempt !== 1 ||
    state.status !== 'live' || run?.id !== state.runId || run.run_attempt !== 1 ||
    run.head_sha !== state.candidate || run.status !== 'completed' || run.conclusion !== 'success' ||
    !run.path?.startsWith('.github/workflows/deploy-worker.yml') ||
    !Array.isArray(listing?.artifacts) || !Number.isSafeInteger(listing.total_count) ||
    listing.total_count > listing.artifacts.length) {
    throw new Error('Pinned GitHub release run identity or completion invalid');
  }
  const select = name => {
    const rows = listing.artifacts.filter(a => a.name === name && !a.expired);
    if (rows.length !== 1 || rows[0].workflow_run?.id !== state.runId ||
      rows[0].workflow_run?.head_sha !== state.candidate || !Number.isSafeInteger(rows[0].id)) {
      throw new Error(`Unique same-run ${name} artifact unavailable`);
    }
    return rows[0];
  };
  return { pages: select('pages-release-artifact'), result: select('release-result') };
}

export function verifyPinnedPagesBytes(state, resultBytes, pagesBytes) {
  let result, pages;
  try { result = JSON.parse(resultBytes); pages = JSON.parse(pagesBytes); }
  catch { throw new Error('Pinned release artifact JSON invalid'); }
  if (result?.state !== 'live' || result.candidate !== state.candidate ||
    !isDeepStrictEqual(result, state.result) || result.pagesArtifactRunId !== state.runId ||
    result.pagesArtifactRunAttempt !== state.runAttempt ||
    !/^[a-f0-9]{64}$/.test(result.pagesArtifactSha256 ?? '') ||
    sha256(pagesBytes) !== result.pagesArtifactSha256 ||
    pages.revision !== state.candidate || pages.tree !== result.sourceTree ||
    pages.runId !== state.runId || pages.runAttempt !== state.runAttempt ||
    pages.buildId !== result.buildId || result.worker?.revision !== state.candidate ||
    result.worker?.versionId !== state.workerProof?.versionId) {
    throw new Error('Pages artifact digest or release-result binding invalid');
  }
  return pages;
}

function ghApi(path) {
  try { return execFileSync('gh', ['api', `repos/${REPO}/${path}`], { timeout: 30000, maxBuffer: 16_000_000, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error('Authenticated GitHub artifact API unavailable'); }
}
function unzipArtifact(id, name) {
  const zipBytes = ghApi(`actions/artifacts/${id}/zip`);
  const dir = mkdtempSync(join(tmpdir(), 'teajia-pinned-artifact-'));
  try {
    const zip = join(dir, 'artifact.zip');
    writeFileSync(zip, zipBytes, { mode: 0o600 });
    return execFileSync('/usr/bin/unzip', ['-p', zip, name], { timeout: 30000, maxBuffer: 16_000_000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { throw new Error('Pinned GitHub artifact ZIP entry unavailable'); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
export function loadPinnedPagesArtifact(state, dependencies = {}) {
  const api = dependencies.api || (path => JSON.parse(ghApi(path)));
  const download = dependencies.download || unzipArtifact;
  const run = api(`actions/runs/${state.runId}`);
  const listing = api(`actions/runs/${state.runId}/artifacts?per_page=100`);
  const selected = selectPinnedArtifacts(state, run, listing);
  const resultBytes = download(selected.result.id, 'release-state.json');
  const pagesBytes = download(selected.pages.id, 'pages-release-artifact.json');
  return { artifact: verifyPinnedPagesBytes(state, resultBytes, pagesBytes),
    provenance: { runId: state.runId, runAttempt: state.runAttempt, pagesArtifactId: selected.pages.id,
      releaseResultArtifactId: selected.result.id, pagesArtifactSha256: sha256(pagesBytes) } };
}

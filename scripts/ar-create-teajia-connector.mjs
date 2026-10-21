#!/usr/bin/env node
/** Local, read-only AR Create bridge. Only paired Teajia jobs may request source material. */
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const AR_CREATE_ORIGIN = 'http://127.0.0.1:8841';
// Use the canonical host directly: API requests must never follow redirects with credentials.
export const TEAJIA_ORIGIN = 'https://www.teajia.com';
export const BRIDGE_PATH = '/api/curate/ar-create';
export const CREDENTIAL_PATH = join(homedir(), '.codex', 'connections', 'teajia-ar-create.json');
export const LIMITS = Object.freeze({ candidates: 30, reads: 10, results: 30, snippet: 1000, text: 200_000, query: 300, responseBytes: 16 * 1024 * 1024, requestMs: 15_000, pairMs: 10 * 60_000 });

class ConnectorError extends Error {}
const safeId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(id);
const hashOf = source => typeof source.hash === 'string' && /^[a-f0-9]{64}$/i.test(source.hash) ? source.hash : undefined;
const titleOf = source => typeof source.title === 'string' && source.title.trim() ? source.title.slice(0, 300) : typeof source.name === 'string' && source.name.trim() ? source.name.slice(0, 300) : source.id;
const metadataOf = source => ({ id: source.id, title: titleOf(source), ...(hashOf(source) ? { hash: hashOf(source) } : {}) });

async function boundedJson(response) {
  if (!response.ok) { const error = new ConnectorError(`Service request failed (${response.status}).`); error.status = response.status; throw error; }
  const reader = response.body?.getReader();
  if (!reader) throw new ConnectorError('Service returned no JSON response.');
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > LIMITS.responseBytes) { await reader.cancel(); throw new ConnectorError('Service response exceeds the connector limit.'); }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof ConnectorError) throw error;
    throw new ConnectorError('Service returned invalid JSON.');
  } finally { reader.releaseLock(); }
}

/** Network targets are constants. Job data can select an opaque source ID, never a URL or path. */
export function createConnector({ fetchImpl = fetch, sleep = delay, now = Date.now } = {}) {
  async function request(origin, path, { token, body, signal } = {}) {
    const timeout = AbortSignal.timeout(LIMITS.requestMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      return await boundedJson(await fetchImpl(`${origin}${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: requestSignal,
        headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }));
    } catch (error) {
      if (error instanceof ConnectorError) throw error;
      throw new ConnectorError('Service request unavailable or timed out.');
    }
  }
  const ar = path => request(AR_CREATE_ORIGIN, path);
  const bridge = (path, options) => request(TEAJIA_ORIGIN, `${BRIDGE_PATH}${path}`, options);
  async function sources() {
    const tree = await ar('/api/sources/tree');
    if (!Array.isArray(tree.sources)) throw new ConnectorError('AR Create returned an invalid source tree.');
    return tree.sources.filter(source => source && safeId(source.id) && !source.missing && !source.sourceUnavailable);
  }
  async function readSource(sourceId, knownSources) {
    if (!safeId(sourceId)) throw new ConnectorError('Use a source ID returned by AR Create search.');
    const tree = knownSources ?? await sources();
    if (!tree.some(source => source.id === sourceId)) throw new ConnectorError('Source is not available in the AR Create Library.');
    const source = await ar(`/api/sources/file?id=${encodeURIComponent(sourceId)}`);
    if (source.id !== sourceId || typeof source.text !== 'string' || !hashOf(source)) throw new ConnectorError('Source has no readable text and verified hash.');
    if (source.transcriptState?.coherent === false) throw new ConnectorError('The source transcript needs review in AR Create.');
    if (source.text.length > LIMITS.text) throw new ConnectorError('Source text exceeds 200000 characters. Choose a smaller source in AR Create.');
    // The API hash covers the original raw file; text is its frontmatter-stripped body.
    // Carry both exactly as returned rather than inventing a hash of a different representation.
    return { source: { id: source.id, title: titleOf(source), hash: source.hash, text: source.text } };
  }
  async function search(query) {
    if (typeof query !== 'string' || !query.trim() || query.length > LIMITS.query) throw new ConnectorError('Search needs a literal query of 1 to 300 characters.');
    const needle = query.trim().toLocaleLowerCase();
    const tree = await sources();
    const named = tree.filter(source => titleOf(source).toLocaleLowerCase().includes(needle));
    const namedIds = new Set(named.map(source => source.id));
    const candidates = [...named, ...tree.filter(source => !namedIds.has(source.id))].slice(0, LIMITS.candidates);
    const found = new Map(); let reads = 0;
    for (const candidate of candidates) {
      const titleMatch = namedIds.has(candidate.id);
      if (titleMatch) found.set(candidate.id, metadataOf(candidate));
      if (reads >= LIMITS.reads || candidate.hasReadableBody === false || ['pdf', 'audio', 'image', 'other'].includes(candidate.kind)) continue;
      reads++;
      try {
        const { source } = await readSource(candidate.id, candidates);
        const match = source.text.toLocaleLowerCase().indexOf(needle);
        if (match >= 0) {
          const start = Math.max(0, match - 120);
          found.set(source.id, { id: source.id, title: source.title, hash: source.hash, snippet: source.text.slice(start, start + LIMITS.snippet) });
        }
      } catch { /* Metadata-only sources remain discoverable by title. */ }
    }
    return { sources: [...found.values()].slice(0, LIMITS.results) };
  }
  async function pair({ print = console.log, signal, timeoutMs = LIMITS.pairMs } = {}) {
    const start = await bridge('/pair/start', { body: {}, signal });
    if (!safeId(start.deviceId) || typeof start.deviceSecret !== 'string' || !start.deviceSecret || typeof start.code !== 'string' || !/^[A-Za-z0-9-]{4,80}$/.test(start.code)) throw new ConnectorError('Pairing service returned an invalid challenge.');
    const expiresAt = Date.parse(start.expiresAt);
    if (!Number.isFinite(expiresAt)) throw new ConnectorError('Pairing service returned an invalid expiry.');
    const deadline = Math.min(expiresAt, now() + Math.min(timeoutMs, LIMITS.pairMs));
    print(`https://teajia.com/admin/compass?tab=library&arPair=${encodeURIComponent(start.code)}`);
    print(start.code);
    let backoff = 3000;
    while (!signal?.aborted && now() < deadline) {
      let status;
      try { status = await bridge(`/pair/${encodeURIComponent(start.deviceId)}`, { token: start.deviceSecret, signal }); backoff = 3000; }
      catch (error) {
        if (signal?.aborted || (error.status >= 400 && error.status < 500 && error.status !== 429)) throw error;
        await sleep(Math.min(backoff, Math.max(0, deadline - now())), undefined, { signal }); backoff = Math.min(backoff * 2, 30_000); continue;
      }
      if (status.status === 'paired' && typeof status.token === 'string' && status.token) return { deviceId: start.deviceId, token: status.token, pairedAt: new Date(now()).toISOString() };
      if (status.status !== 'pending') throw new ConnectorError('Pairing was declined or expired.');
      await sleep(Math.min(3000, Math.max(0, deadline - now())), undefined, { signal });
    }
    throw new ConnectorError('Pairing timed out. Start a new pairing request.');
  }
  let pendingResult = null;
  async function pollOnce(credentials, { signal } = {}) {
    if (!credentials || typeof credentials.token !== 'string' || !credentials.token) throw new ConnectorError('Pair this connector before running it.');
    if (pendingResult) {
      if (pendingResult.token === credentials.token) await bridge('/connector/result', { token: credentials.token, body: pendingResult.payload, signal });
      pendingResult = null;
    }
    const response = await bridge('/connector/poll', { token: credentials.token, body: {}, signal });
    if (!Array.isArray(response.jobs) || response.jobs.length > 10) throw new ConnectorError('Connector service returned an invalid job batch.');
    for (const job of response.jobs) {
      if (!safeId(job?.id)) throw new ConnectorError('Connector service returned an invalid job ID.');
      let payload;
      try {
        const result = job.kind === 'search' ? await search(job.query) : job.kind === 'read' ? await readSource(job.sourceId) : (() => { throw new ConnectorError('Unsupported connector job.'); })();
        payload = { id: job.id, result };
      } catch (error) { payload = { id: job.id, error: error instanceof ConnectorError ? error.message : 'AR Create source request failed.' }; }
      // An uncertain POST must retry these exact bytes before another source read.
      pendingResult = { token: credentials.token, payload };
      await bridge('/connector/result', { token: credentials.token, body: payload, signal });
      pendingResult = null;
    }
    return { handled: response.jobs.length };
  }
  async function run(credentials, { once = false, signal, onTransient = () => {} } = {}) {
    let backoff = 2000;
    while (!signal?.aborted) {
      try { const result = await pollOnce(credentials, { signal }); if (once) return result; backoff = 2000; await sleep(result.handled ? 250 : 3000, undefined, { signal }); }
      catch (error) { if (once || signal?.aborted || error.status === 401 || error.status === 403) throw error; onTransient('Connection temporarily unavailable; retrying.'); await sleep(backoff, undefined, { signal }); backoff = Math.min(backoff * 2, 60_000); }
    }
  }
  return { pair, search, readSource, pollOnce, run };
}

export async function saveCredentials(credentials, filename = CREDENTIAL_PATH) {
  if (!credentials || !safeId(credentials.deviceId) || typeof credentials.token !== 'string' || !credentials.token || !Number.isFinite(Date.parse(credentials.pairedAt))) throw new ConnectorError('Only completed pairing credentials can be saved.');
  const directory = dirname(filename);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink()) throw new ConnectorError('Connection directory must not be a symbolic link.');
  try { if ((await lstat(filename)).isSymbolicLink()) throw new ConnectorError('Connection credentials must not be a symbolic link.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = join(directory, `.teajia-ar-${randomUUID()}.tmp`);
  let file;
  try {
    file = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    await file.writeFile(JSON.stringify({ deviceId: credentials.deviceId, token: credentials.token, pairedAt: credentials.pairedAt }));
    await file.sync(); await file.close(); file = null;
    await rename(temporary, filename); await chmod(filename, 0o600);
  } finally { if (file) await file.close(); await unlink(temporary).catch(() => {}); }
}
export async function loadCredentials(filename = CREDENTIAL_PATH) {
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new ConnectorError('Connection credentials must be a private regular file (0600).');
    const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const checked = await file.stat();
      if (!checked.isFile() || (checked.mode & 0o077) !== 0 || checked.size > 65536) throw new ConnectorError('Connection credentials must be a private regular file (0600).');
      const credentials = JSON.parse(await file.readFile('utf8'));
      if (!safeId(credentials.deviceId) || typeof credentials.token !== 'string' || !credentials.token || !Number.isFinite(Date.parse(credentials.pairedAt))) throw new ConnectorError('Connection credentials are invalid.');
      return credentials;
    } finally { await file.close(); }
  } catch (error) { if (error.code === 'ENOENT') return null; if (error instanceof ConnectorError) throw error; throw new ConnectorError('Connection credentials could not be read.'); }
}
export async function main(args = process.argv.slice(2), { credentialPath = CREDENTIAL_PATH, connector = createConnector(), print = console.log } = {}) {
  if (args.some(arg => !['--pair', '--once', '--status'].includes(arg)) || args.length > 1) throw new ConnectorError('Use --pair, --once, --status, or no arguments to run.');
  if (args[0] === '--status') { const credentials = await loadCredentials(credentialPath); print(JSON.stringify(credentials ? { paired: true, deviceId: credentials.deviceId, pairedAt: credentials.pairedAt } : { paired: false })); return; }
  if (args[0] === '--pair') { const credentials = await connector.pair({ print }); await saveCredentials(credentials, credentialPath); return; }
  const credentials = await loadCredentials(credentialPath);
  if (!credentials) throw new ConnectorError('No paired connection. Run this connector with --pair first.');
  const controller = new AbortController();
  const stop = () => controller.abort(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { return await connector.run(credentials, { once: args[0] === '--once', signal: controller.signal }); }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof ConnectorError ? error.message : 'Connector stopped. Check the local connection and try again.'); process.exitCode = 1; });

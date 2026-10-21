import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnector, main, loadCredentials, saveCredentials, AR_CREATE_ORIGIN, TEAJIA_ORIGIN, BRIDGE_PATH, LIMITS } from './ar-create-teajia-connector.mjs';

const hash = 'a'.repeat(64);
const credentials = { deviceId: 'device-1', token: `ar1_${'b'.repeat(64)}`, pairedAt: '2026-10-21T00:00:00.000Z' };
const source = (id, title = 'A tea note') => ({ id, title, hash, kind: 'note', path: '/private/library/source.md', rootId: 'private-root', rel_path: 'source.md', provenance: { originalPath: '/private/original' } });
function fixture({ sources = [], read = () => ({ ...source('source-1'), text: 'Exact\r\nbody with tea and unchanged spacing.\n', raw: '---\ntitle: Raw\n---\nExact body' }), jobs = [], extra } = {}) {
  const calls = []; const results = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const parsed = new URL(url);
    const key = `${parsed.origin}${parsed.pathname}`;
    let body;
    if (key === `${AR_CREATE_ORIGIN}/api/sources/tree`) body = { revision: 9, roots: [{ path: '/private/root' }], sources };
    else if (key === `${AR_CREATE_ORIGIN}/api/sources/file`) body = await read(parsed.searchParams.get('id'));
    else if (key === `${TEAJIA_ORIGIN}${BRIDGE_PATH}/connector/poll`) body = { jobs };
    else if (key === `${TEAJIA_ORIGIN}${BRIDGE_PATH}/connector/result`) { results.push(JSON.parse(options.body)); body = { recorded: true }; }
    else if (extra) return extra(url, options);
    else throw new Error(`Unexpected synthetic URL ${url}`);
    return Response.json(body);
  };
  return { calls, results, fetchImpl, connector: createConnector({ fetchImpl }) };
}

test('search uses real metadata identity, literal text snippets, and explicit outbound fields', async () => {
  const f = fixture({ sources: [source('source-1', 'Unrelated title'), source('source-2', 'Tea title')], read: id => ({ ...source(id), text: id === 'source-1' ? 'A literal TEA passage.' : 'Other content' }) });
  const result = await f.connector.search('tea');
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources.find(s => s.id === 'source-1').snippet, 'A literal TEA passage.');
  for (const item of result.sources) assert.deepEqual(Object.keys(item).sort(), item.snippet ? ['hash', 'id', 'snippet', 'title'] : ['hash', 'id', 'title']);
  assert.ok(!JSON.stringify(result).includes('/private/'));
  assert.ok(!JSON.stringify(result).includes('private-root'));
  assert.ok(f.calls.every(call => call.url.startsWith(AR_CREATE_ORIGIN) && call.options.method === 'GET' && call.options.redirect === 'error'));
});

test('search considers at most 30 candidates and performs at most 10 text reads', async () => {
  const f = fixture({ sources: Array.from({ length: 100 }, (_, i) => source(`source-${i}`, `Tea ${i}`)), read: id => ({ ...source(id), text: 'tea '.repeat(500) }) });
  const result = await f.connector.search('tea');
  assert.equal(result.sources.length, LIMITS.candidates);
  assert.equal(f.calls.filter(call => new URL(call.url).pathname.endsWith('/file')).length, LIMITS.reads);
  assert.ok(result.sources.every(item => !item.snippet || item.snippet.length <= LIMITS.snippet));
});

test('unmatched queries do not upload the library catalog and use bounded literal search', async () => {
  const f = fixture({ sources: [source('one', 'First'), source('two', 'Second')], read: id => ({ ...source(id), text: 'No match here.' }) });
  assert.deepEqual(await f.connector.search('not-found'), { sources: [] });
  assert.equal(f.calls.length, 3);
  await assert.rejects(() => f.connector.search(''), /literal query/);
  await assert.rejects(() => f.connector.search('a'.repeat(301)), /literal query/);
});

test('read preserves the real API text and raw-byte hash exactly, never path metadata', async () => {
  const exact = '  A tea passage.\r\n\n二〇二四\n';
  const f = fixture({ sources: [source('source-1')], read: () => ({ ...source('source-1'), text: exact, raw: `---\ntitle: private\n---\n${exact}`, body: 'Do not use this alternative' }) });
  assert.deepEqual(await f.connector.readSource('source-1'), { source: { id: 'source-1', title: 'A tea note', hash, text: exact } });
  assert.equal(new URL(f.calls[1].url).pathname, '/api/sources/file');
  assert.equal(new URL(f.calls[1].url).searchParams.get('id'), 'source-1');
});

test('read refuses oversized, binary, mismatched or unverified API sources without truncating or inventing evidence', async () => {
  for (const patch of [{ text: 'x'.repeat(LIMITS.text + 1) }, { text: null }, { hash: null, text: 'body' }, { id: 'another', text: 'body' }, { text: 'body', transcriptState: { coherent: false } }]) {
    const f = fixture({ sources: [source('source-1')], read: () => ({ ...source('source-1'), text: 'body', ...patch }) });
    await assert.rejects(() => f.connector.readSource('source-1'));
  }
  const f = fixture({ sources: [source('source-1')], read: () => ({ ...source('source-1'), text: 'x'.repeat(LIMITS.text) }) });
  assert.equal((await f.connector.readSource('source-1')).source.text.length, LIMITS.text);
});

test('source paths, URLs, unavailable IDs and alternate endpoints cannot be requested by a job', async () => {
  for (const id of ['../../secret', '/private/library', 'https://attacker.test/source', 'source-1?path=secret', 'source-1#secret', 'not-in-tree']) {
    const f = fixture({ sources: [source('source-1')] });
    await assert.rejects(() => f.connector.readSource(id));
    assert.equal(f.calls.filter(call => new URL(call.url).pathname.endsWith('/file')).length, 0);
  }
  const f = fixture({ sources: [{ ...source('source-1'), sourceUnavailable: true }] });
  await assert.rejects(() => f.connector.readSource('source-1'));
});

test('paired job polling returns only bounded sanitized results to the fixed bridge', async () => {
  const f = fixture({ sources: [source('source-1')], jobs: [{ id: 'job-1', kind: 'search', query: 'tea' }, { id: 'job-2', kind: 'read', sourceId: 'source-1' }, { id: 'job-3', kind: 'write', url: 'https://attacker.test', path: '/private/foo' }] });
  assert.deepEqual(await f.connector.pollOnce(credentials), { handled: 3 });
  assert.equal(f.results[0].result.sources[0].id, 'source-1');
  assert.equal(f.results[1].result.source.hash, hash);
  assert.deepEqual(f.results[2], { id: 'job-3', error: 'Unsupported connector job.' });
  assert.ok(!JSON.stringify(f.results).includes('/private/'));
  for (const call of f.calls.filter(call => call.url.startsWith(TEAJIA_ORIGIN))) assert.equal(call.options.headers.authorization, `Bearer ${credentials.token}`);
  for (const call of f.calls.filter(call => call.url.startsWith(AR_CREATE_ORIGIN))) assert.equal(call.options.headers.authorization, undefined);
});

test('no credentials means no job poll or source access', async () => {
  const f = fixture();
  await assert.rejects(() => f.connector.pollOnce(null), /Pair this connector/);
  assert.equal(f.calls.length, 0);
});

test('pair prints the exact human approval link and code, never secrets or token', async () => {
  let clock = Date.parse('2026-10-21T00:00:00Z'); let attempts = 0; const printed = []; const requested = [];
  const connector = createConnector({ now: () => clock, sleep: async ms => { clock += ms; }, fetchImpl: async (url, options) => {
    requested.push({ url, options });
    if (url.endsWith('/pair/start')) return Response.json({ deviceId: 'device-1', deviceSecret: 'secret-never-print', code: 'PAIR-1234', expiresAt: new Date(clock + 10000).toISOString() });
    attempts++;
    return Response.json(attempts === 1 ? { status: 'pending' } : { status: 'paired', token: credentials.token });
  } });
  assert.deepEqual(await connector.pair({ print: line => printed.push(line) }), { ...credentials, pairedAt: '2026-10-21T00:00:03.000Z' });
  assert.deepEqual(printed, ['https://teajia.com/admin/compass?tab=library&arPair=PAIR-1234', 'PAIR-1234']);
  assert.ok(!printed.join(' ').includes(credentials.token));
  assert.ok(!printed.join(' ').includes('secret-never-print'));
  assert.ok(requested.every(call => call.url.startsWith(`${TEAJIA_ORIGIN}${BRIDGE_PATH}/pair/`)));
  assert.equal(requested.some(call => call.url.startsWith(AR_CREATE_ORIGIN)), false);
  for (const call of requested.slice(1)) { assert.equal(new URL(call.url).search, ''); assert.equal(call.options.headers.authorization, 'Bearer secret-never-print'); }
  assert.ok(requested.every(call => !call.url.includes('secret-never-print')));
});

test('pending pairing times out with no credential write or local source read', async () => {
  let clock = 0;
  const directory = await mkdtemp(join(tmpdir(), 'teajia-ar-pair-'));
  try {
    const connector = createConnector({ now: () => clock, sleep: async ms => { clock += ms; }, fetchImpl: async url => url.endsWith('/pair/start') ? Response.json({ deviceId: 'device-1', deviceSecret: 'private', code: 'PAIR-1234', expiresAt: new Date(5000).toISOString() }) : Response.json({ status: 'pending' }) });
    await assert.rejects(() => main(['--pair'], { connector, credentialPath: join(directory, 'connection.json'), print: () => {} }), /Pairing timed out/);
    assert.equal(await loadCredentials(join(directory, 'connection.json')), null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('credentials are written only after pairing, atomically as 0600; --status prints metadata only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teajia-ar-creds-')); const filename = join(directory, 'connections', 'synthetic.json');
  try {
    await assert.rejects(() => saveCredentials({ deviceId: 'unpaired' }, filename), /Only completed pairing/);
    await main(['--pair'], { credentialPath: filename, connector: { pair: async () => credentials }, print: () => {} });
    assert.equal((await stat(filename)).mode & 0o777, 0o600);
    assert.deepEqual(await loadCredentials(filename), credentials);
    const printed = []; await main(['--status'], { credentialPath: filename, print: text => printed.push(text) });
    assert.deepEqual(JSON.parse(printed[0]), { paired: true, deviceId: credentials.deviceId, pairedAt: credentials.pairedAt });
    assert.ok(!printed.join('').includes(credentials.token));
    await chmod(filename, 0o644); await assert.rejects(() => loadCredentials(filename), /private regular file/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('credential reads and replacement reject symlinks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teajia-ar-link-'));
  try {
    const target = join(directory, 'target.json'); await saveCredentials(credentials, target);
    const filename = join(directory, 'link.json'); await symlink(target, filename);
    await assert.rejects(() => loadCredentials(filename), /private regular file/);
    await assert.rejects(() => saveCredentials(credentials, filename), /symbolic link/);
    assert.equal(JSON.parse(await readFile(target, 'utf8')).token, credentials.token);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('--once runs exactly one poll and transient failures back off without exposing underlying errors', async () => {
  let polls = 0; const sleeps = []; const notices = []; const controller = new AbortController();
  const connector = createConnector({ fetchImpl: async () => { polls++; throw new Error('secret-token-in-error'); }, sleep: async ms => { sleeps.push(ms); if (sleeps.length === 3) controller.abort(); } });
  await connector.run(credentials, { signal: controller.signal, onTransient: message => notices.push(message) });
  assert.deepEqual(sleeps, [2000, 4000, 8000]);
  assert.equal(polls, 3); assert.ok(notices.every(message => !message.includes('secret-token')));
  const f = fixture(); assert.deepEqual(await f.connector.run(credentials, { once: true }), { handled: 0 }); assert.equal(f.calls.length, 1);
});

test('redirects and excessive response sizes are rejected without submitting content', async () => {
  const f = createConnector({ fetchImpl: async () => new Response('x'.repeat(LIMITS.responseBytes + 1)) });
  await assert.rejects(() => f.search('tea'), /response exceeds/);
});


test('uncertain result delivery retries the same snapshot before another source read', async () => {
  let polls = 0; let reads = 0; let posts = 0; const bodies = [];
  const connector = createConnector({ fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/connector/poll')) return Response.json({ jobs: polls++ === 0 ? [{ id: 'job-retry', kind: 'read', sourceId: 'source-1' }] : [] });
    if (path.endsWith('/connector/result')) { bodies.push(options.body); if (posts++ === 0) throw new Error('response lost'); return Response.json({ recorded: true }); }
    if (path.endsWith('/sources/tree')) return Response.json({ sources: [source('source-1')] });
    if (path.endsWith('/sources/file')) { reads++; return Response.json({ ...source('source-1'), text: reads === 1 ? 'First exact snapshot.' : 'Changed snapshot.' }); }
    throw new Error('Unexpected fixture request');
  } });
  await assert.rejects(() => connector.pollOnce(credentials));
  await connector.pollOnce(credentials);
  assert.equal(reads, 1);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
});


test('pairing retries transient poll failures within its existing approval window', async () => {
  let clock = 0; let polls = 0; const printed = [];
  const connector = createConnector({ now: () => clock, sleep: async ms => { clock += ms; }, fetchImpl: async url => {
    if (url.endsWith('/pair/start')) return Response.json({ deviceId: 'device-1', deviceSecret: 'never-print', code: 'PAIR-5678', expiresAt: new Date(10000).toISOString() });
    if (polls++ === 0) return Response.json({ private: 'must not print' }, { status: 503 });
    return Response.json({ status: 'paired', token: credentials.token });
  } });
  assert.equal((await connector.pair({ print: value => printed.push(value) })).token, credentials.token);
  assert.equal(printed.length, 2);
  assert.equal(clock, 3000);
});

test('revoked pairing credentials stop the runner without requesting local source content', async () => {
  let requests = 0; const sleeps = [];
  const connector = createConnector({ sleep: async ms => { sleeps.push(ms); }, fetchImpl: async url => { requests++; assert.ok(url.startsWith(TEAJIA_ORIGIN)); return Response.json({}, { status: 401 }); } });
  await assert.rejects(() => connector.run(credentials), /Service request failed/);
  assert.equal(requests, 1);
  assert.deepEqual(sleeps, []);
});


test('pair status HTTP 429 backs off and recovers in the original approval window', async () => {
  let clock = 0; let starts = 0; let polls = 0; const sleeps = []; const printed = [];
  const connector = createConnector({ now: () => clock, sleep: async ms => { sleeps.push(ms); clock += ms; }, fetchImpl: async (url, options) => {
    if (url.endsWith('/pair/start')) { starts++; return Response.json({ deviceId: 'device-1', deviceSecret: 'secret-rate-limit', code: 'PAIR-RATE', expiresAt: new Date(20000).toISOString() }); }
    assert.equal(options.headers.authorization, 'Bearer secret-rate-limit');
    polls++;
    if (polls === 1) return Response.json({}, { status: 429 });
    if (polls === 2) return Response.json({ status: 'pending' });
    return Response.json({ status: 'paired', token: credentials.token });
  } });
  assert.equal((await connector.pair({ print: value => printed.push(value) })).token, credentials.token);
  assert.equal(starts, 1); assert.equal(polls, 3); assert.deepEqual(sleeps, [3000, 3000]);
  assert.deepEqual(printed, ['https://teajia.com/admin/compass?tab=library&arPair=PAIR-RATE', 'PAIR-RATE']);
});

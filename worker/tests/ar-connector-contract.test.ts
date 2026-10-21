import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const PREFIX = '/api/curate/ar-create';
const JWT = 'synthetic-ar-connector-contract-only';
const cleanup: Array<() => Promise<void> | void> = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  cleanup.push(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

it('pairs the shipped connector over HTTP, searches and reads the real Worker queue, and links an exact source without any AR write', async () => {
  const connectorModule = await import('../../scripts/ar-create-teajia-connector.mjs');
  const db = new SqliteD1('migrations', '0045');
  cleanup.push(() => db.close());
  seedIdentity(db, { userId: 'ar-owner', accountId: 'ar-shop', role: 'owner', bundles: ['gather', 'catalog'] });
  seedIdentity(db, { userId: 'ar-other-owner', accountId: 'ar-other-shop', role: 'owner', bundles: ['gather', 'catalog'] });
  db.sqlite.prepare('INSERT INTO tea_compass_entries(id,user_id,account_id,name,notes,description) VALUES(?,?,?,?,?,?)')
    .run('same-tea', 'ar-owner', 'ar-shop', 'A tea already in Library', 'Original tea evidence.', 'Existing working description.');
  const token = await signedToken(JWT, { sub: 'ar-owner', email: 'ar-owner@test.dev', active_account_id: 'ar-shop', platform_role: null });
  const foreignToken = await signedToken(JWT, { sub: 'ar-other-owner', email: 'ar-other-owner@test.dev', active_account_id: 'ar-other-shop', platform_role: null });
  const env = { DB: db, JWT_SECRET: JWT, OAUTH_REGISTER_LIMITER: { limit: async () => ({ success: true }) }, OAUTH_AUTHORIZE_LIMITER: { limit: async () => ({ success: true }) } };
  const sourceId = randomUUID();
  const exactText = '  A field notebook.\r\nSpring harvest from Yiwu, with unchanged spacing.\n二〇二四\n';
  const rawFile = `---\ntitle: Yiwu field notebook\n---\n${exactText}`;
  const originalHash = createHash('sha256').update(rawFile).digest('hex');
  const privatePath = '/private/synthetic-archive/yiwu.md';
  let currentSource = { id: sourceId, title: 'Yiwu field notebook', hash: originalHash, text: exactText, raw: rawFile, path: privatePath, rootId: 'synthetic-private-root' };
  const arCalls: Array<{ method: string; path: string; authorization?: string }> = [];
  const pairPollQueries: string[] = [];
  let sourceReads = 0;
  let dropNextResultResponse = false;
  let droppedResults = 0;
  const serverErrors: string[] = [];
  const http = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url ?? '/', 'http://fixture.test');
      if (url.pathname.startsWith('/api/sources/')) {
        arCalls.push({ method: incoming.method ?? '', path: url.pathname, authorization: incoming.headers.authorization });
        if (incoming.method !== 'GET') { outgoing.writeHead(405); outgoing.end(); return; }
        const payload = url.pathname === '/api/sources/tree'
          ? { roots: [{ path: '/private/synthetic-archive' }], sources: [{ ...currentSource, kind: 'note', hasReadableBody: true }] }
          : url.pathname === '/api/sources/file' && url.searchParams.get('id') === sourceId
            ? (sourceReads++, currentSource) : null;
        outgoing.writeHead(payload ? 200 : 404, { 'content-type': 'application/json' });
        outgoing.end(JSON.stringify(payload)); return;
      }
      if (/\/pair\/[^/]+$/.test(url.pathname) && incoming.method === 'GET') pairPollQueries.push(url.search);
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value != null) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const request = new Request(`https://teajia.com${incoming.url}`, {
        method: incoming.method, headers,
        ...(body.length ? { body } : {}),
      });
      const response = await worker.fetch(request, env as any);
      if (dropNextResultResponse && url.pathname === `${PREFIX}/connector/result` && response.ok) {
        dropNextResultResponse = false; droppedResults++; outgoing.destroy(); return;
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      serverErrors.push(error instanceof Error ? error.message : 'Fixture HTTP error');
      if (!outgoing.headersSent) outgoing.writeHead(500);
      outgoing.end();
    }
  });
  const localOrigin = await listen(http);
  const transport = async (target: string, options: RequestInit) => {
    const url = new URL(target);
    expect([connectorModule.AR_CREATE_ORIGIN, connectorModule.TEAJIA_ORIGIN]).toContain(url.origin);
    return fetch(`${localOrigin}${url.pathname}${url.search}`, options);
  };
  const connector = connectorModule.createConnector({ fetchImpl: transport });
  const userCall = async (path: string, method = 'GET', body?: unknown, foreign = false) => {
    const response = await fetch(`${localOrigin}${PREFIX}${path}`, {
      method,
      headers: { authorization: `Bearer ${foreign ? foreignToken : token}`, 'X-Teajia-Account': foreign ? 'ar-other-shop' : 'ar-shop', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return response;
  };
  const checked = async (response: Response, status = 200) => {
    const body = await response.json() as any;
    expect(response.status, JSON.stringify(body)).toBe(status);
    return body;
  };

  let deliverCode!: (code: string) => void;
  const printedCode = new Promise<string>(resolve => { deliverCode = resolve; });
  const printed: string[] = [];
  const pairingAbort = new AbortController();
  cleanup.push(() => pairingAbort.abort());
  const pairing = connector.pair({ signal: pairingAbort.signal, print: (line: string) => {
    printed.push(line);
    if (/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(line)) deliverCode(line);
  } });
  void pairing.catch(() => {});
  const code = await printedCode;
  expect(await checked(await userCall('/pair/claim', 'POST', { code }))).toEqual({ paired: true });
  const credentials = await pairing;
  expect(credentials.token).toMatch(/^ar1_[a-f0-9]{64}$/);
  expect(printed.some(line => line.includes(credentials.token))).toBe(false);
  expect(pairPollQueries.length).toBeGreaterThan(0);
  expect(pairPollQueries.every(query => query === '')).toBe(true);

  const search = await checked(await userCall('/requests', 'POST', { kind: 'search', query: 'Yiwu' }), 201);
  expect(await connector.pollOnce(credentials)).toEqual({ handled: 1 });
  const searchResult = await checked(await userCall(`/requests/${search.id}`));
  expect(searchResult.status).toBe('complete');
  expect(searchResult.result.sources).toHaveLength(1);
  expect(searchResult.result.sources[0]).toMatchObject({ id: sourceId, title: currentSource.title, hash: originalHash });
  expect(JSON.stringify(searchResult)).not.toContain(privatePath);
  expect((await userCall(`/requests/${search.id}`, 'GET', undefined, true)).status).toBe(404);

  const read = await checked(await userCall('/requests', 'POST', { kind: 'read', sourceId: searchResult.result.sources[0].id }), 201);
  dropNextResultResponse = true;
  await expect(connector.pollOnce(credentials)).rejects.toThrow();
  expect(droppedResults).toBe(1);
  const readsBeforeRetry = sourceReads;
  // Simulate another local app changing its source after the first result was
  // accepted. A lost HTTP response must replay the saved result, never reread.
  currentSource = { ...currentSource, text: 'A later local revision.', hash: createHash('sha256').update('A later local revision.').digest('hex') };
  expect(await connector.pollOnce(credentials)).toEqual({ handled: 0 });
  expect(sourceReads).toBe(readsBeforeRetry);
  const readResult = await checked(await userCall(`/requests/${read.id}`));
  expect(readResult.result).toEqual({ source: { id: sourceId, title: 'Yiwu field notebook', hash: originalHash, text: exactText } });
  expect(JSON.stringify(readResult)).not.toContain(privatePath);
  expect(JSON.stringify(readResult)).not.toContain('synthetic-private-root');

  const excerpt = 'Spring harvest from Yiwu, with unchanged spacing.';
  const start = exactText.indexOf(excerpt);
  const payload = { requestId: read.id, entryId: 'same-tea', sourceId, title: 'Yiwu field notebook', hash: originalHash, text: excerpt, start, end: start + excerpt.length };
  const linked = await checked(await userCall('/links', 'POST', payload), 201);
  const replay = await checked(await userCall('/links', 'POST', payload));
  expect(replay.link.id).toBe(linked.link.id);
  expect(await checked(await userCall('/links?entryId=same-tea'))).toEqual({ links: [linked.link] });
  expect(linked.link).toMatchObject({ entryId: 'same-tea', sourceId, hash: originalHash, text: excerpt, start, end: start + excerpt.length });
  expect((await userCall('/links?entryId=same-tea', 'GET', undefined, true)).status).toBe(404);
  expect(db.sqlite.prepare('SELECT id,name,notes,description FROM tea_compass_entries WHERE id=?').get('same-tea')).toMatchObject({ id: 'same-tea', name: 'A tea already in Library', notes: 'Original tea evidence.', description: 'Existing working description.' });
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM products').get()).toMatchObject({ n: 0 });
  expect(arCalls.length).toBeGreaterThan(0);
  expect(arCalls.every(call => call.method === 'GET' && call.authorization === undefined)).toBe(true);
  expect(serverErrors).toEqual([]);
}, 20000);

import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/index';
import { upsertIncident, normalizeIncidentInput, recordHealthProblem, clearHealthProblem } from '../src/incidents';
import { handoffToRepair, REPAIR_ENDPOINT } from '../src/problemAlerts';
import { SqliteD1 } from './helpers/sqliteD1';

const SECRET = 'REPAIR-SECRET-123';
const env = (db: SqliteD1, over: Record<string, unknown> = {}) =>
  ({ DB: db as unknown as D1Database, I64OS_REPAIR_SECRET: SECRET, ...over });

const report = (db: SqliteD1, severity: string, route = '/api/products', status = 503, errorCode = 'http_503') =>
  upsertIncident(
    db as unknown as D1Database,
    normalizeIncidentInput({ category: 'server', severity, route, method: 'GET', http_status: status, error_code: errorCode }),
    { accountId: null, userId: null },
  );

function fakeFetch(answer: () => Response | Promise<Response> = () => new Response('{}', { status: 200 })) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    return answer();
  };
  return { calls, impl };
}

const alertRows = (db: SqliteD1) =>
  db.sqlite.prepare('SELECT kind, ok FROM problem_alerts ORDER BY sent_at').all() as Array<{ kind: string; ok: number }>;

afterEach(() => vi.restoreAllMocks());

describe('handoff to i64os', () => {
  it('a new high problem is posted with the secret header and the agreed body', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    const w = await report(db, 'high');
    const r = await handoffToRepair(env(db), w, f.impl);
    expect(r.sent).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(REPAIR_ENDPOINT);
    expect(f.calls[0].url).toBe('https://app.i64os.com/api/v1/repairs/incident');
    expect(f.calls[0].headers['x-i64os-repair-secret']).toBe(SECRET);
    const b = f.calls[0].body;
    expect(b.source).toBe('teajia');
    expect(b.repo).toBe('storyoftheleaf/teajia');
    expect(Object.keys(b.incident).sort()).toEqual([
      'category', 'change', 'error_code', 'first_seen', 'http_status', 'id', 'last_seen', 'method',
      'occurrence_count', 'route', 'safe_message', 'sentence', 'severity', 'signature',
    ]);
    expect(b.incident.id).toBe(w.row!.id);
    expect(b.incident.change).toBe('new');
    expect(b.incident.route).toBe('/api/products');
    expect(b.incident.sentence).toContain('product list failed to load');
    expect(alertRows(db)).toEqual([{ kind: 'handoff', ok: 1 }]);
  });

  it('critical goes too; medium, repeats and a missing secret do not', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    expect((await handoffToRepair(env(db), await report(db, 'critical', '/api/a'), f.impl)).sent).toBe(true);
    expect((await handoffToRepair(env(db), await report(db, 'medium', '/api/x', 0, 'timeout'), f.impl)).sent).toBe(false);
    const again = await report(db, 'critical', '/api/a');
    expect(again.change).toBe('repeat');
    expect((await handoffToRepair(env(db), again, f.impl)).sent).toBe(false);
    expect(await handoffToRepair(env(db, { I64OS_REPAIR_SECRET: undefined }), await report(db, 'high', '/api/b'), f.impl))
      .toEqual({ sent: false, reason: 'not configured' });
    expect(f.calls).toHaveLength(1);
  });

  it('a problem that comes back is handed over again as reopened', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    await handoffToRepair(env(db), await report(db, 'high'), f.impl);
    db.exec("UPDATE incident_ledger SET status = 'resolved'");
    const w = await report(db, 'high');
    expect(w.change).toBe('reopened');
    await handoffToRepair(env(db), w, f.impl);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1].body.incident.change).toBe('reopened');
  });

  it('health problems hand off when new and when reopened, not on repeat ticks', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    const file = () => recordHealthProblem(db as unknown as D1Database, {
      signature: 'rates_stale', severity: 'high', route: '/api/rates', method: 'CRON', errorCode: 'rates_stale',
      message: 'Exchange rates last refreshed 5 days ago.',
    });
    await handoffToRepair(env(db), await file(), f.impl);
    await handoffToRepair(env(db), await file(), f.impl);
    await clearHealthProblem(db as unknown as D1Database, 'rates_stale', 'auto');
    await handoffToRepair(env(db), await file(), f.impl);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1].body.incident.change).toBe('reopened');
  });

  it('a 500 or a throw never throws, is recorded as failed, and never leaks the secret', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map(k => vi.spyOn(console, k).mockImplementation(() => {}));
    const db = new SqliteD1();
    const a = await handoffToRepair(env(db), await report(db, 'high', '/api/a'), fakeFetch(() => new Response('no', { status: 500 })).impl);
    expect(a.sent).toBe(false);
    const boom = async () => { throw new Error(`failed with ${SECRET}`); };
    const b = await handoffToRepair(env(db), await report(db, 'high', '/api/b'), boom);
    expect(b.sent).toBe(false);
    expect(JSON.stringify([a, b])).not.toContain(SECRET);
    for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toContain(SECRET);
    expect(alertRows(db)).toEqual([{ kind: 'handoff', ok: 0 }, { kind: 'handoff', ok: 0 }]);
  });

  it('the worker sends nothing to Telegram any more', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../src/problemAlerts.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/api\.telegram\.org|sendProblemAlert|sendMorningNote/);
  });
});

describe('i64os reports back with the shared secret', () => {
  const seed = (db: SqliteD1) => report(db, 'high').then(w => String(w.row!.id));
  const call = (db: SqliteD1, path: string, method: string, headers: Record<string, string>, body?: unknown, over: Record<string, unknown> = {}) =>
    worker.fetch(
      new Request(`https://worker.test${path}`, {
        method, headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      { DB: db as any, JWT_SECRET: 'j', I64OS_REPAIR_SECRET: SECRET, ...over } as any,
    );
  const good = { 'x-teajia-repair-secret': SECRET };

  it('PATCH accepts the secret for repairing, open and resolved, and keeps the reason', async () => {
    const db = new SqliteD1();
    const id = await seed(db);
    for (const [status, ref] of [
      ['repairing', 'auto-repair started'],
      ['open', 'fix ready: https://github.com/storyoftheleaf/teajia/pull/1'],
      ['resolved', 'fixed: https://github.com/storyoftheleaf/teajia/pull/1'],
    ]) {
      const res = await call(db, `/api/platform/incidents/${id}`, 'PATCH', good, { status, resolution_ref: ref });
      expect(res.status).toBe(200);
      const row = db.sqlite.prepare('SELECT status, resolution_ref FROM incident_ledger WHERE id = ?').get(id) as any;
      expect(row).toEqual({ status, resolution_ref: ref });
    }
  });

  it('PATCH refuses a wrong, empty or missing secret, and statuses outside the three', async () => {
    const db = new SqliteD1();
    const id = await seed(db);
    const patch = (headers: Record<string, string>, status = 'resolved') =>
      call(db, `/api/platform/incidents/${id}`, 'PATCH', headers, { status });
    expect((await patch({ 'x-teajia-repair-secret': 'nope' })).status).toBe(401);
    expect((await patch({ 'x-teajia-repair-secret': SECRET + 'x' })).status).toBe(401);
    expect((await patch({ 'x-teajia-repair-secret': '' })).status).toBe(401);
    expect((await patch({})).status).toBe(401);
    expect((await call(db, `/api/platform/incidents/${id}`, 'PATCH', good, { status: 'resolved' }, { I64OS_REPAIR_SECRET: undefined })).status).toBe(401);
    expect((await patch(good, 'acknowledged')).status).toBe(400);
    expect((await patch(good, 'observing')).status).toBe(400);
    expect((db.sqlite.prepare('SELECT status FROM incident_ledger WHERE id = ?').get(id) as any).status).toBe('open');
  });

  it('GET list accepts the secret and refuses a wrong one', async () => {
    const db = new SqliteD1();
    await seed(db);
    const ok = await call(db, '/api/platform/incidents', 'GET', good);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as any).incidents).toHaveLength(1);
    expect((await call(db, '/api/platform/incidents', 'GET', { 'x-teajia-repair-secret': 'nope' })).status).toBe(401);
  });

  it('no other route accepts the secret', async () => {
    const db = new SqliteD1();
    const id = await seed(db);
    const others: Array<[string, string, unknown?]> = [
      ['GET', '/api/platform/accounts'],
      ['GET', '/api/platform/users'],
      ['POST', '/api/incidents', { category: 'server', severity: 'high', error_code: 'x', safe_message: 'x' }],
      ['DELETE', `/api/platform/incidents/${id}`],
      ['GET', '/api/admin/products'],
    ];
    for (const [method, path, body] of others) {
      const res = await call(db, path, method, good, body);
      expect([401, 403, 404, 405], `${method} ${path} answered ${res.status}`).toContain(res.status);
    }
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM incident_ledger').get()).toEqual({ n: 1 });
  });

  it('the secret is checked in exactly two places in the worker', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    expect(src.match(/hasRepairCredential\(/g)?.length).toBe(3); // definition + list + patch
  });
});

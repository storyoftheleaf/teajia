import { describe, it, expect, vi, afterEach } from 'vitest';
import { upsertIncident, normalizeIncidentInput, recordHealthProblem, clearHealthProblem } from '../src/incidents';
import { alertForProblem, DAILY_ALERT_CAP } from '../src/problemAlerts';
import { SqliteD1 } from './helpers/sqliteD1';

const TOKEN = 'SECRET-TOKEN-123';
const env = (db: SqliteD1, over: Record<string, unknown> = {}) =>
  ({ DB: db as unknown as D1Database, TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: '42', ...over });

const report = (db: SqliteD1, severity: string, route = '/api/products', status = 503, errorCode = 'http_503') =>
  upsertIncident(
    db as unknown as D1Database,
    normalizeIncidentInput({ category: 'server', severity, route, method: 'GET', http_status: status, error_code: errorCode }),
    { accountId: null, userId: null },
  );

function fakeFetch(answer: () => Response | Promise<Response> = () => new Response('{}', { status: 200 })) {
  const calls: Array<{ url: string; body: any }> = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return answer();
  };
  return { calls, impl };
}

afterEach(() => vi.restoreAllMocks());

describe('problem alerts', () => {
  it('a new high problem sends one plain message with the link', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    const r = await alertForProblem(env(db), await report(db, 'high'), f.impl);
    expect(r.sent).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const { text, chat_id, parse_mode, disable_web_page_preview } = f.calls[0].body;
    expect(chat_id).toBe('42');
    expect(parse_mode).toBeUndefined();
    expect(disable_web_page_preview).toBe(true);
    expect(text).toContain('Teajia: something needs fixing.');
    expect(text).toContain("the shop's product list failed to load (server error 503)".replace(/^t/, 'T'));
    expect(text).toContain('First seen ');
    expect(text).toContain('https://www.teajia.com/account/fixes');
  });

  it('a repeat of an open problem sends nothing', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    await alertForProblem(env(db), await report(db, 'high'), f.impl);
    const again = await report(db, 'high');
    expect(again.change).toBe('repeat');
    const r = await alertForProblem(env(db), again, f.impl);
    expect(r.sent).toBe(false);
    expect(f.calls).toHaveLength(1);
  });

  it('medium severity sends nothing', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    const r = await alertForProblem(env(db), await report(db, 'medium', '/api/x', 0, 'timeout'), f.impl);
    expect(r.sent).toBe(false);
    expect(f.calls).toHaveLength(0);
  });

  it('a resolved problem reported again says it came back', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    await alertForProblem(env(db), await report(db, 'high'), f.impl);
    db.exec("UPDATE incident_ledger SET status = 'resolved'");
    const w = await report(db, 'high');
    expect(w.change).toBe('reopened');
    await alertForProblem(env(db), w, f.impl);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1].body.text.startsWith('Teajia: a problem came back.')).toBe(true);
  });

  it('health problems alert when new and when reopened, not on repeat ticks', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    const file = () => recordHealthProblem(db as unknown as D1Database, {
      signature: 'rates_stale', severity: 'high', route: '/api/rates', method: 'CRON', errorCode: 'rates_stale',
      message: 'Exchange rates last refreshed 5 days ago.',
    });
    await alertForProblem(env(db), await file(), f.impl);
    await alertForProblem(env(db), await file(), f.impl);
    await clearHealthProblem(db as unknown as D1Database, 'rates_stale', 'auto');
    await alertForProblem(env(db), await file(), f.impl);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0].body.text).toContain('Exchange rates last refreshed 5 days ago.');
    expect(f.calls[1].body.text).toContain('came back');
  });

  it('missing secrets send nothing and do not throw', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    const w = await report(db, 'critical');
    expect(await alertForProblem(env(db, { TELEGRAM_BOT_TOKEN: undefined }), w, f.impl)).toEqual({ sent: false, reason: 'not configured' });
    expect(await alertForProblem(env(db, { TELEGRAM_CHAT_ID: undefined }), w, f.impl)).toEqual({ sent: false, reason: 'not configured' });
    expect(f.calls).toHaveLength(0);
  });

  it('Telegram answering 500 or throwing never throws, and never leaks the token', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map(k => vi.spyOn(console, k).mockImplementation(() => {}));
    const db = new SqliteD1();
    const a = await alertForProblem(env(db), await report(db, 'high', '/api/a'), fakeFetch(() => new Response('no', { status: 500 })).impl);
    expect(a.sent).toBe(false);
    const boom = async (url: string) => { throw new Error(`failed fetching ${url}`); };
    const b = await alertForProblem(env(db), await report(db, 'high', '/api/b'), boom);
    expect(b.sent).toBe(false);
    expect(JSON.stringify(b)).not.toContain(TOKEN);
    expect(JSON.stringify(a)).not.toContain(TOKEN);
    for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toContain(TOKEN);
  });

  it('caps at ten a day: the 10th says paused, the 11th sends nothing', async () => {
    const db = new SqliteD1();
    const f = fakeFetch();
    for (let i = 0; i < DAILY_ALERT_CAP + 1; i++) {
      await alertForProblem(env(db), await report(db, 'high', `/api/thing-${i}`), f.impl);
    }
    expect(f.calls).toHaveLength(DAILY_ALERT_CAP);
    expect(f.calls[DAILY_ALERT_CAP - 1].body.text).toContain('paused for today');
    expect(f.calls[DAILY_ALERT_CAP - 2].body.text).not.toContain('paused');
  });
});

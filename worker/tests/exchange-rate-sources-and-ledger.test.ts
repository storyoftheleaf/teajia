import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseErApi,
  parseCurrencyApi,
  fetchLiveRates,
  staleRateRows,
  staleRatesMessage,
  type FeedSource,
} from '../src/exchangeRateSources';
import { recordHealthProblem, clearHealthProblem } from '../src/incidents';
import { SqliteD1 } from './helpers/sqliteD1';

/**
 * Two things that used to be silent: which feed the dollar came from, and what
 * happened when none of them answered.
 *
 * The parsers are pure and are fed real shapes plus garbage. The ledger cycle
 * runs against a real SQLite-backed D1 shim, because the reopen behaviour lives
 * in SQL (`ON CONFLICT ... DO UPDATE`) and a test that reads the source can only
 * say the source still says the right thing.
 */

const backupParse = parseCurrencyApi('backup feed');

describe('open.er-api shape', () => {
  it('takes uppercase codes and keeps only the ones the shop maps', () => {
    const r = parseErApi({ result: 'success', rates: { USD: 1, CNY: 7.1, TWD: 30.5, XAU: 0.0004 } });
    expect(r).toEqual({ ok: true, rates: { USD: 1, CNY: 7.1, TWD: 30.5 } });
  });

  it('refuses a body that does not say success, or carries no rates', () => {
    expect(parseErApi({ result: 'error', rates: { CNY: 7 } }).ok).toBe(false);
    expect(parseErApi({ result: 'success' }).ok).toBe(false);
    expect(parseErApi(null).ok).toBe(false);
    expect(parseErApi('nope').ok).toBe(false);
  });

  it('drops zero, negative, NaN and string rates rather than trusting them', () => {
    const r = parseErApi({ result: 'success', rates: { CNY: 0, TWD: -3, IDR: Number.NaN, JPY: '150', MYR: 4.4 } });
    expect(r).toEqual({ ok: true, rates: { MYR: 4.4 } });
    // Nothing usable at all is a failure, so the next feed gets its turn.
    expect(parseErApi({ result: 'success', rates: { CNY: 0 } }).ok).toBe(false);
  });
});

describe('backup feed shape', () => {
  it('uppercases the lowercase keys and keeps the mapped currencies', () => {
    const r = backupParse({ date: '2026-10-07', usd: { cny: 7.1, twd: 30, idr: 16000, btc: 0.00001 } });
    expect(r).toEqual({ ok: true, rates: { CNY: 7.1, TWD: 30, IDR: 16000 } });
  });

  it('refuses garbage, a missing usd block, and unusable numbers', () => {
    expect(backupParse(null).ok).toBe(false);
    expect(backupParse({ date: 'x' }).ok).toBe(false);
    expect(backupParse({ usd: { cny: 0, twd: -1 } }).ok).toBe(false);
    expect(backupParse({ usd: [] }).ok).toBe(false);
  });
});

function fakeFetch(answers: Record<string, () => Response | Promise<Response>>): typeof fetch {
  return (async (url: string) => {
    for (const [needle, answer] of Object.entries(answers)) {
      if (String(url).includes(needle)) return answer();
    }
    throw new Error('unexpected url ' + url);
  }) as unknown as typeof fetch;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('fetchLiveRates', () => {
  it('uses the first feed when it answers, and never touches the others', async () => {
    const hits: string[] = [];
    const f = (async (url: string) => {
      hits.push(String(url));
      return json({ result: 'success', rates: { CNY: 7.2 } });
    }) as unknown as typeof fetch;
    const r = await fetchLiveRates(f);
    expect(r).toMatchObject({ ok: true, source: 'open.er-api', rates: { CNY: 7.2 } });
    expect(hits).toHaveLength(1);
  });

  it('falls through to the backup, and says nothing failed when it lands', async () => {
    const r = await fetchLiveRates(fakeFetch({
      'open.er-api': () => json({}, 429),
      'cdn.jsdelivr.net': () => json({ usd: { cny: 7.3 } }),
    }));
    expect(r).toMatchObject({ ok: true, source: 'backup feed', rates: { CNY: 7.3 } });
  });

  it('falls through a thrown error and a bad body to the second backup', async () => {
    const r = await fetchLiveRates(fakeFetch({
      'open.er-api': () => { throw new TypeError('boom'); },
      'cdn.jsdelivr.net': () => new Response('<html>', { status: 200 }),
      'currency-api.pages.dev': () => json({ usd: { twd: 31 } }),
    }));
    expect(r).toMatchObject({ ok: true, source: 'second backup feed', rates: { TWD: 31 } });
  });

  it('names every feed that failed when none answers', async () => {
    const r = await fetchLiveRates(fakeFetch({
      'open.er-api': () => json({}, 429),
      'cdn.jsdelivr.net': () => json({}, 404),
      'currency-api.pages.dev': () => { throw new TypeError('down'); },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('open.er-api answered 429');
      expect(r.reason).toContain('backup feed answered 404');
      expect(r.reason).toContain('second backup feed could not be reached');
    }
  });

  it('accepts injected sources, so the order is a decision and not an accident', async () => {
    const only: FeedSource[] = [{ name: 'x', url: 'https://x.test', parse: parseErApi }];
    const r = await fetchLiveRates(fakeFetch({ 'x.test': () => json({ result: 'success', rates: { JPY: 150 } }) }), only);
    expect(r).toMatchObject({ ok: true, source: 'x' });
  });
});

describe('staleness arithmetic', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  it('flags only rows older than the threshold, and undatable rows', () => {
    const stale = staleRateRows([
      { currency: 'Yuan', last_updated: '2026-10-07 11:00:00' },
      { currency: 'NT', last_updated: '2026-10-02 12:00:00' },
      { currency: 'IDR', last_updated: null },
      { currency: 'JPY', last_updated: 'garbage' },
    ], now, 3);
    expect(stale).toEqual([
      { currency: 'NT', days: 5 },
      { currency: 'IDR', days: null },
      { currency: 'JPY', days: null },
    ]);
  });

  it('writes a plain sentence including the last failure reason', () => {
    expect(staleRatesMessage([{ currency: 'NT', days: 5 }], 'open.er-api answered 429; backup feed answered 404'))
      .toBe('Exchange rates last refreshed 5 days ago. Last attempt: open.er-api answered 429; backup feed answered 404.');
    expect(staleRatesMessage([{ currency: 'NT', days: null }], undefined))
      .toBe('Exchange rates have no readable refresh date.');
  });
});

describe('the problem ledger, for stale rates', () => {
  const SIG = 'rates_stale';
  const row = (db: SqliteD1) =>
    db.prepare("SELECT * FROM incident_ledger WHERE signature = '__global__:rates_stale'").first<Record<string, any>>();
  const file = (db: SqliteD1, message: string) => recordHealthProblem(db as unknown as D1Database, {
    signature: SIG, category: 'server', severity: 'high', route: '/api/rates', method: 'CRON',
    errorCode: 'rates_stale', message,
  });

  it('files one row with the plain message, and a repeat only counts', async () => {
    const db = new SqliteD1();
    await file(db, 'Exchange rates last refreshed 5 days ago. Last attempt: open.er-api answered 429.');
    await file(db, 'Exchange rates last refreshed 6 days ago. Last attempt: open.er-api answered 429.');
    const r = row(db)!;
    expect(r).toMatchObject({
      status: 'open', category: 'server', severity: 'high', route: '/api/rates', method: 'CRON',
      error_code: 'rates_stale', occurrence_count: 2,
    });
    // The newest wording wins.
    expect(r.safe_message).toContain('6 days ago');
    expect(db.prepare('SELECT COUNT(*) AS n FROM incident_ledger').first<{ n: number }>()!.n).toBe(1);
  });

  it('resolves itself when the rates recover, and does nothing when there is nothing to clear', async () => {
    const db = new SqliteD1();
    expect(await clearHealthProblem(db as unknown as D1Database, SIG, 'auto: rates refreshed')).toBe(false);
    await file(db, 'stale');
    expect(await clearHealthProblem(db as unknown as D1Database, SIG, 'auto: rates refreshed')).toBe(true);
    const r = row(db)!;
    expect(r.status).toBe('resolved');
    expect(r.resolved_at).toBeTruthy();
    expect(r.resolution_ref).toBe('auto: rates refreshed');
    // Idempotent: a second healthy tick changes nothing.
    expect(await clearHealthProblem(db as unknown as D1Database, SIG, 'auto: rates refreshed')).toBe(false);
  });

  it('reopens when it goes stale again, with the count up and the resolution wiped', async () => {
    const db = new SqliteD1();
    await file(db, 'first time');
    await clearHealthProblem(db as unknown as D1Database, SIG, 'auto: rates refreshed');
    await file(db, 'second time');
    const r = row(db)!;
    expect(r.status).toBe('open');
    expect(r.occurrence_count).toBe(2);
    expect(r.resolved_at).toBeNull();
    expect(r.resolution_ref).toBeNull();
    expect(r.safe_message).toBe('second time');
  });

  it('leaves a row someone is already handling in the status they put it in', async () => {
    const db = new SqliteD1();
    await file(db, 'stale');
    db.exec("UPDATE incident_ledger SET status = 'acknowledged'");
    await file(db, 'still stale');
    expect(row(db)!.status).toBe('acknowledged');
  });
});

describe('the scheduled tick wires the pieces together', () => {
  const worker = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');
  it('files and clears through the shared pair, with the fixed signature', () => {
    expect(worker).toContain("RATES_STALE_SIGNATURE = 'rates_stale'");
    expect(worker).toContain('recordHealthProblem(env.DB');
    expect(worker).toContain('clearHealthProblem(env.DB');
    expect(worker).toContain('reportStaleExchangeRates(env, rateRefresh)');
  });
});

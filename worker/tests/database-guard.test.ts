import { describe, expect, it, vi } from 'vitest';
import { guardDatabase, isDatabaseQuotaError } from '../src/databaseGuard';
import worker from '../src/index';

const quota = () => new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit.");

describe('database quota containment', () => {
  it('recognizes nested quota failures without treating SQL defects as quota', () => {
    expect(isDatabaseQuotaError(new Error('query failed', { cause: quota() }))).toBe(true);
    expect(isDatabaseQuotaError(new Error('D1_ERROR: no such column'))).toBe(false);
    expect(isDatabaseQuotaError(new Error('network timeout'))).toBe(false);
  });

  it('stops subsequent database work and probes again after a bounded cooldown', async () => {
    let now = 1000;
    const all = vi.fn().mockRejectedValueOnce(quota()).mockResolvedValue({ results: [], meta: { rows_read: 2 } });
    const db = { prepare: () => ({ all }) };
    const first = guardDatabase(db, () => now);
    await expect(first.database.prepare().all()).rejects.toThrow('daily row');
    const next = guardDatabase(db, () => now);
    expect(next.blocked()).toBe(true);
    await expect(next.database.prepare().all()).rejects.toThrow('daily row');
    expect(all).toHaveBeenCalledTimes(1);
    now += 60_001;
    expect(next.blocked()).toBe(false);
    await next.database.prepare().all();
    expect(all).toHaveBeenCalledTimes(2);
    expect(next.metrics()).toEqual({ rowsRead: 2, queries: 1 });
  });

  it('keeps native receivers, bind chains and batch statements intact', async () => {
    const native = { bind() { expect(this).toBe(native); return native; }, all() { expect(this).toBe(native); return { results: [], meta: { rows_read: 40 } }; } };
    const db = { prepare() { expect(this).toBe(db); return native; }, batch(items: unknown[]) { expect(this).toBe(db); expect(items).toEqual([native]); return [{ meta: { rows_read: 20 } }]; } };
    const guard = guardDatabase(db);
    const bound = guard.database.prepare().bind();
    await bound.all();
    await guard.database.batch([bound]);
    expect(guard.metrics()).toEqual({ rowsRead: 60, queries: 2 });
  });

  it('turns swallowed route failures into explicit 503 and never retries D1 during cooldown', async () => {
    const all = vi.fn().mockRejectedValue(quota());
    const db = { prepare: () => ({ all }) };
    const request = new Request('https://api.teajia.com/api/rates', { headers: { Origin: 'https://teajia.com' } });
    const first = await worker.fetch(request, { DB: db } as any);
    expect(first.status).toBe(503);
    expect(first.headers.get('Retry-After')).toBe('60');
    expect(first.headers.get('Access-Control-Allow-Origin')).toBe('https://teajia.com');
    expect(await first.json()).toMatchObject({ code: 'database_quota_exceeded' });
    const second = await worker.fetch(request, { DB: db } as any);
    expect(second.status).toBe(503);
    expect(all).toHaveBeenCalledTimes(1);
    const preflight = await worker.fetch(new Request(request.url, { method: 'OPTIONS' }), { DB: db } as any);
    expect(preflight.status).toBe(204);
  });
});

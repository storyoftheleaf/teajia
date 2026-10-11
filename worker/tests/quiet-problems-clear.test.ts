import { describe, it, expect } from 'vitest';
import { upsertIncident, normalizeIncidentInput, clearQuietIncidents } from '../src/incidents';
import { SqliteD1 } from './helpers/sqliteD1';

const report = (db: SqliteD1, route: string) =>
  upsertIncident(
    db as unknown as D1Database,
    normalizeIncidentInput({ category: 'server', severity: 'high', route, method: 'POST', http_status: 502, error_code: 'http_502' }),
    { accountId: 'acc', userId: null },
  );

const ageDays = (db: SqliteD1, route: string, days: number) =>
  db.sqlite.prepare(`UPDATE incident_ledger SET last_seen = datetime('now', ?) WHERE route = ?`).run(`-${days} days`, route);

const status = (db: SqliteD1, route: string) =>
  (db.sqlite.prepare('SELECT status, resolution_ref FROM incident_ledger WHERE route = ?').get(route) as { status: string; resolution_ref: string | null });

describe('a problem that stops happening leaves Needs fixing on its own', () => {
  it('clears a problem not seen for 7 days and leaves a recent one', async () => {
    const db = new SqliteD1();
    await report(db, '/api/old');
    await report(db, '/api/recent');
    ageDays(db, '/api/old', 8);
    ageDays(db, '/api/recent', 6);

    expect(await clearQuietIncidents(db as unknown as D1Database)).toBe(1);
    expect(status(db, '/api/old')).toEqual({ status: 'resolved', resolution_ref: 'auto: not seen for 7 days' });
    expect(status(db, '/api/recent').status).toBe('open');
  });

  it('comes back as reopened if the same problem happens again', async () => {
    const db = new SqliteD1();
    await report(db, '/api/old');
    ageDays(db, '/api/old', 8);
    await clearQuietIncidents(db as unknown as D1Database);
    const again = await report(db, '/api/old');
    expect(again.change).toBe('reopened');
    expect(status(db, '/api/old').status).toBe('open');
  });

  it('runs twice without touching anything the second time', async () => {
    const db = new SqliteD1();
    await report(db, '/api/old');
    ageDays(db, '/api/old', 30);
    expect(await clearQuietIncidents(db as unknown as D1Database)).toBe(1);
    expect(await clearQuietIncidents(db as unknown as D1Database)).toBe(0);
  });
});

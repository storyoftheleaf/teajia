import { describe, expect, it } from 'vitest';
import {
  clearHealthProblem,
  incidentToApi,
  normalizeIncidentInput,
  recordHealthProblem,
  sanitizeIncidentSample,
  upsertIncident,
} from '../src/incidents';
import { SqliteD1 } from './helpers/sqliteD1';

/** What the browser sends: a signature it derived from the raw path it called. */
const asBrowserReports = (route: string) => ({
  category: 'server',
  severity: 'high',
  signature: `server:get:${route.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-')}:504:http_504`,
  route,
  method: 'GET',
  http_status: 504,
  error_code: 'http_504',
});

describe('incident normalization', () => {
  it('normalizes a bounded material incident into a stable signature', () => {
    expect(normalizeIncidentInput({
      category: 'configuration',
      severity: 'high',
      route: '/api/products/public?cache=1',
      method: 'get',
      http_status: 503,
      error_code: 'UPSTREAM NOT CONFIGURED',
      safe_message: 'API upstream is not configured.',
      deployment: 'dc8466034b80',
      sample: { online: true },
    })).toMatchObject({
      signature: 'configuration:get:api-products-public:503:upstream_not_configured',
      category: 'configuration',
      severity: 'high',
      route: '/api/products/public',
      method: 'GET',
      httpStatus: 503,
      errorCode: 'upstream_not_configured',
    });
  });

  it('a job id in the path is not part of what broke', () => {
    const first = normalizeIncidentInput(asBrowserReports('/api/curate/ar-create/requests/3504e462-73f9-4200-862f-d55de2fea535'));
    const second = normalizeIncidentInput(asBrowserReports('/api/curate/ar-create/requests/9bb1f0c2-1111-4222-8333-444455556666'));

    expect(first.signature).toBe('server:get:api-curate-ar-create-requests-id:504:http_504');
    expect(second.signature).toBe(first.signature);
    // The status and the error code are the last two fields, so they are the two
    // the old eighty-character cap ate: the live row ends `..._d55de2fea535_50`.
    expect(first.signature).toContain(':504:http_504');
    expect(first.route).toBe('/api/curate/ar-create/requests/3504e462-73f9-4200-862f-d55de2fea535');
  });

  it('keeps a signature a caller wrote itself rather than derived from the path', () => {
    // recoverFromChunkError files every page's chunk recovery under one key.
    expect(normalizeIncidentInput({
      category: 'client', severity: 'medium',
      signature: 'client:get:app-shell:none:chunk_load_recovered',
      route: '/admin/compass', method: 'GET', http_status: null, error_code: 'chunk_load_recovered',
    }).signature).toBe('client_get_app_shell_none_chunk_load_recovered');
  });

  it('does not cut the tail off a long caller signature', () => {
    const own = `server:cron:${'a'.repeat(70)}:504:http_504`;
    expect(normalizeIncidentInput({
      category: 'server', severity: 'high', signature: own,
      route: '/api/rates', method: 'CRON', http_status: 504, error_code: 'http_504',
    }).signature).toBe(`server_cron_${'a'.repeat(70)}_504_http_504`);
  });

  it('rejects unknown categories and oversized payloads', () => {
    expect(() => normalizeIncidentInput({ category: 'analytics' })).toThrow('Invalid incident category');
    expect(() => normalizeIncidentInput({
      category: 'client', severity: 'low', error_code: 'large', sample: { value: 'x'.repeat(9000) },
    })).toThrow('Incident payload exceeds 8 KB');
  });
});

describe('the ledger counts one recurring fault once', () => {
  const file = (db: SqliteD1, route: string) =>
    upsertIncident(db as unknown as D1Database, normalizeIncidentInput(asBrowserReports(route)), {
      accountId: 'acc_teajia_bali', userId: 'u1',
    });

  it('a second archive request failing the same way is a repeat, not a new problem', async () => {
    const db = new SqliteD1();
    const first = await file(db, '/api/curate/ar-create/requests/3504e462-73f9-4200-862f-d55de2fea535');
    const second = await file(db, '/api/curate/ar-create/requests/9bb1f0c2-1111-4222-8333-444455556666');

    // `handoffToRepair` posts only a new or reopened row, so a per-id signature
    // meant one repair ticket per archive read rather than one per fault.
    expect(first.change).toBe('new');
    expect(second.change).toBe('repeat');
    expect(second.row!.id).toBe(first.row!.id);
    expect(second.row!.occurrence_count).toBe(2);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM incident_ledger').get()).toEqual({ n: 1 });
    expect(second.row!.signature).toBe('acc_teajia_bali:server:get:api-curate-ar-create-requests-id:504:http_504');
  });

  it('a health problem still clears under the signature it was filed with', async () => {
    const db = new SqliteD1();
    await recordHealthProblem(db as unknown as D1Database, {
      signature: 'rates_stale', route: '/api/rates', method: 'CRON',
      errorCode: 'rates_stale', message: 'Rates have not refreshed for 3 days.',
    });
    expect(await clearHealthProblem(db as unknown as D1Database, 'rates_stale', 'auto: rates refreshed')).toBe(true);
  });
});

describe('incident sanitization', () => {
  it('recursively removes credentials, bodies, cookies, and personal addresses', () => {
    const sample = sanitizeIncidentSample({
      correlation_id: 'corr-1',
      authorization: 'Bearer secret',
      token: 'secret',
      cookie: 'secret',
      email: 'person@example.com',
      request_body: { password: 'secret' },
      status: 503,
      note: 'ignore me',
    });

    expect(sample).toEqual({ correlation_id: 'corr-1', status: 503 });
  });
});

describe('incident API projection', () => {
  it('parses bounded sample JSON without exposing storage internals', () => {
    expect(incidentToApi({
      id: 'inc-1', signature: 'server:get:api:500:unknown', category: 'server', severity: 'high',
      status: 'open', first_seen: '2026-07-13T00:00:00Z', last_seen: '2026-07-13T00:01:00Z',
      occurrence_count: 2, route: '/api/test', method: 'GET', http_status: 500,
      error_code: 'unknown', safe_message: 'Service problem', deployment: 'abc', account_id: null,
      user_id: 'u1', sample_json: '{"online":true}', resolved_at: null, resolution_ref: null,
    })).toMatchObject({ id: 'inc-1', occurrence_count: 2, sample: { online: true } });
  });
});

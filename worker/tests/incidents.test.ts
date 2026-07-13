import { describe, expect, it } from 'vitest';
import {
  incidentToApi,
  normalizeIncidentInput,
  sanitizeIncidentSample,
} from '../src/incidents';

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

  it('rejects unknown categories and oversized payloads', () => {
    expect(() => normalizeIncidentInput({ category: 'analytics' })).toThrow('Invalid incident category');
    expect(() => normalizeIncidentInput({
      category: 'client', severity: 'low', error_code: 'large', sample: { value: 'x'.repeat(9000) },
    })).toThrow('Incident payload exceeds 8 KB');
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

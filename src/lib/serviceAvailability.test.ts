import { describe, expect, it } from 'vitest';
import { createServiceAvailabilityGuard, isServiceCapacityError, shouldReportServiceIncident, shouldRetryQuery } from './serviceAvailability';

const quota = { error: 'Database capacity temporarily unavailable', code: 'database_quota_exceeded' };
const error = { status: 503, data: quota };
const response = (body = quota, retryAfter = '3600') => new Response(JSON.stringify(body), {
  status: 503, headers: { 'Retry-After': retryAfter },
});

describe('service availability', () => {
  it('blocks quota retry and recursive incident writes without misclassifying ordinary 503s', () => {
    expect(isServiceCapacityError(error)).toBe(true);
    expect(shouldRetryQuery(0, error)).toBe(false);
    expect(shouldReportServiceIncident(error)).toBe(false);
    expect(shouldReportServiceIncident({ status: 503 })).toBe(true);
    expect(shouldRetryQuery(0, { status: 503 })).toBe(true);
    expect(shouldRetryQuery(1, { status: 503 })).toBe(false);
    for (const status of [400, 401, 403, 404, 429]) expect(shouldRetryQuery(0, { status })).toBe(false);
    expect(shouldRetryQuery(0, new Error('Request timed out'))).toBe(false);
  });

  it('contains a service outage across API routes while preserving the original response', async () => {
    const guard = createServiceAvailabilityGuard(() => 1000);
    const original = response();
    await guard.observeResponse('https://api.teajia.com/api/products', original);
    expect(await original.json()).toEqual(quota);
    const blocked = guard.blockedResponse('https://api.teajia.com/api/orders');
    expect(blocked?.status).toBe(503);
    expect(blocked?.headers.get('Retry-After')).toBe('60');
    expect(await blocked?.json()).toEqual(quota);
    expect(guard.blockedResponse('https://other.example/api/products')).toBeNull();
    expect(guard.blockedResponse('https://api.teajia.com/version.json')).toBeNull();
  });

  it('automatically permits recovery probes within one minute instead of latching until daily reset', async () => {
    let time = 0;
    const guard = createServiceAvailabilityGuard(() => time);
    await guard.observeResponse('/api/products', response());
    time = 59_001;
    expect(guard.blockedResponse('/api/products')?.headers.get('Retry-After')).toBe('1');
    time = 60_000;
    expect(guard.blockedResponse('/api/products')).toBeNull();
    await guard.observeResponse('/api/products', response(quota, '2'));
    time += 2000;
    expect(guard.blockedResponse('/api/products')).toBeNull();
  });

  it('does not open the circuit for validation, authentication, generic failures, or non-API assets', async () => {
    const guard = createServiceAvailabilityGuard();
    await guard.observeResponse('/api/products', new Response('not json', { status: 503 }));
    await guard.observeResponse('/api/products', response({ ...quota, code: 'auth_dependency_unavailable' }));
    await guard.observeResponse('/api/products', new Response(JSON.stringify(quota), { status: 401 }));
    await guard.observeResponse('/version.json', response());
    expect(guard.blockedResponse('/api/products')).toBeNull();
  });
});


it('does not retry an oversized request or pause unrelated requests', async () => {
  const error = { status: 503, data: { error: 'database_read_budget_exceeded' } };
  expect(shouldRetryQuery(0, error)).toBe(false);
  const guard = createServiceAvailabilityGuard();
  await guard.observeResponse('https://api.teajia.com/api/products', new Response(JSON.stringify(error.data), {status: 503}));
  expect(guard.blockedResponse('https://api.teajia.com/api/rates')).toBeNull();
});

import { describe, expect, it } from 'vitest';
import { ApiError, isTransientApiError } from './api';

describe('API error retry classification', () => {
  it('queues network and server failures only', () => {
    expect(isTransientApiError(new Error("Couldn't reach the server"))).toBe(true);
    expect(isTransientApiError(new Error('Request timed out'))).toBe(true);
    expect(isTransientApiError(new ApiError('Unavailable', 503))).toBe(true);
    expect(isTransientApiError(new ApiError('Rate limited', 429))).toBe(true);
  });

  it('does not queue actionable client or authorization failures', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(isTransientApiError(new ApiError('Permanent', status))).toBe(false);
    }
  });
});

it('never queues an explicitly nonretryable budget or partial-write refusal', () => {
  for (const status of [409, 503]) {
    expect(isTransientApiError(new ApiError('Check the saved result', status, { retryable: false }))).toBe(false);
  }
  expect(isTransientApiError(new ApiError('Narrow the request', 503, { code: 'database_read_budget_exceeded' }))).toBe(false);
});

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

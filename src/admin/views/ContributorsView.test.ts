import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import { contributorsLoadError } from './ContributorsView';

describe('why the contributors list did not load', () => {
  it('names the cause and the next step instead of one sentence for everything', () => {
    expect(contributorsLoadError(new ApiError('x', 401))).toMatch(/sign-in has expired/);
    expect(contributorsLoadError(new ApiError('Owner-tier access required for this action', 403))).toMatch(/Switch to that shop in Your Table/);
    expect(contributorsLoadError(new ApiError('x', 503))).toMatch(/problem answering/);
    expect(contributorsLoadError(new TypeError('Failed to fetch'))).toMatch(/did not answer/);
  });
});

import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import { plainFailure } from './plainFailure';

describe('plainFailure: a failed request in a sentence a person can act on', () => {
  it('never prints a bare status line, a column name or nothing at all', () => {
    for (const error of [new ApiError('Request failed (500)', 500), new ApiError('Request failed (404)', 404), new Error('cost_amount is required (missing: amount)'), new Error(''), 'boom', undefined]) {
      const text = plainFailure(error, 'Filing');
      expect(text).toBe('Filing did not go through. Try again.');
    }
  });

  it('keeps the shop\'s own words when it refused for a reason', () => {
    expect(plainFailure(new ApiError('Compass entry not found', 404), 'Shelving')).toBe('Compass entry not found.');
    expect(plainFailure(new ApiError('Cannot promote: entry needs a name, or a photo + vendor.', 400), 'Shelving')).toBe('Cannot promote: entry needs a name, or a photo + vendor.');
  });

  it('says a lost connection is one', () => {
    expect(plainFailure(new Error('Failed to fetch'), 'Copying the photos')).toBe('Copying the photos did not go through. Check the connection and try again.');
    expect(plainFailure(new Error("Couldn't reach the server"), 'That')).toBe('That did not go through. Check the connection and try again.');
  });

  it('does not repeat a server fault\'s own text as if it were advice', () => {
    expect(plainFailure(new ApiError('Internal server error', 500), 'That')).toBe('That did not go through. Try again.');
  });
});

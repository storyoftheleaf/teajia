import { describe, expect, it } from 'vitest';
import { isGuestEventCompleted } from './helpers';

describe('guest post-session recap', () => {
  it('keeps registration closure separate from a completed session', () => {
    expect(isGuestEventCompleted({ lifecycleStatus: 'published', status: 'closed' })).toBe(false);
    expect(isGuestEventCompleted({ status: 'closed' })).toBe(false);
  });

  it('opens when the host completes or archives the session', () => {
    expect(isGuestEventCompleted({ lifecycleStatus: 'completed', status: 'closed' })).toBe(true);
    expect(isGuestEventCompleted({ lifecycleStatus: 'archived' })).toBe(true);
    expect(isGuestEventCompleted({ status: 'completed' })).toBe(true);
  });
});

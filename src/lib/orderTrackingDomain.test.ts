import { describe, expect, it } from 'vitest';
import { createAsyncResultGuard } from './orderTrackingDomain';

describe('order tracking stale response guard', () => {
  it('prevents an older request from applying after cleanup', () => {
    const older = createAsyncResultGuard();
    expect(older.isCurrent()).toBe(true);

    older.cancel();

    expect(older.isCurrent()).toBe(false);
    expect(createAsyncResultGuard().isCurrent()).toBe(true);
  });
});

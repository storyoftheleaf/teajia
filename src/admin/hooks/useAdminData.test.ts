import { describe, expect, it } from 'vitest';
import { normalizeAdminProductTastingSource } from './useAdminData';

describe('admin product tasting provenance', () => {
  it('decodes source and preserves legacy common tasting sources', () => {
    expect(normalizeAdminProductTastingSource('source')).toBe('source');
    expect(normalizeAdminProductTastingSource('common')).toBe('common');
  });
});

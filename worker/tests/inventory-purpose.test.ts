import { describe, expect, it } from 'vitest';
import { decodeInventoryPurposeWrite, effectiveInventoryPurpose } from '../src/inventoryDomain';
import { readFileSync } from 'node:fs';

describe('inventory purpose compatibility', () => {
  it('prefers canonical purpose and reports legacy conflicts', () => {
    expect(effectiveInventoryPurpose({ inventory_purpose: 'personal', is_sample: 1, is_personal: 0 }))
      .toEqual({ purpose: 'personal', conflict: true, source: 'canonical' });
  });

  it('falls back deterministically for legacy sample, personal, and working rows', () => {
    expect(effectiveInventoryPurpose({ is_sample: 1, is_personal: 0 }).purpose).toBe('sample');
    expect(effectiveInventoryPurpose({ is_sample: 0, is_personal: 1 }).purpose).toBe('personal');
    expect(effectiveInventoryPurpose({ is_sample: 0, is_personal: 0 }).purpose).toBe('working');
    expect(effectiveInventoryPurpose({ is_sample: 1, is_personal: 1 })).toMatchObject({ purpose: 'sample', conflict: true });
  });

  it('dual-writes canonical purpose and legacy flags for single and CSV creation', () => {
    expect(decodeInventoryPurposeWrite({ inventory_purpose: 'sample' })).toEqual({
      inventory_purpose: 'sample', is_sample: 1, is_personal: 0,
    });
    expect(decodeInventoryPurposeWrite({ is_personal: true })).toEqual({
      inventory_purpose: 'personal', is_sample: 0, is_personal: 1,
    });
    expect(() => decodeInventoryPurposeWrite({ inventory_purpose: 'sale' })).toThrow(/inventory_purpose/);
  });

  it('mirrors canonical purpose and known-stock state to listings', () => {
    const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    expect(source).toContain('owner_user_id, shown_in_shop, inventory_purpose, stock_known_at');
    expect(source.match(/decodeInventoryPurposeWrite\(body\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

import { describe, expect, it } from 'vitest';
import { getSetCoverVariant } from './setCover';

describe('getSetCoverVariant', () => {
  it('assigns a stable bounded composition from a set id', () => {
    expect(getSetCoverVariant('set-tea-tasting-journey')).toBe(getSetCoverVariant('set-tea-tasting-journey'));
    expect(['orbit', 'column', 'horizon', 'seal']).toContain(getSetCoverVariant('set-modern-brewer-kit'));
  });

  it('distributes the eight starter sets across multiple compositions', () => {
    const sets = [
      ['set-tea-tasting-journey', 'Tea collection'], ['set-puerh-experience', 'Tea collection'],
      ['set-ceremonial-oolong', 'Tea collection'], ['set-afternoon-tea-ritual', 'Tea collection'],
      ['set-gongfu-essentials', 'Teaware collection'], ['set-modern-brewer-kit', 'Teaware collection'],
      ['set-travel-companion-ware', 'Teaware collection'], ['set-minimalist-elegance', 'Teaware collection'],
    ];
    expect(new Set(sets.map(([id, category]) => getSetCoverVariant(id, category))).size).toBeGreaterThanOrEqual(3);
  });
});

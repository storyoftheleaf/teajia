import { describe, expect, it } from 'vitest';
import { resolveLineage, type TeaLineageProduct } from './TeaLineage';

const product = (overrides: Partial<TeaLineageProduct> = {}): TeaLineageProduct => ({
  name: '',
  ...overrides,
});

describe('resolveLineage', () => {
  it('resolves a directly recorded cultivar id first', () => {
    const { cultivar } = resolveLineage(product({ name: 'House blend', cultivar: 'rou-gui' }));
    expect(cultivar?.name).toBe('Rou Gui');
  });

  it('falls back to matching the stored cultivar string when it is not a known id', () => {
    const { cultivar } = resolveLineage(product({ name: 'House blend', cultivar: 'Rou Gui' }));
    expect(cultivar?.name).toBe('Rou Gui');
  });

  it('matches the cultivar from the product name when none is recorded directly', () => {
    const { cultivar } = resolveLineage(product({ name: '2019 Rou Gui Yancha' }));
    expect(cultivar?.name).toBe('Rou Gui');
  });

  it('matches the cultivar from the Chinese name when the English name is unfamiliar', () => {
    const { cultivar } = resolveLineage(product({ name: 'House oolong', chineseName: '肉桂' }));
    expect(cultivar?.name).toBe('Rou Gui');
  });

  it('never guesses: returns a null cultivar rather than an approximate one', () => {
    const { cultivar } = resolveLineage(product({ name: 'Unlabelled bag from the market' }));
    expect(cultivar).toBeNull();
  });

  it('resolves the growing region from the product origin independently of the cultivar', () => {
    const { region } = resolveLineage(product({ name: 'Some tea', origin: 'Wuyi Mountains' }));
    expect(region?.altitude).toBe('200-800m');
  });

  it('leaves the region null when the recorded origin is not a known place', () => {
    const { region } = resolveLineage(product({ name: 'Some tea', origin: 'Nowhere in particular' }));
    expect(region).toBeNull();
  });
});

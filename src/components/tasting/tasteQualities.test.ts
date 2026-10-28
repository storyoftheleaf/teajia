import { describe, it, expect } from 'vitest';
import { toggleBasicTaste, setReturningSweetness } from './tasteQualityState';
import { tastingRecap } from './tastingRecap';

describe('basic tastes and returning sweetness', () => {
  it('keeps sip taste independent of aromatic notes and supports mixed tastes', () => {
    const value = { flavor: ['honey'], aroma: ['honey'] };
    const next = toggleBasicTaste(toggleBasicTaste(value, 'Sweet'), 'Bitter');
    expect(next).toEqual({ ...value, basicTastes: ['Sweet', 'Bitter'] });
    expect(toggleBasicTaste(next, 'Sweet').basicTastes).toEqual(['Bitter']);
  });
  it('distinguishes no answer, explicit none and observed sweetness without guessing legacy intensity', () => {
    expect(setReturningSweetness({}, 0)).toEqual({ huiGan: false, huiGanIntensity: 0 });
    expect(setReturningSweetness({ aroma: ['rose'] }, 3)).toEqual({ aroma: ['rose'], huiGan: true, huiGanIntensity: 3 });
    expect(setReturningSweetness({ huiGan: true }, undefined).huiGanIntensity).toBeUndefined();
    expect(tastingRecap({ huiGan: true }).find(g => g.id === 'flavor')?.words).toContainEqual({ id: 'hui-gan', label: 'Returning sweetness' });
    expect(tastingRecap({ huiGanIntensity: 0 }).find(g => g.id === 'flavor')?.words).toContainEqual({ id: 'hui-gan', label: 'Returning sweetness · None' });
  });
});

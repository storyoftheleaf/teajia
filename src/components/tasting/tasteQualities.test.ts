import { describe, it, expect } from 'vitest';
import type { TastingData } from '../../types';
import { toggleBasicTaste, setReturningSweetness } from './tasteQualityState';
import { tastingRecap } from './tastingRecap';

describe('basic tastes and returning sweetness', () => {
  it('keeps sip taste independent of aromatic notes and supports mixed tastes', () => {
    const value: TastingData = { flavor: ['honey'], aroma: ['honey'] };
    const next = toggleBasicTaste(toggleBasicTaste(value, 'Sweet'), 'Bitter');
    expect(next).toEqual({ ...value, basicTastes: ['Sweet', 'Bitter'] });
    expect(toggleBasicTaste(next, 'Sweet').basicTastes).toEqual(['Bitter']);
  });
  it('preserves canonical savory data while toggling independent tastes', () => {
    const value: TastingData = { basicTastes: ['Umami', 'Salty'], flavor: ['honey'], huiGan: true };
    expect(toggleBasicTaste(value, 'Sweet')).toEqual({ ...value, basicTastes: ['Umami', 'Salty', 'Sweet'] });
    expect(toggleBasicTaste(value, 'Umami')).toEqual({ ...value, basicTastes: ['Salty'] });
    expect(value.basicTastes).toEqual(['Umami', 'Salty']);
  });
  it('clears an explicit zero back to absence without dropping other observations', () => {
    const other: TastingData = { aroma: ['rose'], basicTastes: ['Sweet'] };
    const cleared = setReturningSweetness(setReturningSweetness(other, 0), undefined);
    expect(cleared).toEqual({ ...other, huiGan: undefined, huiGanIntensity: undefined });
    expect(JSON.parse(JSON.stringify(cleared))).toEqual(other);
  });
  it('distinguishes no answer, explicit not noticed and observed sweetness without guessing legacy intensity', () => {
    expect(setReturningSweetness({}, 0)).toEqual({ huiGan: false, huiGanIntensity: 0 });
    expect(setReturningSweetness({ aroma: ['rose'] }, 3)).toEqual({ aroma: ['rose'], huiGan: true, huiGanIntensity: 3 });
    expect(setReturningSweetness({ huiGan: true }, undefined).huiGanIntensity).toBeUndefined();
    expect(tastingRecap({ huiGan: true }).find(g => g.id === 'flavor')?.words).toContainEqual({ id: 'hui-gan', label: 'Returning sweetness' });
    expect(tastingRecap({ huiGanIntensity: 0 }).find(g => g.id === 'flavor')?.words).toContainEqual({ id: 'hui-gan', label: 'Returning sweetness · Not noticed' });
  });
});

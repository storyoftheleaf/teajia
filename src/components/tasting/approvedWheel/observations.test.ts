import { describe, expect, it } from 'vitest';
import { tastingWordId, tastingWordLabel, toggleWheelObservation, wheelNotes } from './observations';

describe('approved wheel persistence', () => {
  it('keeps legacy flavor IDs and unknown observations when adding an aroma', () => {
    const value = { flavor: ['honey', 'smoky', 'old-custom-word'], notes: ['Keep this note'] };
    const next = toggleWheelObservation(value, 'Honey', 'aroma');
    expect(next).toEqual({ ...value, aroma: ['honey'] });
    expect(wheelNotes(next)).toContainEqual({name: 'Honey', group: 'Sweet & creamy', taste: true, aroma: true});
    expect(wheelNotes(next)).toContainEqual({name: 'Smoke', group: 'Roast & cocoa', taste: true, aroma: false});
  });
  it('removes only the chosen sense and its intensity', () => {
    const value = { flavor: ['honey', 'rose'], aroma: ['honey'], tasteIntensities: {honey: 'Subtle', rose: 'Moderate'}, aromaIntensities: {honey: 'Pronounced'} };
    expect(toggleWheelObservation(value, 'Honey', 'taste')).toEqual({ ...value, flavor: ['rose'], tasteIntensities: {rose: 'Moderate'} });
  });
  it('uses stable IDs for new vocabulary and retains existing IDs', () => {
    expect(tastingWordId('Smoke')).toBe('smoky');
    expect(tastingWordId('Orange blossom')).toBe('orange-blossom');
    expect(tastingWordLabel('orange-blossom')).toBe('Orange blossom');
    expect(tastingWordLabel('Mineral-like')).toBe('Mineral-like');
  });
  it('does not migrate or overwrite untouched legacy fields', () => {
    const value = { flavor: ['Honey', 'honey', 'umami'], aroma: ['honey'], body: ['silky'] };
    expect(toggleWheelObservation(value, 'Honey', 'taste')).toEqual({ ...value, flavor: ['umami'] });
    expect(value.flavor).toEqual(['Honey', 'honey', 'umami']);
  });
});

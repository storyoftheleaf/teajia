import { describe, expect, it } from 'vitest';
import { tastingWordId, tastingWordLabel, toggleBroadFamily, toggleWheelObservation, wheelNotes } from './observations';

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

describe('broad family observations', () => {
  it('records a family without inventing taste, aroma or a specific note', () => {
    const next = toggleBroadFamily({ notes: ['Keep'] }, 'Floral');
    expect(next).toEqual({ notes: ['Keep'], flavorFamilies: ['floral'] });
    expect(wheelNotes(next)).toEqual([{ name: 'Floral', group: 'Floral', taste: false, aroma: false }]);
    expect(toggleBroadFamily(next, 'Floral')).toEqual({ notes: ['Keep'], flavorFamilies: [] });
  });
  it('does not automatically add a parent when recording a flower', () => {
    expect(toggleWheelObservation({}, 'Rose', 'taste')).toEqual({ flavor: ['rose'] });
    const broad = toggleBroadFamily({}, 'Floral');
    const specific = toggleWheelObservation(broad, 'Rose', 'aroma');
    expect(specific).toEqual({ flavorFamilies: ['floral'], aroma: ['rose'] });
    expect(toggleBroadFamily(specific, 'Floral')).toEqual({ flavorFamilies: [], aroma: ['rose'] });
  });
  it('uses understandable Earthy and Mineral-like broad labels', () => {
    expect(toggleBroadFamily({}, 'Earth & fungi')).toEqual({ flavorFamilies: ['earthy'] });
    expect(toggleBroadFamily({}, 'Stone & metal')).toEqual({ flavorFamilies: ['mineral'] });
  });
});

it('keeps unwanted Incense out of the suggested flavor families', async () => {
  const { families } = await import('./families');
  expect(families.flatMap(family => family.notes)).not.toContain('Incense');
});

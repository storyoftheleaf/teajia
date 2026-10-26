import { describe, expect, it } from 'vitest';
import { tastingRecap } from './tastingRecap';
import type { SensoryTastingData } from './connectedSensationsVocabulary';

describe('Tasting selection recap', () => {
  it('does not invent unanswered observations or empty groups', () => {
    expect(tastingRecap({})).toEqual([]);
    expect(tastingRecap({ storageCharacter: NaN })).toEqual([]);
  });
  it('preserves known, legacy and custom sensations and their resume IDs', () => {
    const data: SensoryTastingData = { body: ['silky', 'old-body-term'], finish: ['unknown-finish'], feeling: ['unknown-feeling'], cleanliness: 'clean', sensoryCustom: { body: ['My texture'], state: ['My effect'] } };
    const groups = tastingRecap(data);
    expect(groups.map(g => g.id)).toEqual(['body', 'state']);
    expect(groups[0].words).toEqual(expect.arrayContaining([{ id: 'silky', label: 'Silky' }, { id: 'throat-comfortable', label: 'Comfortable' }, { id: 'old-body-term', label: 'Old Body Term' }, { id: 'unknown-finish', label: 'Unknown Finish' }, { id: 'My texture', label: 'My texture' }]));
    expect(groups[1].words.map(w => w.id)).toEqual(['unknown-feeling', 'My effect']);
    expect(data.body).toEqual(['silky', 'old-body-term']);
  });
  it('keeps taste and aroma distinct and preserves original wheel IDs', () => {
    expect(tastingRecap({ flavor: ['orange-blossom'], aroma: ['orange-blossom'] })).toEqual([
      { id: 'flavor', label: 'Taste', words: [{ id: 'orange-blossom', label: 'Orange blossom' }] },
      { id: 'aroma', label: 'Aroma', words: [{ id: 'orange-blossom', label: 'Orange blossom' }] },
    ]);
  });
  it('shows the zero storage endpoint, unwanted notes, colour and clarity', () => {
    const groups = tastingRecap({ storageCharacter: 0, storageNotes: ['Musty'], 'liquor-color': ['amber'], clarity: 'clear' });
    expect(groups[0]).toEqual({ id: 'storage', label: 'Storage', words: [{ id: 'storage-character', label: 'Parched' }, { id: 'Musty', label: 'Musty' }] });
    expect(groups[1].words).toEqual([{ id: 'amber', label: 'Amber' }, { id: 'clear', label: 'Clear' }]);
  });
});

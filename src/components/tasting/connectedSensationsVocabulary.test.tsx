import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConnectedSensations } from './ConnectedSensations';
import { SENSATION_GROUPS, selectedSensations, toggleSensation, addSensoryCustom, removeSensoryCustom, type SensoryTastingData } from './connectedSensationsVocabulary';

describe('Connected Texture and Effect', () => {
  it('keeps the approved family order and all visible choices', () => {
    expect(SENSATION_GROUPS.body.map(group => group.label)).toEqual(['Throat feel', 'Texture', 'Weight', 'After the sip', 'Local sensation', 'Persistence']);
    expect(SENSATION_GROUPS.state.map(group => group.label)).toEqual(['Mood', 'Energy', 'Mind', 'Body', 'Change noticed']);
    const html = renderToStaticMarkup(<ConnectedSensations section="body" value={{}} onChange={() => {}} />);
    for (const group of SENSATION_GROUPS.body) for (const term of group.terms) expect(html).toContain(`data-sensation-word="${term.id}"`);
    expect(html).toContain('Add your own texture word');
  });

  it('preserves historical IDs and unrelated answers while changing exclusive groups', () => {
    const old = { body: ['light', 'silky', 'legacy'], finish: ['lingering', 'finish-bitter'], feeling: ['calming'] };
    const medium = toggleSensation(old, 'body', 'weight', 'medium');
    expect(medium.body).toEqual(['silky', 'legacy', 'medium']);
    expect(toggleSensation(medium, 'body', 'weight', 'medium').body).toEqual(['silky', 'legacy']);
    expect(toggleSensation(old, 'body', 'duration', 'finish-short').finish).toEqual(['finish-bitter', 'finish-short']);
    expect(old.body).toEqual(['light', 'silky', 'legacy']);
    expect(selectedSensations(old, 'state').map(term => term.label)).toEqual(['Calm']);
  });

  it('allows coexisting throat feelings and migrates legacy cleanliness only on edit', () => {
    const old = { cleanliness: 'clean', storageCharacter: 0, finish: ['finish-bitter'] };
    expect(selectedSensations(old, 'body').map(term => term.label)).toContain('Comfortable');
    const next = toggleSensation(old, 'body', 'throat', 'throat-slight-edge');
    expect(next.finish).toEqual(['finish-bitter', 'throat-comfortable', 'throat-slight-edge']);
    expect(next.cleanliness).toBeUndefined();
    expect(next.storageCharacter).toBe(0);
    expect(toggleSensation(old, 'body', 'throat', 'throat-comfortable').finish).toEqual(['finish-bitter']);
  });

  it('keeps calm and energized together and makes no-change mutually exclusive', () => {
    const calm = toggleSensation({}, 'state', 'mood', 'calming');
    const both = toggleSensation(calm, 'state', 'activation', 'energizing');
    expect(both.feeling).toEqual(['calming', 'energizing']);
    const noChange = toggleSensation(addSensoryCustom(both, 'state', 'Floating'), 'state', 'change', 'no-clear-change');
    expect(noChange.feeling).toEqual(['no-clear-change']);
    expect(noChange.sensoryCustom?.state).toEqual([]);
    expect(toggleSensation(noChange, 'state', 'mood', 'calming').feeling).toEqual(['calming']);
    expect(toggleSensation(noChange, 'state', 'change', 'no-clear-change').feeling).toEqual([]);
  });

  it('normalizes custom words without duplicating known terms or changing another section', () => {
    const initial: SensoryTastingData = { feeling: ['no-clear-change'], sensoryCustom: { body: ['Bouncy'] }, storageNotes: ['Musty'] };
    const custom = addSensoryCustom(initial, 'state', '  Floating   gently ');
    expect(custom.sensoryCustom).toEqual({ body: ['Bouncy'], state: ['Floating gently'] });
    expect(custom.feeling).toEqual([]);
    expect(addSensoryCustom(custom, 'state', 'floating gently')).toBe(custom);
    expect(addSensoryCustom(custom, 'state', '   ')).toBe(custom);
    const known = addSensoryCustom(custom, 'body', 'silky');
    expect(known.body).toEqual(['silky']);
    expect(known.sensoryCustom).toEqual(custom.sensoryCustom);
    expect(removeSensoryCustom(custom, 'state', 'Floating gently').sensoryCustom).toEqual({ body: ['Bouncy'], state: [] });
    expect(JSON.parse(JSON.stringify(custom)).storageNotes).toEqual(['Musty']);
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { withObservationIntensity } from './ObservationIntensity';
import { ConnectedSensations } from './ConnectedSensations';
import { SENSATION_GROUPS, sensationAllowsIntensity, selectedSensations, toggleSensation, addSensoryCustom, removeSensoryCustom, type SensoryTastingData } from './connectedSensationsVocabulary';

describe('Connected Texture and Effect', () => {
  it('keeps the approved family order and all visible choices', () => {
    expect(SENSATION_GROUPS.body.map(group => group.label)).toEqual(['Throat feel', 'Texture', 'Weight', 'After the sip', 'Local sensation', 'Persistence']);
    expect(SENSATION_GROUPS.state.map(group => group.label)).toEqual(['Mood', 'Energy', 'Mind', 'Body', 'Change noticed']);
    const html = renderToStaticMarkup(<ConnectedSensations section="body" value={{}} onChange={() => {}} />);
    for (const group of SENSATION_GROUPS.body) for (const term of group.terms) expect(html).toContain(`data-sensation-word="${term.id}"`);
    expect(html).toContain('Add your own texture word');
  });

  it('preserves historical IDs and unrelated answers while changing exclusive groups', () => {
    expect(SENSATION_GROUPS.body.filter(group => group.single).map(group => group.id)).toEqual(['throat', 'weight', 'duration']);
    const old = { body: ['light', 'silky', 'legacy'], finish: ['lingering', 'finish-bitter'], feeling: ['calming'] };
    const medium = toggleSensation(old, 'body', 'weight', 'medium');
    expect(medium.body).toEqual(['silky', 'legacy', 'medium']);
    expect(toggleSensation(medium, 'body', 'weight', 'medium').body).toEqual(['silky', 'legacy']);
    expect(toggleSensation(old, 'body', 'duration', 'finish-short').finish).toEqual(['finish-bitter', 'finish-short']);
    expect(old.body).toEqual(['light', 'silky', 'legacy']);
    expect(selectedSensations(old, 'state').map(term => term.label)).toEqual(['Calm']);
  });

  it('replaces throat feel and migrates legacy cleanliness only on edit', () => {
    const old = { cleanliness: 'clean', storageCharacter: 0, finish: ['finish-bitter'] };
    expect(selectedSensations(old, 'body').map(term => term.label)).toContain('Comfortable');
    const next = toggleSensation(old, 'body', 'throat', 'throat-slight-edge');
    expect(next.finish).toEqual(['finish-bitter', 'throat-slight-edge']);
    expect(toggleSensation(next, 'body', 'throat', 'throat-irritated').finish).toEqual(['finish-bitter', 'throat-irritated']);
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
  it('keeps independently chosen intensities and clears only removed observations', () => {
    let value: SensoryTastingData = { body: ['silky', 'rough'], feeling: ['calming'], storageNotes: ['Musty'] };
    value = withObservationIntensity(value, 'sensation:silky', 'Slight');
    value = withObservationIntensity(value, 'sensation:rough', 'Strong');
    value = withObservationIntensity(value, 'storage:Musty', 'Moderate');
    const removed = toggleSensation(value, 'body', 'texture', 'silky');
    expect(removed.observationIntensity).toEqual({ 'sensation:rough': 'Strong', 'storage:Musty': 'Moderate' });
    expect(value.observationIntensity?.['sensation:silky']).toBe('Slight');
    expect(withObservationIntensity(value, 'sensation:rough', undefined).observationIntensity).toEqual({ 'sensation:silky': 'Slight', 'storage:Musty': 'Moderate' });
    expect(toggleSensation({}, 'body', 'texture', 'silky').observationIntensity).toBeUndefined();
  });

  it('offers no intensity for absence, weight, or persistence and clears effects on no-change', () => {
    for (const [group, term] of [['weight', 'light'], ['duration', 'lingering'], ['change', 'no-clear-change'], ['throat', 'throat-comfortable'], ['finish', 'clean-finish']]) {
      expect(sensationAllowsIntensity(group, term)).toBe(false);
    }
    const value: SensoryTastingData = { feeling: ['calming'], sensoryCustom: { state: ['Floating'] }, observationIntensity: { 'sensation:calming': 'Slight', 'sensation:custom:state:Floating': 'Strong', 'sensation:silky': 'Moderate' } };
    expect(toggleSensation(value, 'state', 'change', 'no-clear-change').observationIntensity).toEqual({ 'sensation:silky': 'Moderate' });
    const html = renderToStaticMarkup(<ConnectedSensations section="body" value={{ body: ['light', 'silky'], finish: ['lingering', 'clean-finish'] }} onChange={() => {}} />);
    expect(html).toContain('Intensity for Silky');
    expect(html).not.toContain('Intensity for Light');
    expect(html).not.toContain('Intensity for Lingering');
    expect(html).not.toContain('Intensity for Clean finish');
    expect(html).not.toContain('Silky: Moderate');
  });

  it('adds stomach discomfort without inventing body coolness', () => {
    const body = SENSATION_GROUPS.state.find(group => group.id === 'physical')!;
    expect(body.terms.map(term => term.label)).toContain('Stomach discomfort');
    expect(body.terms.map(term => term.label)).not.toContain('Coolness');
    expect(toggleSensation({}, 'state', 'physical', 'stomach-discomfort').feeling).toEqual(['stomach-discomfort']);
    expect(removeSensoryCustom({ sensoryCustom: { body: ['Bouncy'] }, observationIntensity: { 'sensation:custom:body:Bouncy': 'Strong', 'storage:Musty': 'Slight' } }, 'body', 'Bouncy').observationIntensity).toEqual({ 'storage:Musty': 'Slight' });
  });

});

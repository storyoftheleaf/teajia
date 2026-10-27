import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StorageZone, withStorageCharacter, toggleStorageNote } from './StorageZone';
import type { TastingData } from '../../types';

describe('Storage observations', () => {
  it('does not turn an unanswered character into the visual midpoint', () => {
    const html = renderToStaticMarkup(<StorageZone value={{}} onChange={() => {}} />);
    expect(html).toContain('aria-valuetext="Not selected"');
    expect(html).not.toContain('aria-label="Clear storage character"');
    expect(withStorageCharacter({}, undefined).storageCharacter).toBeUndefined();
  });

  it('keeps the dry endpoint as a real answer and clears only character', () => {
    const original: TastingData = { clarity: 'clear', cleanliness: 'rough', storageNotes: ['Musty'], flavor: ['honey'] };
    const dry = withStorageCharacter(original, 0);
    expect(JSON.parse(JSON.stringify(dry))).toEqual({ ...original, storageCharacter: 0 });
    const html = renderToStaticMarkup(<StorageZone value={dry} onChange={() => {}} />);
    expect(html).toContain('aria-valuetext="Parched"');
    expect(html).toContain('aria-label="Clear storage character"');
    expect(JSON.parse(JSON.stringify(withStorageCharacter(dry, undefined)))).toEqual(original);
    expect(original.storageCharacter).toBeUndefined();
  });

  it('records multiple unwanted notes independently from wetness and appearance', () => {
    const original: TastingData = { storageCharacter: 4, 'liquor-color': ['amber'], storageNotes: ['legacy note'] };
    const added = toggleStorageNote(toggleStorageNote(original, 'Musty'), 'Moldy');
    expect(added.storageNotes).toEqual(['legacy note', 'Musty', 'Moldy']);
    expect(toggleStorageNote(added, 'Musty')).toEqual({ ...original, storageNotes: ['legacy note', 'Moldy'] });
    expect(original.storageNotes).toEqual(['legacy note']);
    expect(added.storageCharacter).toBe(4);
    expect(added['liquor-color']).toEqual(['amber']);
  });

  it('bounds saved character stops and does not persist invalid numbers', () => {
    expect(withStorageCharacter({}, -1).storageCharacter).toBe(0);
    expect(withStorageCharacter({}, 10).storageCharacter).toBe(4);
    expect(withStorageCharacter({}, 1.8).storageCharacter).toBe(2);
    expect(withStorageCharacter({}, NaN).storageCharacter).toBeUndefined();
  });
});

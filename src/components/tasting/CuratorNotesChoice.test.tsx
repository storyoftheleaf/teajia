import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CuratorNotesChoice, curatorCandidates, setCuratorNote } from './CuratorNotesChoice';
import { AlcoveCharacterBand } from '../shop/alcove/AlcoveCharacterBand';
import type { TastingData } from '../../types';

const tasting = {
  flavor: ['honey'],
  notes: [
    'A legacy string note',
    { id: 'mine', text: 'Picked from one old tree above the village.' },
    { id: 'blank', text: '   ' },
    { id: 'guest', text: 'A guest wrote this', sourceJournalEntryId: 'journal-1' },
    { id: 'promoted', text: 'Promoted words', sourceAuthor: { initial: 'M' } },
  ],
} as unknown as TastingData;

describe("Curator's notes choice", () => {
  it('offers only the shop’s own written notes', () => {
    expect(curatorCandidates(tasting).map(note => note.id)).toEqual(['mine']);
  });

  it('starring one note leaves every other note exactly as it was', () => {
    const next = setCuratorNote(tasting, 'mine', true);
    expect(next.notes).toEqual([
      'A legacy string note',
      { id: 'mine', text: 'Picked from one old tree above the village.', starred: true },
      { id: 'blank', text: '   ' },
      { id: 'guest', text: 'A guest wrote this', sourceJournalEntryId: 'journal-1' },
      { id: 'promoted', text: 'Promoted words', sourceAuthor: { initial: 'M' } },
    ]);
    expect(next.flavor).toEqual(['honey']);
    const cleared = setCuratorNote(next, 'mine', false);
    expect((cleared.notes as Array<{ starred?: boolean }>)[1].starred).toBeUndefined();
  });

  it('says plainly whether each note is on the tea page', () => {
    const markup = renderToStaticMarkup(<CuratorNotesChoice value={setCuratorNote(tasting, 'mine', true)} onChange={() => {}} />);
    expect(markup).toContain('Curator&#x27;s notes'.replace('&#x27;', '’'));
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('On the tea page');
    expect(markup).not.toContain('A guest wrote this');
  });

  it('a chosen note shows on the shop’s own tea page, signed by the curator', () => {
    const item = { id: 'lot', tastingSource: 'owner', tasting: setCuratorNote(tasting, 'mine', true) } as never;
    const markup = renderToStaticMarkup(<AlcoveCharacterBand verifiedOnly item={item} legacyNotes={[]} />);
    expect(markup).toContain('data-testid="curator-notes"');
    expect(markup).toContain('Picked from one old tree above the village.');
    expect(markup).toContain('Tjia, curator');
  });
});

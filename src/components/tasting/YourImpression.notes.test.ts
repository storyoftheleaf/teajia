import { describe, expect, it } from 'vitest';
import type { TastingData } from '../../types';
import { IMPRESSION_NOTE_ID, impressionNoteText, impressionNotes, updateImpressionNote } from './YourImpression';

// A quick tasting, and every tasting written before notes became a list, stores
// its notes as one string. The full tasting read that as a list and crashed.
describe('tasting notes saved as one string', () => {
  const legacy = { quality: 6, notes: 'kept words' } as unknown as TastingData;

  it('reads as one legacy note, kept as written', () => {
    expect(impressionNotes(legacy)).toEqual(['kept words']);
    expect(impressionNoteText(legacy)).toBe('');
  });

  it('keeps the legacy words when a new impression is typed', () => {
    const next = updateImpressionNote(legacy, 'fresh impression');
    expect(next.notes?.[0]).toBe('kept words');
    expect(next.notes?.[1]).toMatchObject({ id: IMPRESSION_NOTE_ID, text: 'fresh impression' });
  });

  it('treats no notes, or an empty string, as none', () => {
    expect(impressionNotes({} as TastingData)).toEqual([]);
    expect(impressionNotes({ notes: '  ' } as unknown as TastingData)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { TastingData } from '../../types';
import { tastingNoteText } from './tastingNoteText';

describe('note text read from a tasting', () => {
  it('reads note objects by their text, never as [object Object]', () => {
    const data = { notes: ['first', { id: 'n', text: 'second', section: 'general', capturedAt: 'x' }] } as unknown as TastingData;
    expect(tastingNoteText(data)).toBe('first\nsecond');
  });
  it('reads a legacy single string', () => {
    expect(tastingNoteText({ notes: 'kept words' } as unknown as TastingData)).toBe('kept words');
  });
  it('is empty when there are no notes', () => {
    expect(tastingNoteText({})).toBe('');
  });
});

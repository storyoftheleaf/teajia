import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TastingData } from '../../types';
import { YourImpression, IMPRESSION_NOTE_ID, impressionNoteText, updateImpressionNote, appendImpressionTranscript } from './YourImpression';

describe('Personal impression notes', () => {
  it('edits one designated draft without changing historical notes or provenance', () => {
    const historical = { id: 'curated', text: 'Old note', starred: true, section: 'flavor' as const, capturedAt: '2026-01-01', sourceAuthor: { accountName: 'Source' }, sourceJournalEntryId: 'journal-1' };
    const original: TastingData = { notes: ['Legacy words', historical], voiceNote: 'Older recording', quality: 8 };
    const added = updateImpressionNote(original, 'My new words');
    const edited = updateImpressionNote(added, 'Changed words');
    expect(edited.notes?.slice(0, 2)).toEqual(original.notes);
    expect(edited.notes?.[1]).toBe(historical);
    expect(edited.voiceNote).toBe('Older recording');
    expect(edited.quality).toBe(8);
    expect(edited.notes).toHaveLength(3);
    expect(impressionNoteText(edited)).toBe('Changed words');
    expect(original.notes).toHaveLength(2);
  });
  it('preserves all metadata when updating or clearing the designated note', () => {
    const original: TastingData = { notes: [{ id: IMPRESSION_NOTE_ID, text: 'My note', starred: true, capturedAt: '2026-01-01', section: 'general', sourceJournalEntryId: 'original' }] };
    expect(updateImpressionNote(original, '').notes).toEqual([{ ...original.notes![0] as object, text: '' }]);
    expect(updateImpressionNote({}, '')).toEqual({});
  });
  it('appends voice text to the typed draft without destroying existing notes', () => {
    const original: TastingData = { notes: ['History'] };
    const typed = updateImpressionNote(original, 'Written note');
    const spoken = appendImpressionTranscript(typed, '  Voice note  ');
    expect(impressionNoteText(spoken)).toBe('Written note\n\nVoice note');
    expect(spoken.notes?.[0]).toBe('History');
    expect(appendImpressionTranscript(spoken, '  ')).toBe(spoken);
  });
});

it('renders one editable notes area and all ten ratings before the linked selection recap', () => {
  const html = renderToStaticMarkup(<YourImpression value={{ quality: 7 }} onChange={() => {}} verdict="pass" onVerdict={() => {}} wouldBuy={false} onWouldBuy={() => {}} inCollection={false} onCollection={() => {}} selections={[{ id: 'flavor', label: 'Flavor', words: [{ id: 'honey', label: 'Honey' }] }]} onResume={() => {}} />);
  expect(html.match(/<textarea/g)).toHaveLength(1);
  for (let n = 1; n <= 10; n++) expect(html).toContain(`Rate ${n} out of 10`);
  expect(html).toContain('Dislike');
  expect(html).toContain('Edit Honey');
  expect(html.indexOf('</textarea>')).toBeLessThan(html.indexOf('Your tasting selections'));
  expect(html).not.toContain('not selected');
});

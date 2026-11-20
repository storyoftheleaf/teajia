import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TastingData } from '../../types';
import { YourImpression, IMPRESSION_NOTE_ID, impressionNoteText, noteDateLabel, sealEarlierDraft, updateImpressionNote } from './YourImpression';
import { TastingPhotographRow, PHOTOGRAPH_NOTICE, NOTES_NOTICE } from './TastingPhotographRow';
import type { FamilyPhotograph } from '../../lib/familyContract';

const draftOn = (day: string): TastingData => ({ notes: [{ id: IMPRESSION_NOTE_ID, text: 'Sweet and deep', section: 'general', capturedAt: day }] });

describe('dated notes under one tasting', () => {
  it('seals an earlier day\'s draft as a dated note and starts a fresh draft today', () => {
    const now = new Date('2026-11-19T10:00:00');
    const sealed = sealEarlierDraft(draftOn('2026-11-12T09:00:00'), now);
    expect(impressionNoteText(sealed)).toBe('');
    const next = updateImpressionNote(sealed, 'Today it is softer');
    expect(next.notes).toHaveLength(2);
    const [earlier, today] = next.notes as Array<{ id: string; text: string }>;
    expect(earlier.text).toBe('Sweet and deep');
    expect(earlier.id).not.toBe(IMPRESSION_NOTE_ID);
    expect(today.id).toBe(IMPRESSION_NOTE_ID);
  });
  it('keeps today\'s draft editable, and leaves notes with no date alone', () => {
    const now = new Date('2026-11-19T20:00:00');
    const same = draftOn('2026-11-19T08:00:00');
    expect(sealEarlierDraft(same, now)).toBe(same);
    const undated: TastingData = { notes: [{ id: IMPRESSION_NOTE_ID, text: 'x' }] };
    expect(sealEarlierDraft(undated, now)).toBe(undated);
  });
  it('shows each earlier note with its date, and none for a legacy note', () => {
    const value = sealEarlierDraft(draftOn('2026-11-12T09:00:00'), new Date('2026-11-19T10:00:00'));
    const withLegacy: TastingData = { ...value, notes: ['Legacy words', ...(value.notes as []) ] };
    const html = renderToStaticMarkup(<YourImpression value={withLegacy} onChange={() => {}} verdict={null} onVerdict={() => {}} wouldBuy={false} onWouldBuy={() => {}} inCollection={false} onCollection={() => {}} selections={[]} onResume={() => {}} />);
    expect(html).toContain(noteDateLabel('2026-11-12T09:00:00'));
    expect(html).toContain('Sweet and deep');
    expect(html.match(/<time/g)).toHaveLength(1);
  });
});

describe('the photograph row', () => {
  const photo = { id: 'p1', product_id: 't', journal_entry_id: null, page: 'impression', full_url: 'https://media.teajia.co/x-full.jpg', small_url: 'https://media.teajia.co/x-small.jpg', full_width: 2000, full_height: 1500, small_width: 480, small_height: 360, share_state: 'private', created_at: '2026-11-19' } as FamilyPhotograph;
  it('sits above the notes, with the one-line notices and the small link', () => {
    const html = renderToStaticMarkup(<YourImpression value={{}} onChange={() => {}} verdict={null} onVerdict={() => {}} wouldBuy={false} onWouldBuy={() => {}} inCollection={false} onCollection={() => {}} selections={[]} onResume={() => {}}
      photographRow={<TastingPhotographRow photos={[photo]} busy={false} onRemove={() => {}} />} notesNotice={NOTES_NOTICE} />);
    expect(html.indexOf('Your photographs')).toBeGreaterThan(-1);
    expect(html.indexOf('Your photographs')).toBeLessThan(html.indexOf('Your notes'));
    expect(html).toContain(PHOTOGRAPH_NOTICE);
    expect(html).toContain('How we use photographs');
    // Nothing is written under a thumbnail: "Remove from my page" is in the zoom.
    expect(html).not.toContain('Remove from my page');
    expect(html).toContain('data-testid="tasting-photograph"');
    expect(html).toContain('data-shape="across"');
    expect(html).toContain(NOTES_NOTICE);
    expect(html).not.toContain('Delete');
    expect(html).not.toContain('—');
  });
  it('is absent when no row is given, so nothing else on the page moves', () => {
    const html = renderToStaticMarkup(<YourImpression value={{}} onChange={() => {}} verdict={null} onVerdict={() => {}} wouldBuy={false} onWouldBuy={() => {}} inCollection={false} onCollection={() => {}} selections={[]} onResume={() => {}} />);
    expect(html).not.toContain('Your photographs');
  });
});

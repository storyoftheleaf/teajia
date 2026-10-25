import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../../lib/teaCompassStore', () => ({ useTeaCompassStore: () => vi.fn() }));
vi.mock('./LibraryGivenName', () => ({ LibraryGivenName: () => null }));
vi.mock('../../lib/teaCompassSync', () => ({ syncCompassEntries: vi.fn() }));
vi.mock('../shared/BottomSheet', () => ({ BottomSheet: () => null }));
vi.mock('../tasting/TastingSession', () => ({ TastingSession: () => null }));
import { BrowseCard } from './BrowseCard';
import { createEmptyEntry } from './types';

const entry = { ...createEmptyEntry(), name: 'Silver Needle', year: 2024, type: 'White' as const, originRegion: 'Fuding', priceAmount: 70, pricePerUnitGrams: 100, sampleState: 'received' as const };
const render = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(<BrowseCard entry={entry} onEdit={() => {}} onAcquire={() => {}} onOpenDetail={() => {}} rates={[{ currency: 'Yuan', rateToUSD: 7 }]} {...extra} />);

describe('Library phone row', () => {
  it('renders a named source price, quiet harvest and preparation line, and three actions', () => {
    const markup = render();
    expect(markup).toContain('Silver Needle');
    expect(markup).toContain('>0.1<');
    expect(markup).toContain('Fuding · White');
    expect(markup).toContain('Sample ready');
    expect(markup).toContain('aria-label="Taste Silver Needle"');
    expect(markup).toContain('>Reject<');
    expect(markup).not.toContain('Save');
    expect(markup).not.toContain('Carry');
    expect(markup).not.toContain('Add to');
  });
  it('shows arrival and sample status independently without preview decoration or prose', () => {
    const markup = render({ entry: { ...entry, status: 'incoming', vendorName: 'Chosen', notes: 'Internal notes', description: 'Long story', photos: ['https://example.com/bag.jpg'] } });
    expect(markup).not.toContain('Incoming');
    expect(markup).toContain('Sample ready');
    expect(markup).toContain('Chosen');
    expect(markup).not.toContain('Internal notes');
    expect(markup).not.toContain('Long story');
    expect(markup).not.toContain('<img');
  });
  it('retains Taste and chosen state without showing order quantities', () => {
    const markup = render({ entry: { ...entry, tastingHistory: [{ data: { rating: 9 }, date: '2026-10-20' }], tasting: { rating: 9 } }, purchaseState: { status: 'ordered', quantities: [{ unit: 'g', draft: 0, ordered: 500, received: null, due: null }] } });
    expect(markup).toContain('Taste');
    expect(markup).not.toContain('library-order-ribbon');
    expect(markup).toContain('Chosen');
    expect(markup).not.toContain('Taste again');
    expect(markup).not.toContain('500g due');
    expect(markup).toContain('9/10');
  });
  it('keeps quote, quoted grams and converted unit price visible together', () => {
    const markup = render();
    expect(markup).toContain('>10.00<');
    expect(markup).toContain('>100<');
    expect(markup).toContain('>0.1<');
  });
  it('keeps receipt quantities out of the Library label', () => {
    const markup = render({ purchaseState: { status: 'partially_received', quantities: [{ unit: 'g', draft: 0, ordered: 500, received: 200, due: 250 }] } });
    for (const value of ['500g', '200g', '250g']) expect(markup).not.toContain(value);
    expect(markup).not.toContain('300g');
    const unavailable = render({ purchaseStatusUnknown: 'Purchase status unavailable', purchaseState: { status: 'received', quantities: [{ unit: 'g', ordered: 500, received: 500, due: 0 }] } });
    expect(unavailable).not.toContain('500g');
    expect(unavailable).toContain('Purchase status unavailable');
  });
  it('does not label a whole quote as a price per gram when weight is absent', () => {
    const markup = render({ entry: { ...entry, pricePerUnitGrams: null } });
    expect(markup).toContain('>Add<');
    expect(markup).toContain('>0.0<');
    expect(markup).toContain('Per gram unknown');
    expect(markup).toContain('>10.00<');
    expect(markup).not.toContain('>0.1<');
  });
  it('asks before using an existing pack weight as the quote basis', () => {
    const markup = render({ entry: { ...entry, pricePerUnitGrams: null, packSizeGrams: 357 } });
    expect(markup).toContain('Confirm quoted grams for Silver Needle');
    expect(markup).toContain('>0.0<');
    expect(markup).not.toContain('>357<');
  });
  it('offers a positive choice and makes it selected for ordered tea', () => {
    expect(render()).toContain('aria-pressed="false"');
    expect(render()).not.toContain('data-chosen-marker');
    const selected = render({ entry: { ...entry, decision: 'selected' } });
    expect(selected).toContain('aria-pressed="true"');
    expect(selected).not.toContain('data-chosen-marker');
    expect(selected).toContain('library-choose');
    expect(selected).toContain('Chosen');
    const chosen = render({ entry: { ...entry, status: 'incoming' } });
    expect(chosen).toContain('aria-pressed="true"');
    expect(chosen).not.toContain('data-chosen-marker');
    expect(chosen).toContain('Already ordered. Open order details');
    const rejected = render({ entry: { ...entry, decision: 'passed_on' } });
    expect(rejected).toContain('>Restore<');
    expect(rejected).not.toContain('aria-pressed');
  });
  it('puts an editable missing year below the full-width title', () => {
    const markup = render({ entry: { ...entry, year: undefined, ageQuoted: null } });
    expect(markup).toContain('Add year');
    expect(markup).toContain('Edit year for Silver Needle');
    expect(markup.indexOf('library-card-subrow')).toBeLessThan(markup.indexOf('library-card-year'));
  });
  it('hides mutations in the read-only preview', () => {
    const markup = render({ readOnly: true });
    expect(markup).not.toContain('>Reject<');
    expect(markup).not.toContain('aria-label="Edit quote');
    expect(markup).toContain('Open Silver Needle details');
  });
  it('retains tea type accents without merging adjacent card backgrounds', () => {
    const white = render();
    const green = render({ entry: { ...entry, type: 'Green' } });
    const wash = (markup: string) => markup.match(/--library-accent:([^;" ]+)/)?.[1];
    expect(wash(white)).toBeTruthy();
    expect(wash(white)).not.toBe(wash(green));
  });
});

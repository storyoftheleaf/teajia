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
    expect(markup).toContain('Incoming');
    expect(markup).toContain('Sample ready');
    expect(markup).toContain('Chosen');
    expect(markup).not.toContain('Internal notes');
    expect(markup).not.toContain('Long story');
    expect(markup).not.toContain('<img');
  });
  it('retains Taste for a tea already tasted and uses durable order quantities', () => {
    const markup = render({ entry: { ...entry, tastingHistory: [{ data: { rating: 9 }, date: '2026-10-20' }], tasting: { rating: 9 } }, purchaseState: { status: 'ordered', quantities: [{ unit: 'g', draft: 0, ordered: 500, received: null, due: null }] } });
    expect(markup).toContain('Taste');
    expect(markup).toContain('500g');
    expect(markup).toContain('Unknown');
    expect(markup).not.toContain('Taste again');
    expect(markup).not.toContain('500g due');
    expect(markup).toContain('9/10');
  });
  it('keeps quote, quoted grams and converted unit price visible together', () => {
    const markup = render();
    expect(markup).toContain('>10.00<');
    expect(markup).toContain('100g');
    expect(markup).toContain('>0.1<');
  });
  it('uses received and due from receipts, including zero and cancelled quantities', () => {
    const markup = render({ purchaseState: { status: 'partially_received', quantities: [{ unit: 'g', draft: 0, ordered: 500, received: 200, due: 250 }] } });
    for (const value of ['500g', '200g', '250g']) expect(markup).toContain(value);
    expect(markup).not.toContain('300g');
    const unavailable = render({ purchaseStatusUnknown: 'Purchase status unavailable', purchaseState: { status: 'received', quantities: [{ unit: 'g', ordered: 500, received: 500, due: 0 }] } });
    expect(unavailable).not.toContain('500g');
    expect(unavailable).toContain('Unknown');
  });
  it('does not label a whole quote as a price per gram when weight is absent', () => {
    const markup = render({ entry: { ...entry, pricePerUnitGrams: null } });
    expect(markup).toContain('Set grams');
    expect(markup).toContain('>10.00<');
    expect(markup).not.toContain('>0.1<');
  });
  it('offers a positive choice and makes it selected for ordered tea', () => {
    expect(render()).toContain('aria-pressed="false"');
    const chosen = render({ entry: { ...entry, status: 'incoming' } });
    expect(chosen).toContain('aria-pressed="true"');
    expect(chosen).toContain('Already ordered. Open order details');
    const rejected = render({ entry: { ...entry, decision: 'passed_on' } });
    expect(rejected).toContain('>Restore<');
    expect(rejected).not.toContain('aria-pressed');
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

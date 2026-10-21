import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../../lib/teaCompassStore', () => ({ useTeaCompassStore: () => vi.fn() }));
vi.mock('../tasting/TastingSession', () => ({ TastingSession: () => null }));
import { BrowseCard } from './BrowseCard';
import { createEmptyEntry } from './types';

const entry = { ...createEmptyEntry(), name: 'Silver Needle', year: 2024, type: 'White' as const, originRegion: 'Fuding', priceAmount: 70, pricePerUnitGrams: 100, sampleState: 'received' as const };
const render = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(<BrowseCard entry={entry} onEdit={() => {}} onAcquire={() => {}} onOpenDetail={() => {}} rates={[{ currency: 'Yuan', rateToUSD: 7 }]} {...extra} />);

describe('Library phone row', () => {
  it('renders a named source price, quiet harvest and preparation line, and three actions', () => {
    const markup = render();
    expect(markup).toContain('Silver Needle');
    expect(markup).toContain('$0.10/g');
    expect(markup).toContain('2024 · Fuding · White · Sample ready');
    expect(markup).toContain('aria-label="Taste Silver Needle"');
    expect(markup).toContain('aria-label="More about Silver Needle"');
    expect(markup).not.toContain('Save');
    expect(markup).not.toContain('Carry');
    expect(markup).not.toContain('Add to');
  });
  it('retains Taste for a tea already tasted and uses durable order quantities', () => {
    const markup = render({ entry: { ...entry, tastingHistory: [{ data: { rating: 9 }, date: '2026-10-20' }], tasting: { rating: 9 } }, purchaseState: { status: 'ordered', quantities: [{ unit: 'g', draft: 0, ordered: 500, received: null, due: null }] } });
    expect(markup).toContain('Taste');
    expect(markup).toContain('500g ordered');
    expect(markup).not.toContain('500g due');
    expect(markup).toContain('More about Silver Needle');
  });
  it('uses a different whole-row type wash for different actual tea types', () => {
    const white = render();
    const green = render({ entry: { ...entry, type: 'Green' } });
    const wash = (markup: string) => markup.match(/--library-wash:([^;]+)/)?.[1];
    expect(wash(white)).toBeTruthy();
    expect(wash(white)).not.toBe(wash(green));
  });
});

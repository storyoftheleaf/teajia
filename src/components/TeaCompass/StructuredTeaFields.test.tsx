import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('./TeaSourcingConnections', () => ({ useTeaSupplierQuote: () => ({ quoteLine: undefined }), TeaSourcingConnections: () => <section aria-label="Connected sourcing" /> }));
import { StructuredTeaFields } from './StructuredTeaFields';
import { createEmptyEntry } from './types';

describe('structured tea fields presentation', () => {
  it('exposes sourcing fields and route actions without an accordion in flat mode', () => {
    const entry = { ...createEmptyEntry('tea'), ageQuoted: '1980s', packSizeGrams: 500, vendorItemNumber: 'A-12' };
    const html = renderToStaticMarkup(<StructuredTeaFields entry={entry} flat onChange={() => {}} />);
    expect(html).not.toContain('<details');
    expect(html).not.toContain('<summary');
    expect(html).toContain('aria-label="Quoted age"');
    expect(html).toContain('value="1980s"');
    expect(html).toContain('aria-label="Pack weight (g)"');
    expect(html).toContain('value="500"');
    expect(html).toContain('value="A-12"');
    expect(html).toContain('Connected sourcing');
    for (const label of ['Shop name','Shipping method','Pu-erh processing','Discount (%)']) expect(html).not.toContain(`aria-label="${label}"`);
  });
  it('uses a focused details action instead of an accordion', () => {
    const html = renderToStaticMarkup(<StructuredTeaFields entry={createEmptyEntry('tea')} onChange={() => {}} />);
    expect(html).not.toContain('<details');
    expect(html).not.toContain('<summary');
    expect(html).toContain('Tea details</span>');
  });
});

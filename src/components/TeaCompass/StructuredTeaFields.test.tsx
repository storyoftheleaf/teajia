import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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
    expect(html).toContain('Add route quote</button>');
  });
  it('preserves collapsible sourcing for existing callers', () => {
    const html = renderToStaticMarkup(<StructuredTeaFields entry={createEmptyEntry('tea')} onChange={() => {}} />);
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
  });
});

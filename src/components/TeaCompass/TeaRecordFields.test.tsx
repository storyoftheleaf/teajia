import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeaRecordFields } from './TeaRecordFields';
import { createEmptyEntry } from './types';

describe('shared tea record editor', () => {
  it('edits description separately from sourcing notes and retains recorded zero cost', () => {
    const html = renderToStaticMarkup(<TeaRecordFields entry={{ ...createEmptyEntry('tea'), name: 'A real tea', description: 'Working shop description', notes: 'Private vendor evidence', priceAmount: 0 }} onChange={() => {}} />);
    expect(html).toContain('>Description</span>');
    expect(html).toContain('>Notes</span>');
    expect(html).toContain('Working shop description</textarea>');
    expect(html).toContain('Private vendor evidence</textarea>');
    expect(html).toContain('value="0"');
    expect(html).not.toContain('role="tab"');
  });
  it('keeps original voice transcripts and supplier provenance accessible', () => {
    const html = renderToStaticMarkup(<TeaRecordFields entry={{ ...createEmptyEntry('tea'), vendorName: 'Supplier', vendorDetails: { wechat: 'original-source' }, sourceEntryId: 'shared-original', audioClips: [{ url: '/api/media/clip.mp3', transcript: 'Original spoken note', timestamp: '2026-10-20T12:00:00Z' }] }} onChange={() => {}} />);
    expect(html).toContain('Original spoken note');
    expect(html).toContain('<audio');
    expect(html).toContain('original-source');
    expect(html).toContain('shared-original');
    expect(html).toContain('Record a note');
  });
  it('shows quote and provenance directly in flat mode without accordions', () => {
    const entry = { ...createEmptyEntry('tea'), priceAmount: 0, pricePerUnitGrams: 500, vendorName: 'Supplier', vendorDetails: { wechat: 'original-source' }, sourceEntryId: 'shared-original', audioClips: [{ url: '/api/media/clip.mp3', transcript: 'Original spoken note', timestamp: '2026-10-20T12:00:00Z' }] };
    const quote = renderToStaticMarkup(<TeaRecordFields entry={entry} section="quote" flat onChange={() => {}} />);
    const provenance = renderToStaticMarkup(<TeaRecordFields entry={entry} section="provenance" flat onChange={() => {}} />);
    for (const html of [quote, provenance]) {
      expect(html).not.toContain('<details');
      expect(html).not.toContain('<summary');
      expect(html).toContain('<h3');
    }
    expect(quote).toContain('>Quoted amount</span>');
    expect(quote).toContain('value="0"');
    expect(quote).toContain('value="500"');
    expect(provenance).toContain('<audio');
    expect(provenance).toContain('Original spoken note');
    expect(provenance).toContain('original-source');
    expect(provenance).toContain('shared-original');
  });
  it('offers only editable tea attributes when the parent owns name, year and shared supplier', () => {
    const html = renderToStaticMarkup(<TeaRecordFields entry={{ ...createEmptyEntry('tea'), name: 'Source tea', chineseName: '茶', originRegion: 'Phoenix Mountain', year: 1980, vendorName: 'Shared supplier', type: 'Oolong', form: 'Loose' }} section="attributes" flat onChange={() => {}} />);
    expect(html).toContain('grid-cols-2');
    expect(html).toMatch(/<input[^>]+value="茶"/);
    expect(html).toMatch(/<input[^>]+value="Phoenix Mountain"/);
    expect(html).toContain('>Tea type</span>');
    expect(html).toContain('>Form</span>');
    expect(html.match(/<select/g)).toHaveLength(2);
    for (const label of ['Tea name', 'Year', 'Source', 'Quoted amount', 'Description', 'Notes']) expect(html).not.toContain(`>${label}</span>`);
    expect(html).not.toContain('Shared supplier');
    expect(html).not.toContain('<details');
  });

});

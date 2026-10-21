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
});

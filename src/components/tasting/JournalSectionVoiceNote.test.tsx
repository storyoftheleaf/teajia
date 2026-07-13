import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { JournalSectionVoiceNote, appendSectionTranscript } from './JournalSectionVoiceNote';

vi.mock('../../hooks/useVoiceCapture', () => ({
  useVoiceCapture: () => ({ state: 'idle', start: vi.fn(), stop: vi.fn() }),
}));

describe('JournalSectionVoiceNote', () => {
  it('appends a transcript only to the selected section text', () => {
    expect(appendSectionTranscript('Stone fruit', 'Warm apricot')).toBe('Stone fruit Warm apricot');
    expect(appendSectionTranscript('', 'Warm apricot')).toBe('Warm apricot');
  });

  it('exposes private section-scoped record and star controls', () => {
    const html = renderToStaticMarkup(
      <JournalSectionVoiceNote
        text=""
        starred={false}
        onTextChange={() => undefined}
        onStarChange={() => undefined}
      />,
    );
    expect(html).toContain('Record note for this tasting');
    expect(html).toContain('Star this note for private review');
    expect(html).toContain('aria-pressed="false"');
  });
});

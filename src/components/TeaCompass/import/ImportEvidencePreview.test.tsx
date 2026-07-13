import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImportEvidencePreview } from './ImportEvidencePreview';

describe('ImportEvidencePreview', () => {
  it('keeps the native replacement file picker in the keyboard tab order', () => {
    const markup = renderToStaticMarkup(<ImportEvidencePreview evidence={[{
      id: 'file-1', file: new File(['tea'], 'invoice.pdf'), kind: 'file', name: 'invoice.pdf', size: 3,
      type: 'application/pdf', status: 'ready', error: null,
    }]} onReplace={() => undefined} />);

    expect(markup).toContain('type="file"');
    expect(markup).toContain('aria-label="Replace invoice.pdf"');
    expect(markup).not.toContain('tabindex="-1"');
  });
});

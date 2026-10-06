import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImportEvidencePreview } from './ImportEvidencePreview';

describe('ImportEvidencePreview', () => {
  it('exposes one replacement action while hiding the proxy file input', () => {
    const markup = renderToStaticMarkup(<ImportEvidencePreview evidence={[{
      id: 'file-1', file: new File(['tea'], 'invoice.pdf'), kind: 'file', name: 'invoice.pdf', size: 3,
      type: 'application/pdf', status: 'ready', error: null,
    }]} onReplace={() => undefined} />);

    expect(markup).toContain('type="file"');
    expect(markup).toContain('aria-label="Replace invoice.pdf"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('aria-label="Replace attachment invoice.pdf"');
  });

  it('shows DOCX as ready for supported analysis', () => {
    const markup = renderToStaticMarkup(<ImportEvidencePreview evidence={[{
      id: 'file-2', file: new File(['PK'], 'invoice.docx'), kind: 'file', name: 'invoice.docx', size: 2,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', status: 'ready', error: null,
    }]} />);

    expect(markup).toContain('Ready to upload');
    expect(markup).not.toContain('Reference only');
  });
});

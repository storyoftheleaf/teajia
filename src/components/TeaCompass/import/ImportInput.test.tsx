import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImportInput } from './ImportInput';

const sizedFile = (name: string, size: number) => {
  const file = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('ImportInput', () => {
  it('discloses exact intake limits, supported records, and AI-provider processing', () => {
    const markup = renderToStaticMarkup(<ImportInput
      draft={{ text: '', evidence: [], sourceKind: 'paste', journeyId: null }}
      onChange={() => undefined}
      onSubmit={() => undefined}
      journeyLookup={{ status: 'empty', options: [], error: null }}
      onRetryJourneys={() => undefined}
      busy={false}
      onCreateJourney={async () => true}
    />);

    expect(markup).toContain('Up to 50 records per import');
    expect(markup).toContain('Each file can be up to 5 MB');
    expect(markup).toContain('20 MB total, including pasted text');
    expect(markup).toContain('DOC, DOCX, XLS, XLSX, ODT, ODS, and HEIC');
    expect(markup).toContain('record content is sent to configured AI providers for analysis');
    expect(markup).toContain('.heic');
    expect(markup).toContain('.docx');
    expect(markup).toContain('.xlsx');
  });

  it('counts UTF-8 pasted-text bytes toward the 20 MiB aggregate limit', () => {
    const evidence = Array.from({ length: 4 }, (_, index) => {
      const file = sizedFile(`record-${index}.pdf`, index === 3 ? 5 * 1024 * 1024 - 2 : 5 * 1024 * 1024);
      return { id: `file-${index}`, file, kind: 'file' as const, name: file.name, size: file.size, type: file.type, status: 'ready' as const, error: null };
    });
    const markup = renderToStaticMarkup(<ImportInput
      draft={{ text: '茶', evidence, sourceKind: 'paste', journeyId: null }}
      onChange={() => undefined}
      onSubmit={() => undefined}
      journeyLookup={{ status: 'empty', options: [], error: null }}
      onRetryJourneys={() => undefined}
      busy={false}
      onCreateJourney={async () => true}
    />);

    expect(markup).toContain('Record content totals more than 20 MB');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Start import<\/button>/);
  });

  it('counts the exact pasted record bytes, including surrounding whitespace', () => {
    const file = sizedFile('record.pdf', 20 * 1024 * 1024 - 2);
    const markup = renderToStaticMarkup(<ImportInput
      draft={{
        text: ' x ',
        evidence: [{ id: 'file', file, kind: 'file', name: file.name, size: file.size, type: file.type, status: 'ready', error: null }],
        sourceKind: 'paste',
        journeyId: null,
      }}
      onChange={() => undefined}
      onSubmit={() => undefined}
      journeyLookup={{ status: 'empty', options: [], error: null }}
      onRetryJourneys={() => undefined}
      busy={false}
      onCreateJourney={async () => true}
    />);

    expect(markup).toContain('Record content totals more than 20 MB');
  });
});

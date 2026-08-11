import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AlcoveTableSection } from './AlcoveTableSection';

describe('product writing reverse links', () => {
  it('links authoritative public xref articles to the live article reader', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AlcoveTableSection
          impressions={[]}
          events={[]}
          tastingCount={0}
          relatedArticles={[{ id: 'article-1', slug: 'rou-gui-field-note', title: 'Rou Gui field note' }]}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Rou Gui field note');
    expect(html).toContain('href="/article/rou-gui-field-note"');
  });
});

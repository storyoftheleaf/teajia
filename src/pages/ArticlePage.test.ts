import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleTeaReferencesPage, normalizeArticleTeaReferences, paginateArticleTeaReferences, paginateQaItems } from './ArticlePage';

describe('live article tea references', () => {
  it('normalizes and deduplicates public xref products for a fixed reader page', () => {
    expect(normalizeArticleTeaReferences([
      { id: 'tea-1', name: 'Rou Gui', type: 'Oolong', origin_region: 'Wuyi' },
      { id: 'tea-1', name: 'Duplicate Rou Gui' },
      { id: 'tea-2', product_name: 'Shui Xian', origin: 'Wuyi' },
      { id: '', name: 'Broken' },
    ])).toEqual([
      { id: 'tea-1', name: 'Rou Gui', detail: 'Oolong · Wuyi', href: '/shop/product/tea-1' },
      { id: 'tea-2', name: 'Shui Xian', detail: 'Wuyi', href: '/shop/product/tea-2' },
    ]);
  });

  it('uses backend product paths and store slugs when the article xref supplies them', () => {
    expect(normalizeArticleTeaReferences([
      { id: 'tea-1', name: 'Rou Gui', public_path: '/shop/product/tea-1', account_slug: 'rayi-master' },
      { id: 'tea-2', name: 'Shui Xian', source_account_slug: 'barry-master' },
    ])).toEqual([
      { id: 'tea-1', name: 'Rou Gui', detail: '', href: '/shop/product/tea-1?store=rayi-master' },
      { id: 'tea-2', name: 'Shui Xian', detail: '', href: '/shop/product/tea-2?store=barry-master' },
    ]);
  });

  it('renders linked teas as a fixed reader page with public product links', () => {
    const html = renderToStaticMarkup(React.createElement(ArticleTeaReferencesPage, { teas: [
      { id: 'tea-1', name: 'Rou Gui', detail: 'Oolong · Wuyi', href: '/shop/product/tea-1' },
    ] }));
    expect(html).toContain('Teas in this piece');
    expect(html).toContain('/shop/product/tea-1');
    expect(html).toContain('Rou Gui');
  });

  it('bounds linked teas across fixed reader pages', () => {
    const teas = Array.from({ length: 13 }, (_, index) => ({ id: `tea-${index}`, name: `Tea ${index}`, detail: '', href: `/shop/product/tea-${index}` }));
    expect(paginateArticleTeaReferences(teas).map(page => page.length)).toEqual([6, 6, 1]);
  });

  it('keeps exactly one Q&A pair on each magazine page', () => {
    const items = [{ q: 'One?', a: 'One.' }, { q: 'Two?', a: 'Two.' }];
    expect(paginateQaItems(items)).toEqual([[items[0]], [items[1]]]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

const detail = vi.hoisted(() => ({ price: 0.25 as number | null }));

vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'tea-1' }), useNavigate: () => vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'products' && queryKey[1] === 'detail'
      ? [{ id: 'tea-1', productName: 'Worker row', givenName: 'Raw Puer', type: 'Puer', stockGrams: 120, pricePerGramUSD: detail.price }]
      : [],
  }),
}));
vi.mock('../hooks/usePrivateQueryScope', () => ({ usePrivateQueryScope: () => ({ key: ['account', 'user', 0], ready: true }) }));
vi.mock('../store', () => ({ useAppStore: () => ({ openPurchaseOrder: vi.fn() }) }));

import { ProductStoryView } from './ProductStoryView';

describe('product story route', () => {
  it.each([
    { name: 'known price', price: 0.25, expected: '$0.250' },
    { name: 'unknown price', price: null, expected: '—' },
    { name: 'explicit zero', price: 0, expected: '$0.000' },
  ])('renders a mapped detail product with $name', ({ price, expected }) => {
    detail.price = price;
    const html = renderToString(<ProductStoryView />);
    expect(html).toContain('Raw Puer');
    const priceCell = html.match(/>Price\/g<\/p><p[^>]*>(.*?)<\/p>/s);
    expect(priceCell).not.toBeNull();
    // Assert the actual cell text; React's SSR comment boundaries are incidental.
    expect(priceCell![1].replace(/<!--.*?-->/g, '')).toBe(expected);
    expect(html).toContain('120');
  });
});

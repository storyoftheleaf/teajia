import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'tea-1' }), useNavigate: () => vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'products' && queryKey[1] === 'detail'
      ? [{ id: 'tea-1', productName: 'Worker row', givenName: 'Raw Puer', type: 'Puer', stockGrams: 120, pricePerGramUSD: 0.25 }]
      : [],
  }),
}));
vi.mock('../hooks/usePrivateQueryScope', () => ({ usePrivateQueryScope: () => ({ key: ['account', 'user', 0], ready: true }) }));
vi.mock('../store', () => ({ useAppStore: () => ({ openPurchaseOrder: vi.fn() }) }));

import { ProductStoryView } from './ProductStoryView';

describe('product story route', () => {
  it('renders a mapped detail product with its price', () => {
    const html = renderToString(<ProductStoryView />);
    expect(html).toContain('Raw Puer');
    expect(html).toMatch(/\$<!-- -->0\.250/);
    expect(html).toContain('120');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'tea-1' }), useNavigate: () => vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'products'
      ? [{ id: 'tea-1', product_name: 'Worker row', given_name: 'Raw Puer', type: 'Puer', stock_grams: 120, retail_price_per_gram_usd: 0.25 }]
      : [],
  }),
}));
vi.mock('../store', () => ({ useAppStore: () => ({ openPurchaseOrder: vi.fn() }) }));

import { ProductStoryView } from './ProductStoryView';

describe('product story route', () => {
  it('renders a raw Worker product row with its price', () => {
    const html = renderToString(<ProductStoryView />);
    expect(html).toContain('Raw Puer');
    expect(html).toMatch(/\$<!-- -->0\.250/);
    expect(html).toContain('120');
  });
});

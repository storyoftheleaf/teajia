import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import type { InventoryItem } from '../types';
import { TeawareCatalog } from './TeawareCatalog';

const pot: InventoryItem = {
  id: 'stoneware-pot', category: 'ware', type: 'Teaware', subcategory: 'pot',
  name: 'Stoneware teapot', variant: 'Stoneware teapot', year: '', origin: '',
  stock_g: 1, cost_price: '0', description: '', tags: [], image: '',
};

function render(item: InventoryItem) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter><TeawareCatalog externalInventory={[item]} /></MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('teaware shelf metadata', () => {
  beforeEach(() => vi.stubGlobal('localStorage', { getItem: () => null }));
  afterEach(() => vi.unstubAllGlobals());
  it('groups the piece without repeating its category or title beneath it', () => {
    const markup = render(pot);
    expect(markup).toContain('Pots &amp; Kettles');
    expect(markup).toContain('Stoneware teapot');
    expect(markup).not.toMatch(/>pot<\/span>/);
  });

  it('keeps useful recorded detail and a distinct variant fallback', () => {
    expect(render({ ...pot, material: 'Purple clay', capacityMl: 180 }))
      .toContain('Purple clay · 180ml');
    expect(render({ ...pot, variant: 'Side-handle form' })).toContain('Side-handle form');
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Launch 5: with HOST_CREDIT_OPEN off, checkout renders exactly as it did
// before tea credit, even for a signed-in host whose credit is already in the
// cache. Only the switch opens the choice.

const state = vi.hoisted(() => ({ open: false }));
vi.mock('../../lib/hostCredit', () => ({ hostCreditOpen: () => state.open }));
vi.mock('../../admin/hooks/useAdminData', () => ({ useRates: () => ({ data: [] }) }));
vi.mock('../../lib/api', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  currentSignInToken: () => 'session',
}));
// A server render reads a zustand store's first state; hand it the signed-in host.
vi.mock('../../lib/store', async importOriginal => {
  const original = await importOriginal<typeof import('../../lib/store')>();
  const useAppStore = Object.assign(
    (select: (value: ReturnType<typeof original.useAppStore.getState>) => unknown) =>
      select({ ...original.useAppStore.getState(), activeUserId: 'host' }),
    original.useAppStore,
  );
  return { ...original, useAppStore };
});

const { PublicCart } = await import('./PublicCart');

const item = { id: 'tea', name: 'Spring oolong', category: 'tea', storeSlug: 'shop', storeName: 'Shop', quantityGrams: 50, pricePerGram: 0.5, totalPrice: 25 } as never;
const credit = { balances: [], lines: [], requests: [], orders: [], store_available: 12 };

function render(cached: boolean) {
  const client = new QueryClient();
  if (cached) client.setQueryData(['me', 'tea-credit', 'host', 'shop'], credit);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}><MemoryRouter>
      <PublicCart storeSlug="shop" storeName="Shop" cart={[item]} isOpen whatsappNumber="+6281339712339"
        onRemoveItem={() => {}} onUpdateQuantity={() => {}} onUpdatePacks={() => {}} onAddItem={() => {}} />
    </MemoryRouter></QueryClientProvider>,
  );
}

beforeEach(() => {
  state.open = false;
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
});
afterEach(() => vi.unstubAllGlobals());

describe('checkout with tea credit closed', () => {
  it('renders the same markup with or without credit in the cache, and says nothing about credit', () => {
    const closed = render(true);
    expect(closed).toBe(render(false));
    expect(closed).not.toMatch(/tea credit|use-tea-credit/i);
  });

  it('opens the one choice only when the switch is on', () => {
    state.open = true;
    const open = render(true);
    expect(open).toContain('Use my tea credit on this order');
    expect(open).toContain('You have $12.00. The shop approves it by hand.');
    state.open = false;
    expect(render(true)).not.toContain('Use my tea credit');
  });
});

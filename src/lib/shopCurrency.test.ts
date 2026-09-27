import { beforeEach, describe, expect, it, vi } from 'vitest';

const entries = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => entries.set(key, value),
  removeItem: (key: string) => entries.delete(key),
});
vi.stubGlobal('window', { localStorage: globalThis.localStorage });
const { useAppStore } = await import('./store');

describe('first shop currency', () => {
  beforeEach(() => {
    entries.clear();
    useAppStore.setState({ currency: 'USD', hasCurrencyPreference: false });
  });
  it('starts a new Bali shopper in rupiah', () => {
    useAppStore.getState().initializeShopCurrency('teajia-bali');
    expect(useAppStore.getState().currency).toBe('IDR');
  });
  it('leaves another store currency unchanged', () => {
    useAppStore.getState().initializeShopCurrency('teajia-australia');
    expect(useAppStore.getState().currency).toBe('USD');
  });
  it('keeps a deliberately chosen currency', () => {
    useAppStore.getState().setCurrency('AUD');
    useAppStore.getState().initializeShopCurrency('teajia-bali');
    expect(useAppStore.getState().currency).toBe('AUD');
  });
  it('keeps saved currency even from storage without a preference flag', async () => {
    entries.set('teajia-storage', JSON.stringify({ state: { currency: 'USD' }, version: 5 }));
    await useAppStore.persist.rehydrate();
    useAppStore.getState().initializeShopCurrency('teajia-bali');
    expect(useAppStore.getState().currency).toBe('USD');
    expect(useAppStore.getState().hasCurrencyPreference).toBe(true);
  });
});

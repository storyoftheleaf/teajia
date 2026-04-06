
import React, { createContext, useContext, useMemo } from 'react';
import { InventoryItem } from '../types';
import { usePublicProducts } from '../hooks/usePublicProducts';
import { publicProductToInventoryItem } from '../lib/adapters';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { useAppStore } from '../lib/store';
import { useQuery } from '@tanstack/react-query';
import { fetchStoreProducts } from '../lib/storefrontApi';

const DEFAULT_SLUG = 'teajia-bali';

interface InventoryContextType {
  inventory: InventoryItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shopStoreSlug = useAppStore(state => state.shopStoreSlug);
  const activeSlug = shopStoreSlug || DEFAULT_SLUG;

  // Default path: legacy endpoint (no slug or Bali slug)
  const defaultQuery = usePublicProducts();

  // Store-specific path: fetch via /api/s/:slug/products
  const storeQuery = useQuery<InventoryItem[]>({
    queryKey: ['storefront', 'products', activeSlug],
    queryFn: () => fetchStoreProducts(activeSlug),
    enabled: !!shopStoreSlug && shopStoreSlug !== DEFAULT_SLUG,
    staleTime: 1000 * 60 * 5,
  });

  // Pick which query result to use
  const isStoreMode = !!shopStoreSlug && shopStoreSlug !== DEFAULT_SLUG;
  const activeQuery = isStoreMode ? storeQuery : defaultQuery;

  const inventory = useMemo(() => {
    if (isStoreMode) {
      // storeQuery already returns InventoryItem[]
      return activeQuery.data ?? [];
    }
    // Default path: map PublicProduct → InventoryItem
    const apiItems = (defaultQuery.data || []).map(publicProductToInventoryItem);
    if (apiItems.length === 0 && !defaultQuery.isLoading && !defaultQuery.isError) {
      return SAMPLE_PRODUCTS.map(publicProductToInventoryItem);
    }
    return apiItems;
  }, [isStoreMode, activeQuery.data, defaultQuery.data, defaultQuery.isLoading, defaultQuery.isError]);

  // CRUD operations are no-ops on the public side.
  const addInventoryItem = () => {};
  const updateInventoryItem = () => {};
  const deleteInventoryItem = () => {};

  const value = useMemo(
    () => ({
      inventory,
      isLoading: activeQuery.isLoading,
      isError: activeQuery.isError,
      error: activeQuery.error as Error | null,
      refetch: activeQuery.refetch,
      addInventoryItem,
      updateInventoryItem,
      deleteInventoryItem,
    }),
    [inventory, activeQuery.isLoading, activeQuery.isError, activeQuery.error, activeQuery.refetch]
  );

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

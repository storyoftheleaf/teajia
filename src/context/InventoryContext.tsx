
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InventoryItem } from '../types';
import { usePublicProducts } from '../hooks/usePublicProducts';
import { publicProductToInventoryItem } from '../lib/adapters';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { useAppStore } from '../lib/store';
import { useQuery } from '@tanstack/react-query';
import { fetchStoreProducts } from '../lib/storefrontApi';
import { resolveInventoryStoreSlug } from '../lib/publicProductNavigation';

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
  const setShopStoreSlug = useAppStore(state => state.setShopStoreSlug);
  const [searchParams] = useSearchParams();
  const requestedStoreSlug = searchParams.get('store')?.trim() || null;
  const activeSlug = resolveInventoryStoreSlug(searchParams, shopStoreSlug);

  // ProductPage is a cold-load sibling of Shop, so Shop's URL synchronizer
  // cannot establish its inventory. Read the store at provider level and keep
  // the persisted selection aligned for subsequent product/shop navigation.
  useEffect(() => {
    if (requestedStoreSlug && requestedStoreSlug !== shopStoreSlug) {
      setShopStoreSlug(requestedStoreSlug);
    }
  }, [requestedStoreSlug, setShopStoreSlug, shopStoreSlug]);

  // Default path: legacy endpoint (no slug or Bali slug)
  const defaultQuery = usePublicProducts();

  // Store-specific path: fetch via /api/s/:slug/products
  const storeQuery = useQuery<InventoryItem[]>({
    queryKey: ['storefront', 'products', activeSlug],
    queryFn: () => fetchStoreProducts(activeSlug),
    enabled: activeSlug !== DEFAULT_SLUG,
    staleTime: 1000 * 60 * 5,
  });

  // Pick which query result to use
  const isStoreMode = activeSlug !== DEFAULT_SLUG;
  const activeQuery = isStoreMode ? storeQuery : defaultQuery;

  const inventory = useMemo<InventoryItem[]>(() => {
    if (isStoreMode) {
      // storeQuery already returns InventoryItem[]. Read it directly rather
      // than through activeQuery, whose type is the union of the two shapes.
      return storeQuery.data ?? [];
    }
    // Default path: map PublicProduct → InventoryItem
    const apiItems = (defaultQuery.data || []).map(publicProductToInventoryItem);
    if (apiItems.length === 0 && !defaultQuery.isLoading && !defaultQuery.isError) {
      return SAMPLE_PRODUCTS.map(publicProductToInventoryItem);
    }
    return apiItems;
  }, [isStoreMode, storeQuery.data, defaultQuery.data, defaultQuery.isLoading, defaultQuery.isError]);

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

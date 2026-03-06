
import React, { createContext, useContext, useMemo } from 'react';
import { InventoryItem } from '../types';
import { usePublicProducts } from '../hooks/usePublicProducts';
import { publicProductToInventoryItem } from '../lib/adapters';

interface InventoryContextType {
  inventory: InventoryItem[];
  isLoading: boolean;
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: products = [], isLoading } = usePublicProducts();

  const inventory = useMemo(
    () => products.map(publicProductToInventoryItem),
    [products]
  );

  // CRUD operations are no-ops on the public side.
  // Inventory is managed through the admin interface via the Worker API.
  const addInventoryItem = () => {};
  const updateInventoryItem = () => {};
  const deleteInventoryItem = () => {};

  const value = useMemo(
    () => ({ inventory, isLoading, addInventoryItem, updateInventoryItem, deleteInventoryItem }),
    [inventory, isLoading]
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

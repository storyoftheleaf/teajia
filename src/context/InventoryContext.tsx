
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { InventoryItem } from '../types';
import { TEA_MARKDOWN_FILES } from '../data/tea-vault';
import { TEAWARE_MARKDOWN_FILES } from '../data/teaware-vault';
import { parseMarkdown, cleanObsidianLink, cleanObsidianLinksInArray } from '../utils/markdown';

interface InventoryContextType {
  inventory: InventoryItem[];
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    // Create a reference map of markdown items for validation/restoration
    const markdownItems: Record<string, InventoryItem> = {};

    // 2a. Load Initial Markdown Data first to use as reference
    const initialTea: InventoryItem[] = TEA_MARKDOWN_FILES.map(fileContent => {
        const { metadata, content } = parseMarkdown(fileContent);
        const item = {
           id: metadata.id,
           category: 'tea' as const,
           type: cleanObsidianLink(metadata.type),
           name: metadata.name,
           year: metadata.year,
           origin: cleanObsidianLink(metadata.origin),
           variant: metadata.variant,
           stock_g: parseFloat(String(metadata.stock_g)) || 0,
           cost_price: String(metadata.cost_price),
           cost_currency: 'USD' as const, // Default for legacy items
           multiplier: 3, // Default multiplier for all items
           price_per_gram: String(metadata.price_per_gram || '0'),
           tags: cleanObsidianLinksInArray(metadata.tags || []),
           image: metadata.image,
           description: content
        };
        markdownItems[item.id] = item;
        return item;
     });

     const initialWare: InventoryItem[] = TEAWARE_MARKDOWN_FILES.map(fileContent => {
        const { metadata, content } = parseMarkdown(fileContent);
        const item = {
           id: metadata.id,
           category: 'ware' as const,
           subcategory: metadata.category,
           type: cleanObsidianLink(metadata.type),
           name: metadata.name,
           year: metadata.year,
           origin: cleanObsidianLink(metadata.origin),
           variant: metadata.variant,
           stock_g: parseFloat(String(metadata.stock_g)) || 0,
           cost_price: String(metadata.cost_price || '0'),
           cost_currency: 'USD' as const, // Default for legacy items
           multiplier: 3, // Default multiplier for all items
           price_50g: String(metadata.price_50g),
           tags: cleanObsidianLinksInArray(metadata.tags || []),
           image: metadata.image,
           description: content
        };
        markdownItems[item.id] = item;
        return item;
     });

    // 2b. Try to load from local storage
    const saved = localStorage.getItem('teajia_inventory');
    if (saved) {
      try {
        const savedItems = JSON.parse(saved) as InventoryItem[];
        // Validate and fix items: if price looks corrupted, restore from markdown
        return savedItems.map(item => {
          const markdownItem = markdownItems[item.id];

          // Migrate stock_g to number if it's still a string
          const stock = typeof item.stock_g === 'string' ? parseFloat(item.stock_g) || 0 : item.stock_g;

          // Determine which price field to check based on category
          const priceField = item.category === 'tea' ? 'price_per_gram' : 'price_50g';
          const priceValue = item[priceField as keyof InventoryItem];
          const price = typeof priceValue === 'string' ? parseFloat(priceValue) : (priceValue as number) || 0;

          // Check for corrupted price: null, NaN, or non-positive values
          const isCorrupted = (!price || isNaN(price) || price <= 0) && markdownItem;

          if (isCorrupted) {
            console.warn(`[InventoryContext] Corrupted price detected for "${item.name}": ${price}. Restoring from markdown.`);
            // Restore the appropriate price field from markdown but keep stock changes
            return {
              ...item,
              stock_g: stock,
              [priceField]: markdownItem[priceField as keyof InventoryItem],
              cost_currency: item.cost_currency || 'USD',
              multiplier: item.multiplier !== undefined ? item.multiplier : 3
            };
          }

          return {
            ...item,
            stock_g: stock,
            cost_currency: item.cost_currency || 'USD',
            multiplier: item.multiplier !== undefined ? item.multiplier : 3
          };
        });
      } catch (e) {
        // If parsing fails, log error and reload from markdown
        console.error('[InventoryContext] Failed to parse inventory from localStorage:', e);
        localStorage.removeItem('teajia_inventory');
      }
    }

    return [...initialTea, ...initialWare];
  });

  useEffect(() => {
    localStorage.setItem('teajia_inventory', JSON.stringify(inventory));
  }, [inventory]);

  const addInventoryItem = (item: InventoryItem) => {
    setInventory(prev => [...prev, item]);
  };

  const updateInventoryItem = (item: InventoryItem) => {
    setInventory(prev => prev.map(i => i.id === item.id ? item : i));
  };

  const deleteInventoryItem = (id: string) => {
    setInventory(prev => prev.filter(i => i.id !== id));
  };

  const value = useMemo(() => ({ inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem }), [inventory]);

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

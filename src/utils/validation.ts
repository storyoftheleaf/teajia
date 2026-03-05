/**
 * Data Validation Utilities
 * Validation schemas and sanitization functions
 */

import type { Story, InventoryItem } from '../types';
import { hasRequiredStoryFields, hasRequiredInventoryFields, validatePrice, validateStock } from './typeGuards';
import { PRICE_VALIDATION } from '../constants/admin';

export const validateStory = (story: any): Story | null => {
  if (!hasRequiredStoryFields(story)) {
    console.warn('Invalid story data:', story);
    return null;
  }

  // Sanitize and provide defaults
  return {
    ...story,
    subtitle: story.subtitle || '',
    thumbnailUrl: story.thumbnailUrl || '',
    durationOrTime: story.durationOrTime || '5 min',
    origin: story.origin || 'In-house',
    description: story.description || '',
    content: Array.isArray(story.content) ? story.content : [],
    drawings: typeof story.drawings === 'boolean' ? story.drawings : false,
  } as Story;
};

export const validateInventoryItem = (item: any): InventoryItem | null => {
  if (!hasRequiredInventoryFields(item)) {
    console.warn('Invalid inventory item data:', item);
    return null;
  }

  const stock = validateStock(item.stock_g);
  const costPrice = validatePrice(item.cost_price);
  const multiplier = typeof item.multiplier === 'number' && item.multiplier > 0 ? item.multiplier : 3;

  // Validate price fields based on category
  const priceField = item.category === 'tea' ? 'price_per_gram' : 'price_50g';
  const price = validatePrice(item[priceField]);

  // Check for corrupted price (too low)
  const isPriceCorrupted = price < PRICE_VALIDATION.MIN_PRICE_THRESHOLD && costPrice > 0;

  if (isPriceCorrupted) {
    console.warn(`Corrupted price detected for item "${item.name}": ${price}. Should be higher based on cost.`);
  }

  return {
    ...item,
    stock_g: stock,
    cost_price: costPrice.toString(),
    multiplier,
    cost_currency: item.cost_currency || 'USD',
    [priceField]: price.toString(),
    variant: item.variant || '',
    year: item.year || new Date().getFullYear().toString(),
    origin: item.origin || '',
    description: item.description || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    image: item.image || '',
  } as InventoryItem;
};

export const validateStoriesArray = (data: any[]): Story[] => {
  if (!Array.isArray(data)) {
    console.error('Stories data is not an array');
    return [];
  }

  return data
    .map(validateStory)
    .filter((story): story is Story => story !== null);
};

export const validateInventoryArray = (data: any[]): InventoryItem[] => {
  if (!Array.isArray(data)) {
    console.error('Inventory data is not an array');
    return [];
  }

  return data
    .map(validateInventoryItem)
    .filter((item): item is InventoryItem => item !== null);
};

// Image validation
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check file size
  if (file.size > PRICE_VALIDATION.MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image must be smaller than ${PRICE_VALIDATION.MAX_IMAGE_SIZE_MB}MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  return { valid: true };
};

export const validateImageUrl = (url: string): boolean => {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' || url.startsWith('data:image');
  } catch {
    return url.startsWith('data:image');
  }
};

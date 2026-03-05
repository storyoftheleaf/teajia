/**
 * TypeScript Type Guards
 * Runtime type validation utilities
 */

import type { Story, InventoryItem, CostCurrency, StoryStatus, ContentType } from '../types';

export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isValidCurrency = (value: unknown): value is CostCurrency => {
  return isString(value) && ['USD', 'IDR', 'CNY', 'TWD', 'MYR', 'HKD', 'JPY'].includes(value);
};

export const isValidStoryStatus = (value: unknown): value is StoryStatus => {
  return isString(value) && ['published', 'draft', 'vault'].includes(value);
};

export const isValidContentType = (value: unknown): value is ContentType => {
  return isString(value) && ['Reel', 'Film', 'Article', 'Audio', 'PhotoEssay'].includes(value);
};

export const hasRequiredStoryFields = (obj: any): obj is Partial<Story> => {
  return (
    obj &&
    typeof obj === 'object' &&
    isString(obj.id) &&
    isValidContentType(obj.type) &&
    isValidStoryStatus(obj.status) &&
    isString(obj.title)
  );
};

export const hasRequiredInventoryFields = (obj: any): obj is Partial<InventoryItem> => {
  return (
    obj &&
    typeof obj === 'object' &&
    isString(obj.id) &&
    (obj.category === 'tea' || obj.category === 'ware') &&
    isString(obj.name)
  );
};

export const validatePrice = (price: unknown): number => {
  const parsed = typeof price === 'string' ? parseFloat(price) : price;
  if (!isNumber(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

export const validateStock = (stock: unknown): number => {
  const parsed = typeof stock === 'string' ? parseFloat(stock) : stock;
  if (!isNumber(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

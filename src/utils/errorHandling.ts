/**
 * Error Handling Utilities
 * Centralized error handling and logging
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleError = (error: unknown, context?: string): string => {
  console.error(`[Error${context ? ` in ${context}` : ''}]:`, error);

  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
};

export const isLocalStorageAvailable = (): boolean => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

export const safeJSONParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return fallback;
  }
};

export const safeLocalStorageGet = <T>(key: string, fallback: T): T => {
  if (!isLocalStorageAvailable()) return fallback;

  try {
    const item = localStorage.getItem(key);
    return safeJSONParse(item, fallback);
  } catch (error) {
    console.error(`Failed to get localStorage item "${key}":`, error);
    return fallback;
  }
};

export const safeLocalStorageSet = (key: string, value: any): boolean => {
  if (!isLocalStorageAvailable()) return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to set localStorage item "${key}":`, error);
    return false;
  }
};

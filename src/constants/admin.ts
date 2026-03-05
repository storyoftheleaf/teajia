/**
 * Admin Panel Configuration Constants
 * Centralized configuration for the admin panel components
 */

// Z-index layers for modals and overlays
export const ADMIN_Z_INDEX = {
  PANEL: 50,
  STUDIO: 100,
  INVENTORY_EDITOR: 150,
  TEMPLATE_MODAL: 200,
  TOAST: 9999,
  FORMAT_TOOLBAR: 9999,
} as const;

// Timing intervals in milliseconds
export const TIMING = {
  EXCHANGE_RATE_REFRESH_MS: 3 * 60 * 60 * 1000, // 3 hours
  AUTO_SAVE_INTERVAL_MS: 30 * 1000, // 30 seconds
  TOAST_DURATION_MS: 5 * 1000, // 5 seconds
  UNDO_WINDOW_MS: 5 * 1000, // 5 seconds for undo
} as const;

// Canvas dimensions and padding
export const CANVAS = {
  MOBILE_PADDING: 24,
  DESKTOP_PADDING: 64,
  ASPECT_RATIOS: {
    ARTICLE: { w: 800, h: 1067, ratio: '3/4' },
    REEL: { w: 600, h: 1067, ratio: '9/16' },
    FILM: { w: 1067, h: 600, ratio: '16/9' },
    AUDIO: { w: 800, h: 800, ratio: '1/1' },
  },
} as const;

// Price validation thresholds
export const PRICE_VALIDATION = {
  MIN_PRICE_THRESHOLD: 5, // Prices below this are considered corrupted
  MAX_IMAGE_SIZE_MB: 2,
  MAX_IMAGE_SIZE_BYTES: 2 * 1024 * 1024,
} as const;

// Touch target minimum sizes (accessibility)
export const TOUCH_TARGET = {
  MIN_SIZE: 44, // 44x44px minimum for mobile
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
  ACCESS_KEYS: 'teajia_access_keys',
  STORIES: 'teajia_stories',
  INVENTORY: 'teajia_inventory',
  EXCHANGE_RATES: 'exchangeRates',
  EXCHANGE_RATES_TIMESTAMP: 'exchangeRates_timestamp',
  THEME: 'teajia_theme',
  USER_EMAIL: 'teajia_user_email',
} as const;

// Currency auto-detection mapping from supplier location
export const CURRENCY_BY_LOCATION = {
  'China': 'CNY',
  'Taiwan': 'TWD',
  'Hong Kong': 'HKD',
  'Indonesia': 'IDR',
  'Japan': 'JPY',
  'Malaysia': 'MYR',
} as const;

export const SUPPLIER_LOCATIONS = ['China', 'Taiwan', 'Hong Kong', 'Indonesia', 'Japan', 'Malaysia'] as const;

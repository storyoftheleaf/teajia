import type { TastingData } from '../../types';
import type { Currency } from '../../admin/types';

export type TeaType = 'Green' | 'White' | 'Yellow' | 'Oolong' | 'Red' | 'Dark' | 'Sheng' | 'Shou' | 'Herbal' | 'Teaware';
export type TeaForm = 'Loose' | 'Cake' | 'Brick' | 'Tuo' | 'Ball' | 'Bag';
export type CompassStatus = 'logged' | 'want' | 'buying' | 'bought' | 'passed';
export type CompassCategory = 'tea' | 'teaware';
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export type Storage = 'Dry' | 'Wet/Traditional' | 'HK' | 'Malaysian' | 'Natural';
export type TeawareCategory = 'Pot' | 'Cup' | 'Gaiwan' | 'Fair Cup' | 'Tray' | 'Storage' | 'Tool' | 'Other';
export type TeawareMaterial = 'Zhuni' | 'Zisha' | 'Duanni' | 'Hongni' | 'Porcelain' | 'Celadon' | 'Wood-fired' | 'Glass' | 'Clay' | 'Ceramic' | 'Wood' | 'Metal' | 'Stone' | 'Silver' | 'Other';
export type TeawareEra = 'Modern' | '90s' | '80s' | '70s' | 'Pre-70s' | 'Republic' | 'Qing' | 'Unknown';

export type BrowseGrouping = 'date' | 'vendor';
export type BrowseFilter = 'all' | 'want' | 'bought';

export interface TeaCompassEntry {
  id: string;

  // Identity
  name: string;
  chineseName?: string;
  type?: TeaType;
  form?: TeaForm;
  year?: number;
  season?: Season;
  storage?: Storage;
  originRegion?: string;

  // Pricing
  priceAmount?: number;
  priceCurrency: Currency;
  pricePerUnitGrams?: number;

  // Category
  category: CompassCategory;

  // Teaware-specific
  teawareCategory?: TeawareCategory;
  material?: TeawareMaterial;
  capacityMl?: number;
  quantity: number;
  era?: TeawareEra;

  // Vendor
  vendorId?: string;
  vendorName?: string;

  // Content
  notes: string;
  tasting?: TastingData;
  photos: string[];
  audioClips: { url: string; transcript?: string; timestamp: string }[];

  // Status & buying
  status: CompassStatus;
  buyQuantityGrams?: number;
  buyQuantityUnits?: number;
  buyTotal?: number;

  // Pipeline
  draftProductId?: string;

  // Meta
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

// Gram presets by form
export const GRAM_PRESETS: Record<TeaForm, number[]> = {
  Loose: [50, 75, 100, 150, 300, 600],
  Cake: [100, 200, 357, 400],
  Brick: [250, 500, 1000],
  Tuo: [100, 250, 500],
  Ball: [50, 100, 250],
  Bag: [50, 100, 150, 300],
};

// Default gram for each form
export const DEFAULT_GRAMS: Record<TeaForm, number> = {
  Loose: 100,
  Cake: 357,
  Brick: 250,
  Tuo: 100,
  Ball: 100,
  Bag: 100,
};

// Tea types array for the grid
export const TEA_TYPES: TeaType[] = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Teaware'];

// Form options
export const TEA_FORMS: TeaForm[] = ['Loose', 'Cake', 'Brick', 'Tuo', 'Ball', 'Bag'];

// Season options
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];

// Storage options
export const STORAGE_OPTIONS: Storage[] = ['Dry', 'Wet/Traditional', 'HK', 'Malaysian', 'Natural'];

// Teaware categories
export const TEAWARE_CATEGORIES: TeawareCategory[] = ['Pot', 'Cup', 'Gaiwan', 'Fair Cup', 'Tray', 'Storage', 'Tool', 'Other'];

// Teaware materials by category
export const TEAWARE_MATERIALS: Record<string, TeawareMaterial[]> = {
  Pot: ['Zhuni', 'Zisha', 'Duanni', 'Hongni', 'Porcelain', 'Silver', 'Glass', 'Other'],
  Cup: ['Porcelain', 'Celadon', 'Wood-fired', 'Glass', 'Clay', 'Other'],
  default: ['Clay', 'Porcelain', 'Glass', 'Ceramic', 'Wood', 'Metal', 'Stone', 'Other'],
};

// Teaware eras
export const TEAWARE_ERAS: TeawareEra[] = ['Modern', '90s', '80s', '70s', 'Pre-70s', 'Republic', 'Qing', 'Unknown'];

// Common regions
export const COMMON_REGIONS = [
  'Alishan', 'Yiwu', 'Wuyi', 'Lugu', 'Jingmai', 'Anxi',
  'Menghai', 'Lincang', 'Phoenix', 'Dong Ding', 'Nantou',
  'Darjeeling', 'Assam', 'Uji', 'Shizuoka',
];

export function createEmptyEntry(category: CompassCategory = 'tea', defaults?: { vendorName?: string; vendorId?: string; priceCurrency?: Currency }): TeaCompassEntry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: '',
    category,
    priceCurrency: defaults?.priceCurrency || 'NT',
    quantity: 1,
    vendorId: defaults?.vendorId,
    vendorName: defaults?.vendorName,
    notes: '',
    photos: [],
    audioClips: [],
    status: 'logged',
    createdAt: now,
    updatedAt: now,
    synced: false,
  };
}

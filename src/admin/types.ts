export type ProductType = 'Green' | 'Yellow' | 'White' | 'Oolong' | 'Red' | 'Dark' | 'Sheng' | 'Shou' | 'Herbal' | 'Teaware' | 'Misc' | 'MISSING_TYPE';

export type TeaForm = 'Loose Leaf' | 'Cake' | 'Tuo' | 'Brick' | 'Rolled' | 'Ball' | 'Powder' | 'Bag' | 'Other';

export type Currency = 'USD' | 'NT' | 'Yuan' | 'IDR' | 'JPY' | 'MYR' | 'HKD' | 'UNK';

import type { TastingData } from '../types';

export interface Product {
  id: string;
  type: ProductType;
  form?: TeaForm; // Physical form: Loose Leaf, Cake, Tuo, Brick, etc.
  givenName: string;
  chineseName?: string;
  productName: string; // The botanical/cultivar name
  year?: number;
  originCountry: string;
  originRegion: string;
  pricePerGramUSD: number; // Retail price (calculated or fixed)
  costPerGramUSD: number; // Private cost calculated per gram
  costAmount: number; // Raw total batch cost
  stockGrams: number;
  lowStockThreshold: number;
  recheckStock?: boolean; // Flag to revisit stock count when unknown
  stockVerifiedAt?: string | null; // ISO timestamp of last physical stock verification
  description: string;
  tastingNotes: string[];
  imageUrl: string;
  vendor?: string;
  vendorId?: string;
  status: 'Active' | 'Archived' | 'Sold Out' | 'Draft';
  costCurrency: Currency;
  quantityPurchased: number; // The amount purchased corresponding to the costAmount
  shippingRatePerKg?: number; // Shipping cost per kg in source currency
  fixedRetailPriceUSD?: number | null; // Explicit override price
  isPersonal: boolean; // Personal collection flag
  canReorder: boolean; // Restockable flag
  isPublic: boolean; // Publicly visible flag
  isFeatured?: boolean; // Suggested/Featured flag
  isCurated?: boolean; // Curated selection flag
  isSample?: boolean; // Sample/trial tea not yet committed to inventory
  inTransit?: boolean; // Stock ordered but not yet physically arrived
  lore?: string; // AI or handcrafted history/story
  isCustomWisdom?: boolean; // True if manually edited
  showWisdom?: boolean; // Toggle to display on public card
  processingNotes?: string; // e.g. "Heavy charcoal roast over pine wood."
  terroir?: string; // e.g. "High-altitude granite soils above 1200m, with dramatic day-night temperature swings."
  mood?: string; // e.g. "Grounding & Meditative"
  experience?: string; // e.g. "A deeply centering tea..."
  additionalImages?: string[]; // Extra photos (different angles, detail shots)
  // Teaware-specific fields (null/undefined for tea)
  material?: string; // e.g. "Yixing clay", "porcelain", "silver"
  capacityMl?: number; // Vessel capacity in ml
  teawareCategory?: 'pot' | 'cup' | 'tray' | 'storage' | 'accessory' | 'decorative';
  quantityUnits?: number; // Unit count (used instead of stockGrams for teaware)
  tasting?: TastingData;
}

export interface InvoiceItem {
  productId: string;
  quantity: number; // Grams or Units
  priceAtSale: number;
}

export interface ExchangeRate {
  currency: Currency;
  rateToUSD: number; // 1 USD = X Currency
}

export interface CartItem extends InvoiceItem {
  product: Product;
}

export type CustomerTag = 'wholesale' | 'retail' | 'friend' | 'vendor' | 'vip' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  country?: string;
  preferredCurrency: Currency;
  tags: CustomerTag[];
  notes?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  // Computed from joined invoice data
  orderCount?: number;
  totalSpentUSD?: number;
  lastOrderDate?: string;
}
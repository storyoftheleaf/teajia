export type ProductType = 'Green' | 'Yellow' | 'White' | 'Oolong' | 'Red' | 'Dark' | 'Sheng' | 'Shou' | 'Herbal' | 'Matcha' | 'Flower' | 'Teaware' | 'Misc' | 'MISSING_TYPE';

export type Currency = 'USD' | 'NT' | 'Yuan' | 'IDR' | 'JPY' | 'MYR' | 'UNK';

export interface Product {
  id: string;
  type: ProductType;
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
  description: string;
  tastingNotes: string[];
  imageUrl: string;
  vendor?: string; 
  status: 'Active' | 'Archived' | 'Sold Out' | 'Draft';
  costCurrency: Currency;
  quantityPurchased: number; // The amount purchased corresponding to the costAmount
  shippingRatePerKg?: number; // Shipping cost per kg in source currency
  fixedRetailPriceUSD?: number | null; // Explicit override price
  isPersonal: boolean; // Personal collection flag
  canReorder: boolean; // Restockable flag
  isPublic: boolean; // Publicly visible flag
  isFeatured?: boolean; // Suggested/Featured flag
  lore?: string; // AI or handcrafted history/story
  isCustomWisdom?: boolean; // True if manually edited
  showWisdom?: boolean; // Toggle to display on public card
  processingNotes?: string; // e.g. "Heavy charcoal roast over pine wood."
  mood?: string; // e.g. "Grounding & Meditative"
  experience?: string; // e.g. "A deeply centering tea..."
  liquorColor?: string; // e.g. "Deep Amber"
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
export type CollectionCategory = 'tea-tables' | 'art' | 'antiques' | 'rare-tea';

export type ShippingType = 'international' | 'bali-only' | 'inquiry-only';

export type ShopView = 'landing' | 'collection' | 'practice';

export type ProductCategory = 'tea' | 'ware' | 'teaware' | 'incense' | 'accessories' | 'other';

export interface ShopProduct {
  id: string;
  name: string;
  category: ProductCategory | string;
  practice: boolean;
  collection: boolean;
  shipsInternational: boolean;
  shipsBali: boolean;
  inquiryOnly: boolean;
  price?: number;
  price_50g?: string;
  stock_g?: number;
  image: string;
  description: string;
  variant?: string;
  type?: string;
  origin?: string;
  tags: string[];
  shopCategory?: ProductCategory;
  story?: string;
  price_per_gram?: string;
  [key: string]: unknown;
}

export interface CollectionItem {
  id: string;
  category: CollectionCategory;
  name: string;
  subtitle: string;
  story: string;
  image: string;
  images?: string[];
  year?: string;
  origin?: string;
  dimensions?: string;
  materials?: string;
  artist?: string;
  price?: number;
  shippingType: ShippingType;
  tags: string[];
}

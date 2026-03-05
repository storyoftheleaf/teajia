export type CollectionCategory = 'tea-tables' | 'art' | 'antiques' | 'rare-tea';

export type ShippingType = 'international' | 'bali-only' | 'inquiry-only';

export type ShopView = 'landing' | 'collection' | 'practice';

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

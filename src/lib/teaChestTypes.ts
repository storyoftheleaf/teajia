// Stock spine step 4: one item in a user's personal cellar.
export interface CellarItem {
  id: string;
  name: string;
  type?: string | null;
  year?: number | null;
  origin?: string | null;
  notes?: string | null;
  grams: number;
  imageUrl?: string | null;
  placementStatus: 'private' | 'requested' | 'placed';
  placementAccountId?: string | null;
  linkedProductId?: string | null;
  label?: string | null;
  costAmount?: number | null;
  costCurrency?: string | null;
  shelfPublished: boolean;
  shelfNeedsReview?: boolean;
  shelfOffer?: (Omit<ShelfOfferInput, 'price_amount' | 'price_currency'> & {
    price_amount: number | null;
    price_currency: string | null;
  }) | null;
  /** Where the tea came from (Launch 1). NULL on older teas: never guessed. */
  source?: CellarSource | null;
  createdAt: string;
  updatedAt: string;
}

/** 'bought' and 'session' are set by the site; 'gift' and 'own' are chosen by hand. */
export type CellarSourceKind = 'bought' | 'gift' | 'session' | 'own';

export interface CellarSource {
  kind: CellarSourceKind;
  fromName?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  invoiceId?: string | null;
}

export interface CellarPlacementRequest extends CellarItem {
  ownerName?: string | null;
  ownerEmail?: string | null;
}

// Stock spine step 5: the seller's own shelf settings (grant state + identity).
export interface TeaChestAccount {
  id: string;
  slug: string;
  public_enabled: number;
  /** 1 once Teajia approved this person to sell; until then offers stay private. */
  seller_approved?: number;
}

export interface ShelfSettings {
  enabled: boolean;
  slug: string | null;
  title: string | null;
  whatsapp: string | null;
}

export interface ShelfOfferInput {
  name: string;
  grams: number;
  price_amount: number;
  price_currency: string;
  type?: string | null;
  year?: number | null;
  origin?: string | null;
}

// One item on a public shelf, public-safe fields only.
export interface PublicShelfItem {
  id: string;
  name: string;
  type: string | null;
  year: number | null;
  origin: string | null;
  grams: number;
  price_amount: number;
  price_currency: string;
  image_url: string | null;
}

export interface PublicShelf {
  slug: string;
  store_slug?: string;
  title: string | null;
  seller_name: string | null;
  whatsapp: string | null;
  contributor_slug?: string | null;
  items: PublicShelfItem[];
}

export type ProductType = 'Green' | 'Yellow' | 'White' | 'Oolong' | 'Red' | 'Dark' | 'Sheng' | 'Shou' | 'Herbal' | 'Teaware' | 'Misc' | 'MISSING_TYPE';

export type TeaForm = 'Loose' | 'Cake' | 'Tuo' | 'Brick' | 'Rolled' | 'Ball' | 'Powder' | 'Bag' | 'Other';

export type Currency = 'USD' | 'NT' | 'Yuan' | 'IDR' | 'JPY' | 'MYR' | 'HKD' | 'AUD' | 'UNK';

export type InventoryPurpose = 'working' | 'sample' | 'personal';
export type ReceiptAcquisitionKind = 'purchase' | 'free_sample' | 'gift' | 'transfer' | 'other';
export interface CurateReceiptProposal {
  id: string; account_id: string; compass_entry_id?: string | null; import_id?: string | null;
  import_item_id?: string | null; product_id?: string | null; batch_id?: string | null;
  product_name?: string | null; product_type?: string | null; purpose: InventoryPurpose;
  quantity: number; unit: 'g' | 'unit'; acquisition_kind: ReceiptAcquisitionKind;
  status: 'pending' | 'accepted' | 'rejected'; idempotency_key: string; ledger_id?: string | null;
  proposed_by_user_id: string; reviewed_by_user_id?: string | null; reviewed_at?: string | null;
  created_at: string; updated_at: string;
}
export type InventoryReceiptState = 'planned' | 'ordered' | 'in_transit' | 'partially_received' | 'received' | 'cancelled';
export interface InventoryReceiptLine { id: string; product_id: string; product_name: string; expected_quantity: number; received_quantity: number; cancelled_quantity: number; current_on_hand?: number; unit: 'g' | 'unit'; intended_purpose: InventoryPurpose; source_kind?: string; source_ref?: string | null; }
export interface InventoryReceipt { id: string; state: InventoryReceiptState; vendor_name?: string | null; source_kind: string; source_ref?: string | null; eta?: string | null; legacy?: boolean; lines: InventoryReceiptLine[]; }

import type { TastingData } from '../types';

export interface Product {
  id: string;
  type: ProductType;
  form?: TeaForm; // Physical form: Loose, Cake, Tuo, Brick, etc.
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
  isPublic: boolean; // Publicly visible flag (operator's "list this at all")
  shownInShop: boolean; // Stock spine step 2 — location owner's curation gate; storefront requires isPublic && shownInShop
  ownerUserId?: string | null; // Stock spine step 1 — whose stock this is; null = owned by the location
  isFeatured?: boolean; // Suggested/Featured flag
  isCurated?: boolean; // Curated selection flag
  isSample?: boolean; // Sample/trial tea not yet committed to inventory
  inventoryPurpose?: InventoryPurpose | null; // Canonical purpose; legacy flags remain during migration
  stockKnownAt?: string | null; // Set when the on-hand quantity is known, including a known zero
  inventoryLocation?: string | null; // Physical shelf/bin; blank holdings surface in Missing location
  inTransit?: boolean; // Stock ordered but not yet physically arrived
  inTransitGrams?: number; // Quantity currently in transit (grams)
  inTransitEta?: string; // Expected arrival date (ISO date string)
  lore?: string; // AI or handcrafted history/story
  isCustomWisdom?: boolean; // True if manually edited
  showWisdom?: boolean; // Toggle to display on public card
  processingNotes?: string; // e.g. "Heavy charcoal roast over pine wood."
  terroir?: string; // e.g. "High-altitude granite soils above 1200m, with dramatic day-night temperature swings."
  mood?: string; // e.g. "Grounding & Meditative"
  experience?: string; // e.g. "A deeply centering tea..."
  additionalImages?: string[]; // Extra photos (different angles, detail shots)
  bagPhotoUrl?: string; // Original bag shot from capture — kept apart from product imagery so it's never displaced; replaceable deliberately
  // Teaware-specific fields (null/undefined for tea)
  material?: string; // e.g. "Yixing clay", "porcelain", "silver"
  capacityMl?: number; // Vessel capacity in ml
  teawareCategory?: 'pot' | 'cup' | 'tray' | 'storage' | 'accessory' | 'decorative';
  quantityUnits?: number; // Unit count (used instead of stockGrams for teaware)
  moodTags?: string[];       // structured feeling/state term ids from taxonomy
  flavorTags?: string[];     // structured flavor term ids from taxonomy
  tasting?: TastingData;
  tastingSource?: 'common' | 'owner' | 'community';
  sourceCompassEntryId?: string; // Persistent link to the Tea Compass entry that sourced this product
  teaKey?: string; // Normalised tea identity key — shared across accounts for cross-store review aggregation
  wholesalePrice?: number;
  catalogVisible?: boolean;
  sessionReserveGrams?: number; // Stock below this threshold shows a soft low-availability warning on the public shop
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_whatsapp?: string;
  customer_id?: string;
  display_currency: string;
  shipping_cost_usd?: number;
  status: 'Draft' | 'Pending' | 'Filled' | 'Void';
  payment_status: 'unpaid' | 'partial' | 'paid';
  payment_date?: string;
  payment_method?: string;
  inventory_deducted: boolean;
  notes?: string;
  source_event_id?: string;
  source_event_title?: string;
  source_collection_id?: string | null;
  source_publication_id?: string | null;
  deleted_at?: string;
  created_at: string;
}

export interface InvoiceItem {
  productId?: string;
  customName?: string;
  quantity: number; // Grams or Units
  priceAtSale: number;
}

export interface InvoiceDisplayItem extends InvoiceItem {
  id?: string;
  unit?: 'g' | 'pcs';
  product?: Product;
}

export interface ExchangeRate {
  currency: Currency;
  rateToUSD: number; // 1 USD = X Currency
}

export interface CartItem extends InvoiceDisplayItem {
  product: Product;
}

export interface InvoiceWithItems extends Invoice {
  customer_phone?: string;
  items?: Array<{
    product_name?: string;
    quantity: number;
    product?: { givenName?: string; type?: string };
  }>;
}

export type CustomerTag = 'wholesale' | 'retail' | 'friend' | 'vendor' | 'vip' | 'inactive';
export type ContactType = 'customer' | 'supplier';
export type ContactRelationshipKind =
  | 'buyer'
  | 'vendor'
  | 'event_guest'
  | 'collection_recipient'
  | 'contributor'
  | 'personal_connection';

export type ContactChannel = 'phone' | 'email' | 'whatsapp' | 'wechat' | 'line' | 'instagram' | 'telegram' | 'signal' | 'other';

export interface ContactEntry {
  channel: ContactChannel;
  handle: string;
}

export interface Customer {
  id: string;
  type: ContactType;
  name: string;
  company?: string;
  contacts: ContactEntry[];
  // Legacy flat fields — kept for backwards compat, contacts is the source of truth
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  country?: string;
  preferredCurrency: Currency;
  tags: CustomerTag[];
  /** Freeform contact tags (admin-only, lowercase). Joined from customer_tags. */
  contact_tags?: string[];
  relationshipKinds?: ContactRelationshipKind[];
  notes?: string;
  source?: string;
  // Vendor storefront + location (added migration 097). Returned by the customer
  // list/get as snake_case; used for the Sources thumbnail and map link.
  business_card_photo?: string;
  storefront_photo?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  userLinkedAt?: string;
  // Computed from joined invoice data
  orderCount?: number;
  totalSpentUSD?: number;
  lastOrderDate?: string;
  // Computed from event_attendees join
  eventCount?: number;
}

export type {
  ParagraphVariant,
  ImageVariant,
  QuoteVariant,
  CoverVariant,
  ChapterVariant,
  PoemVariant,
  BackMatterVariant,
  ArticleBlock,
  DbArticle,
} from '../types';

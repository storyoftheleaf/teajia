import type { TastingData } from '../../types';
import type { Currency } from '../../admin/types';

export type TeaType = 'Green' | 'White' | 'Yellow' | 'Oolong' | 'Red' | 'Dark' | 'Sheng' | 'Shou' | 'Herbal' | 'Teaware';
export type TeaForm = 'Loose' | 'Cake' | 'Brick' | 'Tuo' | 'Ball' | 'Bag';
export type CompassStatus = 'noted' | 'want' | 'pass' | 'buying' | 'incoming' | 'in_stock' | 'depleted' | 'available_to_taste';
export type CompassCategory = 'tea' | 'teaware';
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export type Storage = 'Dry' | 'Wet/Traditional' | 'HK' | 'Malaysian' | 'Natural';
export type TeawareCategory = 'Pot' | 'Cup' | 'Gaiwan' | 'Fair Cup' | 'Tray' | 'Storage' | 'Tool' | 'Other';
// 'Zhuni' | 'Zisha' | 'Duanni' | 'Hongni' kept in the union for backward compatibility
// with entries created before Yixing-as-material refactor — picker no longer offers them
// as top-level materials; they're surfaced as clay subtypes under Yixing.
export type TeawareMaterial = 'Yixing' | 'Zhuni' | 'Zisha' | 'Duanni' | 'Hongni' | 'Porcelain' | 'Celadon' | 'Wood-fired' | 'Glass' | 'Clay' | 'Ceramic' | 'Wood' | 'Metal' | 'Stone' | 'Silver' | 'Other' | 'Unknown';
// Yixing clay subtypes — picked by colour and name inside the Material picker
export type YixingClayType = 'Zhuni' | 'Zisha' | 'Duanni' | 'Hongni' | 'Lvni' | 'Heini' | 'Unknown';
// Era is now a free-form string so user-added eras (e.g. "Song Dynasty") are first-class.
// Standard values are listed in TEAWARE_ERAS for the picker.
export type TeawareEra = string;

export type BrowseGrouping = 'date' | 'vendor';
export type BrowseFilter = 'all' | 'mine' | 'queue' | 'want' | 'pass';

export interface VendorDetails {
  businessCardUrl?: string;
  storefrontUrl?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  whatsapp?: string;
  wechat?: string;
  line?: string;
}

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
  priceAmount?: number;        // Cost price (what you paid)
  priceCurrency: Currency;
  pricePerUnitGrams?: number;
  sellPrice?: number;          // Retail sell price per gram (on tags + flows to inventory)

  // Category
  category: CompassCategory;

  // Teaware-specific
  teawareCategory?: TeawareCategory;
  material?: TeawareMaterial;
  /** When material is 'Yixing', the specific clay subtype */
  clayType?: YixingClayType;
  /** Optional free-form descriptor for the material (e.g. "Master Wang's blend") */
  materialNote?: string;
  capacityMl?: number;
  quantity: number;
  era?: TeawareEra;

  // Vendor
  vendorId?: string;
  vendorName?: string;
  vendorDetails?: VendorDetails;
  /** Customer record ID for the vendor — links compass entry to a customer profile */
  linkedCustomerId?: string;

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

  // Panel sharing — normalised identity key, shared across accounts so reviews pool
  teaKey?: string;

  // Sample flag — tea entries can be marked as samples (small tasting portions)
  isSample?: boolean;
  sampleSetId?: string;        // Groups samples from one session
  sampleGrams?: number;        // Amount in sample bag (5-15g)
  sampleVerdict?: 'love' | 'like' | 'neutral' | 'pass';
  sampleWouldBuy?: boolean;

  // Tasting queue — timestamp set when entry is explicitly prioritised; higher = sooner
  tasteOrder?: number;

  // Retaste timeline — each tasting session appended; current tasting is also in .tasting
  tastingHistory?: Array<{ data: TastingData; date: string; note?: string }>;

  // Pipeline — internal, set automatically when ledger purchase is confirmed
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

// Tea types array for the grid (tea only — Teaware is a separate tab now)
export const TEA_TYPES: TeaType[] = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal'];

// Form options
export const TEA_FORMS: TeaForm[] = ['Loose', 'Cake', 'Brick', 'Tuo', 'Ball', 'Bag'];

// Season options
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];

// Storage options
export const STORAGE_OPTIONS: Storage[] = ['Dry', 'Wet/Traditional', 'HK', 'Malaysian', 'Natural'];

// Teaware categories
export const TEAWARE_CATEGORIES: TeawareCategory[] = ['Pot', 'Cup', 'Gaiwan', 'Fair Cup', 'Tray', 'Storage', 'Tool', 'Other'];

// Teaware materials by category — Yixing rolls up the four classic clay subtypes
// (Zhuni / Zisha / Duanni / Hongni); a sub-picker on Yixing surfaces them.
export const TEAWARE_MATERIALS: Record<string, TeawareMaterial[]> = {
  Pot: ['Yixing', 'Porcelain', 'Silver', 'Glass', 'Other', 'Unknown'],
  Cup: ['Porcelain', 'Celadon', 'Wood-fired', 'Glass', 'Clay', 'Other', 'Unknown'],
  Gaiwan: ['Porcelain', 'Celadon', 'Glass', 'Clay', 'Other', 'Unknown'],
  default: ['Clay', 'Porcelain', 'Glass', 'Ceramic', 'Wood', 'Metal', 'Stone', 'Other', 'Unknown'],
};

// Yixing clay subtypes — picked by colour swatch + name. Hex colours are
// physical-material references, not theme tokens, so they live inline.
export interface YixingClayInfo {
  name: YixingClayType;
  /** Anglicised label shown beside the swatch */
  label: string;
  /** Approximate colour of the fired clay */
  swatch: string;
}
export const YIXING_CLAY_TYPES: YixingClayInfo[] = [
  { name: 'Zhuni',   label: 'Zhuni',   swatch: '#C84B3F' },
  { name: 'Hongni',  label: 'Hongni',  swatch: '#A35442' },
  { name: 'Zisha',   label: 'Zisha',   swatch: '#6B4F4A' },
  { name: 'Duanni',  label: 'Duanni',  swatch: '#C9A872' },
  { name: 'Lvni',    label: 'Lvni',    swatch: '#6F8261' },
  { name: 'Heini',   label: 'Heini',   swatch: '#2A2620' },
  { name: 'Unknown', label: 'Unknown', swatch: '#8a8275' },
];

// Teaware eras — standard list shown first in the picker; user-added eras
// (e.g. "Song Dynasty") are appended via the compass store's customEras.
export const TEAWARE_ERAS: TeawareEra[] = ['Modern', '90s', '80s', '70s', 'Pre-70s', 'Republic', 'Qing', 'Unknown'];

/** Origin auto-fill rules keyed by material — applied when the field is empty. */
export const MATERIAL_ORIGIN_DEFAULT: Partial<Record<TeawareMaterial, string>> = {
  Yixing: 'Yixing, China',
};

// Common regions
export const COMMON_REGIONS = [
  'Alishan', 'Yiwu', 'Wuyi', 'Lugu', 'Jingmai', 'Anxi',
  'Menghai', 'Lincang', 'Phoenix', 'Dong Ding', 'Nantou',
  'Darjeeling', 'Assam', 'Uji', 'Shizuoka',
];

/**
 * Derives a normalised tea_key from identity fields.
 * Both accounts capturing the same tea should produce the same key if they use consistent naming.
 * e.g. "Silver Needle", "White", 2024, "Fuding" → "silver-needle-white-2024-fuding"
 */
export function generateTeaKey(entry: Pick<TeaCompassEntry, 'name' | 'type' | 'year' | 'originRegion'>): string {
  return [entry.name, entry.type, entry.year, entry.originRegion]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Returns the public-safe metadata to include in a compass share.
 * Strips vendor costs, private notes, and buying details.
 */
export function compassShareMetadata(entry: TeaCompassEntry): Record<string, unknown> {
  return {
    name: entry.name,
    chineseName: entry.chineseName,
    type: entry.type,
    form: entry.form,
    year: entry.year,
    season: entry.season,
    originRegion: entry.originRegion,
    category: entry.category,
    teaKey: entry.teaKey,
    photo: entry.photos?.[0] || null,
    teawareCategory: entry.teawareCategory,
    material: entry.material,
    capacityMl: entry.capacityMl,
  };
}

/**
 * Maps a Tea Compass entry to a product draft payload matching the API's expected format.
 * INTERNAL — called only by LedgerView.handleConfirm when a purchase is confirmed.
 * Do not call from UI components directly.
 */
export function compassEntryToProductDraft(entry: TeaCompassEntry): Record<string, any> {
  const captureDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build description: notes + field notes attribution
  const descParts: string[] = [];
  if (entry.notes?.trim()) descParts.push(entry.notes.trim());
  descParts.push(`---\nField notes from Tea Compass capture on ${captureDate}`);
  const description = descParts.join('\n\n');

  // Determine stock: grams for tea, units for teaware
  let stockGrams = 0;
  let quantityPurchased = 0;
  if (entry.category === 'teaware') {
    quantityPurchased = entry.buyQuantityUnits ?? entry.quantity ?? 1;
    stockGrams = 0;
  } else if (['Cake', 'Brick', 'Tuo'].includes(entry.form || '')) {
    quantityPurchased = entry.buyQuantityUnits ?? 1;
    stockGrams = entry.buyQuantityGrams ?? 0;
  } else {
    stockGrams = entry.buyQuantityGrams ?? 0;
    quantityPurchased = 0;
  }

  // Build tasting data if present
  const tastingData = entry.tasting
    ? Object.fromEntries(Object.entries(entry.tasting).filter(([, v]) => v && (Array.isArray(v) ? v.length > 0 : true)))
    : undefined;

  return {
    type: entry.category === 'teaware' ? 'Teaware' : (entry.type || 'Misc'),
    form: entry.form || null,
    given_name: entry.name || '',
    chinese_name: entry.chineseName || '',
    product_name: entry.name || '',
    year: entry.year || null,
    origin_country: '',
    origin_region: entry.originRegion || '',
    stock_grams: stockGrams,
    quantity_purchased: quantityPurchased,
    cost_amount: entry.buyTotal ?? entry.priceAmount ?? 0,
    cost_currency: entry.priceCurrency || 'NT',
    vendor: entry.vendorName || '',
    status: 'Draft',
    is_public: false,
    is_personal: false,
    can_reorder: true,
    description,
    tasting_notes: entry.tasting?.flavor || [],
    tasting: tastingData && Object.keys(tastingData).length > 0 ? tastingData : undefined,
    image_url: entry.photos?.[0] || null,
    mood: '',
    experience: '',
    lore: '',
    processing_notes: '',
    terroir: '',
    // Persistent cross-link back to this compass entry
    source_compass_entry_id: entry.id,
    tea_key: entry.teaKey || null,
    // Teaware-specific
    ...(entry.category === 'teaware' ? {
      teaware_category: entry.teawareCategory || null,
      material: entry.material || null,
      capacity_ml: entry.capacityMl || null,
    } : {}),
  };
}

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
    status: 'noted',
    createdAt: now,
    updatedAt: now,
    synced: false,
  };
}

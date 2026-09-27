import type { TastingData } from '../../types';
import type { Currency } from '../../admin/types';
import {
  TEA_TYPES as WISDOM_TEA_TYPES,
  TEA_FORMS as WISDOM_TEA_FORMS,
  SEASONS as WISDOM_SEASONS,
  STORAGE_STYLES as WISDOM_STORAGE_STYLES,
  REGION_NAMES,
} from '../../wisdom';

export type TeaType = 'Green' | 'White' | 'Yellow' | 'Oolong' | 'Red' | 'Dark' | 'Sheng' | 'Shou' | 'Herbal' | 'Teaware';
export type { TeaForm } from '../../wisdom';
import type { TeaForm } from '../../wisdom';
export type CompassStatus = 'noted' | 'want' | 'pass' | 'buying' | 'incoming' | 'in_stock' | 'depleted' | 'available_to_taste';
export type CompassCategory = 'tea' | 'teaware';
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export type Storage = 'Dry' | 'Wet/Traditional' | 'HK' | 'Malaysian' | 'Natural';
export type TeawareCategory = 'Pot' | 'Cup' | 'Gaiwan' | 'Fair Cup' | 'Tray' | 'Storage' | 'Tool' | 'Other';
// 'Zhuni' | 'Zisha' | 'Duanni' | 'Hongni' kept in the union for backward compatibility
// with entries created before Yixing-as-material refactor, picker no longer offers them
// as top-level materials; they're surfaced as clay subtypes under Yixing.
export type TeawareMaterial = 'Yixing' | 'Zhuni' | 'Zisha' | 'Duanni' | 'Hongni' | 'Porcelain' | 'Celadon' | 'Wood-fired' | 'Glass' | 'Clay' | 'Ceramic' | 'Wood' | 'Metal' | 'Stone' | 'Silver' | 'Other' | 'Unknown';
// Yixing clay subtypes, picked by colour and name inside the Material picker
export type YixingClayType = 'Zhuni' | 'Zisha' | 'Duanni' | 'Hongni' | 'Lvni' | 'Heini' | 'Unknown';
// Era is now a free-form string so user-added eras (e.g. "Song Dynasty") are first-class.
// Standard values are listed in TEAWARE_ERAS for the picker.
export type TeawareEra = string;

export type BrowseGrouping = 'date' | 'vendor';
export type BrowseFilter = 'all' | 'to_taste' | 'selected';
export type BrowseSort = 'recent' | 'score' | 'price' | 'name';
// Library layout, list rows, or a grid of the capture photos (bag shots)
export type BrowseLayout = 'list' | 'photos';
// Post-tasting verdict, the single organizing signal used by the triage
// review. Generalizes the sample-only sampleVerdict (kept as a read fallback).
export type CompassVerdict = 'love' | 'like' | 'neutral' | 'pass';
export type CompassDecision = 'considering' | 'selected' | 'passed_on';
export type CompassSampleState = 'requested' | 'received' | 'tasted';

export interface LibraryFilters {
  decision?: CompassDecision | 'none';
  verdict?: CompassVerdict;
  possession?: 'none' | 'sample' | 'working' | 'personal';
  journey?: string;
  vendor?: string;
  place?: string;
  date?: 'today' | '7_days' | '30_days' | 'this_year';
  category?: CompassCategory;
  type?: string;
  origin?: string;
  year?: string;
  price?: 'known' | 'missing';
  sampleState?: 'requested' | 'received' | 'tasted';
  photos?: 'with' | 'without';
  missing?: 'name' | 'price' | 'type' | 'origin' | 'notes';
}

export interface CurateJourney {
  id: string;
  account_id: string;
  name: string;
  season?: string | null;
  year?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  notes?: string | null;
}

export interface CurateVisit {
  id: string;
  account_id: string;
  journey_id?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  place?: string | null;
  visited_at?: string | null;
  notes?: string | null;
}

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

  /** Client-only record of fields explicitly entered or confirmed by the operator. */
  touchedFields?: string[];
  /** Client-only scope for resumable, uncommitted capture drafts. */
  draftAccountId?: string;

  // Identity
  name: string;
  chineseName?: string;
  type?: TeaType;
  form?: TeaForm;
  year?: number;
  season?: Season;
  storage?: Storage;
  originRegion?: string;
  /** Filled from `originRegion` via the wisdom base's `countryForRegion` when
   *  blank; never overwrites a value already present. */
  originCountry?: string;

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
  /** Customer record ID for the vendor, links compass entry to a customer profile */
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

  // Panel sharing, normalised identity key, shared across accounts so reviews pool
  teaKey?: string;
  // Shared/incoming entries point back to the source compass card.
  sourceEntryId?: string;

  // Post-tasting verdict, first-class organizing signal (synced, migration 082).
  // Drives the triage review and the "Loved" lens. Reads fall back to
  // sampleVerdict for legacy sample entries that predate this field.
  verdict?: CompassVerdict;
  // Deliberate sourcing choice. Independent from tasting verdict, stock status,
  // and storefront publication; never inferred from those fields.
  decision?: CompassDecision | null;
  // Capture session, entries created in one capture run share this id, so a
  // batch review can group "the teas I just tasted". Column reserved by 071.
  sessionId?: string;
  /** Optional sourcing context; independent from the six-hour capture session. */
  journeyId?: string | null;
  visitId?: string | null;

  // Sample flag, tea entries can be marked as samples (small tasting portions)
  isSample?: boolean;
  /** Explicit sample lifecycle. Never inferred from logistics or tasting data. */
  sampleState?: CompassSampleState | null;
  sampleSetId?: string;        // Groups samples from one session
  sampleGrams?: number;        // Amount in sample bag (5-15g)
  sampleVerdict?: 'love' | 'like' | 'neutral' | 'pass';
  sampleWouldBuy?: boolean;

  // Tasting queue, timestamp set when entry is explicitly prioritised; higher = sooner
  tasteOrder?: number;

  // Retaste timeline, each tasting session appended; current tasting is also in .tasting
  tastingHistory?: Array<{ data: TastingData; date: string; note?: string }>;

  // Pipeline, internal, set automatically when ledger purchase is confirmed
  draftProductId?: string;

  // Meta
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

/** Durable sample identity. `isSample` is read only as a legacy fallback for
 * rows created before sample_state existed. */
export function entryIsSample(entry: Pick<TeaCompassEntry, 'sampleState' | 'isSample'>): boolean {
  return entry.sampleState != null || entry.isSample === true;
}

// Gram presets by form
export const GRAM_PRESETS: Record<TeaForm, number[]> = {
  Loose: [50, 75, 100, 150, 300, 600],
  Rolled: [50, 75, 100, 150, 300, 600],
  Cake: [100, 200, 357, 400],
  Brick: [250, 500, 1000],
  Tuo: [100, 250, 500],
  Ball: [50, 100, 250],
  Bag: [50, 100, 150, 300],
};

// Default gram for each form
export const DEFAULT_GRAMS: Record<TeaForm, number> = {
  Loose: 100,
  Rolled: 100,
  Cake: 357,
  Brick: 250,
  Tuo: 100,
  Ball: 100,
  Bag: 100,
};

// Tea vocabulary, read from the shared wisdom base (src/wisdom) rather than
// declared here, so this file and every other surface agree on what a value
// means. Re-exported under these names so the many existing consumers of
// this module keep working. See docs/TEA_WISDOM_BASE.md.
export const TEA_TYPES: TeaType[] = [...WISDOM_TEA_TYPES];

export const TEA_FORMS: TeaForm[] = [...WISDOM_TEA_FORMS];

export const SEASONS: Season[] = [...WISDOM_SEASONS];

export const STORAGE_OPTIONS: Storage[] = [...WISDOM_STORAGE_STYLES];

// Teaware categories
export const TEAWARE_CATEGORIES: TeawareCategory[] = ['Pot', 'Cup', 'Gaiwan', 'Fair Cup', 'Tray', 'Storage', 'Tool', 'Other'];

// Teaware materials by category: Yixing rolls up the four classic clay subtypes
// (Zhuni / Zisha / Duanni / Hongni); a sub-picker on Yixing surfaces them.
export const TEAWARE_MATERIALS: Record<string, TeawareMaterial[]> = {
  Pot: ['Yixing', 'Porcelain', 'Silver', 'Glass', 'Other', 'Unknown'],
  Cup: ['Porcelain', 'Celadon', 'Wood-fired', 'Glass', 'Clay', 'Other', 'Unknown'],
  Gaiwan: ['Porcelain', 'Celadon', 'Glass', 'Clay', 'Other', 'Unknown'],
  default: ['Clay', 'Porcelain', 'Glass', 'Ceramic', 'Wood', 'Metal', 'Stone', 'Other', 'Unknown'],
};

// Yixing clay subtypes, picked by colour swatch + name. Hex colours are
// physical-material references, not theme tokens, so they live inline.
// `imageUrl` is optional, when set, the full-screen clay picker shows a
// photographic swatch instead of the flat colour disk.
export interface YixingClayInfo {
  name: YixingClayType;
  /** Anglicised label shown beside the swatch */
  label: string;
  /** Approximate colour of the fired clay */
  swatch: string;
  /** One-line description shown in the full-screen picker */
  hint?: string;
  /** Optional photographic swatch URL, replaces the flat colour disk */
  imageUrl?: string;
}
export const YIXING_CLAY_TYPES: YixingClayInfo[] = [
  { name: 'Zhuni',   label: 'Zhuni',   swatch: '#C84B3F', hint: 'Bright vermillion · iron-rich, dense' },
  { name: 'Hongni',  label: 'Hongni',  swatch: '#A35442', hint: 'Red iron clay · workhorse Yixing' },
  { name: 'Zisha',   label: 'Zisha',   swatch: '#6B4F4A', hint: 'Purple sand · the classic' },
  { name: 'Duanni',  label: 'Duanni',  swatch: '#C9A872', hint: 'Yellow-brown · sandy texture' },
  { name: 'Lvni',    label: 'Lvni',    swatch: '#6F8261', hint: 'Olive green · rare' },
  { name: 'Heini',   label: 'Heini',   swatch: '#2A2620', hint: 'Deep black · earthy minerals' },
  { name: 'Unknown', label: 'Unknown', swatch: '#8a8275', hint: 'Not sure yet' },
];

// Teaware eras, standard list shown first in the picker; user-added eras
// (e.g. "Song Dynasty") are appended via the compass store's customEras.
export const TEAWARE_ERAS: TeawareEra[] = ['Modern', '90s', '80s', '70s', 'Pre-70s', 'Republic', 'Qing', 'Unknown'];

/** Origin auto-fill rules keyed by material, applied when the field is empty. */
export const MATERIAL_ORIGIN_DEFAULT: Partial<Record<TeawareMaterial, string>> = {
  Yixing: 'Yixing, China',
};

// Growing regions, read from the wisdom base's 167 known places rather than
// a short local list, kept under this name for existing consumers.
export const COMMON_REGIONS: string[] = REGION_NAMES;

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
 * INTERNAL, called only by LedgerView.handleConfirm when a purchase is confirmed.
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
  descParts.push(`---\nField notes from Curate capture on ${captureDate}`);
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
    origin_country: entry.originCountry || '',
    origin_region: entry.originRegion || '',
    stock_grams: stockGrams,
    quantity_purchased: quantityPurchased,
    /* `?? 0` said an entry with no price recorded was a tea that cost nothing,
       and the server then had a well formed zero to agree with. Null instead,
       which the server refuses by name, so the operator records the price and
       promotes again. The worker's own promotion door was given exactly this
       rule; this is the client half of it.

       The CURRENCY is carried as it stands, deliberately and without a
       fallback. It is not a guess this function is making: it is a picker,
       `PricingRow`'s currency select, sitting immediately left of the price
       input on the capture card, so an operator typing a price sees the unit
       they are typing it in. That is where the decision is made and where it
       can be changed. An entry old enough to carry no currency at all sends
       nothing here, and the server refuses that too, by name. What must never
       happen is this function supplying one, because a currency chosen down
       here is chosen where nobody can see it. */
    cost_amount: entry.buyTotal ?? entry.priceAmount ?? null,
    /* The currency carries the same rule: an untouched default must never
       become content. `createEmptyEntry` (and `startNewCapture`, which seeds
       from `lastCurrency`) stamp every new entry with a currency nobody has
       chosen yet, so the stored value alone cannot tell a choice from a
       default, and `touchedFields` is this codebase's existing answer to
       exactly that question (see `entryHasDeliberateInput`). Sending it
       unconditionally marked an inherited default as `cost_currency_source:
       'stated'` on the server, which excluded the row from
       `list_unstated_costs` for good. A legacy entry with no touch metadata
       at all falls back to trusting its stored value, the same fallback
       `entryHasDeliberateInput` uses, so old fragments are not silently
       stripped of a currency they always carried. */
    cost_currency: entry.touchedFields === undefined || entry.touchedFields.includes('priceCurrency')
      ? entry.priceCurrency
      : undefined,
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

/** True when an entry carries any real tasting data (not just empty arrays). */
export function entryHasTasting(entry: Pick<TeaCompassEntry, 'tasting'>): boolean {
  return !!(entry.tasting && Object.values(entry.tasting).some((v) => Array.isArray(v) ? v.length > 0 : v != null));
}

/** Normalize nullable database rows and older local drafts before render. */
export function normalizeCompassEntry(entry: TeaCompassEntry): TeaCompassEntry {
  return {
    ...entry,
    name: entry.name || '',
    notes: entry.notes || '',
    photos: Array.isArray(entry.photos) ? entry.photos : [],
    audioClips: Array.isArray(entry.audioClips) ? entry.audioClips : [],
  };
}

/**
 * The effective verdict for an entry. Prefers the first-class `verdict`,
 * falls back to legacy `sampleVerdict`, and finally infers from the 1–10
 * quality score so older tastings still sort into love/like/neutral/pass.
 */
export function resolveVerdict(entry: Pick<TeaCompassEntry, 'verdict' | 'sampleVerdict' | 'tasting'>): CompassVerdict | null {
  if (entry.verdict) return entry.verdict;
  if (entry.sampleVerdict) return entry.sampleVerdict;
  const q = entry.tasting?.quality ?? entry.tasting?.rating;
  if (q == null) return null;
  return q >= 8 ? 'love' : q >= 6 ? 'like' : q >= 4 ? 'neutral' : 'pass';
}

/** An entry is "tasted but not yet sorted", the triage review's working set. */
export function isUntriaged(entry: Pick<TeaCompassEntry, 'verdict' | 'sampleVerdict' | 'tasting' | 'status'>): boolean {
  return entryHasTasting(entry) && !entry.verdict && !entry.sampleVerdict && entry.status !== 'pass';
}

/** Display title for an entry anywhere a name is expected. Nameless entries
 *  (photo + vendor captures) read as "Vendor · Jun 12" instead of a blank or
 *  generic "Untitled", matching the auto-name they get when promoted. */
export function entryDisplayTitle(entry: Pick<TeaCompassEntry, 'name' | 'vendorName' | 'createdAt'>): string {
  if ((entry.name || '').trim()) return entry.name;
  const date = new Date(entry.createdAt);
  const dateLabel = isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return [entry.vendorName, dateLabel].filter(Boolean).join(' · ') || 'Untitled';
}

export function createEmptyEntry(category: CompassCategory = 'tea', defaults?: { vendorName?: string; vendorId?: string; priceCurrency?: Currency }): TeaCompassEntry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    touchedFields: [],
    name: '',
    category,
    // Adrian's 2026-09-07 rule: everything is bought and air-freighted from
    // China, so Yuan is the shelf default. This is still an inherited
    // default the operator has not chosen, so `touchedFields` starting
    // empty is what keeps `compassEntryToProductDraft` from sending it as a
    // stated currency until the picker is actually touched.
    priceCurrency: defaults?.priceCurrency || 'Yuan',
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

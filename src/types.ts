
// Tea type vocabulary lives in the shared wisdom base (src/wisdom) — re-exported
// here so existing consumers (e.g. admin-panel/InventoryEditor.tsx) keep working
// without importing from ../wisdom directly. Do not redeclare this list.
import { NON_TEA_TYPES, type TeaType } from './wisdom';
export { TEA_TYPES, type TeaType, NON_TEA_TYPES } from './wisdom';

/**
 * A single captured note within a tasting session. May originate from a voice
 * transcription, typed entry, or promoted community entry. Starred notes are
 * the admin's published voice on the product's tasting profile.
 */
export interface NoteEntry {
  id: string;
  text: string;
  /** If true, the note has been curated and should render publicly. */
  starred?: boolean;
  /** Which section of the session the note was captured in. */
  section?: 'flavor' | 'feeling' | 'body' | 'finish' | 'general';
  /** ISO timestamp of when the note was first captured. */
  capturedAt?: string;
  /** When the note was promoted from a community source, its attribution. */
  sourceAuthor?: { initial?: string; accountName?: string };
  sourceJournalEntryId?: string;
}

export interface TastingData {
  // Section 1: Sensation (temperature, weight, texture)
  body?: string[];              // temperature + weight + texture terms

  // Section 2: Movement (throat, duration, finish character)
  finish?: string[];            // throat sensations + finish character/duration terms
  cleanliness?: string;         // 'clean' | 'some-edge' | 'rough'
  huiGan?: boolean;             // 回甘 — Returning sweetness
  yun?: boolean;                // 韵 — Resonance / lingering character
  qi?: boolean;                 // 气 — Vitality / body energy
  tangGan?: boolean;            // 汤感 — Soup feel / liquor presence

  // Section 3: Feeling (settling, lifting, body, mind)
  feeling?: string[];           // qi / mood / effect terms
  clarity?: 'clear' | 'hazy' | 'cloudy';
  quality?: number;             // 1-10 overall verdict

  // Section 4: Flavor (families + specific terms)
  flavor?: string[];            // family-level or specific sub-terms

  // Section 5: Appearance (color + clarity)
  'liquor-color'?: string[];    // color swatch

  // Notes — accepts legacy plain strings or structured entries so admin
  // can star/edit/curate specific notes for public display.
  notes?: (string | NoteEntry)[];
  voiceNote?: string;           // legacy single concatenated note
  /** One-line editorial teaser for the product page. Shown at the top of
   *  About this tea, only when present. Entered from the tasting section. */
  teaser?: string;

  // Brewing context (session conditions)
  brewingTemp?: number;      // Celsius
  brewingTime?: string;      // e.g. "30s", "1m"
  brewingVessel?: string;    // e.g. "Gaiwan", "Yixing", "Glass"

  // Admin only
  brewing?: string[];

  // Legacy (kept for backward compatibility, not written by new flow)
  rating?: number;
  overallImpression?: string;
  primaryNotes?: string[];
  patience?: number;
  mood?: string;
}

/**
 * One recorded tasting sitting. Holds the raw TastingData captured that day.
 * Sessions beyond the first carry a `reason` explaining why a fresh tasting was
 * warranted instead of editing the entry's note in place.
 */
export interface TastingRecord {
  id: string;
  createdAt: string;
  tasting: TastingData;
  /**
   * Required for tastings 2..N. Why a fresh tasting was needed (different brew,
   * aged tea, new vessel, etc.). The first record on an entry leaves this empty.
   */
  reason?: string;
  /** Per-tasting provenance. Source context lives here, not at entry level. */
  sourceType?: 'product' | 'compass' | 'event' | 'sample' | 'session';
  eventId?: string;
  eventSlug?: string;
  eventTitle?: string;
  tasterName?: string;
}

/**
 * Canonical tasting entry. One row per (userId, productId).
 *
 * The `note` layer is the user's current view of this tea: the paragraph that
 * surfaces in the journal card and the latest tasting profile. Edited in place
 * over time. The `tastings[]` array holds every recorded sitting, oldest first.
 */
export interface CustomerTasting {
  id: string;
  /** Canonical key. Renamed from teaId. Never 'quick-note' (that sentinel is gone). */
  productId: string;
  productName: string;
  productType: string;
  productImage?: string;

  /**
   * The current view of this tea for this user. Surfaces in the journal card
   * and the entry detail. Mutated in place by edits and (with confirmation)
   * when a new tasting is added.
   */
  note: {
    tasting: TastingData;
    personalNote?: string;
    rating?: number;
    verdict?: 'love' | 'like' | 'neutral' | 'pass';
    wouldBuy?: boolean;
    updatedAt: string;
  };

  /** Every recorded tasting, oldest first. Length >= 1. */
  tastings: TastingRecord[];

  /** Cross-links and origin context that belong to the entry as a whole. */
  compassEntryId?: string;

  createdAt: string;
  accountId?: string;
  archived?: boolean;
  synced?: boolean;
}

export enum ContentType {
  Reel = 'Reel',
  Film = 'Film',
  Article = 'Article',
  Audio = 'Audio',
  PhotoEssay = 'PhotoEssay',
}

export enum LayoutVariant {
  // Covers & Front Matter
  COVER_MAIN = 'COVER_MAIN',
  COVER_MINIMAL = 'COVER_MINIMAL',
  COVER_TYPOGRAPHIC = 'COVER_TYPOGRAPHIC',
  COVER_PHOTO_INSET = 'COVER_PHOTO_INSET',
  COVER_SPLIT = 'COVER_SPLIT',
  COVER_MASTHEAD = 'COVER_MASTHEAD',
  COVER_ABSTRACT = 'COVER_ABSTRACT',
  COPYRIGHT_PAGE = 'COPYRIGHT_PAGE',
  DEDICATION_SIMPLE = 'DEDICATION_SIMPLE',
  TOC_MINIMAL = 'TOC_MINIMAL',
  TOC_IMAGE = 'TOC_IMAGE',
  
  // Chapter Markers
  CHAPTER_MARKER = 'CHAPTER_MARKER', // New: For TOC navigation only, not rendered
  CHAPTER_BOLD = 'CHAPTER_BOLD',
  CHAPTER_MINIMAL = 'CHAPTER_MINIMAL',
  CHAPTER_CENTERED_SMALL = 'CHAPTER_CENTERED_SMALL',
  CHAPTER_SPLIT = 'CHAPTER_SPLIT',
  CHAPTER_IMAGE_BG = 'CHAPTER_IMAGE_BG',
  CHAPTER_LARGE_NUMBER = 'CHAPTER_LARGE_NUMBER',
  
  // Standard Text
  TEXT_SINGLE_COL = 'TEXT_SINGLE_COL',
  TEXT_DOUBLE_COL = 'TEXT_DOUBLE_COL',
  TEXT_TRIPLE_COL = 'TEXT_TRIPLE_COL',
  TEXT_DROP_CAP = 'TEXT_DROP_CAP',
  TEXT_JUSTIFIED_NARROW = 'TEXT_JUSTIFIED_NARROW',
  TEXT_VERTICAL_CJK = 'TEXT_VERTICAL_CJK',
  TEXT_BLOCKQUOTE_CENTER = 'TEXT_BLOCKQUOTE_CENTER',
  TEXT_BLOCKQUOTE_LEFT = 'TEXT_BLOCKQUOTE_LEFT',
  TEXT_SIDEBAR_RIGHT = 'TEXT_SIDEBAR_RIGHT',
  TEXT_SIDEBAR_LEFT = 'TEXT_SIDEBAR_LEFT',
  TEXT_ASYMMETRIC_LEFT = 'TEXT_ASYMMETRIC_LEFT',
  TEXT_ASYMMETRIC_RIGHT = 'TEXT_ASYMMETRIC_RIGHT',
  TEXT_INVERTED = 'TEXT_INVERTED',
  TEXT_TYPEWRITER = 'TEXT_TYPEWRITER',
  TEXT_HIGHLIGHTED = 'TEXT_HIGHLIGHTED',
  TEXT_CENTER_NARROW = 'TEXT_CENTER_NARROW',
  MAGAZINE_INTERVIEW_Q_A = 'MAGAZINE_INTERVIEW_Q_A',

  // Image Focus
  IMG_FULL_BLEED = 'IMG_FULL_BLEED',
  IMG_FULL_BLEED_TITLE = 'IMG_FULL_BLEED_TITLE',
  IMG_SPLIT_HORIZONTAL = 'IMG_SPLIT_HORIZONTAL',
  IMG_SPLIT_VERTICAL = 'IMG_SPLIT_VERTICAL',
  IMG_DIAGONAL_SPLIT = 'IMG_DIAGONAL_SPLIT',
  IMG_GRID_2x2 = 'IMG_GRID_2x2',
  IMG_GRID_3x3 = 'IMG_GRID_3x3',
  IMG_GRID_MONDRIAN = 'IMG_GRID_MONDRIAN',
  IMG_QUAD_GRID = 'IMG_QUAD_GRID',
  IMG_CIRCLE_MASK = 'IMG_CIRCLE_MASK',
  IMG_ARCH_MASK = 'IMG_ARCH_MASK',
  IMG_OVAL_VIGNETTE = 'IMG_OVAL_VIGNETTE',
  IMG_POLAROID_SCATTER = 'IMG_POLAROID_SCATTER',
  IMG_FILM_STRIP_VERTICAL = 'IMG_FILM_STRIP_VERTICAL',
  IMG_WITH_CAPTION_BOTTOM = 'IMG_WITH_CAPTION_BOTTOM',
  IMG_OVERLAY_TEXT = 'IMG_OVERLAY_TEXT',
  IMG_GALLERY_MOSAIC = 'IMG_GALLERY_MOSAIC',
  IMG_DUOTONE = 'IMG_DUOTONE',
  IMG_VIGNETTE_SOFT = 'IMG_VIGNETTE_SOFT',
  IMG_PANORAMIC = 'IMG_PANORAMIC',
  TEXT_SIDEBAR_IMAGE = 'TEXT_SIDEBAR_IMAGE',
  TEXT_OVERLAPPING_IMAGES = 'TEXT_OVERLAPPING_IMAGES',

  // Video Integration
  TEXT_WITH_VIDEO = 'TEXT_WITH_VIDEO',           // Horizontal 16:9 video with text
  TEXT_WITH_VIDEO_VERTICAL = 'TEXT_WITH_VIDEO_VERTICAL',  // Vertical 9:16 video with text

  // Poetic & Artsy
  POEM_CENTERED = 'POEM_CENTERED',
  POEM_LEFT_ALIGN = 'POEM_LEFT_ALIGN',
  POEM_SCATTERED = 'POEM_SCATTERED',
  POEM_VISUAL = 'POEM_VISUAL',
  POEM_HAIKU_MINIMAL = 'POEM_HAIKU_MINIMAL',
  QUOTE_BIG = 'QUOTE_BIG',
  QUOTE_MINIMAL = 'QUOTE_MINIMAL',
  QUOTE_IMAGE_BG = 'QUOTE_IMAGE_BG',
  
  // Editorial / Data
  INTERVIEW_STANDARD = 'INTERVIEW_STANDARD',
  DEFINITION_LARGE = 'DEFINITION_LARGE',
  STAT_BIG_NUMBER = 'STAT_BIG_NUMBER',
  STAT_CHART_MINIMAL = 'STAT_CHART_MINIMAL',
  DATA_BAR_CHART = 'DATA_BAR_CHART',
  LIST_CHECKLIST = 'LIST_CHECKLIST',
  LIST_TIMELINE = 'LIST_TIMELINE',
  RECIPE_CARD = 'RECIPE_CARD',
  INDEX_GRID = 'INDEX_GRID',
  
  // Tea Specific / Special
  TASTING_NOTES_GRID = 'TASTING_NOTES_GRID',
  MAP_CARTOGRAPHY = 'MAP_CARTOGRAPHY',
  NOTE_PAPER = 'NOTE_PAPER',
  POSTCARD_STYLE = 'POSTCARD_STYLE',
  BOTANICAL_SKETCH = 'BOTANICAL_SKETCH',
  
  // Closing
  EPILOGUE_CENTERED = 'EPILOGUE_CENTERED',
  CREDITS_PAGE = 'CREDITS_PAGE',
  BACK_COVER = 'BACK_COVER',
  NEXT_READS = 'NEXT_READS',

  // Curated Content
  CURATED_LINKS = 'CURATED_LINKS', // External link cards with curator notes

  // New Layout Variants
  SPREAD_PANORAMIC = 'SPREAD_PANORAMIC',
  PULL_QUOTE_MARGINAL = 'PULL_QUOTE_MARGINAL',
  LETTERPRESS_DEBOSS = 'LETTERPRESS_DEBOSS',
  ANNOTATED_IMAGE = 'ANNOTATED_IMAGE',
  CONVERSATION_BUBBLE = 'CONVERSATION_BUBBLE',
  TIMELINE_VISUAL = 'TIMELINE_VISUAL',
  COMPARISON_SPLIT = 'COMPARISON_SPLIT',
  STACKED_CARDS = 'STACKED_CARDS',
  FULL_BLEED_TEXT = 'FULL_BLEED_TEXT',
  INFOGRAPHIC_CIRCLE = 'INFOGRAPHIC_CIRCLE',
}

export interface Person {
  id: string;
  name: string;
  role: string;
  bio: string;
  avatarUrl?: string;
}

// Contributor - the canonical editorial identity that backs /people/:slug.
// See docs/ARCHITECTURE.md.
export interface ContributorLink {
  label: string;
  url: string;
}

export interface ContributorListItem {
  id: string;
  display_name: string;
  chinese_name?: string | null;
  role?: string | null;
  location_line?: string | null;
  avatar_url?: string | null;
}

export interface ContributorPullQuote {
  pull_quote: string;
  author_id: string;
  published_at: string;
  article_slug: string;
  article_title: string;
}

export interface ContributorArticleRef {
  slug: string;
  title: string;
  subtitle?: string | null;
  published_at: string;
  cover_image_url?: string | null;
}

export interface ContributorFeaturedRef {
  slug: string;
  title: string;
  subtitle?: string | null;
  author_id: string;
  published_at: string;
}

export interface ContributorProductRef {
  id: string;
  product_name: string;
  given_name?: string | null;
  chinese_name?: string | null;
  image_url?: string | null;
  sourced_by?: string | null;
  roasted_by?: string | null;
  vouched_by?: string | null;
}

export interface ContributorHostAccount {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  public_shop_path?: string | null;
  location_city?: string | null;
  location_country?: string | null;
}

export interface ContributorAccountRef extends Omit<ContributorHostAccount, 'id'> {
  account_id?: string;
  account_slug?: string;
  account_name?: string;
  account_kind?: AccountKind;
  public_role?: string | null;
  is_host: 0 | 1;
  display_order: number;
}

export interface ContributorProfile {
  id: string;

  display_name: string;
  chinese_name?: string | null;
  role?: string | null;
  pronouns?: string | null;
  location_line?: string | null;
  active_since?: string | null;

  beginnings?: string | null;
  now_text?: string | null;
  now_stamp?: string | null;
  now_updated_at?: string | null;
  inspirations?: string | null;
  closing?: string | null;

  avatar_url?: string | null;
  portrait_url?: string | null;
  portrait_caption?: string | null;
  voice_clip_url?: string | null;
  voice_clip_caption?: string | null;

  pouring_today_product_id?: string | null;
  pouring_today_note?: string | null;
  where_to_find_text?: string | null;

  links: ContributorLink[];
  languages?: string[];
  is_published: 0 | 1;

  articles: ContributorArticleRef[];
  pull_quotes: ContributorPullQuote[];
  featured_in: ContributorFeaturedRef[];
  products: ContributorProductRef[];
  accounts?: ContributorAccountRef[];
  shelf_slug?: string | null;
  has_payment_methods?: boolean;
  payment_accounts?: Array<{ slug: string; name: string }>;
  host_account: ContributorHostAccount | null;
  seasonal_line: string | null;
}

export interface AdminContributor extends Omit<ContributorProfile, 'articles' | 'pull_quotes' | 'featured_in' | 'products' | 'host_account' | 'seasonal_line'> {
  account_id: string;
  publication_state?: 'draft' | 'awaiting_approval' | 'published' | 'unpublished';
  approval_state?: 'pending' | 'approved' | 'changes_requested';
  reviewer_note?: string | null;
  has_pending_draft?: boolean;
  draft_diff?: null | {
    submitted_at: string | null;
    updated_at: string | null;
    changed_fields: string[];
    live: Record<string, unknown>;
    pending: Record<string, unknown>;
  };
  user_id?: string | null;
  face_of_account_id?: string | null;
  created_at: string;
  updated_at: string;
  contact_customer_id?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
}

export interface ContributorOption {
  id: string;
  slug: string;
  display_name: string;
  status: 'draft' | 'published';
}

export interface ContributorWrite {
  id?: string;
  slug?: string;
  display_name?: string;
  chinese_name?: string | null;
  role?: string | null;
  pronouns?: string | null;
  location_line?: string | null;
  active_since?: string | null;
  beginnings?: string | null;
  now_text?: string | null;
  now_stamp?: string | null;
  now_updated_at?: string | null;
  inspirations?: string | null;
  closing?: string | null;
  avatar_url?: string | null;
  portrait_url?: string | null;
  portrait_caption?: string | null;
  voice_clip_url?: string | null;
  voice_clip_caption?: string | null;
  pouring_today_product_id?: string | null;
  pouring_today_note?: string | null;
  where_to_find_text?: string | null;
  user_id?: string | null;
  face_of_account_id?: string | null;
  links?: ContributorLink[];
}

export interface Chapter {
  id: string;
  title: string;
  startPageIndex: number;
}

export interface GalleryItem {
  url: string;
  caption?: string;  // Optional - not all images need captions
  layout?: 'full' | 'half';  // Optional hint for layout
}

export type StoryStatus = 'published' | 'draft' | 'vault';

export type CostCurrency = 'USD' | 'IDR' | 'CNY' | 'TWD' | 'MYR' | 'HKD' | 'JPY';

// Story categories for content organization
export type StoryCategory = 'tea-feature' | 'interview' | 'science' | 'curated' | 'pairing';

export interface Story {
  id: string;
  slug?: string;
  type: ContentType;
  status: StoryStatus;
  title: string;
  subtitle: string; // Chinese or poetic subtitle
  thumbnailUrl?: string;
  durationOrTime: string;
  origin: 'In-house' | 'Curated';
  description: string;
  content?: string[]; // For articles: array of paragraphs or pages
  gallery?: GalleryItem[]; // For PhotoEssays
  drawings?: boolean; // If true, show ink drawings instead of full image
  author?: Person;
  interviewee?: Person;

  // Video Embed Support
  externalId?: string; // YouTube ID (e.g. "dQw4w9WgXcQ") or Instagram Shortcode (e.g. "CqQ5_5xP")
  platform?: 'YouTube' | 'Instagram';

  // Content categorization & featuring
  category?: StoryCategory; // Content category for filtering and badges
  isFeatured?: boolean; // Featured on homepage
  teaId?: string; // Links to inventory item (for Tea Feature articles)
  publishedDate?: string; // ISO date string (YYYY-MM-DD) for sorting newest first
}

export interface LearnModule {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  lessons: Story[];
}

export interface LearnPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  modules: string[]; // Module IDs
}

export type ViewState = 'BROWSE' | 'STORY_VIEW' | 'READER';

export interface CartItem {
  id: string;
  name: string;
  variant: string;
  category: 'tea' | 'ware';
  storeSlug: string;
  storeName: string;
  /**
   * The total weight on this line: `packGrams` multiplied by `packs`.
   *
   * Kept as the total, and not as the pack size, because every reader of a
   * line already means "how much tea is this" by it: the order's gram total,
   * the request message, the rate the panel divides out. A line that predates
   * packing has no `packs` and is one pack of this weight, so the two agree.
   */
  quantityGrams: number;
  /**
   * The weight of ONE pack, and how many of them.
   *
   * The order used to hold a weight per tea and nothing else, so asking for
   * two 25 g packs was impossible: the second one merged into the first and
   * came back as a single 50 g pack at the 50 g price, which is a cheaper
   * price for a thing the shop was not being asked to send. Two small packs
   * are not one big one, and the discount is for the big one.
   *
   * Optional so a cart saved before packing still loads; absent means one
   * pack of `quantityGrams`.
   */
  packGrams?: number;
  packs?: number;
  /**
   * What makes this line itself: the tea and its pack size.
   *
   * A tea can now be on the order twice, as 25 g and as 100 g, so the tea's
   * own id no longer picks out a row. Absent on carts saved before packing,
   * where the id still does.
   */
  lineKey?: string;
  pricePerGram: number;
  totalPrice: number;
  /**
   * The weight of one unbroken piece of this tea, when it is pressed into one.
   * Carried on the line because the pricing curve exempts a whole piece from
   * the handling fee, and the cart has to be able to recompute a line total
   * when a quantity changes without reaching back into the catalogue.
   */
  wholePieceGrams?: number;
  /**
   * The tea's type (Sheng, Red, White...), carried so the order panel can wash
   * each line in the colour that tea brews, the same ground the shop ledger
   * uses. Optional because carts saved before this existed have no type, and a
   * line without one simply goes untinted.
   */
  type?: string;
  image?: string;
}

// Unified Inventory Type
export interface InventoryItem {
  id: string;
  /** Readable public address, e.g. "mahei-gushu-red". Absent on rows that
   *  predate the slug migration; links fall back to the id. */
  slug?: string;
  category: 'tea' | 'ware';
  subcategory?: string; // For teaware (brewing, serving, etc.)
  type: string; // e.g. "Green", "Teapot"
  /** Physical form: 'Loose' | 'Cake' | 'Brick' | 'Tuo' | 'Ball' | 'Bag' | ... .
   *  Drives which whole-piece amount the shop offers (a cake is 357 g). */
  form?: string;
  /**
   * What one pressed piece of this tea weighs.
   *
   * Entered per tea, because a tuo can be 5 g or 250 g and the word "tuo" does
   * not say which. Absent means nobody has said, and the shop then offers no
   * whole piece rather than assuming the common size: a whole piece is exempt
   * from the handling fee, so guessing the weight quietly guesses the price.
   */
  pieceWeightG?: number;
  name: string;
  year: string;
  origin: string;
  variant: string;
  stock_g: number; // Stock in grams
  cost_price: string; // Original cost in the currency specified by cost_currency
  cost_currency?: CostCurrency; // Currency the cost was entered in (default: USD)
  multiplier?: number; // Multiplier for price calculation (default: 1)
  price_per_gram?: string; // Price per gram for tea items
  price_50g?: string; // For tea: price per 50g (derived from price_per_gram * 50). For teaware/misc: price per unit. Field name is historical — comes from the API.
  pricePerUnit?: string; // Semantic alias for teaware/misc items: same value as price_50g but clarifies it means "per unit", not "per 50 grams"
  description: string;
  tags: string[];
  image: string;
  supplier?: string; // Supplier/vendor name for the item
  supplier_location?: string; // Location/country where supplier is based (maps to currency)
  chineseName?: string;
  /** The plant this tea is made from, resolved against the tea wisdom base. */
  cultivar?: string | null;
  lore?: string;
  showWisdom?: boolean;
  terroir?: string;
  processingNotes?: string;
  mood?: string;
  experience?: string;
  additionalImages?: string[];
  /** URL to a short audio guide (origin story, brewing tips) */
  audioGuideUrl?: string;
  material?: string;
  capacityMl?: number;
  isFeatured?: boolean;
  isOneOfAKind?: boolean;
  isCurated?: boolean;
  magazineUrl?: string;
  tasting?: TastingData;
  /**
   * Source of the tasting data.
   * - 'owner': reviewed and saved by the shop owner — speaks as Adrian's voice.
   * - 'community': aggregated from public reviews.
   * - 'source': described by source material for this exact tea lot.
   * - 'common' | undefined: default to style-level common profile (see commonTastingByStyle).
   * Source-described profiles remain distinct from owner tasting and shared knowledge.
   */
  tastingSource?: 'common' | 'owner' | 'community' | 'source';
  quantityUnits?: number;
  sessionReserveGrams?: number; // When stock_g <= this, show a soft low-availability warning
  moodTags?: string[];
  flavorTags?: string[];
}

// Public-safe product type (no cost/vendor fields)
export type PublicProductType = TeaType | typeof NON_TEA_TYPES[number];

export interface PublicProduct {
  id: string;
  /** Readable public address. See InventoryItem.slug. */
  slug?: string;
  type: PublicProductType;
  /** Physical form. Public because it is how the leaf is sold, not a cost fact. */
  form?: string;
  /**
   * What one pressed piece of this tea weighs.
   *
   * Entered per tea, because a tuo can be 5 g or 250 g and the word "tuo" does
   * not say which. Absent means nobody has said, and the shop then offers no
   * whole piece rather than assuming the common size: a whole piece is exempt
   * from the handling fee, so guessing the weight quietly guesses the price.
   */
  pieceWeightG?: number;
  givenName: string;
  chineseName?: string;
  productName: string;
  year?: number;
  originCountry: string;
  originRegion: string;
  pricePerGramUSD: number;
  fixedRetailPriceUSD?: number | null;
  stockGrams: number;
  description: string;
  tastingNotes: string[];
  imageUrl: string;
  status: 'Active' | 'Sold Out';
  isPersonal: boolean;
  canReorder: boolean;
  isFeatured?: boolean;
  isOneOfAKind: boolean;
  isCurated?: boolean;
  lore?: string;
  showWisdom?: boolean;
  processingNotes?: string;
  terroir?: string;
  mood?: string;
  experience?: string;
  additionalImages?: string[];
  material?: string;
  capacityMl?: number;
  teawareCategory?: 'pot' | 'cup' | 'tray' | 'storage' | 'accessory' | 'decorative';
  quantityUnits?: number;
  tasting?: TastingData;
  tastingSource?: 'common' | 'owner' | 'community' | 'source';
  moodTags?: string[];
  flavorTags?: string[];
  /**
   * The plant, as written. Resolved against the wisdom base at render time, so
   * a record saved "Da Ye Zhong" and one saved in Chinese reach the same page.
   * Not a display string: when the base holds nothing for it, nothing is shown.
   */
  cultivar?: string | null;
}

export interface StarterSet {
  id: string;
  name: string;
  shortDescription: string; // Brief one-liner for collapsed state
  description: string; // Full description for expanded state
  idealFor?: string; // "Perfect for: ..." one-liner
  image?: string;
  price: string;
  discount?: string; // e.g., "15% off" or "$5 off individual items"
  items: {
    type: 'tea' | 'ware';
    itemId: string;
    quantity?: number;
  }[];
  tags: string[];
}

// Image Preloader Types
export interface PreloaderState {
  preloadedUrls: Set<string>;
  failedUrls: Set<string>;
  pendingUrls: Set<string>;
  estimatedSizeMB: number;
}

export interface PreloaderConfig {
  maxMemoryMB: number;
  maxConcurrentLoads: number;
  pagesAhead: number;
}

// Community & Tea Inspire Types
export interface CommunityMember {
  id: string;
  name: string;
  photo: string;
  bio: string; // One sentence
  socialLinks?: {
    instagram?: string;
    website?: string;
    [key: string]: string | undefined;
  };
  teaInspireImageIds: string[]; // Array of Tea Inspire image IDs
}

export interface TeaInspireInsight {
  type: 'design' | 'curation' | 'layout' | 'material' | 'philosophy' | 'story' | 'work';
  title: string;
  explanation: string;
}

export interface TeaInspireImage {
  id: string;
  imageUrl: string;
  caption: string; // One sentence describing the photo
  communityMemberId: string; // Links to community member
  dateAdded: string; // ISO date format
  insights?: TeaInspireInsight[];
}

// Resources Types
export interface Resource {
  id: string;
  type: 'playlist' | 'guide' | 'restaurant' | 'travel' | 'collection';
  title: string;
  description: string;
  image?: string;
  content?: string; // URL or detailed content
  category?: string;
  location?: string; // For restaurants and travel guides
  dateAdded: string;
}

// Navigation Types
export type Section = 'HOME' | 'MAGAZINE' | 'LEARN' | 'SHOP' | 'OFFERINGS' | 'EVENTS' | 'YOUR_TABLE' | 'ABOUT';
export type MainNavSection = Exclude<Section, 'HOME' | 'YOUR_TABLE'>;
export type UtilitySection = Extract<Section, 'YOUR_TABLE'>;

// ─── Multi-Account (Multi-Store) Types ───────────────────────────────────────
// A Teajia "account" is a tea house / store. Users belong to one or more
// accounts via memberships with per-account roles.

export interface Account {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  location_city?: string;
  location_country?: string;
  timezone?: string;
  currency_default?: string;
  whatsapp_number?: string;
  contact_email?: string;
  public_enabled?: boolean;
  /**
   * Whether money can still reach anyone at this store. Served only on the
   * public store payload, so it is absent everywhere else and absence must
   * never be read as "no": only an explicit false stops a checkout.
   */
  can_be_paid?: boolean;
  is_platform_owner?: boolean;
  invoice_prefix?: string;
  // BYOK presence flags (the encrypted secret itself is never sent to the client).
  has_openai_key?: boolean;
  openai_key_last4?: string | null;
}

export type AccountRole = 'owner' | 'staff' | 'viewer';
export type PlatformRole = 'platform_owner' | 'platform_admin' | null;
export type AccountKind = 'platform' | 'location' | 'master';
export type AccountStatus = 'active' | 'suspended';
export type Bundle = 'catalog' | 'stock' | 'publish' | 'gather' | 'sell' | 'members';

export const ALL_BUNDLES: Bundle[] = ['catalog', 'stock', 'publish', 'gather', 'sell', 'members'];

export const BUNDLE_LABELS: Record<Bundle, string> = {
  catalog: 'Catalog',
  stock: 'Stock',
  publish: 'Publish',
  gather: 'Gather',
  sell: 'Sell',
  members: 'Members',
};

// One-line description shown in editor sheet under each bundle name (per M&A brief §10).
export const BUNDLE_DESCRIPTIONS: Record<Bundle, string> = {
  catalog: 'Add and edit teas, teaware, sources, and purchase orders.',
  stock: 'Adjust inventory counts and log shipments received.',
  publish: 'Write articles and curate Collections.',
  gather: 'Run events and approve attendees.',
  sell: 'Manage customers, orders, and pricing.',
  members: 'Grant and revoke access for other people at this location.',
};

// ── Network catalog — Step 2 (Carry from network) ─────────────────────────
// Shape returned by GET /api/network/catalog. Agent A is building that endpoint;
// this type mirrors the network response contract; see docs/ARCHITECTURE.md.
// Profile shape returned by GET /api/network/catalog. Mirrors the response
// constructed in worker/src/index.ts handleNetworkCatalog.
export interface NetworkCatalogProfile {
  id: string;
  slug: string;
  name: string;
  chinese_name: string | null;
  type: string | null;            // e.g. "White", "Oolong", "Green"
  form: string | null;
  origin_country: string | null;
  origin_region: string | null;
  varietal: string | null;
  harvest_year: string | null;
  description: string | null;
  image_url: string | null;
  canonical_photos: string[];     // parsed array
  // Attribution — both ids exposed so the draft view can build wholesale orders
  // without a second fetch.
  curator_account_id: string;
  curator_account_name: string;
  curator_account_slug: string;
  curator_listing_id: string | null;  // the supplier_listing_id for wholesale orders
  originator_account_id: string;
  originator_account_name: string;
  // Pricing — curator's retail in their currency, caller's wholesale in theirs
  retail_currency: string;
  retail_price_per_gram_curator: number | null;
  wholesale_margin_pct_for_caller: number;
  wholesale_price_per_gram_caller: number | null;
  wholesale_currency_caller: string;
  fx_unavailable: boolean;
}

export interface CarryProfileOpts {
  initial_stock_grams: number;
  initial_price_amount: number;
  initial_price_currency: string;
}

export interface CarryProfileResult {
  listing_id: string;
}

// ── Profile suggestions (Step 3 — editorial governance) ──────────────────────

/** A single field change a partner is proposing for canonical content. */
export interface ProfileSuggestionFieldDraft {
  field_name: ProfileSuggestableField;
  /** Snapshot of the current canonical value so the curator sees drift later. */
  current_value: string | null;
  proposed_value: string;
}

/** The whitelist of fields a partner can suggest. Mirrors PROFILE_SUGGESTABLE_FIELDS in worker/src/index.ts. */
export type ProfileSuggestableField =
  | 'name'
  | 'chinese_name'
  | 'type'
  | 'form'
  | 'origin_country'
  | 'origin_region'
  | 'varietal'
  | 'harvest_year'
  | 'description'
  | 'lore'
  | 'processing_notes'
  | 'terroir'
  | 'mood'
  | 'experience'
  | 'image_url';

export type ProfileSuggestionStatus = 'pending' | 'partial' | 'resolved' | 'withdrawn';
export type ProfileSuggestionFieldStatus = 'pending' | 'accepted' | 'rejected';

export interface ProfileSuggestionField {
  id: string;
  suggestion_id: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string;
  status: ProfileSuggestionFieldStatus;
  reject_note: string | null;
  decided_at: string | null;
}

export interface ProfileSuggestion {
  id: string;
  profile_id: string;
  /** Set on the incoming-queue endpoint; absent on the per-profile endpoint. */
  profile_name?: string;
  profile_slug?: string;
  status: ProfileSuggestionStatus;
  created_at: string;
  updated_at: string;
  suggested_by_account_id: string;
  suggested_by_account_name: string;
  suggested_by_user_id: string;
  suggested_by_user_name: string | null;
  suggested_by_email: string | null;
  fields: ProfileSuggestionField[];
}

/** Per-field decision sent in POST /api/suggestions/:id/decide. */
export interface ProfileSuggestionDecision {
  field_id: string;
  status: 'accepted' | 'rejected';
  reject_note?: string;
}

// ── Wholesale orders (Step 4) ────────────────────────────────────────────────

export type WholesaleOrderStatus =
  | 'draft'
  | 'submitted'
  | 'replied'
  | 'confirmed'
  | 'shipped'
  | 'received'
  | 'cancelled';

/** Per-line item in a wholesale order. */
export interface WholesaleOrderItem {
  id: string;
  order_id: string;
  supplier_listing_id: string;
  buyer_listing_id: string | null;   // null until received
  profile_id: string;
  grams: number;
  unit_price_amount: number;
  unit_price_currency: string;
  line_total: number;
  // Joined when fetched via getOrder
  profile_name?: string;
  profile_slug?: string;
  profile_image?: string | null;
}

/** The order envelope. Mirrors the wholesale_orders table. */
export interface WholesaleOrder {
  id: string;
  supplier_account_id: string;
  buyer_account_id: string;
  status: WholesaleOrderStatus;
  currency: string;
  subtotal_amount: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  shipping_address: string | null;
  tracking_number: string | null;
  carrier: string | null;
  buyer_notes: string | null;
  supplier_notes: string | null;
  invoice_id_supplier: string | null;
  invoice_id_buyer: string | null;
  submitted_at: string | null;
  replied_at: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  cancelled_by_account_id: string | null;
  cancel_reason: string | null;
  last_nudge_at: string | null;
  nudge_count: number;
  created_at: string;
  updated_at: string;
}

/** Summary row from GET /api/wholesale/orders (list view). */
export interface WholesaleOrderSummary extends WholesaleOrder {
  supplier_name: string;
  supplier_slug: string;
  buyer_name: string;
  buyer_slug: string;
  item_count: number;
}

/** Detail response from GET /api/wholesale/orders/:id. */
export interface WholesaleOrderDetail {
  order: WholesaleOrder;
  supplier: { id: string; name: string; slug: string; currency_default: string };
  buyer: { id: string; name: string; slug: string; currency_default: string };
  items: WholesaleOrderItem[];
}

/** Body for POST /api/wholesale/orders. */
export interface WholesaleOrderCreateBody {
  supplier_account_id: string;
  currency: string;
  shipping_address?: string | null;
  buyer_notes?: string | null;
  items?: Array<{
    supplier_listing_id: string;
    grams: number;
    unit_price_amount: number;
    unit_price_currency: string;
  }>;
}

/** Body for PUT /api/wholesale/orders/:id. */
export interface WholesaleOrderUpdateBody {
  shipping_address?: string | null;
  buyer_notes?: string | null;
  items?: Array<{
    supplier_listing_id: string;
    grams: number;
    unit_price_amount: number;
    unit_price_currency: string;
  }>;
}

/** Body for POST /api/wholesale/orders/:id/transition. */
export interface WholesaleTransitionBody {
  to: 'submitted' | 'replied' | 'confirmed' | 'shipped' | 'received' | 'cancelled';
  shipping_amount?: number;     // confirmed
  tracking_number?: string;     // shipped
  carrier?: string;             // shipped
  supplier_notes?: string;      // replied | confirmed
  cancel_reason?: string;       // cancelled
}

// ── Network adoption (Step 6) ────────────────────────────────────────────────

export type AdoptionDecision = 'pending' | 'adopted' | 'declined';

/** A row in the adoption queue (GET /api/network/adoption-queue). */
export interface AdoptionQueueEntry {
  id: string;
  slug: string;
  name: string;
  chinese_name: string | null;
  type: string | null;
  form: string | null;
  origin_country: string | null;
  origin_region: string | null;
  varietal: string | null;
  harvest_year: string | null;
  description: string | null;
  image_url: string | null;
  suggested_for_network_at: string;
  suggested_for_network_note: string | null;
  adoption_decision: AdoptionDecision;
  adoption_decided_at: string | null;
  adoption_decline_note: string | null;
  originated_by_account_id: string;
  originator_account_name: string;
  originator_account_slug: string;
  suggested_for_network_by_user_id: string | null;
  suggested_by_user_name: string | null;
  suggested_by_user_email: string | null;
}

export interface AccountMembership {
  account_id: string;
  account_name: string;
  slug: string;
  role: AccountRole;
  // Tea Master vs Location vs Platform — read at the account level.
  account_kind?: AccountKind;
  // Bundle authorization (Members & Access). Owners always have all six;
  // staff bundles come from account_members.permissions.bundles; viewers have none.
  bundles?: Bundle[];
  logo_url?: string;
  is_platform_account?: boolean;
}

export interface AccountMember {
  user_id: string;
  email: string;
  name: string;
  username?: string | null;
  role: AccountRole;
  platform_role?: PlatformRole;
  bundles?: Bundle[];
  permissions?: Record<string, boolean>;
  joined_at?: string | null;
  invited_at?: string | null;
  status?: string;
  can_create_collections?: boolean;
}

// Pending account application (Members & Access platform queue).
export interface AccountApplication {
  id: string;
  applicant_email: string;
  applicant_name: string | null;
  proposed_account_kind: 'location' | 'master';
  note: string | null;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  decided_by_user_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

// ── Magazine / Article types ────────────────────────────────────────────────

// ArticleBlock — paginated 4:5 article system.
// Every block renders as one page in the paginated reader at /article/:slug.
// New variants are absorbed by `variant` discriminators rather than new types
// to keep the union small. See docs/ARCHITECTURE.md.
export type ParagraphVariant =
  | 'single' | 'double' | 'justified' | 'center' | 'drop_cap';

export type ImageVariant =
  | 'full_bleed' | 'caption_bottom' | 'split_vertical' | 'film_strip'
  | 'polaroid_scatter' | 'circle_mask' | 'arch_mask'
  // Immersive reader (AR.2) visual variants. Added minimally so the data-driven
  // image block can render the book-plate and pinned-hero layouts without a new
  // block type. Inert in the 4:5 carousel reader (which ignores unknown variants).
  | 'book_plate' | 'pinned_hero';

export type QuoteVariant = 'big' | 'minimal';

export type CoverVariant =
  | 'main' | 'photo_inset' | 'minimal' | 'masthead';

export type ChapterVariant = 'minimal';

export type PoemVariant = 'centered';

export type BackMatterVariant = 'copyright' | 'dedication';

// Text-effect dial (AR.3). Attaches to reading sections as an optional per-block
// toggle. Inert in the 4:5 carousel reader (which ignores the field); the
// immersive reader reads it in renderBlock. 'scroll-highlight' is the default
// reading effect for prose when the field is absent.
export type ArticleTextEffect =
  | 'none'
  | 'scroll-highlight'
  | 'word-rise'
  | 'shimmer'
  | 'blur-focus'
  | 'line-stagger'
  | 'scale-jump'
  | 'color-wipe'
  | 'underline-draw'
  | 'letter-expand';

export type ArticleBlock =
  // Original 6, extended:
  | { type: 'intro'; text: string; textEffect?: ArticleTextEffect }
  | { type: 'paragraph'; variant?: ParagraphVariant; text: string; textEffect?: ArticleTextEffect }
  | { type: 'section_heading'; text: string; textEffect?: ArticleTextEffect }
  | { type: 'quote'; variant?: QuoteVariant; text: string; attribution?: string }
  | { type: 'image'; variant?: ImageVariant; url?: string; images?: string[]; description: string; caption?: string }
  | { type: 'divider' }
  // Magazine page kinds:
  | { type: 'cover'; variant?: CoverVariant; title: string; subtitle?: string; image?: string; kicker?: string }
  | { type: 'chapter_divider'; variant?: ChapterVariant; number?: string; title: string; subtitle?: string }
  | { type: 'qa_pair'; items: Array<{ q: string; a: string }> }
  | { type: 'pull_sidebar'; side: 'left' | 'right' | 'image'; body: string; sidebar: string; image?: string }
  | { type: 'epilogue'; text: string; signature?: string }
  | { type: 'stat'; value: string; label: string; context?: string }
  | { type: 'definition'; term: string; body: string; etymology?: string }
  | { type: 'recipe'; title: string; ingredients: string[]; steps: string[]; pairing?: string }
  | { type: 'tasting_notes'; items: Array<{ label: string; note: string }> }
  | { type: 'poem'; variant: PoemVariant; text: string }
  | { type: 'map'; caption?: string; locations: string[] }
  | { type: 'list'; variant: 'checklist' | 'timeline'; title?: string; items: string[] }
  | { type: 'embed'; platform: 'youtube' | 'instagram'; externalId: string; caption?: string; description?: string }
  | { type: 'back_matter'; variant: BackMatterVariant; lines: string[] }
  // Immersive reader (AR.4) interactive blocks. New, minimal — no existing
  // block carries before/after pairs, an audio source, or a product link.
  // These render only in the immersive reader; the 4:5 carousel skips unknown
  // block types, so coexistence holds.
  | { type: 'comparison'; before: string; after: string; beforeLabel?: string; afterLabel?: string; caption?: string }
  | { type: 'audio'; src?: string; title?: string }
  | { type: 'product_link'; title: string; blurb?: string; href: string; image?: string };

export interface DbArticle {
  id: string;
  account_id?: string;
  title: string;
  subtitle?: string;
  author_id?: string;
  author_name?: string;
  subject_ids?: string[];
  pull_quote?: string;
  pull_quote_subject?: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  category?: string;
  tags: string[];
  cover_image_url?: string;
  blocks: ArticleBlock[];
  layout_template?: string;
  reading_time_mins?: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
  blocks_preview?: string;
}

// ── Collections (Phase 1) ───────────────────────────────────────────────────

export type CollectionStatus = 'draft' | 'active' | 'archived';
export type CollectionTargetType = 'person' | 'store' | 'event' | 'shop' | 'tag';

export interface CollectionRecipient {
  customer_id?: string;
  name: string;
  phone?: string;
}

export interface Collection {
  id: string;
  account_id: string;
  title: string;
  note?: string | null;
  hero_image_url?: string | null;
  status: CollectionStatus;
  created_by_user_id?: string | null;
  curator_user_id?: string | null;
  curator_display_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionListRow {
  id: string;
  title: string;
  note?: string | null;
  hero_image_url?: string | null;
  status: CollectionStatus;
  curator_display_name?: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
  active_publication_count: number;
  last_published_at?: string | null;
  thumbnails: string[];
}

/** A collection on the logged-in user's shelf (saved or received via a shared link). */
export interface SavedCollectionRow {
  id: string;                       // collection_id
  slug?: string | null;             // publication slug they came through (deep-link back to /c/:slug)
  source: 'received' | 'saved';
  saved_at: string;
  title: string;
  note?: string | null;
  hero_image_url?: string | null;
  curator_display_name?: string | null;
  item_count: number;
  thumbnails: string[];
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  product_id: string;
  position: number;
  item_note?: string | null;
  /** Curator's suggested amount: grams (loose-leaf) or unit count (cake/teaware), as a string. */
  recommended_quantity?: string | null;
  /** Curator's quoted total price (USD) for the recommended quantity. Null = use catalog price. */
  recommended_price_usd?: number | null;
  /** Catalog per-gram (tea) / per-unit (teaware) retail price, for the editor's placeholder. */
  fixed_retail_price_usd?: number | null;
  product_type?: string;
  product_name?: string;
  chinese_name?: string | null;
  year?: number | null;
  origin_country?: string | null;
  origin_region?: string | null;
  image_url?: string | null;
  product_status?: string;
  stock_grams?: number | null;
  quantity_units?: number | null;
  tasting_notes?: string[] | string | null;
  description?: string | null;
}

export interface CollectionPublication {
  id: string;
  collection_id: string;
  target_type: CollectionTargetType;
  target_id?: string | null;
  slug: string;
  recipients: CollectionRecipient[];
  published_at: string;
  unpublished_at?: string | null;
  view_count: number;
}

export interface CollectionDetail {
  collection: Collection;
  items: CollectionItem[];
  publications: CollectionPublication[];
}

export interface PublicCollectionItem {
  id: string;
  position: number;
  item_note?: string | null;
  /** Curator's suggested amount: grams (loose-leaf) or unit count (cake/teaware). */
  recommended_quantity?: string | null;
  /** Curator's quoted total price (USD) for the recommended quantity. */
  recommended_price_usd?: number | null;
  product_id: string;
  product_type?: string;
  product_name?: string;
  chinese_name?: string | null;
  year?: number | null;
  origin_country?: string | null;
  origin_region?: string | null;
  image_url?: string | null;
  description?: string | null;
  tasting_notes?: string[] | null;
  product_status?: string;
  out_of_stock: boolean;
}

export interface PublicCollectionResponse {
  collection: {
    title: string;
    note?: string | null;
    hero_image_url?: string | null;
    curator_display_name?: string | null;
  };
  items: PublicCollectionItem[];
  account: { name: string; whatsapp_number?: string | null } | null;
  publication: { slug: string; view_count: number };
}

export interface InboundCollectionRow {
  publication_id: string;
  slug: string;
  published_at: string;
  unpublished_at?: string | null;
  recipient_seen_at?: string | null;
  collection_id: string;
  title: string;
  note?: string | null;
  hero_image_url?: string | null;
  publisher_account_id: string;
  publisher_account_name: string;
  item_count: number;
  imported_count: number;
  thumbnails: string[];
}

export interface InboundCollectionItem {
  item_id: string;
  product_id: string;
  position: number;
  item_note?: string | null;
  product_type?: string;
  product_name?: string;
  chinese_name?: string | null;
  year?: number | null;
  origin_country?: string | null;
  origin_region?: string | null;
  image_url?: string | null;
  tasting_notes?: string[] | string | null;
  description?: string | null;
  imported_product_id?: string | null;
}

export interface InboundCollectionDetail {
  publication: {
    publication_id: string;
    slug: string;
    target_id: string;
    published_at: string;
    unpublished_at?: string | null;
    recipient_seen_at?: string | null;
    collection_id: string;
    title: string;
    note?: string | null;
    hero_image_url?: string | null;
    publisher_account_id: string;
    publisher_account_name: string;
    publisher_tagline?: string | null;
    curator_display_name?: string | null;
  };
  items: InboundCollectionItem[];
}

export interface NeedsAttentionItem {
  item_id: string;
  collection_id: string;
  collection_title: string;
  product_id: string;
  product_name: string;
  product_type?: string;
  product_status?: string;
  issue: 'out_of_stock' | 'archived';
}

// Item shape returned by GET /api/collections/shop (in-stock active products only).
export interface ShopCollectionItem {
  item_id: string;
  position: number;
  item_note?: string | null;
  product_id: string;
  product_type?: string;
  product_name?: string;
  chinese_name?: string | null;
  year?: number | null;
  origin_country?: string | null;
  origin_region?: string | null;
  image_url?: string | null;
  description?: string | null;
  tasting_notes?: string[] | null;
}

// One entry in the GET /api/collections/shop response.
export interface ShopCollectionEntry {
  publication_id: string;
  slug: string;
  published_at: string;
  view_count: number;
  collection: {
    id: string;
    account_id: string;
    title: string;
    note?: string | null;
    hero_image_url?: string | null;
    status: CollectionStatus;
    curator_display_name?: string | null;
  };
  items: ShopCollectionItem[];
}

// Response shape for GET /api/collections/shop.
export interface PublicShopCollectionsResponse {
  collections: ShopCollectionEntry[];
}

export type InventoryPurposeValue = 'working' | 'sample' | 'personal';
export type ReceiptAcquisitionKind = 'purchase' | 'free_sample' | 'gift' | 'transfer' | 'other';
export interface CurateReceiptProposal {
  id: string; account_id: string; compass_entry_id?: string | null; import_id?: string | null;
  import_item_id?: string | null; product_id?: string | null; batch_id?: string | null;
  product_name?: string | null; product_type?: string | null; purpose: InventoryPurposeValue;
  quantity: number; unit: 'g' | 'unit'; acquisition_kind: ReceiptAcquisitionKind;
  status: 'pending' | 'accepted' | 'rejected'; idempotency_key: string; ledger_id?: string | null;
  proposed_by_user_id: string; reviewed_by_user_id?: string | null; reviewed_at?: string | null;
  created_at: string; updated_at: string;
}

export interface CustomerOrderDetail {
  id: string;
  invoice_number: string;
  status: string;
  created_at: string;
  payment_date: string | null;
  fulfilled_at: string | null;
  currency: string;
  items: Array<{
    id: string;
    product_id: string | null;
    name: string;
    quantity: number;
    unit_price_usd: number;
    line_total_usd: number;
  }>;
  subtotal_amount_usd: number;
  shipping_amount_usd: number;
  total_amount_usd: number;
  contact: { whatsapp: string | null; email: string | null };
}

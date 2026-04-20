
export interface TastingData {
  // Section 1: Sensation (temperature, weight, texture)
  body?: string[];              // temperature + weight + texture terms

  // Section 2: Movement (throat, duration, finish character)
  finish?: string[];            // throat sensations + finish character/duration terms
  cleanliness?: string;         // 'clean' | 'some-edge' | 'rough'
  huiGan?: boolean;             // Returning sweetness

  // Section 3: Feeling (settling, lifting, body, mind)
  feeling?: string[];           // qi / mood / effect terms
  clarity?: 'clear' | 'hazy' | 'cloudy';
  quality?: number;             // 1-10 overall verdict

  // Section 4: Flavor (families + specific terms)
  flavor?: string[];            // family-level or specific sub-terms

  // Section 5: Appearance (color + clarity)
  'liquor-color'?: string[];    // color swatch

  // Notes
  notes?: string[];             // separate note entries (text / transcribed voice)
  voiceNote?: string;           // legacy single concatenated note

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

export interface CustomerTasting {
  id: string;
  teaId: string;
  teaName: string;
  teaType: string;
  teaImage?: string;
  tasting: TastingData;
  personalNote?: string;
  rating?: number;
  createdAt: string;
  /** When this tasting originated from an event session */
  eventId?: string;
  /** URL slug for the event (e.g. "winter-2024") — used for navigation */
  eventSlug?: string;
  /** Human-readable event title for display in the journal */
  eventTitle?: string;
  /** Origin context */
  sourceType?: 'product' | 'compass' | 'event' | 'sample';
  /** Cross-link to a TeaCompassEntry */
  compassEntryId?: string;
  /** Sourcing verdict — would we stock/order this tea? */
  verdict?: 'love' | 'like' | 'neutral' | 'pass';
  /** Would you buy/order this tea? */
  wouldBuy?: boolean;
  /** Name of the person who tasted (group cuppings) */
  tasterName?: string;
  /** Whether this entry has been synced to the server */
  synced?: boolean;
  /** Account this tasting belongs to (for multi-account filtering) */
  accountId?: string;
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

export type ViewState = 'BROWSE' | 'STORY_VIEW' | 'READER' | 'PHOTO_ESSAY' | 'PAGE_READER';

export interface CartItem {
  id: string;
  name: string;
  variant: string;
  category: 'tea' | 'ware';
  quantityGrams: number;
  pricePerGram: number;
  totalPrice: number;
  image?: string;
}

// Unified Inventory Type
export interface InventoryItem {
  id: string;
  category: 'tea' | 'ware';
  subcategory?: string; // For teaware (brewing, serving, etc.)
  type: string; // e.g. "Green", "Teapot"
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
  quantityUnits?: number;
  sessionReserveGrams?: number; // When stock_g <= this, show a soft low-availability warning
}

// Public-safe product type (no cost/vendor fields)
export type PublicProductType = 'Green' | 'Yellow' | 'White' | 'Oolong' | 'Red' | 'Dark' | 'Sheng' | 'Shou' | 'Herbal' | 'Teaware' | 'Misc';

export interface PublicProduct {
  id: string;
  type: PublicProductType;
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
}

export const TEA_TYPES = ['Green', 'White', 'Oolong', 'Black', 'Puerh', 'Yellow'] as const;
export type TeaType = typeof TEA_TYPES[number];

export interface StarterSet {
  id: string;
  name: string;
  shortDescription: string; // Brief one-liner for collapsed state
  description: string; // Full description for expanded state
  idealFor?: string; // "Perfect for: ..." one-liner
  image: string;
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
export type Section = 'HOME' | 'MAGAZINE' | 'LEARN' | 'SHOP' | 'OFFERINGS' | 'EVENTS' | 'ACCOUNT' | 'ABOUT';
export type MainNavSection = Exclude<Section, 'HOME' | 'ACCOUNT'>;
export type UtilitySection = Extract<Section, 'ACCOUNT'>;

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
  is_platform_owner?: boolean;
  invoice_prefix?: string;
}

export type AccountRole = 'owner' | 'staff' | 'viewer';
export type PlatformRole = 'platform_owner' | 'platform_admin' | null;

export interface AccountMembership {
  account_id: string;
  account_name: string;
  slug: string;
  role: AccountRole;
  logo_url?: string;
  is_platform_account?: boolean;
}

export interface AccountMember {
  user_id: string;
  email: string;
  name: string;
  role: AccountRole;
  platform_role?: PlatformRole;
  permissions?: Record<string, boolean>;
  joined_at?: string;
  status?: string;
}

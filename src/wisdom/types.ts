/**
 * The tea wisdom base: what a tea IS, held once and read everywhere.
 *
 * Three layers, deliberately separate:
 *   vocabulary  the controlled words (type, form, season, storage)
 *   entities    the things those words describe (regions, cultivars, varieties)
 *   stories     the prose about them, loaded on demand rather than bundled
 *
 * Nothing here is account-scoped. A cultivar is true regardless of who holds it.
 * What one shop stocks, priced, and tasted stays in the shop's own records.
 */

import type { TastingData } from '../types';

export type RegionLevel =
  | 'country'
  | 'province'
  | 'prefecture'
  | 'county'
  | 'tea_area'
  | 'mountain'
  | 'village'
  | 'locality';

export interface RegionEvidenceSource {
  label: string;
  url: string;
}

/**
 * An evidenced elevation statement. Whole-place geography and tea-garden
 * elevation are deliberately different scopes: one must never imply the
 * other.
 */
export interface RegionElevation {
  value: string;
  scope: 'tea_growing' | 'place';
  /** Reader-facing qualifier when the numerical range could be overread. */
  note?: string;
  source?: RegionEvidenceSource;
}

/** A growing region. `id` is a stable slug so records can point at it. */
export interface Region {
  id: string;
  name: string;
  country: string;
  /** Province or prefecture, when the name alone is ambiguous. */
  province?: string;
  /** Explicit geographic level. Absence means the legacy flat record is unresolved. */
  level?: RegionLevel;
  /** Stable id of an explicitly reviewed parent. A province label is not silently promoted to this. */
  parentId?: string;
  /** Evidence-aware replacement for the legacy, context-free altitude string. */
  elevation?: RegionElevation;
  /** Legacy context-free data. New reviewed records should use `elevation`. */
  altitude?: string;
  climate?: string;
  /**
   * How much of the place is under forest, as a reader-facing phrase. Kept
   * beside elevation because for an old-growth origin the canopy is the fact
   * that explains the tea, and it belongs to the place rather than to any one
   * garden in it.
   */
  forestCover?: string;
  /**
   * What the tea trees themselves are, in a phrase: ancient stands, planted
   * terraces, and so on. A claim about the population, not about a cultivar.
   */
  treeCharacter?: string;
  /** Qualified place or trade context, when a citation supports it. */
  description?: string;
}

export type WisdomEntryKind = 'cultivar' | 'region' | 'producer' | 'style' | 'mark' | 'namedTea';
export type CitationUsage = 'usable' | 'qualified' | 'held_back';
export type ResearchSourceKind =
  | 'scientific'
  | 'governmental'
  | 'institutional'
  | 'producer-primary'
  | 'specialist-retailer'
  | 'book'
  | 'other';

/** Canonical bibliographic source. Internal fields never enter browser modules. */
export interface ResearchSource {
  id: string;
  publisher: string;
  title: string;
  url?: string;
  kind: ResearchSourceKind;
  accessedAt: string;
  publishedAt?: string;
  trust: 'primary' | 'strong' | 'qualified' | 'lead-only';
  privateEvidenceRef?: string;
}

export type PublicResearchSource = Omit<ResearchSource, 'trust' | 'privateEvidenceRef'>;

/** Field-level support from one or more bibliographic sources. */
export interface WisdomCitation {
  id: string;
  entryKind: WisdomEntryKind;
  entryId: string;
  fields: string[];
  sourceIds: string[];
  usage: CitationUsage;
  qualification?: string;
}

/** Qualified sensory character at one shared Wisdom entry scope. */
export type WisdomPotentialTasting = Pick<
  TastingData,
  'body' | 'finish' | 'feeling' | 'flavor' | 'liquor-color' | 'brewing'
>;

export interface WisdomPotentialProfile {
  entryKind: WisdomEntryKind;
  entryId: string;
  tasting: WisdomPotentialTasting;
  citationIds: string[];
}

/** A tea plant cultivar. The lean shape: no prose, safe to import anywhere. */
export interface Cultivar {
  id: string;
  name: string;
  chineseName?: string;
  altNames: string[];
  originCountry?: string;
  originRegion?: string;
  developedYear?: number;
  /** Breeding lineage, e.g. "TRES-2022 x Tainung #80". */
  parentage?: string;
}

/** The prose about a cultivar. Lives in stories/, fetched when a reader asks. */
export interface CultivarStory {
  description: string;
  plantType: string;
  environment: string;
  processing: string;
  oxidation: string;
  roasting: string;
  versatility: string;
  /** Country to growing areas, where the research recorded it. */
  distribution: Record<string, string[]> | null;
  /** Style family to named expressions made from this cultivar. */
  expressions: Record<string, Record<string, string>> | null;
  sensory: { aroma?: string; flavor?: string; mouthfeel_liquor?: string } | null;
}

/**
 * Who made the tea. A factory, house, brand or cooperative.
 *
 * Not the vendor. The vendor is who a shop bought from, which is account-scoped
 * and belongs in the shop's own records. The producer is true for everyone: a
 * 7572 was made by Menghai Tea Factory no matter whose shelf it sits on.
 */
export interface Producer {
  id: string;
  name: string;
  chineseName?: string;
  altNames: string[];
  /** A house (号) is a pre-1950 family firm. A factory (茶厂) is state or industrial. */
  kind: 'factory' | 'house' | 'brand' | 'cooperative' | 'unknown';
  country?: string;
  region?: string;
  founded?: number;
  /** Recipe numbers, seals and labels this producer is known for. */
  notableMarks: string[];
  description?: string;
}

/**
 * A recognised way a tea is made, pressed or prepared that is neither a plant
 * variety nor one of the basic forms. Xiao Qing Gan is shou stuffed in a green
 * mandarin; Tie Bing is a cake pressed in a stone-weighted iron mould.
 */
export interface Style {
  id: string;
  name: string;
  chineseName?: string;
  altNames: string[];
  /** Canonical tea types this style applies to. Empty means it applies broadly. */
  appliesToTypes: string[];
  region?: string;
  description?: string;
}

/**
 * A recipe number, seal or label identifying a product line, usually tied to a
 * producer and an era. 7572, Red Seal, Yellow Label, Jia Ji.
 */
export interface Mark {
  id: string;
  name: string;
  chineseName?: string;
  altNames: string[];
  /** The producer's id, when the record names one. */
  producerId?: string;
  era?: string;
  appliesToTypes: string[];
  description?: string;
}

/**
 * A tea whose identity is the name it was given, where the composition is not
 * disclosed.
 *
 * These arrive already named, usually from Chinese private collections where
 * naming a stored tea is common practice among serious collectors. The mountain,
 * the village and often the vintage are never recorded, and that is the nature
 * of the record rather than a gap in it. Holding the name and saying plainly
 * what is not known beats refusing to hold it at all.
 */
export interface NamedTea {
  id: string;
  name: string;
  chineseName?: string;
  altNames: string[];
  /** Canonical tea type, from the record itself. */
  type?: string;
  form?: string;
  region?: string;
  country?: string;
  /** The collection it came from, when a write-up names one. */
  collection?: string;
  /** The thread back to where it was obtained. */
  vendor?: string;
  /** How much of the composition the record actually states. */
  provenance: 'undisclosed' | 'partial' | 'stated';
  /** The naming practice this belongs to. */
  tradition?: string;
  description?: string;
}

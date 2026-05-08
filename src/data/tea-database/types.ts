/**
 * Tea database — shared types.
 *
 * A future-friendly catalogue of tea cultivars, named teas, producing regions,
 * and tisanes. Designed for autocomplete, filtering, map pins, and editorial
 * surfaces. Entries are intentionally minimal — extend rather than mutate.
 *
 * See `index.ts` for the aggregated exports across regional files.
 */

export type TeaCategory =
  | 'green'
  | 'white'
  | 'yellow'
  | 'oolong'
  | 'black'         // Western "black" / Chinese "red" (hong cha)
  | 'dark'          // Hei cha (post-fermented), excluding puer
  | 'puer-sheng'    // Raw / green puer
  | 'puer-shou'     // Ripe / cooked puer
  | 'scented'       // Jasmine, osmanthus, rose, etc.
  | 'flavored'      // Earl Grey, masala chai, etc.
  | 'compressed'    // Brick/cake/tuocha form (often orthogonal)
  | 'powdered'      // Matcha, Tencha-derived
  | 'herbal'        // Non-camellia tisane
  | 'mate'
  | 'rooibos'
  | 'fruit'
  | 'spice'
  | 'mushroom'
  | 'flower'
  | 'blend';

export type TeaPlantSpecies =
  | 'Camellia sinensis var. sinensis'
  | 'Camellia sinensis var. assamica'
  | 'Camellia sinensis var. cambodiensis'
  | 'Camellia sinensis var. dehungensis'
  | 'Camellia sinensis var. pubilimba'
  | 'Camellia taliensis'
  | 'Camellia ptilophylla'    // Cocoa tea
  | 'Camellia crassicolumna'
  | 'hybrid'
  | 'other';

export type ProcessingStep =
  | 'wither'
  | 'fix' | 'kill-green'      // Sha qing / steaming / pan-fire to halt oxidation
  | 'pan-fire' | 'steam' | 'bake' | 'sun-dry' | 'shade'
  | 'roll' | 'shape' | 'twist' | 'pellet' | 'compress'
  | 'oxidize' | 'partial-oxidize' | 'full-oxidize'
  | 'wet-pile' | 'wo-dui'     // Shou puer fermentation
  | 'age' | 'aged'
  | 'roast' | 'charcoal-roast' | 'mei-hua' // Min Nan style
  | 'scent' | 'flavor'
  | 'grind';

export interface Origin {
  country: string;             // Country in English
  province?: string;           // Province / state / prefecture
  locality?: string;           // City / county / mountain / estate
  elevation?: string;          // e.g. "800–1200 m"
  coordinates?: { lat: number; lon: number };
}

export interface BrewingProfile {
  waterTempC?: [number, number];
  timeSec?: [number, number];
  leafGramsPer100ml?: number;
  rinses?: number;             // For gongfu — rinses before first drinking infusion
  notes?: string;
}

export interface TeaEntry {
  /** Stable kebab-case identifier — never reuse or rename. */
  id: string;
  /** Primary display name (English / Pinyin / Romaji). */
  name: string;
  category: TeaCategory;
  chineseName?: string;
  japaneseName?: string;
  koreanName?: string;
  vietnameseName?: string;
  altNames?: string[];
  origin: Origin;
  cultivar?: string[];         // Cultivar names, e.g. ["Yabukita", "Saemidori"]
  species?: TeaPlantSpecies;
  oxidation?: string;          // "0%" | "10–20%" | "60–70%" | "100%" | "post-fermented"
  processing?: ProcessingStep[];
  flavorNotes?: string[];
  brewing?: BrewingProfile;
  harvestSeason?: string[];    // ["spring", "first flush", "monsoon"]
  description?: string;
  /** Optional editorial flag — surfaces in landing pages, magazine. */
  flagship?: boolean;
}

export interface TeaRegion {
  id: string;
  name: string;
  country: string;
  province?: string;
  /** Sub-region locality — town, mountain, valley. */
  locality?: string;
  altNames?: string[];
  coordinates?: { lat: number; lon: number };
  elevation?: string;
  climate?: string;
  /** Categories this region is best known for. */
  primaryCategories: TeaCategory[];
  /** Tea entry IDs from this region. */
  signatureTeas?: string[];
  /** Cultivar IDs commonly grown here. */
  signatureCultivars?: string[];
  notes?: string;
}

export interface TeaCultivar {
  /** Stable kebab-case id, e.g. "yabukita". */
  id: string;
  /** Primary cultivar name. */
  name: string;
  chineseName?: string;
  japaneseName?: string;
  koreanName?: string;
  vietnameseName?: string;
  altNames?: string[];
  species: TeaPlantSpecies;
  origin?: string;             // Country / region of registration or selection
  parents?: string[];          // Lineage cultivar names if hybrid
  /** Categories this cultivar is most often processed for. */
  primaryUse: TeaCategory[];
  introduced?: string;         // Year of release / registration
  notes?: string;
}

/**
 * Helper for typed re-exports across regional files. Each regional file
 * exports a `const xyzTeas: TeaEntry[]`, `xyzRegions: TeaRegion[]`, etc.
 */
export type TeaEntryList = readonly TeaEntry[];
export type TeaRegionList = readonly TeaRegion[];
export type TeaCultivarList = readonly TeaCultivar[];

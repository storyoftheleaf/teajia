import {
  Flower2, Cherry, Wheat, Flame, TreePine, Mountain, Gem, Leaf, Droplets,
  Circle, Waves, Timer, Sparkles, Wind, Moon, Zap, Thermometer, Maximize2,
  Palette, Clock, Coffee, Sunrise, Cookie,
  type LucideIcon,
} from 'lucide-react';
import taxonomyJson from './teajia-tasting-taxonomy.json';
import type { TastingData } from '../types';

export const TASTING_TAXONOMY = taxonomyJson;

/** Only the array-valued categories in TastingData — used by useTastingFlow and taxonomy lookups */
export type TastingCategoryId = 'flavor' | 'body' | 'finish' | 'feeling' | 'liquor-color' | 'brewing';

/** Somatic flow: sensation first, naming last */
export const TASTING_CATEGORY_ORDER: TastingCategoryId[] = [
  'body', 'finish', 'feeling', 'flavor', 'liquor-color', 'brewing',
];

export interface TastingTermInfo {
  id: string;
  label: string;
  icon: LucideIcon;
  groupLabel: string;
  categoryId: TastingCategoryId;
}

// Map group labels to lucide icons
export const GROUP_ICON_MAP: Record<string, LucideIcon> = {
  // Flavor families
  'Floral': Flower2,
  'Sweet': Cookie,
  'Fruity': Cherry,
  'Nutty & grain': Wheat,
  'Roasted & warm': Flame,
  'Spice': Flame,
  'Woody': TreePine,
  'Earthy': Mountain,
  'Mineral': Gem,
  'Fresh & vegetal': Leaf,
  'Taste & character': Droplets,
  // Sensation
  'Temperature': Thermometer,
  'Weight': Circle,
  'Texture': Waves,
  // Movement
  'Duration': Timer,
  'Character': Sparkles,
  'Throat': Wind,
  // Feeling
  'Settling': Moon,
  'Lifting': Zap,
  'Body': Thermometer,
  'Mind': Maximize2,
  // Appearance
  'Color': Palette,
  // Brewing
  'Approach': Clock,
  'Vessel': Coffee,
  'Session arc': Sunrise,
  // Legacy keys kept for old entries
  'Other qualities': Droplets,
  'Calming': Moon,
  'Activating': Zap,
  'Physical': Thermometer,
  'Spatial': Maximize2,
};

/** Icons for each tasting section tab */
export const SECTION_ICONS: Record<string, LucideIcon> = {
  'body': Circle,
  'finish': Wind,
  'feeling': Moon,
  'flavor': Leaf,
  'liquor-color': Palette,
  'brewing': Coffee,
};

/** One-line descriptions for each section */
export const SECTION_DESCRIPTIONS: Record<string, string> = {
  'body': 'What your mouth reports. Temperature, weight, texture.',
  'finish': 'What happens as you swallow. Follow the tea down.',
  'feeling': 'What the tea does to your state. Beyond flavor, into presence.',
  'flavor': 'What you taste. Pick the family first, then get specific if you want.',
  'liquor-color': 'What you see in the cup.',
  'brewing': 'A nudge, not a recipe. How to approach this tea.',
};

// Fallback icons per category
const CATEGORY_ICON_FALLBACK: Record<string, LucideIcon> = {
  'flavor': Leaf,
  'body': Circle,
  'finish': Sparkles,
  'feeling': Moon,
  'liquor-color': Palette,
  'brewing': Coffee,
};

// Per-term icon overrides (for groups with duplicate labels across categories)
const TERM_ICON_OVERRIDES: Record<string, LucideIcon> = {
  'opens-slowly': Sunrise,
  'peaks-mid-session': Sunrise,
  'consistent': Sunrise,
  'fades-gracefully': Sunrise,
};

// Build flat lookup map: termId → TastingTermInfo
export const TERM_MAP = new Map<string, TastingTermInfo>();

for (const cat of taxonomyJson.categories) {
  for (const group of cat.groups) {
    const groupIcon = GROUP_ICON_MAP[group.label] || CATEGORY_ICON_FALLBACK[cat.id] || Droplets;
    for (const term of group.terms) {
      TERM_MAP.set(term.id, {
        id: term.id,
        label: term.label,
        icon: TERM_ICON_OVERRIDES[term.id] || groupIcon,
        groupLabel: group.label,
        categoryId: cat.id as TastingCategoryId,
      });
    }
  }
}

/** Resolve a term ID to its display label (handles custom terms gracefully) */
export function resolveTermLabel(id: string): string {
  return TERM_MAP.get(id)?.label ?? id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Resolve a term ID to its lucide icon component.
 *  Falls back to fuzzy matching — if "light-honey" isn't in the map,
 *  it checks whether any known term ID is a suffix of the input. */
export function resolveTermIcon(id: string): LucideIcon {
  const exact = TERM_MAP.get(id);
  if (exact) return exact.icon;

  // Fuzzy: check if any known term is contained in the compound ID
  // Prefer longest match to avoid false positives (e.g. "floral-earth" → "earth" not "art")
  let bestMatch: TastingTermInfo | undefined;
  let bestLen = 0;
  for (const [termId, info] of TERM_MAP) {
    if (id.includes(termId) && termId.length > bestLen) {
      bestMatch = info;
      bestLen = termId.length;
    }
  }
  return bestMatch?.icon ?? Droplets;
}

/** Liquor color hex values for swatches */
export const LIQUOR_COLORS: Record<string, string> = {
  'pale-gold': '#f5e6a8',
  'gold': '#d4a845',
  'amber': '#c87533',
  'honey-color': '#d4a030',
  'copper': '#b87333',
  'orange': '#cc6c2e',
  'reddish-brown': '#8b4513',
  'deep-brown': '#5c3317',
  'dark-chestnut': '#3c1414',
  'ink': '#1a1a1a',
};

/** Suggested flavor terms per tea type */
export const TEA_TYPE_SUGGESTIONS: Record<string, string[]> = {
  'Green': ['fresh-grass', 'vegetal', 'herbaceous', 'floral', 'chestnut'],
  'White': ['floral', 'honey', 'peach', 'vanilla', 'cream'],
  'Yellow': ['chestnut', 'honey', 'floral', 'vanilla'],
  'Oolong': ['floral', 'orchid', 'stone-fruit', 'honey', 'toasted', 'cinnamon', 'cream'],
  'Red': ['honey', 'malt', 'cocoa', 'dried-fruit', 'caramel', 'lychee'],
  'Dark': ['earthy', 'mushroom', 'leather', 'woody', 'aged', 'fermented'],
  'Sheng': ['floral', 'honey', 'bitter', 'camphor', 'mineral', 'sour'],
  'Shou': ['earthy', 'woody', 'aged', 'date', 'fig', 'cocoa', 'mushroom', 'fermented'],
  'Herbal': ['floral', 'herbaceous', 'honey', 'citrus', 'vanilla'],
};

/** Flatten a TastingData object into an ordered list of term IDs (flavor first, then body, finish, feeling, liquor-color) */
export function flattenTastingNotes(tasting: TastingData): string[] {
  const displayOrder: TastingCategoryId[] = ['flavor', 'body', 'finish', 'feeling', 'liquor-color'];
  const result: string[] = [];
  for (const cat of displayOrder) {
    const terms = tasting[cat];
    if (terms?.length) result.push(...terms);
  }
  return result;
}

/** Get brewing notes separately (displayed differently from main notes) */
export function getBrewingNotes(tasting: TastingData): string[] {
  return tasting.brewing ?? [];
}

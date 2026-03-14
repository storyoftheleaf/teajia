import {
  Flower2, Cherry, Wheat, Flame, TreePine, Mountain, Gem, Leaf, Droplets,
  Circle, Waves, Timer, Sparkles, Wind, Moon, Zap, Thermometer, Maximize2,
  Palette, Clock, Coffee, Sunrise, Cookie,
  type LucideIcon,
} from 'lucide-react';
import taxonomyJson from './teajia-tasting-taxonomy.json';
import type { TastingData } from '../types';

export const TASTING_TAXONOMY = taxonomyJson;

export type TastingCategoryId = keyof TastingData;

export const TASTING_CATEGORY_ORDER: TastingCategoryId[] = [
  'flavor', 'body', 'finish', 'feeling', 'liquor-color', 'brewing',
];

export interface TastingTermInfo {
  id: string;
  label: string;
  icon: LucideIcon;
  groupLabel: string;
  categoryId: TastingCategoryId;
}

// Map group labels to lucide icons
const GROUP_ICON_MAP: Record<string, LucideIcon> = {
  'Floral': Flower2,
  'Sweet': Cookie,
  'Fruity': Cherry,
  'Nutty & grain': Wheat,
  'Roasted & warm': Flame,
  'Woody': TreePine,
  'Earthy': Mountain,
  'Mineral': Gem,
  'Fresh & vegetal': Leaf,
  'Other qualities': Droplets,
  'Weight': Circle,
  'Texture': Waves,
  'Duration': Timer,
  'Character': Sparkles,
  'Throat': Wind,
  'Calming': Moon,
  'Activating': Zap,
  'Physical': Thermometer,
  'Spatial': Maximize2,
  'Temperature': Thermometer,
  'Approach': Clock,
  'Vessel': Coffee,
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

/** Resolve a term ID to its lucide icon component */
export function resolveTermIcon(id: string): LucideIcon {
  return TERM_MAP.get(id)?.icon ?? Droplets;
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

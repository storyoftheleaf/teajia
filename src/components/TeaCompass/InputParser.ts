import { SEASONS, COMMON_REGIONS } from './types';
import type { TeaType, TeaForm, Season, Storage } from './types';

export interface ParseResult {
  name: string;
  type?: TeaType;
  form?: TeaForm;
  year?: number;
  season?: Season;
  storage?: Storage;
  region?: string;
}

// Words that follow "Red" and indicate it's part of a tea name, not the type
const RED_COMPOUND_SUFFIXES = ['robe', 'label', 'jade', 'mark', 'peony', 'beauty', 'dragon'];

// Storage phrase mappings (input phrase → Storage value)
const STORAGE_PHRASES: { phrase: string; value: Storage }[] = [
  { phrase: 'dry storage', value: 'Dry' },
  { phrase: 'wet storage', value: 'Wet/Traditional' },
  { phrase: 'traditional storage', value: 'Wet/Traditional' },
  { phrase: 'hk storage', value: 'HK' },
  { phrase: 'hong kong storage', value: 'HK' },
  { phrase: 'malaysian storage', value: 'Malaysian' },
  { phrase: 'natural storage', value: 'Natural' },
];

// Single-word storage shortcuts (only if not ambiguous)
const STORAGE_SINGLES: { word: string; value: Storage }[] = [
  { word: 'dry', value: 'Dry' },
  { word: 'wet', value: 'Wet/Traditional' },
];

// Form aliases (input → TeaForm)
const FORM_ALIASES: Record<string, TeaForm> = {
  cake: 'Cake',
  brick: 'Brick',
  tuo: 'Tuo',
  'loose leaf': 'Loose',
  loose: 'Loose',
  ball: 'Ball',
  bag: 'Bag',
};

// Type aliases
const TYPE_ALIASES: Record<string, TeaType> = {
  green: 'Green',
  white: 'White',
  yellow: 'Yellow',
  oolong: 'Oolong',
  red: 'Red',
  dark: 'Dark',
  sheng: 'Sheng',
  shou: 'Shou',
  herbal: 'Herbal',
  matcha: 'Green',
  black: 'Red', // Chinese convention
};

// Ambiguous puerh terms — skip these (user should pick Sheng or Shou)
const AMBIGUOUS_TYPE_TERMS = ['puerh', 'pu-erh', 'puer', "pu'er", 'pu er'];

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Parse a free-text tea input into structured fields.
 * Extraction order: storage phrases (multi-word) → form phrases (multi-word) → regions → single tokens
 */
export function parseTeaInput(input: string, knownRegions: string[] = []): ParseResult {
  if (!input.trim()) {
    return { name: '' };
  }

  const result: ParseResult = { name: '' };

  // Working copy — we'll remove matched tokens and what's left becomes the name
  let working = input;

  // Helper: remove a substring from working (case-insensitive), returns whether it matched
  const removePhrase = (phrase: string): boolean => {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i');
    if (regex.test(working)) {
      working = working.replace(regex, ' ');
      return true;
    }
    return false;
  };

  // --- Pass 1: Storage phrases (multi-word, must go first) ---
  for (const { phrase, value } of STORAGE_PHRASES) {
    if (removePhrase(phrase)) {
      result.storage = value;
      break;
    }
  }

  // --- Pass 2: Multi-word form ("loose leaf") ---
  if (removePhrase('loose leaf')) {
    result.form = 'Loose';
  }

  // --- Pass 3: Multi-word regions (e.g., "Dong Ding") ---
  const allRegions = [...COMMON_REGIONS, ...knownRegions];
  // Sort by length descending so longer phrases match first
  const sortedRegions = [...new Set(allRegions)].sort((a, b) => b.length - a.length);

  for (const region of sortedRegions) {
    if (region.includes(' ')) {
      // Multi-word region
      const regex = new RegExp(`\\b${escapeRegex(region)}\\b`, 'i');
      if (regex.test(working)) {
        result.region = region;
        working = working.replace(regex, ' ');
        break;
      }
    }
  }

  // --- Pass 4: Process remaining tokens (single words) ---
  // Tokenize what's left
  const tokens = working.split(/\s+/).filter(Boolean);
  const consumed: Set<number> = new Set();

  for (let i = 0; i < tokens.length; i++) {
    if (consumed.has(i)) continue;
    const token = tokens[i];
    const lower = token.toLowerCase();

    // Year detection: 4-digit number in range
    if (!result.year && /^\d{4}$/.test(token)) {
      const num = parseInt(token, 10);
      if (num >= 1950 && num <= CURRENT_YEAR + 1) {
        result.year = num;
        consumed.add(i);
        continue;
      }
    }

    // Season
    if (!result.season) {
      const matchedSeason = SEASONS.find((s) => s.toLowerCase() === lower);
      if (matchedSeason) {
        result.season = matchedSeason;
        consumed.add(i);
        continue;
      }
    }

    // Storage single-word shortcuts (only if no storage matched from phrases)
    // But "dry" and "wet" alone are too ambiguous when followed by other words that aren't "storage"
    // Only match these if they appear standalone (not before another noun that isn't "storage")
    if (!result.storage) {
      const storageMatch = STORAGE_SINGLES.find((s) => s.word === lower);
      if (storageMatch) {
        // Check if next token is "storage" — if so, it was already handled in pass 1
        // If next token is NOT "storage", treat this as a standalone storage indicator
        const nextToken = i + 1 < tokens.length ? tokens[i + 1]?.toLowerCase() : '';
        if (nextToken !== 'storage') {
          // "dry" alone → Dry storage. "wet" alone → Wet/Traditional.
          // But only if it's not part of a compound like "dry leaf"
          const safeNext = !nextToken || ['', undefined].includes(nextToken) ||
            SEASONS.some(s => s.toLowerCase() === nextToken) ||
            /^\d{4}$/.test(tokens[i + 1] || '');
          if (safeNext || i === tokens.length - 1) {
            result.storage = storageMatch.value;
            consumed.add(i);
            continue;
          }
        }
      }
    }

    // Tea type
    if (!result.type) {
      // Skip ambiguous puerh terms
      if (AMBIGUOUS_TYPE_TERMS.includes(lower)) continue;

      const typeMatch = TYPE_ALIASES[lower];
      if (typeMatch) {
        // Special handling for "Red" — check if it's part of a compound name
        if (lower === 'red') {
          const nextToken = i + 1 < tokens.length ? tokens[i + 1]?.toLowerCase() : '';
          if (nextToken && RED_COMPOUND_SUFFIXES.includes(nextToken)) {
            // "Red Robe" — leave both in name
            continue;
          }
        }
        result.type = typeMatch;
        consumed.add(i);
        continue;
      }
    }

    // Form (single-word)
    if (!result.form) {
      const formKey = lower;
      if (formKey in FORM_ALIASES) {
        result.form = FORM_ALIASES[formKey];
        consumed.add(i);
        continue;
      }
    }

    // Region (single-word)
    if (!result.region) {
      const regionMatch = sortedRegions.find(
        (r) => !r.includes(' ') && r.toLowerCase() === lower
      );
      if (regionMatch) {
        result.region = regionMatch;
        consumed.add(i);
        continue;
      }
    }
  }

  // Rebuild name from unconsumed tokens
  const nameTokens = tokens.filter((_, i) => !consumed.has(i));
  result.name = nameTokens.join(' ').replace(/\s{2,}/g, ' ').trim();

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

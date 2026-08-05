import { normalizeTeaForm, normalizeTeaType, SEASONS } from '../../wisdom';
import { RED_COMPOUND_SUFFIXES, recognizeAmbiguity, recognizeRegion } from '../../wisdom/recognition';
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

// Storage isn't part of the shared tea-type/form vocabulary. Nothing else in
// the app parses storage phrases, so this knowledge lives only here.
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

// Words this free-text parser will auto-strip out of the name when it
// recognises them as a bare type/form word. This is deliberately a narrower
// allowlist than the wisdom base's full `normalizeTeaType`/`normalizeTeaForm`
// dialect tables: those also answer to generic English words used elsewhere
// in a tea's own name, such as "leaf" (Big Leaf varieties), "pearl" (Jasmine
// Pearl), "flower"/"raw"/"ripe"/"cooked", which would otherwise vanish from a typed
// name the moment they appeared. The *values* still come from the shared
// vocabulary (`normalizeTeaType/normalizeTeaForm`) so a canonicalisation
// change there is picked up automatically; only *which words trigger a strip
// here* is curated locally, because that is a free-text-parsing safety
// concern the wisdom base itself has no opinion on.
const STRIPPABLE_TYPE_WORDS = ['green', 'white', 'yellow', 'oolong', 'red', 'dark', 'sheng', 'shou', 'herbal', 'matcha', 'black'];
const STRIPPABLE_FORM_WORDS = ['cake', 'brick', 'tuo', 'loose', 'ball', 'bag'];

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Parse a free-text tea input into structured fields.
 * Extraction order: storage phrases (multi-word) → loose leaf → region (from
 * the wisdom base's 167 known places) → single tokens (year, season, storage,
 * type, form).
 *
 * Type and form recognition read the wisdom base's one shared vocabulary
 * (`normalizeTeaType` / `normalizeTeaForm`) instead of a local alias table, so
 * this parser and every other surface agree on what a word means, including
 * the two careful exceptions the shared recogniser preserves: a bare puerh
 * spelling never resolves to Sheng or Shou, and "Red" followed by a name word
 * (robe, label, jade, mark, peony, beauty, dragon) stays part of the tea's
 * name rather than becoming the type.
 */
export function parseTeaInput(input: string, knownRegions: string[] = []): ParseResult {
  if (!input.trim()) {
    return { name: '' };
  }

  const result: ParseResult = { name: '' };

  // Working copy: we'll remove matched tokens and what's left becomes the name
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

  // --- Pass 3: Region (multi-word or single-word, from the wisdom base) ---
  const regionMatch = recognizeRegion(working, knownRegions);
  if (regionMatch) {
    result.region = regionMatch;
    const regionPattern = new RegExp(`\\b${escapeRegex(regionMatch)}\\b`, 'i');
    working = working.replace(regionPattern, ' ');
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
        // Check if next token is "storage": if so, it was already handled in pass 1
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

    // Tea type: value comes from the wisdom base's shared vocabulary, but
    // only for the small set of words this free-text parser treats as safe to
    // auto-strip from a typed name (see STRIPPABLE_TYPE_WORDS above). Bare
    // puerh spellings stay unresolved, and "Red" stays part of a compound tea
    // name (Red Robe, Red Label, Red Jade...) rather than becoming the type.
    if (!result.type && STRIPPABLE_TYPE_WORDS.includes(lower)) {
      if (recognizeAmbiguity(token)) continue;

      const typeMatch = normalizeTeaType(lower);
      if (typeMatch) {
        // Special handling for "Red": check if it's part of a compound name
        if (lower === 'red') {
          const nextToken = i + 1 < tokens.length ? tokens[i + 1]?.toLowerCase() : '';
          if (nextToken && RED_COMPOUND_SUFFIXES.includes(nextToken)) {
            // "Red Robe": leave both in name
            continue;
          }
        }
        result.type = typeMatch;
        consumed.add(i);
        continue;
      }
    }

    // Form (single-word): same allowlist principle as type, above.
    if (!result.form && STRIPPABLE_FORM_WORDS.includes(lower)) {
      const formMatch = normalizeTeaForm(lower);
      if (formMatch) {
        result.form = formMatch;
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

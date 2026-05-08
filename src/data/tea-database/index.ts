/**
 * Tea database — aggregated index.
 *
 * Single import point for the full database. Regional files contain the
 * authoritative entries; this file flattens them into typed arrays for
 * search, filtering, autocomplete, and editorial use.
 *
 * Usage:
 *   import { allTeas, allRegions, allCultivars } from '@/data/tea-database';
 *   import { teasByCategory, teasByCountry } from '@/data/tea-database';
 *
 * Adding a new origin → create `src/data/tea-database/<region>.ts`, export
 * `<region>Teas`, `<region>Regions`, optionally `<region>Cultivars`, then
 * register here.
 */

import type {
  TeaCategory,
  TeaCultivar,
  TeaEntry,
  TeaPlantSpecies,
  TeaRegion,
} from './types';

// ── Regional re-exports ──────────────────────────────────────────────────
export * from './types';
export { teaSpecies, teaCultivars } from './cultivars';
export type { TeaSpeciesEntry } from './cultivars';

import { chinaGreenTeas, chinaYellowTeas, chinaGreenYellowRegions } from './china-green-yellow';
import { chinaWhiteTeas, chinaWhiteRegions, chinaWhiteCultivars } from './china-white';
import { chinaOolongTeas, chinaOolongRegions, chinaOolongCultivars } from './china-oolong';
import { chinaRedTeas, chinaRedRegions, chinaRedCultivars } from './china-red';
import {
  puerTeas,
  chinaDarkTeas,
  chinaDarkPuerRegions,
  chinaDarkPuerCultivars,
} from './china-dark-puer';
import { japanTeas, japanRegions, japanCultivars } from './japan';
import { taiwanTeas, taiwanRegions, taiwanCultivars } from './taiwan';
import { koreaTeas, koreaRegions, koreaCultivars } from './korea';
import { indiaTeas, indiaRegions, indiaCultivars } from './india';
import {
  srilankaNepalTeas,
  srilankaNepalRegions,
  srilankaNepalCultivars,
} from './sri-lanka-nepal';
import {
  southeastAsiaTeas,
  southeastAsiaRegions,
  southeastAsiaCultivars,
} from './southeast-asia';
import { africaTeas, africaRegions, africaCultivars } from './africa';
import {
  middleEastCaucasusTeas,
  middleEastCaucasusRegions,
  middleEastCaucasusCultivars,
} from './middle-east-caucasus';
import {
  americasEmergingTeas,
  americasEmergingRegions,
  americasEmergingCultivars,
} from './americas-emerging';
import { teaCultivars as masterCultivarCatalogue } from './cultivars';
import { tisanes, tisaneRegions } from './tisanes';

// ── Aggregated arrays ────────────────────────────────────────────────────

/** Every Camellia-sinensis tea entry across all regions. */
export const allTeas: TeaEntry[] = [
  ...chinaGreenTeas,
  ...chinaYellowTeas,
  ...chinaWhiteTeas,
  ...chinaOolongTeas,
  ...chinaRedTeas,
  ...puerTeas,
  ...chinaDarkTeas,
  ...japanTeas,
  ...taiwanTeas,
  ...koreaTeas,
  ...indiaTeas,
  ...srilankaNepalTeas,
  ...southeastAsiaTeas,
  ...africaTeas,
  ...middleEastCaucasusTeas,
  ...americasEmergingTeas,
];

/** Every non-Camellia infusion (rooibos, mate, herbal, fruit, mushroom...). */
export const allTisanes: TeaEntry[] = [...tisanes];

/** Camellia teas + tisanes combined — for global search/autocomplete. */
export const allTeasAndTisanes: TeaEntry[] = [...allTeas, ...allTisanes];

/** Every recognised tea-producing region. */
export const allRegions: TeaRegion[] = [
  ...chinaGreenYellowRegions,
  ...chinaWhiteRegions,
  ...chinaOolongRegions,
  ...chinaRedRegions,
  ...chinaDarkPuerRegions,
  ...japanRegions,
  ...taiwanRegions,
  ...koreaRegions,
  ...indiaRegions,
  ...srilankaNepalRegions,
  ...southeastAsiaRegions,
  ...africaRegions,
  ...middleEastCaucasusRegions,
  ...americasEmergingRegions,
  ...tisaneRegions,
];

/**
 * Master cultivar catalogue. Combines the authoritative cross-reference in
 * `cultivars.ts` with regional cultivar exports — duplicates are filtered
 * by `id` (regional file wins so granular notes are preserved).
 */
export const allCultivars: TeaCultivar[] = (() => {
  const seen = new Set<string>();
  const merged: TeaCultivar[] = [];
  const regional: TeaCultivar[] = [
    ...chinaWhiteCultivars,
    ...chinaOolongCultivars,
    ...chinaRedCultivars,
    ...chinaDarkPuerCultivars,
    ...japanCultivars,
    ...taiwanCultivars,
    ...koreaCultivars,
    ...indiaCultivars,
    ...srilankaNepalCultivars,
    ...southeastAsiaCultivars,
    ...africaCultivars,
    ...middleEastCaucasusCultivars,
    ...americasEmergingCultivars,
  ];
  for (const cv of regional) {
    if (seen.has(cv.id)) continue;
    seen.add(cv.id);
    merged.push(cv);
  }
  for (const cv of masterCultivarCatalogue) {
    if (seen.has(cv.id)) continue;
    seen.add(cv.id);
    merged.push(cv);
  }
  return merged;
})();

// ── Lookups & filters ────────────────────────────────────────────────────

/** Tea entries grouped by category. */
export const teasByCategory: Record<TeaCategory, TeaEntry[]> = (() => {
  const out = {} as Record<TeaCategory, TeaEntry[]>;
  for (const tea of allTeasAndTisanes) {
    (out[tea.category] ||= []).push(tea);
  }
  return out;
})();

/** Tea entries grouped by country. */
export const teasByCountry: Record<string, TeaEntry[]> = (() => {
  const out: Record<string, TeaEntry[]> = {};
  for (const tea of allTeasAndTisanes) {
    (out[tea.origin.country] ||= []).push(tea);
  }
  return out;
})();

/** Cultivars grouped by species. */
export const cultivarsBySpecies: Record<TeaPlantSpecies, TeaCultivar[]> = (() => {
  const out = {} as Record<TeaPlantSpecies, TeaCultivar[]>;
  for (const cv of allCultivars) {
    (out[cv.species] ||= []).push(cv);
  }
  return out;
})();

/** Regions grouped by country. */
export const regionsByCountry: Record<string, TeaRegion[]> = (() => {
  const out: Record<string, TeaRegion[]> = {};
  for (const region of allRegions) {
    (out[region.country] ||= []).push(region);
  }
  return out;
})();

/** Quick lookup table — id → entry. */
export const teaById: Record<string, TeaEntry> = Object.fromEntries(
  allTeasAndTisanes.map((t) => [t.id, t]),
);

export const regionById: Record<string, TeaRegion> = Object.fromEntries(
  allRegions.map((r) => [r.id, r]),
);

export const cultivarById: Record<string, TeaCultivar> = Object.fromEntries(
  allCultivars.map((c) => [c.id, c]),
);

/** Flagship entries — for editorial / homepage / "famous teas" surfaces. */
export const flagshipTeas: TeaEntry[] = allTeasAndTisanes.filter((t) => t.flagship);

// ── Database statistics (handy for diagnostic / tests) ───────────────────

export const databaseStats = {
  teas: allTeas.length,
  tisanes: allTisanes.length,
  total: allTeasAndTisanes.length,
  regions: allRegions.length,
  cultivars: allCultivars.length,
  countries: Object.keys(teasByCountry).length,
  flagships: flagshipTeas.length,
} as const;

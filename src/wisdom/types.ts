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

/** A growing region. `id` is a stable slug so records can point at it. */
export interface Region {
  id: string;
  name: string;
  country: string;
  /** Province or prefecture, when the name alone is ambiguous. */
  province?: string;
  altitude?: string;
  climate?: string;
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

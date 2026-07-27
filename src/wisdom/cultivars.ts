import { CULTIVARS } from './generated/cultivars';
import type { Cultivar, CultivarStory } from './types';

export { CULTIVARS };

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, '');
/** Latin names need real length before a containment match is trustworthy; Chinese does not. */
const longEnough = (value: string) => (/[㐀-鿿]/.test(value) ? value.length >= 2 : value.length >= 5);

interface CultivarAlias { key: string; cultivar: Cultivar }

const CULTIVAR_ALIASES: CultivarAlias[] = CULTIVARS
  .flatMap(cultivar => [cultivar.name, cultivar.chineseName, ...cultivar.altNames]
    .filter((alias): alias is string => Boolean(alias))
    .map(alias => ({ key: matchKey(alias), cultivar })))
  .filter(entry => longEnough(entry.key))
  .sort((left, right) => right.key.length - left.key.length);

const BY_ID = new Map(CULTIVARS.map(cultivar => [cultivar.id, cultivar]));

export const findCultivarById = (id: string | null | undefined): Cultivar | null =>
  (id ? BY_ID.get(id) ?? null : null);

/**
 * Resolves a written tea name to the plant it is made from. Prefers the longest
 * matching alias, and returns null rather than guessing, because a wrong
 * lineage is worse than a blank one.
 */
export function matchCultivar(...names: Array<string | null | undefined>): Cultivar | null {
  const keys = names.map(name => (name ? matchKey(name) : '')).filter(Boolean);
  if (!keys.length) return null;
  for (const { key, cultivar } of CULTIVAR_ALIASES) {
    if (keys.some(candidate => candidate.includes(key))) return cultivar;
  }
  return null;
}

/** Cultivars recorded as coming from a given place. */
export const cultivarsFromRegion = (region: string): Cultivar[] =>
  CULTIVARS.filter(cultivar => cultivar.originRegion?.toLowerCase().includes(region.toLowerCase()));

/** Direct descendants, read out of the recorded breeding lineage. */
export function childrenOf(cultivar: Cultivar): Cultivar[] {
  const names = [cultivar.name, ...cultivar.altNames].map(name => name.toLowerCase());
  return CULTIVARS.filter(candidate => {
    const parentage = candidate.parentage?.toLowerCase();
    return Boolean(parentage) && candidate.id !== cultivar.id && names.some(name => parentage!.includes(name));
  });
}

/** Recorded parents, resolved to entries we hold where possible. */
export function parentsOf(cultivar: Cultivar): Array<Cultivar | string> {
  if (!cultivar.parentage) return [];
  return cultivar.parentage
    .split(/\s*(?:x|×|\/|,)\s*/i)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => matchCultivar(part) ?? part);
}

/**
 * The prose about a cultivar. Held apart from the index and fetched only when a
 * reader asks, so the 128 KB of research never lands in a page that just needs
 * a name.
 */
let storyCache: Record<string, CultivarStory> | null = null;
export async function loadCultivarStory(id: string): Promise<CultivarStory | null> {
  if (!storyCache) storyCache = (await import('./stories/cultivars.json')).default as Record<string, CultivarStory>;
  return storyCache[id] ?? null;
}

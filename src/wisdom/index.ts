/**
 * The tea wisdom base. One answer to "what is this tea", read by every surface.
 *
 * Import, capture, inventory, the shop, and the public reference all call
 * `resolveTea`. When a record here improves, every one of them improves the
 * same day, because none of them keeps its own copy.
 */
import { matchTeaVariety, type TeaVarietyMatch } from '../data/teaVarieties';
import { matchCultivar } from './cultivars';
import { matchNamedTea } from './namedTeas';
import { matchMark, matchProducer, matchStyle } from './producers';
import { countryForRegion, findRegion } from './regions';
import { normalizeTeaForm, normalizeTeaType, type TeaForm, type TeaType } from './vocabulary';
import type { Cultivar, Mark, NamedTea, Producer, Region, Style } from './types';

export * from './vocabulary';
export * from './regions';
export * from './cultivars';
export * from './producers';
export * from './namedTeas';
export * from './research';
export type {
  Cultivar,
  Region,
  CultivarStory,
  Producer,
  Style,
  Mark,
  NamedTea,
  WisdomEntryKind,
  CitationUsage,
  ResearchSourceKind,
  ResearchSource,
  PublicResearchSource,
  WisdomCitation,
  WisdomPotentialProfile,
} from './types';

/** What the wisdom base knows about a tea, and where each part came from. */
export interface TeaResolution {
  type: TeaType | null;
  form: TeaForm | null;
  variety: TeaVarietyMatch | null;
  cultivar: Cultivar | null;
  /** Who made it. Not the vendor a shop bought from. */
  producer: Producer | null;
  /** How it was made or pressed, when that is not just a form. */
  style: Style | null;
  /** The recipe number, seal or label it carries. */
  mark: Mark | null;
  /** A tea known by the name it was given, where composition is undisclosed. */
  namedTea: NamedTea | null;
  region: Region | null;
  country: string | null;
  year: number | null;
  /** Which fields were answered by the wisdom base rather than the record. */
  derived: string[];
  /**
   * True when the base can say at least one thing about this tea that the
   * record did not already carry. A shop's own name for a tea ("Courage") is
   * never going to resolve to a shared entry, and should not, but its maker,
   * style, plant or place still can.
   */
  recognized: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

const FORM_HINTS: Array<[RegExp, TeaForm]> = [
  [/\b(cake|beeng|bing)\b|饼|餅/i, 'Cake'],
  [/\bbrick\b|砖|磚/i, 'Brick'],
  [/\b(tuo|tuocha)\b|沱/i, 'Tuo'],
  [/\b(dragon ?ball|long zhu)\b|龙珠|龍珠/i, 'Ball'],
  [/\b(tea ?bag|sachet)\b|袋泡/i, 'Bag'],
  [/\b(loose|loose ?leaf|mao ?cha)\b|散茶/i, 'Loose'],
];

function yearFrom(text: string): number | null {
  for (const token of text.match(/\d{4}/g) ?? []) {
    const year = Number(token);
    if (year >= 1950 && year <= CURRENT_YEAR + 1) return year;
  }
  return null;
}

export interface TeaQuery {
  names: Array<string | null | undefined>;
  /** Values the record already carries. These always win over derived ones. */
  known?: { type?: string | null; form?: string | null; region?: string | null; country?: string | null; year?: number | string | null };
}

/**
 * Reads everything the wisdom base can say about a tea from its names.
 * Values the record already carries are kept as-is and reported untouched, so a
 * caller can safely fill only what is blank.
 */
export function resolveTea({ names, known = {} }: TeaQuery): TeaResolution {
  const text = names.filter(Boolean).join(' ');
  const derived: string[] = [];
  const noteDerived = <T>(field: string, value: T): T => { if (value != null) derived.push(field); return value; };

  const variety = matchTeaVariety(...names);
  const cultivar = matchCultivar(...names);
  const producer = matchProducer(...names);
  const style = matchStyle(...names);
  const mark = matchMark(...names);
  const namedTea = matchNamedTea(...names);

  const knownType = normalizeTeaType(known.type);
  const type = knownType ?? noteDerived('type', variety ? normalizeTeaType(variety.type) : null);

  const knownForm = normalizeTeaForm(known.form);
  const form = knownForm ?? noteDerived('form', FORM_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? null);

  const knownRegion = findRegion(known.region);
  const region = knownRegion
    ?? noteDerived('region', findRegion(variety?.region) ?? (cultivar?.originRegion ? findRegion(cultivar.originRegion) : null));

  const country = known.country?.trim()
    || noteDerived('country', region?.country ?? countryForRegion(variety?.region) ?? cultivar?.originCountry ?? null);

  const knownYear = known.year == null || known.year === '' ? null : Number(known.year);
  const year = Number.isFinite(knownYear) && knownYear ? knownYear : noteDerived('year', yearFrom(text));

  if (cultivar && !known.type) derived.push('cultivar');
  if (producer) derived.push('producer');
  if (style) derived.push('style');
  if (mark) derived.push('mark');
  if (namedTea) derived.push('namedTea');

  return {
    type, form, variety, cultivar, producer, style, mark, namedTea,
    region, country: country || null, year, derived,
    // Parsing a year out of a name is not knowledge. Matching a known entity is.
    recognized: Boolean(variety || cultivar || producer || style || mark || namedTea || region),
  };
}

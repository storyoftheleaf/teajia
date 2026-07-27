/**
 * The tea wisdom base. One answer to "what is this tea", read by every surface.
 *
 * Import, capture, inventory, the shop, and the public reference all call
 * `resolveTea`. When a record here improves, every one of them improves the
 * same day, because none of them keeps its own copy.
 */
import { matchTeaVariety, type TeaVarietyMatch } from '../data/teaVarieties';
import { matchCultivar } from './cultivars';
import { countryForRegion, findRegion } from './regions';
import { normalizeTeaForm, normalizeTeaType, type TeaForm, type TeaType } from './vocabulary';
import type { Cultivar, Region } from './types';

export * from './vocabulary';
export * from './regions';
export * from './cultivars';
export type { Cultivar, Region, CultivarStory } from './types';

/** What the wisdom base knows about a tea, and where each part came from. */
export interface TeaResolution {
  type: TeaType | null;
  form: TeaForm | null;
  variety: TeaVarietyMatch | null;
  cultivar: Cultivar | null;
  region: Region | null;
  country: string | null;
  year: number | null;
  /** Which fields were answered by the wisdom base rather than the record. */
  derived: string[];
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
  const mark = <T>(field: string, value: T): T => { if (value != null) derived.push(field); return value; };

  const variety = matchTeaVariety(...names);
  const cultivar = matchCultivar(...names);

  const knownType = normalizeTeaType(known.type);
  const type = knownType ?? mark('type', variety ? normalizeTeaType(variety.type) : null);

  const knownForm = normalizeTeaForm(known.form);
  const form = knownForm ?? mark('form', FORM_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? null);

  const knownRegion = findRegion(known.region);
  const region = knownRegion
    ?? mark('region', findRegion(variety?.region) ?? (cultivar?.originRegion ? findRegion(cultivar.originRegion) : null));

  const country = known.country?.trim()
    || mark('country', region?.country ?? countryForRegion(variety?.region) ?? cultivar?.originCountry ?? null);

  const knownYear = known.year == null || known.year === '' ? null : Number(known.year);
  const year = Number.isFinite(knownYear) && knownYear ? knownYear : mark('year', yearFrom(text));

  if (cultivar && !known.type) derived.push('cultivar');

  return { type, form, variety, cultivar, region, country: country || null, year, derived };
}

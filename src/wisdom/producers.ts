import { MARKS } from './generated/marks';
import { PRODUCERS } from './generated/producers';
import { STYLES } from './generated/styles';
import type { Mark, Producer, Style } from './types';

export { PRODUCERS, STYLES, MARKS };

/**
 * Who made a tea, how it was made, and which line it belongs to.
 *
 * These are the three things a puerh or dark tea record almost always names and
 * the base previously had no concept of. "7572 Menghai" is not a plant variety
 * and never will be: it is a recipe mark made by a factory. Until this existed,
 * a third of Adrian's own shelf resolved to nothing.
 */

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, '');
/** Latin names need real length before containment is trustworthy; CJK does not. */
const longEnough = (value: string) => (/[㐀-鿿]/.test(value) ? value.length >= 2 : value.length >= 4);

/** Containment that will not cut a number in half, so 7572 never matches inside 75720. */
function containsWholeToken(candidate: string, key: string): boolean {
  const digit = /\d/;
  for (let from = 0; ; from += 1) {
    const at = candidate.indexOf(key, from);
    if (at < 0) return false;
    const before = at > 0 ? candidate[at - 1] : '';
    const after = candidate[at + key.length] ?? '';
    const cuts = (digit.test(key[0]) && digit.test(before)) || (digit.test(key[key.length - 1]) && digit.test(after));
    if (!cuts) return true;
    from = at;
  }
}

interface Named { name: string; chineseName?: string; altNames: string[] }

/** One alias index shape, reused for all three entities rather than written three times. */
function buildIndex<T extends Named>(entries: T[]): Array<{ key: string; entry: T }> {
  return entries
    .flatMap(entry => [entry.name, entry.chineseName, ...entry.altNames]
      .filter((alias): alias is string => Boolean(alias))
      .map(alias => ({ key: matchKey(alias), entry })))
    .filter(alias => longEnough(alias.key))
    .sort((left, right) => right.key.length - left.key.length);
}

function matchIn<T extends Named>(index: Array<{ key: string; entry: T }>, names: Array<string | null | undefined>): T | null {
  const keys = names.map(name => (name ? matchKey(name) : '')).filter(Boolean);
  if (!keys.length) return null;
  for (const { key, entry } of index) {
    if (keys.some(candidate => containsWholeToken(candidate, key))) return entry;
  }
  return null;
}

const PRODUCER_INDEX = buildIndex(PRODUCERS);
const STYLE_INDEX = buildIndex(STYLES);
const MARK_INDEX = buildIndex(MARKS);

const PRODUCER_BY_ID = new Map(PRODUCERS.map(entry => [entry.id, entry]));
const STYLE_BY_ID = new Map(STYLES.map(entry => [entry.id, entry]));
const MARK_BY_ID = new Map(MARKS.map(entry => [entry.id, entry]));

export const findProducerById = (id: string | null | undefined): Producer | null => (id ? PRODUCER_BY_ID.get(id) ?? null : null);
export const findStyleById = (id: string | null | undefined): Style | null => (id ? STYLE_BY_ID.get(id) ?? null : null);
export const findMarkById = (id: string | null | undefined): Mark | null => (id ? MARK_BY_ID.get(id) ?? null : null);

/** The factory, house or brand named in a tea's own names, or null. */
export const matchProducer = (...names: Array<string | null | undefined>): Producer | null => matchIn(PRODUCER_INDEX, names);

/** The way a tea was made or pressed, when its names say so. */
export const matchStyle = (...names: Array<string | null | undefined>): Style | null => matchIn(STYLE_INDEX, names);

/** The recipe number, seal or label a tea's names carry. */
export const matchMark = (...names: Array<string | null | undefined>): Mark | null => matchIn(MARK_INDEX, names);

/** Marks a producer is known for, resolved to entries we hold. */
export const marksOf = (producer: Producer): Mark[] =>
  MARKS.filter(mark => mark.producerId === producer.id);

/** Every tea line we hold for a producer, including ones only named in its own record. */
export function markNamesOf(producer: Producer): string[] {
  const held = marksOf(producer).map(mark => mark.name);
  const extra = producer.notableMarks.filter(name => !held.some(entry => matchKey(entry) === matchKey(name)));
  return [...held, ...extra];
}

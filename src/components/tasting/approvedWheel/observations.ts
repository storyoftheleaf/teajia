import taxonomy from '../../../data/teajia-tasting-taxonomy.json';
import type { TastingData } from '../../../types';
import type { WheelNote } from './TeaWheel';
import { families } from './families';

export type WheelSense = 'taste' | 'aroma';
const terms = taxonomy.categories.find(category => category.id === 'flavor')!.groups.flatMap(group => group.terms.map(term => ({ ...term, group: group.label })));
const aliases: Record<string, string> = { smoky: 'Smoke', mineral: 'Mineral-like' };
const names = [...families.flatMap(family => [family.name, ...family.notes]), 'Earthy', 'Mineral-like'];
const slug = (word: string) => word.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const idToName = new Map(names.map(name => [slug(name), name]));
for (const term of terms) idToName.set(term.id, aliases[term.id] || term.label);
const nameToId = new Map([...idToName].map(([id, name]) => [name.toLowerCase(), id]));
export const tastingWordLabel = (id: string): string => idToName.get(id) || names.find(name => name.toLowerCase() === id.toLowerCase()) || id;
export const tastingWordId = (word: string): string => nameToId.get(word.toLowerCase()) || slug(word);
const groupAliases: Record<string, string> = {
  Sweet: 'Sweet & creamy', Fruity: 'Fresh fruit', 'Stone fruit': 'Fresh fruit',
  'Nutty & grain': 'Nuts & grain', 'Roasted & warm': 'Roast & cocoa',
  Spice: 'Herbs & spice', Woody: 'Wood & resin', Earthy: 'Earth & fungi',
  Mineral: 'Stone & metal', 'Mineral-like': 'Stone & metal', 'Fresh & vegetal': 'Vegetal',
};
export function tastingWordFamily(word: string): string | undefined {
  const direct = families.find(family => family.name === word || family.notes.includes(word));
  if (direct) return direct.name;
  const term = terms.find(term => term.id === tastingWordId(word));
  return groupAliases[word] || (term && (groupAliases[term.group] || term.group));
}
export function wheelNotes(value: TastingData): WheelNote[] {
  const taste = new Set((value.flavor || []).map(tastingWordLabel));
  const aroma = new Set((value.aroma || []).map(tastingWordLabel));
  return [...new Set([...taste, ...aroma])].map(name => ({name, group: tastingWordFamily(name) || '', taste: taste.has(name), aroma: aroma.has(name)}));
}
export function toggleWheelObservation(value: TastingData, word: string, sense: WheelSense): TastingData {
  const field = sense === 'taste' ? 'flavor' : 'aroma';
  const intensityField = sense === 'taste' ? 'tasteIntensities' : 'aromaIntensities';
  const values = value[field] || [];
  const selected = values.some(id => tastingWordLabel(id) === word);
  const next = selected ? values.filter(id => tastingWordLabel(id) !== word) : [...values, tastingWordId(word)];
  const intensities = { ...value[intensityField] };
  if (selected) for (const id of Object.keys(intensities)) if (tastingWordLabel(id) === word) delete intensities[id];
  return { ...value, [field]: next, ...(value[intensityField] ? { [intensityField]: intensities } : {}) };
}

// The small rules of the pour page (PourView.tsx), kept apart so they can be
// checked without a browser.

export type PourTea = {
  id: string; name: string; product_name: string | null; chinese_name: string | null; type: string | null; classification: string | null;
  year: number | null; image_url: string | null; stock_grams: number | null; status: string | null;
  created_at: string | null; sample: number;
  /** What a gram sells for on the shelf, in US dollars; null where it is not known. */
  price_per_gram?: number | null;
};
export type PouredTea = {
  id: string; product_id: string | null; name: string; grams: number | null; short: boolean;
  image_url: string | null; stock_grams: number | null;
};
export type PourSit = {
  id: string; title: string; date: string; timezone: string | null; casual: boolean; happened: boolean;
  link: string | null; note: string | null; place: { id: string; name: string | null } | null;
  has_way: boolean; way_open: boolean; teas: PouredTea[];
};

/** The day on this phone's own calendar, as the sit keeps it. */
export function localDay(now: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/**
 * One key on the number pad. Digits and one decimal point, one place after
 * it, four digits before it; a leading point reads "0.".
 */
export function addKey(typed: string, key: string): string {
  if (key === 'back') return typed.slice(0, -1);
  if (key === '.') return typed.includes('.') ? typed : `${typed || '0'}.`;
  if (!/^\d$/.test(key)) return typed;
  const [whole, part] = typed.split('.');
  if (part !== undefined) return part.length >= 1 ? typed : typed + key;
  if (whole === '0') return key;
  return whole.length >= 4 ? typed : typed + key;
}

/** The weight typed, or null while there is none to enter. */
export function gramsOf(typed: string): number | null {
  const value = Number(typed);
  return typed !== '' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * A kind the Wisdom Base names inside a family (Liu Bao, Lapsang Souchong,
 * yancha), found on the shelf by the words in a tea's own names.
 */
export type NamedKind = { label: string; needles: string[] };

const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’'\-]/g, '').replace(/\s+/g, ' ').trim();

/** The named kinds, from the Wisdom Base's own pages of kind `tea_type`. */
export function namedKindsFrom(pages: readonly { kind: string; label: string; nativeName?: string }[]): NamedKind[] {
  return pages.filter(page => page.kind === 'tea_type').map(page => {
    const split = /^(.*?)\s*\((.*)\)\s*$/.exec(page.label);
    const names = split ? [split[1], split[2]] : [page.label];
    return { label: names[0], needles: [...names.map(fold), page.nativeName ?? ''].filter(Boolean) };
  });
}

const namesOf = (tea: PourTea) => fold([tea.name, tea.product_name, tea.chinese_name, tea.classification].filter(Boolean).join(' '));

/** A tea's kinds: its type, then every named kind its names carry. */
function kindsOfTea(tea: PourTea, named: readonly NamedKind[]): string[] {
  const type = tea.type?.trim();
  const names = namesOf(tea);
  return [
    ...(type && type !== 'MISSING_TYPE' ? [type] : []),
    ...named.filter(kind => kind.needles.some(needle => names.includes(needle))).map(kind => kind.label),
  ];
}

/**
 * Every kind on the shelf as a button: the types, then the named kinds, each
 * with the most teas first. A named kind that only repeats a type (Shou beside
 * Shou Puer) is left out.
 */
export function kindsOf(teas: PourTea[], named: readonly NamedKind[] = []): string[] {
  const types = new Map<string, number>();
  for (const tea of teas) {
    const type = tea.type?.trim();
    if (type && type !== 'MISSING_TYPE') types.set(type, (types.get(type) ?? 0) + 1);
  }
  const foldedTypes = [...types.keys()].map(fold);
  const fresh = named.filter(kind => !foldedTypes.some(type => type.includes(fold(kind.label)) || fold(kind.label).includes(type)));
  const families = new Map<string, number>();
  for (const tea of teas) for (const kind of kindsOfTea(tea, fresh).slice(tea.type?.trim() && tea.type !== 'MISSING_TYPE' ? 1 : 0)) {
    families.set(kind, (families.get(kind) ?? 0) + 1);
  }
  const byCount = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([kind]) => kind);
  return [...byCount(types), ...byCount(families)];
}

export function matchesTea(tea: PourTea, kind: string, query: string, named: readonly NamedKind[] = []): boolean {
  if (kind && !kindsOfTea(tea, named).includes(kind)) return false;
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const text = fold([tea.name, tea.product_name, tea.chinese_name, tea.type, tea.classification, tea.year].filter(Boolean).join(' '));
  return words.every(word => text.includes(word));
}

/** How many teas each kind holds, in the order of kindsOf. */
export function kindCounts(teas: PourTea[], named: readonly NamedKind[] = []): { kind: string; count: number }[] {
  return kindsOf(teas, named).map(kind => ({ kind, count: teas.filter(tea => matchesTea(tea, kind, '', named)).length }));
}

/** Lowest price of a gram first; a tea with no price goes last, then by name. */
export function byPrice(teas: PourTea[]): PourTea[] {
  const price = (tea: PourTea) => (typeof tea.price_per_gram === 'number' ? tea.price_per_gram : Infinity);
  return [...teas].sort((a, b) => price(a) - price(b) || a.name.localeCompare(b.name));
}

/** The price of a gram as the page prints it: a dash where it is not known. */
export function pricePerGram(tea: PourTea): string {
  return typeof tea.price_per_gram === 'number' ? '$' + tea.price_per_gram.toFixed(2) + '/g' : '–';
}

/** The sit a pour on this day joins: the one made here for that day, else a session of that day. */
export function sitForDay(sits: PourSit[], day: string): PourSit | null {
  const onDay = sits.filter(sit => sit.date.slice(0, 10) === day);
  return onDay.find(sit => sit.casual) ?? onDay[0] ?? null;
}

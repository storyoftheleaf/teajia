/**
 * The logic behind Curate v2's new surfaces, kept out of the components so it
 * can be asked directly: what is waiting on Today, how a price reads the way the
 * vendor quoted it, and the fast tasting.
 *
 * The fast tasting writes ONLY into the full tasting's own fields and ids
 * (src/data/teajia-tasting-taxonomy.json, and TastingData's `cleanliness` and
 * `quality`), so a fast tasting is the first layer of a full one and the two can
 * never disagree. Nothing here invents a term.
 */
import type { TastingData } from '../../types';
import { currencyInText } from '../../lib/currency';
import type { Currency } from '../../admin/types';
import type { TeaCompassEntry } from './types';

// ── Today ────────────────────────────────────────────────────────────────

export type TodayAction = 'taste' | 'decide' | 'add-cost' | 'shelf';

export interface TodayItem {
  entryId: string;
  name: string;
  /** Who it is from, or what it is, in one or two words. */
  who: string;
  action: TodayAction;
}

const ACTION_ORDER: Record<TodayAction, number> = { taste: 0, decide: 1, 'add-cost': 2, shelf: 3 };

export function hasTasting(t: TastingData | undefined): boolean {
  if (!t) return false;
  return t.quality != null
    || !!t.cleanliness
    || (t.flavor?.length ?? 0) > 0
    || (t.body?.length ?? 0) > 0
    || (t.finish?.length ?? 0) > 0
    || (t.feeling?.length ?? 0) > 0;
}

/**
 * What needs Adrian, one item per tea, the most pressing reason only.
 * A tea he passed on never asks for anything.
 */
export function todayItems(entries: readonly TeaCompassEntry[]): TodayItem[] {
  const items: TodayItem[] = [];
  for (const e of entries) {
    if (e.decision === 'passed_on' || e.status === 'pass' || e.status === 'depleted') continue;
    const name = e.name?.trim() || 'Untitled tea';
    const vendor = e.vendorName?.trim() || '';
    let action: TodayAction | null = null;
    let who = vendor;
    if (e.sampleState === 'received') { action = 'taste'; who = 'sample'; }
    else if (e.status === 'in_stock' && !e.draftProductId) { action = 'shelf'; who = 'arrived'; }
    else if (hasTasting(e.tasting) && (e.decision == null || e.decision === 'considering') && e.status !== 'buying' && e.status !== 'incoming') action = 'decide';
    else if (e.category === 'tea' && e.priceAmount == null && e.status !== 'in_stock' && e.status !== 'incoming') action = 'add-cost';
    if (action) items.push({ entryId: e.id, name, who, action });
  }
  return items.sort((a, b) => ACTION_ORDER[a.action] - ACTION_ORDER[b.action]);
}

export interface TodaySections {
  /** Tasted and waiting for a choice, plus samples that arrived and want tasting. */
  decide: TodayItem[];
  /** Saved without a price. */
  cost: TodayItem[];
  /** Arrived, not yet on the shop shelf. */
  shelve: TodayItem[];
  /** Ordered or being ordered, with how long it has been. */
  onTheWay: Array<{ entryId: string; name: string; vendor: string; days: number | null; ordering: boolean }>;
}

/** Whole days since an ISO time, or null when it is missing or in the future. */
export function daysSince(iso: string | undefined | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  const d = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

/** Today's tea sections, each a different kind of thing; an empty one is simply empty. */
export function todaySections(entries: readonly TeaCompassEntry[], now: number = Date.now()): TodaySections {
  const items = todayItems(entries);
  return {
    decide: items.filter((i) => i.action === 'taste' || i.action === 'decide'),
    cost: items.filter((i) => i.action === 'add-cost'),
    shelve: items.filter((i) => i.action === 'shelf'),
    onTheWay: entries
      .filter((e) => (e.status === 'incoming' || e.status === 'buying') && e.decision !== 'passed_on')
      .map((e) => ({
        entryId: e.id,
        name: e.name?.trim() || 'Untitled tea',
        vendor: e.vendorName?.trim() || '',
        days: daysSince(e.updatedAt, now),
        ordering: e.status === 'buying',
      })),
  };
}

export const TODAY_ACTION_LABEL: Record<TodayAction, string> = {
  taste: 'Taste',
  decide: 'Decide',
  'add-cost': 'Add cost',
  shelf: 'Shelf',
};

// ── Price, the way the vendor said it ────────────────────────────────────

const PIECE_FORMS = ['Cake', 'Brick', 'Tuo'];

/** The unit a price was quoted in: "cake", "jin", "liang", "g", or "100 g". */
export function quotedUnit(entry: Pick<TeaCompassEntry, 'form' | 'pricePerUnitGrams' | 'category'>): string {
  if (entry.category === 'teaware') return 'each';
  if (entry.form && PIECE_FORMS.includes(entry.form)) return entry.form.toLowerCase();
  const g = entry.pricePerUnitGrams;
  if (g === 500) return 'jin';
  if (g === 50) return 'liang';
  if (g === 1) return 'g';
  if (g != null && g > 0) return `${g} g`;
  return '';
}

/** How a vendor might quote a loose tea, as grams per quoted unit. */
export const QUOTE_UNITS: ReadonlyArray<{ id: string; label: string; grams: number }> = [
  { id: 'jin', label: 'per jin · 500 g', grams: 500 },
  { id: 'liang', label: 'per liang · 50 g', grams: 50 },
  { id: '100g', label: 'per 100 g', grams: 100 },
  { id: 'g', label: 'per gram', grams: 1 },
];

// ── Fast tasting ─────────────────────────────────────────────────────────

export type FastQuestion = 'score' | 'clean' | 'drying' | 'weight' | 'flavour' | 'stays';

export interface FastOption { id: string; label: string }

/** Each question's answers, in the full tasting's own ids. */
export const FAST_TASTING: ReadonlyArray<{ q: FastQuestion; label: string; from: string; multi?: boolean; options: FastOption[] }> = [
  { q: 'score', label: 'How good', from: 'score', options: Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), label: String(i + 1) })) },
  { q: 'clean', label: 'How clean', from: 'movement', options: [
    { id: 'clean', label: 'Clean' }, { id: 'some-edge', label: 'Slight edge' }, { id: 'rough', label: 'Rough' },
  ] },
  { q: 'drying', label: 'How drying', from: 'sensation', options: [
    { id: 'none', label: 'None' }, { id: 'finish-dry', label: 'A little' }, { id: 'dry', label: 'Astringent' },
  ] },
  { q: 'weight', label: 'How full', from: 'sensation', options: [
    { id: 'light', label: 'Light' }, { id: 'medium', label: 'Medium' }, { id: 'full', label: 'Full' },
  ] },
  { q: 'flavour', label: 'Tastes of', from: 'flavour', multi: true, options: [
    { id: 'sweet', label: 'Sweet' }, { id: 'floral', label: 'Floral' }, { id: 'fruity', label: 'Fruity' }, { id: 'woody', label: 'Woody' },
    { id: 'earthy', label: 'Earthy' }, { id: 'roasted', label: 'Roasted' }, { id: 'mineral', label: 'Mineral' },
  ] },
  { q: 'stays', label: 'Stays', from: 'movement', options: [
    { id: 'finish-short', label: 'Short' }, { id: 'finish-medium', label: 'Medium' }, { id: 'finish-long', label: 'Long' }, { id: 'lingering', label: 'Lingers' },
  ] },
];

const WEIGHT_IDS = ['light', 'medium', 'full'];
const STAY_IDS = ['finish-short', 'finish-medium', 'finish-long', 'lingering'];

/** The fast tasting's current answers, read from a full tasting. */
export function readFast(t: TastingData | undefined): Record<FastQuestion, string[]> {
  const body = t?.body ?? [];
  const finish = t?.finish ?? [];
  const drying = body.includes('dry') ? ['dry'] : finish.includes('finish-dry') ? ['finish-dry'] : [];
  return {
    score: t?.quality != null ? [String(t.quality)] : [],
    clean: t?.cleanliness ? [t.cleanliness] : [],
    drying,
    weight: body.filter((id) => WEIGHT_IDS.includes(id)).slice(0, 1),
    flavour: (t?.flavor ?? []).filter((id) => FAST_TASTING[4].options.some((o) => o.id === id)),
    stays: finish.filter((id) => STAY_IDS.includes(id)).slice(0, 1),
  };
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const without = (list: string[] | undefined, ids: string[]) => (list ?? []).filter((x) => !ids.includes(x));

/**
 * One tap on one answer. Single-answer questions switch to the tapped answer,
 * or clear it when it is tapped again. Everything else in the tasting (notes,
 * the deeper terms from a full tasting) is left exactly as it was.
 */
export function applyFast(t: TastingData | undefined, q: FastQuestion, id: string): TastingData {
  const next: TastingData = { ...(t ?? {}) };
  const current = readFast(t)[q];
  const clearing = current.includes(id);
  switch (q) {
    case 'score':
      if (clearing) delete next.quality; else next.quality = Number(id);
      break;
    case 'clean':
      if (clearing) delete next.cleanliness; else next.cleanliness = id;
      break;
    case 'drying': {
      const body = without(next.body, ['dry']);
      const finish = without(next.finish, ['finish-dry']);
      if (!clearing && id === 'dry') body.push('dry');
      if (!clearing && id === 'finish-dry') finish.push('finish-dry');
      next.body = body;
      next.finish = finish;
      break;
    }
    case 'weight': {
      const body = without(next.body, WEIGHT_IDS);
      if (!clearing) body.push(id);
      next.body = body;
      break;
    }
    case 'flavour':
      next.flavor = toggle(next.flavor ?? [], id);
      break;
    case 'stays': {
      const finish = without(next.finish, STAY_IDS);
      if (!clearing) finish.push(id);
      next.finish = finish;
      break;
    }
  }
  return next;
}

/** One line for a row: "8 · Clean · Full · Sweet · Long". */
export function tastingLine(t: TastingData | undefined): string {
  if (!t) return '';
  const a = readFast(t);
  const label = (q: FastQuestion, id: string) => FAST_TASTING.find((x) => x.q === q)?.options.find((o) => o.id === id)?.label ?? '';
  const parts: string[] = [];
  if (a.score[0]) parts.push(a.score[0]);
  if (a.clean[0]) parts.push(label('clean', a.clean[0]));
  if (a.weight[0]) parts.push(label('weight', a.weight[0]));
  for (const f of a.flavour.slice(0, 2)) parts.push(label('flavour', f));
  if (a.stays[0]) parts.push(label('stays', a.stays[0]));
  return parts.join(' · ');
}

// ── A price inside the name line ─────────────────────────────────────────

export interface LinePrice {
  amount: number;
  /** The shop's currency key, when the line said which money. Read by the
   *  shop's one currency reader (src/lib/currency.ts); a bare $ says nothing. */
  currency?: string;
  /** What the price is for, the way the vendor said it. */
  unit?: 'jin' | 'liang' | 'g' | '100g' | 'cake' | 'brick' | 'tuo';
  /** "per 150g": the grams the price is for, when the line said a number. */
  grams?: number;
  /** The line with the price taken out. */
  rest: string;
}

const UNIT_WORDS: Array<[RegExp, LinePrice['unit']]> = [
  [/^(?:jin|斤)$/i, 'jin'],
  [/^(?:liang|两)$/i, 'liang'],
  [/^(?:100\s?g|100\s?grams?)$/i, '100g'],
  [/^(?:g|gram|grams|克)$/i, 'g'],
  [/^(?:cake|cakes|bing|饼)$/i, 'cake'],
  [/^(?:brick|bricks|砖)$/i, 'brick'],
  [/^(?:tuo|沱)$/i, 'tuo'],
];

/**
 * Reads "¥450/cake", "380 a jin", "NT$1800 per 150g" out of a typed or spoken
 * line. A number counts as a price only when it carries a currency mark or a
 * unit, so a year ("2018") or a count in a name is never read as one.
 */
export function readLinePrice(line: string): LinePrice | null {
  const re = /(nt\$|hk\$|cn¥|¥|￥|\$|rmb|cny|usd|ntd|nt|hkd)?\s?(\d[\d,]*(?:\.\d+)?)\s?(元|块|yuan|rmb)?\s*(?:\/|per|a|each|for|一)?\s*(\d+\s?g(?:rams?)?|jin|斤|liang|两|grams?|g|克|cakes?|bing|饼|bricks?|砖|tuo|沱)?(?![\w])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [whole, pre, num, post, unitWord] = m;
    if (!pre && !post && !unitWord) continue;
    const amount = Number(num.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const mark = (pre || post || '').trim();
    const currency = mark ? currencyInText(mark) ?? undefined : undefined;
    const gramsMatch = unitWord ? /^(\d+)\s?g/i.exec(unitWord.trim()) : null;
    const grams = gramsMatch ? Number(gramsMatch[1]) : undefined;
    const unit = gramsMatch ? undefined : unitWord ? UNIT_WORDS.find(([r]) => r.test(unitWord.trim()))?.[1] : undefined;
    if (!currency && !unit && !grams) continue;
    const rest = (line.slice(0, m.index) + ' ' + line.slice(m.index + whole.length)).replace(/\s{2,}/g, ' ').trim();
    return { amount, currency, unit, grams, rest };
  }
  return null;
}

/** The entry fields a line price writes, in the shapes Curate already uses. */
export function linePriceFields(p: LinePrice): { priceAmount: number; priceCurrency?: Currency; pricePerUnitGrams?: number; form?: 'Cake' | 'Brick' | 'Tuo' } {
  const out: ReturnType<typeof linePriceFields> = { priceAmount: p.amount };
  if (p.currency) out.priceCurrency = p.currency as Currency;
  if (p.grams) out.pricePerUnitGrams = p.grams;
  switch (p.unit) {
    case 'jin': out.pricePerUnitGrams = 500; break;
    case 'liang': out.pricePerUnitGrams = 50; break;
    case '100g': out.pricePerUnitGrams = 100; break;
    case 'g': out.pricePerUnitGrams = 1; break;
    case 'cake': out.form = 'Cake'; break;
    case 'brick': out.form = 'Brick'; break;
    case 'tuo': out.form = 'Tuo'; break;
  }
  return out;
}

// ── An order line's price ────────────────────────────────────────────────

/**
 * The price an order line multiplies by its amount. A loose tea's price is
 * quoted for `pricePerUnitGrams` grams (¥120 for 100 g), so the line needs the
 * price of ONE gram; the line used to take the whole quote and multiply it by
 * grams, so 250 g at ¥120 per 100 g came out at ¥30,000 instead of ¥300.
 * A cake, a brick, a tuo or a piece of teaware is priced per piece as quoted.
 */
export function orderLinePrice(entry: Pick<TeaCompassEntry, 'priceAmount' | 'pricePerUnitGrams' | 'form' | 'category'>): { pricePerUnit: number; priceIsPerGram: boolean } {
  const amount = entry.priceAmount ?? 0;
  const pieces = entry.category === 'teaware' || (!!entry.form && PIECE_FORMS.includes(entry.form));
  if (pieces || !entry.pricePerUnitGrams || entry.pricePerUnitGrams <= 0) {
    return { pricePerUnit: amount, priceIsPerGram: false };
  }
  return { pricePerUnit: amount / entry.pricePerUnitGrams, priceIsPerGram: true };
}

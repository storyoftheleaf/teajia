/**
 * The arithmetic of where a tea's stock is kept, shared by the worker
 * (worker/src/stockPlaces.ts, which owns the rules and the database) and
 * Manage's stock panel, so both read the same split from the same numbers.
 * The one number is the tea's total; the places only divide it.
 */

export interface StockPlace { id: string; name: string; position: number }
export interface PlacedAmount { place_id: string; name: string; amount: number }
export interface StockSplit { total: number; places: PlacedAmount[]; not_placed: number }
export type SplitRefusal = { error: 'place_short' | 'over_total' | 'unknown_place' | 'bad_amount'; message: string; available?: number };

/** Grams may be decimals; keep sums clean of floating point dust. */
export const clean = (n: number) => Math.round(n * 1000) / 1000;

export const stockColumn = (type: string | null | undefined): 'stock_grams' | 'quantity_units' =>
  type === 'Teaware' ? 'quantity_units' : 'stock_grams';

export const isRefusal = (value: unknown): value is SplitRefusal =>
  !!value && typeof value === 'object' && 'error' in value;

const word = (unit: 'g' | 'unit') => (unit === 'g' ? 'g' : ' pieces');

/**
 * The split as it stands against `total`. Places come in the shop's order;
 * amounts held at an archived or unknown place fall back to "not placed".
 */
export function fitSplit(total: number, places: StockPlace[], stored: Map<string, number>): StockSplit {
  const whole = Math.max(0, Number(total) || 0);
  const rows = places.map(place => ({ place_id: place.id, name: place.name, amount: Math.max(0, Number(stored.get(place.id) ?? 0)) }));
  let excess = clean(rows.reduce((sum, row) => sum + row.amount, 0) - whole);
  for (const row of rows) {
    if (excess <= 0) break;
    const take = Math.min(row.amount, excess);
    row.amount = clean(row.amount - take);
    excess = clean(excess - take);
  }
  const placed = clean(rows.reduce((sum, row) => sum + row.amount, 0));
  return { total: whole, places: rows, not_placed: clean(whole - placed) };
}

/** A movement at one place: the total and that place move by the same `delta`. */
export function shiftPlace(split: StockSplit, placeId: string, delta: number, unit: 'g' | 'unit' = 'g'): StockSplit | SplitRefusal {
  const at = split.places.find(row => row.place_id === placeId);
  if (!at) return { error: 'unknown_place', message: 'That place is not one of this shop\'s places.' };
  const next = clean(at.amount + delta);
  if (next < 0) return { error: 'place_short', message: `${at.name} has only ${at.amount}${word(unit)} of this tea.`, available: at.amount };
  return {
    total: clean(split.total + delta),
    places: split.places.map(row => (row.place_id === placeId ? { ...row, amount: next } : row)),
    not_placed: split.not_placed,
  };
}

/** Move stock from one place to another; null is "not placed yet". The total does not change. */
export function moveBetween(split: StockSplit, from: string | null, to: string | null, amount: number, unit: 'g' | 'unit' = 'g'): StockSplit | SplitRefusal {
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'bad_amount', message: 'Say how much to move, more than 0.' };
  if (from === to) return { error: 'bad_amount', message: 'Those are the same place.' };
  const fromRow = from ? split.places.find(row => row.place_id === from) : null;
  const toRow = to ? split.places.find(row => row.place_id === to) : null;
  if ((from && !fromRow) || (to && !toRow)) return { error: 'unknown_place', message: 'That place is not one of this shop\'s places.' };
  const available = fromRow ? fromRow.amount : split.not_placed;
  if (clean(amount - available) > 0) {
    return { error: 'place_short', message: `${fromRow ? fromRow.name : 'Not placed yet'} has only ${available}${word(unit)} of this tea.`, available };
  }
  const places = split.places.map(row => {
    if (row.place_id === from) return { ...row, amount: clean(row.amount - amount) };
    if (row.place_id === to) return { ...row, amount: clean(row.amount + amount) };
    return row;
  });
  const placed = clean(places.reduce((sum, row) => sum + row.amount, 0));
  return { total: split.total, places, not_placed: clean(split.total - placed) };
}

/** Set how much is at each named place; whatever is left is "not placed yet". The total does not change. */
export function setAmounts(split: StockSplit, amounts: Array<{ place_id: string; amount: number }>, unit: 'g' | 'unit' = 'g'): StockSplit | SplitRefusal {
  const wanted = new Map<string, number>();
  for (const entry of amounts) {
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount < 0 || (unit === 'unit' && !Number.isInteger(amount))) {
      return { error: 'bad_amount', message: unit === 'unit' ? 'Each place holds a whole number of pieces, 0 or more.' : 'Each place holds 0 g or more.' };
    }
    if (!split.places.some(row => row.place_id === entry.place_id)) return { error: 'unknown_place', message: 'That place is not one of this shop\'s places.' };
    wanted.set(entry.place_id, amount);
  }
  const places = split.places.map(row => (wanted.has(row.place_id) ? { ...row, amount: clean(wanted.get(row.place_id)!) } : row));
  const placed = clean(places.reduce((sum, row) => sum + row.amount, 0));
  if (placed - split.total > 0) {
    return { error: 'over_total', message: `That is ${placed}${word(unit)} in all, more than the ${split.total}${word(unit)} in stock. Count the tea instead if the total is wrong.`, available: split.total };
  }
  return { total: split.total, places, not_placed: clean(split.total - placed) };
}


/**
 * A count at one place: "the studio has 462 g". When the place holds more
 * than before, the difference comes out of "not placed yet" first, since that
 * stock was somewhere and here is where it was found; only what is beyond it
 * adds to the total. When it holds less, the total drops by the difference.
 */
export function countAtPlace(split: StockSplit, placeId: string, counted: number, unit: 'g' | 'unit' = 'g'): StockSplit | SplitRefusal {
  const at = split.places.find(row => row.place_id === placeId);
  if (!at) return { error: 'unknown_place', message: 'That place is not one of this shop\'s places.' };
  if (!Number.isFinite(counted) || counted < 0 || (unit === 'unit' && !Number.isInteger(counted))) {
    return { error: 'bad_amount', message: unit === 'unit' ? 'Count whole pieces, 0 or more.' : 'Count 0 g or more.' };
  }
  const gain = clean(counted - at.amount);
  const drawn = gain > 0 ? Math.min(gain, split.not_placed) : 0;
  const places = split.places.map(row => (row.place_id === placeId ? { ...row, amount: clean(counted) } : row));
  return { total: clean(split.total + gain - drawn), places, not_placed: clean(split.not_placed - drawn) };
}

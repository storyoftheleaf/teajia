import { canonicalCurrency } from '../../src/lib/currency';
import { COMPASS_COLUMNS, COMPASS_JSON_COLUMNS, decodeCompassWrite, type CompassColumn } from './compassCodec';

/**
 * A save from a device changes only the fields that device changed.
 *
 * Curate used to sync whole records, last write wins: a phone that loaded a tea
 * yesterday and edits its note today sent back yesterday's price and name too,
 * undoing what the laptop or an agent changed in between. A current browser now
 * sends, beside the whole record, which fields it changed since its last
 * acknowledged save, what each one held before the first of those edits (the
 * base), and when it was last edited on the device:
 *
 *   { entries: [...], changes: { [id]: { fields, base, edited_at } } }
 *
 * For an entry that already exists on the server, only those fields are
 * written. A field the server ALSO changed since the device's copy (its stored
 * value no longer equals the device's base) goes to the later edit: the
 * device's edit time against the row's `updated_at`. Everything else keeps the
 * server's current value, however old the device's copy is.
 *
 * Without `changes` (a browser still running an older bundle) the request is
 * handled exactly as before, so nothing here runs. A new entry is created from
 * the whole record whatever the hint says, because there is nothing to merge
 * into. The hint lives beside `entries`, not inside them, so a server that has
 * not been deployed yet ignores it instead of refusing an unknown field.
 */
export interface CompassFieldHint {
  fields: string[];
  base: Record<string, unknown>;
  editedAt: Record<string, number>;
}

/** Never taken from a device in a field patch: identity and the server's own
 * timestamps. The product link is NOT in this list: a device that set it says
 * so like any other field, and `keepServerDraftProductLink` (run after the
 * patch) decides whether that link is allowed. Dropping it here would lose the
 * first link a graduated sample or "Develop in Curate" gives an existing tea. */
const SERVER_OWNED = new Set(['id', 'user_id', 'account_id', 'created_at', 'updated_at']);
const COLUMNS = new Set<string>(COMPASS_COLUMNS);

export function readCompassFieldHints(raw: unknown): Map<string, CompassFieldHint> | { error: string } {
  const hints = new Map<string, CompassFieldHint>();
  if (raw === undefined || raw === null) return hints;
  const malformed = { error: 'changes must map each entry id to { fields, base, edited_at }' };
  if (typeof raw !== 'object' || Array.isArray(raw)) return malformed;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return malformed;
    const { fields, base = {}, edited_at: editedAtRaw = {} } = value as Record<string, unknown>;
    if (!Array.isArray(fields) || fields.some(field => typeof field !== 'string')) return malformed;
    if (!base || typeof base !== 'object' || Array.isArray(base)) return malformed;
    if (!editedAtRaw || typeof editedAtRaw !== 'object' || Array.isArray(editedAtRaw)) return malformed;
    const editedAt: Record<string, number> = {};
    for (const [field, at] of Object.entries(editedAtRaw as Record<string, unknown>)) {
      const time = typeof at === 'string' ? Date.parse(at) : NaN;
      if (Number.isFinite(time)) editedAt[field] = time;
    }
    hints.set(id, { fields: fields as string[], base: base as Record<string, unknown>, editedAt });
  }
  return hints;
}

/** `updated_at` is written as ISO by the app and as SQLite's
 * `datetime('now')` (UTC, no zone) by the given-name triggers. */
export function compassServerTime(value: unknown): number {
  if (typeof value !== 'string' || !value) return NaN;
  const sqlite = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value);
  return Date.parse(sqlite ? `${value.replace(' ', 'T')}Z` : value);
}

/** What a browser shows for an empty server value. `toCamelCase` fills these
 * in on the way down, so a device's base of '' or 'Yuan' can be the same fact
 * as a stored NULL, and must not read as somebody having changed it. */
const SHOWN_AS_EMPTY: Partial<Record<string, unknown[]>> = {
  name: [''], notes: [''], quantity: [1], status: ['noted'], category: ['tea'], price_currency: ['Yuan'],
};

function comparable(column: string, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (COMPASS_JSON_COLUMNS.has(column)) {
    let parsed = value;
    if (typeof value === 'string') {
      if (!value.trim()) return null;
      try { parsed = JSON.parse(value); } catch { return value; }
    }
    if (parsed == null) return null;
    if (Array.isArray(parsed) && parsed.length === 0) return null;
    if (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0) return null;
    return stableJson(parsed);
  }
  let next: unknown = value;
  if (column === 'price_currency' && typeof value === 'string') next = canonicalCurrency(value);
  if ((SHOWN_AS_EMPTY[column] ?? []).some(empty => empty === next || (typeof empty === 'number' && next !== '' && Number(next) === empty))) return null;
  if (typeof next === 'number') return next;
  if (typeof next === 'string' && next.trim() !== '' && Number.isFinite(Number(next))) return Number(next);
  return next;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sameStoredCompassValue(column: string, a: unknown, b: unknown): boolean {
  return comparable(column, a) === comparable(column, b);
}

const MISSING = Symbol('missing');

/** The device's base, read through the same codec its value went through. */
function decodedBase(column: CompassColumn, hint: CompassFieldHint): unknown {
  if (!Object.prototype.hasOwnProperty.call(hint.base, column)) return MISSING;
  try {
    const decoded = decodeCompassWrite({ [column]: hint.base[column] ?? null }, false);
    return 'values' in decoded ? decoded.values[column] ?? null : MISSING;
  } catch { return MISSING; }
}

const AMOUNTS = ['price_amount', 'buy_total'] as const;
const CURRENCY = 'price_currency';

/**
 * Restrict a decoded whole record to the fields the device changed, resolving
 * fields both sides changed by the later edit. Returns the values to write
 * (empty when nothing is left to change) and the fields where the server's
 * newer value was kept.
 */
export function compassFieldPatch(
  values: Partial<Record<CompassColumn, unknown>>,
  hint: CompassFieldHint,
  existing: Record<string, unknown>,
  now: string,
): { values: Partial<Record<CompassColumn, unknown>>; keptServer: string[] } {
  const touched = new Set(hint.fields.filter(field => COLUMNS.has(field) && !SERVER_OWNED.has(field)));
  const serverAt = compassServerTime(existing.updated_at);
  // With no readable server time there is nothing to say the server is later,
  // so the device's edit stands, as it always did.
  const deviceLater = (time: number | undefined) => !Number.isFinite(serverAt) || (time !== undefined && time > serverAt);
  const out: Partial<Record<CompassColumn, unknown>> = {};
  const keptServer: string[] = [];

  for (const column of touched as Set<CompassColumn>) {
    if (values[column] === undefined) continue;
    const base = decodedBase(column, hint);
    const serverChanged = base !== MISSING && !sameStoredCompassValue(column, base, existing[column]);
    if (serverChanged && !deviceLater(hint.editedAt[column])) { keptServer.push(column); continue; }
    out[column] = values[column];
  }

  // Money is an amount AND the currency it was typed in. Never write one half
  // onto the other half of a different edit: if the device's money and the
  // server's no longer share a currency (or, for a currency change, an amount),
  // the later money edit wins as a whole.
  const moneyTouched = [...AMOUNTS, CURRENCY].filter(column => touched.has(column)) as CompassColumn[];
  const applied = moneyTouched.filter(column => out[column] !== undefined);
  if (applied.length) {
    const amountApplied = applied.some(column => (AMOUNTS as readonly string[]).includes(column));
    const currencyApplied = applied.includes(CURRENCY);
    const contextMoved =
      (amountApplied && !currencyApplied && values[CURRENCY] !== undefined && !sameStoredCompassValue(CURRENCY, values[CURRENCY], existing[CURRENCY]))
      || (currencyApplied && AMOUNTS.some(amount => out[amount] === undefined && values[amount] !== undefined && !sameStoredCompassValue(amount, values[amount], existing[amount])));
    if (contextMoved) {
      const latest = Math.max(...moneyTouched.map(column => hint.editedAt[column] ?? -Infinity));
      if (deviceLater(Number.isFinite(latest) ? latest : undefined)) {
        for (const column of [...AMOUNTS, CURRENCY] as CompassColumn[]) if (values[column] !== undefined) out[column] = values[column];
      } else {
        for (const column of applied) { delete out[column]; keptServer.push(column); }
      }
    } else if (amountApplied && values[CURRENCY] !== undefined) {
      // The currency rides with the amount even when it is unchanged, so a
      // patch that writes an amount always states its unit.
      out[CURRENCY] = values[CURRENCY];
    }
  }

  if (Object.keys(out).length) out.updated_at = now;
  return { values: out, keptServer: [...new Set(keptServer)] };
}

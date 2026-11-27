/**
 * Packed sizes that learn from every shipment (Adrian, 2026-11-27: "like is
 * with like, self improving").
 *
 * The planning allowances in logisticsFreight.ts (8 litres a kilo of loose tea,
 * 3 a kilo pressed, a gaiwan 3 litres...) are where every estimate starts. Each
 * shipment then teaches two things:
 *
 *   - a line whose packed volume was measured, not estimated, is that item's
 *     real size;
 *   - a confirmed bill charged by the cubic metre states the shipment's whole
 *     volume, so the lines nobody measured share what the measured ones leave,
 *     in the proportions the current estimates give them.
 *
 * An estimate then reads, first that has anything: the same tea or piece in
 * earlier shipments, then items of the same kind (loose tea, pressed tea, a
 * gaiwan, a cup, a teapot), then the allowance. Nothing is stored: the sizes are
 * worked out again from the shipments on every read, so a corrected measurement
 * or bill improves every later estimate at once, and a deleted one stops
 * counting. Estimates stay marked as estimates; they never overwrite a figure
 * somebody entered.
 */
import { estimatePackedVolume, type LogisticsFreightInput, type PackedItemKind } from './logisticsFreight';

export type PackingUnit = 'g' | 'unit';

const PRESSED = new Set(['Cake', 'Tuo', 'Brick', 'Ball', 'Rolled']);

/** What kind of item a shipment line is, from the tea's form or the piece's name. */
export function packingKindFor(item: { unit: string; form?: unknown; type?: unknown; name?: string | null }): PackedItemKind {
  if (item.unit === 'g') return typeof item.form === 'string' && PRESSED.has(item.form) ? 'pressed_tea' : 'loose_tea';
  const name = String(item.name ?? '').toLowerCase();
  if (/\bgaiwan\b|盖碗|蓋碗/.test(name)) return 'gaiwan';
  if (/\bteapot\b|茶壶|茶壺/.test(name)) return 'teapot';
  if (/\bcups?\b|茶杯|品茗杯/.test(name)) return 'cup';
  return 'other';
}

export interface LearnedSize { m3PerUnit: number; samples: number }

export interface PackingSizes {
  /** Keyed `${productId}|${unit}`. */
  byItem: Record<string, LearnedSize>;
  /** Keyed `${kind}|${unit}`. */
  byKind: Record<string, LearnedSize>;
}

export const NO_PACKING_SIZES: PackingSizes = { byItem: {}, byKind: {} };

export interface PackingLine {
  shipment_id: string;
  product_id: string;
  kind: PackedItemKind;
  unit: string;
  quantity: number;
  volume_m3: number | null;
  volume_estimated: boolean;
  freight: LogisticsFreightInput | null;
}

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Learn sizes from every shipment's lines. */
export function learnPackingSizes(lines: readonly PackingLine[]): PackingSizes {
  const observations: Array<{ product_id: string; kind: PackedItemKind; unit: string; quantity: number; volume: number }> = [];
  const byShipment = new Map<string, PackingLine[]>();
  for (const line of lines) byShipment.set(line.shipment_id, [...(byShipment.get(line.shipment_id) ?? []), line]);
  for (const shipment of byShipment.values()) {
    const usable = shipment.filter(l => positive(l.quantity) && (l.unit === 'g' || l.unit === 'unit'));
    const measured = usable.filter(l => !l.volume_estimated && positive(l.volume_m3));
    for (const l of measured) observations.push({ product_id: l.product_id, kind: l.kind, unit: l.unit, quantity: l.quantity, volume: l.volume_m3! });
    // A confirmed bill by the cubic metre gives the whole volume; the unmeasured lines share what is left.
    const bill = shipment[0].freight;
    const billed = bill?.confirmed && bill.basis === 'm3' && positive(bill.billed_quantity) ? bill.billed_quantity : null;
    const rest = usable.filter(l => !measured.includes(l));
    if (billed === null || rest.length === 0 || rest.length !== shipment.length - measured.length) continue;
    const left = billed - measured.reduce((sum, l) => sum + l.volume_m3!, 0);
    const guesses = rest.map(l => estimatePackedVolume({ kind: l.kind, quantity: l.quantity, unit: l.unit as PackingUnit }).volume_m3);
    const guessed = guesses.reduce<number>((sum, g) => sum + (g ?? 0), 0);
    if (!(left > 0) || !(guessed > 0) || guesses.some(g => !positive(g))) continue;
    rest.forEach((l, i) => observations.push({ product_id: l.product_id, kind: l.kind, unit: l.unit, quantity: l.quantity, volume: left * (guesses[i]! / guessed) }));
  }
  const sizes: PackingSizes = { byItem: {}, byKind: {} };
  const add = (table: Record<string, LearnedSize & { quantity?: number; volume?: number }>, key: string, quantity: number, volume: number) => {
    const t = table[key] as (LearnedSize & { quantity: number; volume: number }) | undefined;
    const next = { quantity: (t?.quantity ?? 0) + quantity, volume: (t?.volume ?? 0) + volume, samples: (t?.samples ?? 0) + 1 };
    table[key] = { ...next, m3PerUnit: next.volume / next.quantity };
  };
  for (const o of observations) {
    if (o.product_id) add(sizes.byItem, `${o.product_id}|${o.unit}`, o.quantity, o.volume);
    add(sizes.byKind, `${o.kind}|${o.unit}`, o.quantity, o.volume);
  }
  // Keep only the rate and the count; the running sums were for the weighting.
  for (const table of [sizes.byItem, sizes.byKind]) for (const key of Object.keys(table)) table[key] = { m3PerUnit: table[key].m3PerUnit, samples: table[key].samples };
  return sizes;
}

export type PackingBasis = 'this item' | 'like items' | 'allowance';

/** A packed volume for this many grams or pieces, from the closest thing the shop has learned. */
export function estimateVolume(
  item: { product_id?: string | null; kind: PackedItemKind; quantity: number; unit: PackingUnit },
  sizes: PackingSizes = NO_PACKING_SIZES,
): { volume_m3: number | null; estimated: true; basis: PackingBasis; samples: number; note: string } {
  const round = (v: number) => Math.round(v * 1_000_000) / 1_000_000;
  const own = item.product_id ? sizes.byItem[`${item.product_id}|${item.unit}`] : undefined;
  if (own && Number.isFinite(item.quantity) && item.quantity >= 0) {
    return { volume_m3: round(item.quantity * own.m3PerUnit), estimated: true as const, basis: 'this item', samples: own.samples, note: `From ${own.samples === 1 ? 'one earlier shipment' : `${own.samples} earlier shipments`} of this item.` };
  }
  const like = sizes.byKind[`${item.kind}|${item.unit}`];
  if (like && item.kind !== 'other' && Number.isFinite(item.quantity) && item.quantity >= 0) {
    return { volume_m3: round(item.quantity * like.m3PerUnit), estimated: true as const, basis: 'like items', samples: like.samples, note: `From ${like.samples === 1 ? 'one earlier shipment' : `${like.samples} shipments`} of similar items.` };
  }
  const allowance = estimatePackedVolume(item);
  return { volume_m3: allowance.volume_m3, estimated: true as const, basis: 'allowance', samples: 0, note: allowance.note };
}

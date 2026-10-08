/**
 * Applying the ticked parts of "What you said" to a tea. The worker files a
 * recording into parts (src: worker/src/curateSaidFiling.ts); this turns the
 * ticked ones into the tea's own fields, the fast tasting's own words, its
 * notes and to-dos. A part that would overwrite something already entered
 * leaves it, so a recording never quietly changes a price that was typed.
 */
import { canonicalCurrency } from '../../lib/currency';
import { applyFast, linePriceFields, readFast, type FastQuestion } from './curateV2Model';
import type { TeaCompassEntry, TeaType, TeaForm, Season } from './types';

export type SaidKind = 'tea' | 'price' | 'taste' | 'story' | 'vendor' | 'todo';
export interface SaidPart { kind: SaidKind; text: string; fields: Record<string, any> }

export const SAID_LABEL: Record<SaidKind, string> = {
  tea: 'Tea', price: 'Price', taste: 'Taste', story: 'Story', vendor: 'Vendor', todo: 'To do',
};

const TYPES: TeaType[] = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal'] as TeaType[];

export function applySaidParts(entry: TeaCompassEntry, parts: readonly SaidPart[]): { updates: Partial<TeaCompassEntry>; todos: string[] } {
  const updates: Partial<TeaCompassEntry> = {};
  const todos: string[] = [];
  const notes: string[] = [];
  let tasting = entry.tasting;
  for (const p of parts) {
    const f = p.fields ?? {};
    if (p.kind === 'tea') {
      if (f.year && entry.year == null) updates.year = Number(f.year);
      if (f.season && !entry.season) updates.season = f.season as Season;
      if (f.form && !entry.form) updates.form = f.form as TeaForm;
      if (f.origin_region && !entry.originRegion) updates.originRegion = String(f.origin_region);
      const type = TYPES.find((t) => String(f.type ?? '').toLowerCase().includes(t.toLowerCase()));
      if (type && !entry.type) updates.type = type;
    }
    if (p.kind === 'price' && entry.priceAmount == null && f.amount != null) {
      const currency = canonicalCurrency(f.currency) ?? undefined;
      Object.assign(updates, linePriceFields({ amount: Number(f.amount), currency, unit: f.per, rest: '' }));
    }
    if (p.kind === 'taste') {
      const set = (q: FastQuestion, id: string) => { if (!readFast(tasting)[q].includes(id)) tasting = applyFast(tasting, q, id); };
      if (f.score != null && readFast(tasting).score.length === 0) set('score', String(f.score));
      for (const [k, q] of [['clean', 'clean'], ['drying', 'drying'], ['weight', 'weight'], ['stays', 'stays']] as const) {
        if (f[k] && readFast(tasting)[q].length === 0) set(q, String(f[k]));
      }
      for (const fl of (Array.isArray(f.flavours) ? f.flavours : [])) set('flavour', String(fl));
    }
    if (p.kind === 'story') notes.push(p.text);
    if (p.kind === 'vendor') notes.push(`Vendor: ${p.text}`);
    if (p.kind === 'todo') todos.push(p.text);
  }
  if (tasting !== entry.tasting) updates.tasting = tasting;
  if (notes.length) updates.notes = [entry.notes?.trim(), ...notes].filter(Boolean).join('\n');
  return { updates, todos };
}

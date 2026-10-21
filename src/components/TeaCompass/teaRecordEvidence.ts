import type { Note } from '../../lib/notesStore';
import { knownCurrency, sameCurrency } from '../../lib/currency';
import { applySaidParts, type SaidPart } from '../CurateV2/saidFiling';
import type { TeaCompassEntry } from './types';
import { TEA_FORMS, SEASONS } from '../../wisdom';

export interface TeaRecordEvidence {
  id: string;
  text: string;
  sources: Array<{ id: string; label: string; at?: string }>;
}
export interface TeaRecordFact {
  id: string;
  label: string;
  patch: Partial<TeaCompassEntry>;
  partIndex: number;
  quote: boolean;
}
export interface TeaRecordAssistantScope { accountId: string | null; userId: string | null; revision: number; entryId: string }
export const teaRecordScopeMatches = (a: TeaRecordAssistantScope, b: TeaRecordAssistantScope) =>
  a.accountId === b.accountId && a.userId === b.userId && a.revision === b.revision && a.entryId === b.entryId;

/** Identical text is sent once; each place it came from remains attributed. */
export function collectTeaRecordEvidence(entry: TeaCompassEntry, notes: readonly Note[], accountId: string, linkedSources: readonly { id: string; title: string; text: string }[] = []): TeaRecordEvidence[] {
  const records = new Map<string, TeaRecordEvidence>();
  const add = (text: string | undefined, source: TeaRecordEvidence['sources'][number]) => {
    const clean = text?.trim();
    if (!clean) return;
    const existing = records.get(clean);
    if (existing) existing.sources.push(source);
    else records.set(clean, { id: source.id, text: clean, sources: [source] });
  };
  add(entry.notes, { id: `entry:${entry.id}`, label: 'Tea notes' });
  for (const [index, clip] of (entry.audioClips ?? []).entries()) {
    add(clip.transcript, { id: `clip:${index}:${clip.timestamp}`, label: 'Voice transcript', at: clip.timestamp });
  }
  for (const note of notes) {
    const linked = note.compassEntryId === entry.id || (!!entry.teaKey && note.teaKey === entry.teaKey);
    if (note.deleted || note.accountId !== accountId || !linked) continue;
    add(note.text, { id: `note:${note.id}`, label: `${note.sourceType === 'voice' ? 'Voice note' : note.sourceType === 'vendor' ? 'Vendor note' : note.sourceType === 'tasting' ? 'Tasting note' : 'Written note'}${note.authorName ? ` · ${note.authorName}` : ''}`, at: note.createdAt });
  }
  for (const link of linkedSources) add(link.text, { id: `ar:${link.id}`, label: `AR Create · ${link.title}` });
  return [...records.values()];
}

/** fileSaid reads at most 4,000 characters. Share that space among sources and
 * explicitly report shortened material rather than silently losing the tail. */
export function teaRecordExtractionText(evidence: readonly TeaRecordEvidence[], maxCharacters = 4000): { text: string; shortened: boolean; reviewedIds: string[] } {
  const included = Number.isFinite(maxCharacters) ? evidence.slice(0, 24) : evidence;
  if (!included.length) return { text: '', shortened: false, reviewedIds: [] };
  const headers = included.map((item, index) => `[Source ${index + 1}: ${item.sources.map(source => source.label).join('; ').replace(/\s+/g, ' ').slice(0, 100)}]\n`);
  const budget = Math.max(0, Math.floor((maxCharacters - headers.reduce((total, header) => total + header.length + 2, 0)) / included.length));
  return {
    text: included.map((item, index) => headers[index] + item.text.slice(0, budget)).join('\n\n'),
    shortened: evidence.length !== included.length || included.some(item => item.text.length > budget),
    reviewedIds: included.map(item => item.id),
  };
}

const present = (value: unknown) => value != null && (typeof value !== 'string' || value.trim() !== '');
const fieldLabels: Partial<Record<keyof TeaCompassEntry, string>> = { year: 'Year', season: 'Season', form: 'Form', originRegion: 'Origin', type: 'Tea type' };
const quoteUnit = (entry: Partial<TeaCompassEntry>) => entry.pricePerUnitGrams != null ? `${entry.pricePerUnitGrams}g` : entry.form ? entry.form.toLowerCase() : 'quote';

function quoteFits(entry: TeaCompassEntry, patch: Partial<TeaCompassEntry>): boolean {
  if (entry.priceAmount != null) return false;
  const enteredCurrency = entry.touchedFields === undefined
    ? !!knownCurrency(entry.priceCurrency) && entry.priceCurrency !== 'UNK'
    : entry.touchedFields.includes('priceCurrency');
  if (enteredCurrency && !sameCurrency(entry.priceCurrency, patch.priceCurrency)) return false;
  if (entry.pricePerUnitGrams != null && entry.pricePerUnitGrams !== patch.pricePerUnitGrams) return false;
  if (present(entry.form) && present(patch.form) && entry.form !== patch.form) return false;
  return true;
}

/** Keep the existing filing semantics for identity and price. Tasting, story,
 * vendor and tasks remain source material: this assistant cannot write them. */
export function suggestTeaRecordFacts(entry: TeaCompassEntry, parts: readonly SaidPart[]): TeaRecordFact[] {
  const facts: TeaRecordFact[] = [];
  parts.forEach((part, partIndex) => {
    if (part.kind === 'tea') {
      const { updates } = applySaidParts(entry, [part]);
      for (const key of Object.keys(fieldLabels) as Array<keyof typeof fieldLabels>) {
        const value = updates[key];
        if (!present(value)) continue;
        if (key === 'year' && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > new Date().getFullYear() + 1)) continue;
        if (key === 'season' && !SEASONS.includes(value as never)) continue;
        if (key === 'form' && !TEA_FORMS.includes(value as never)) continue;
        const patch = { [key]: value } as Partial<TeaCompassEntry>;
        facts.push({ id: `${partIndex}:${key}`, label: `${fieldLabels[key]}: ${String(value)}`, patch, partIndex, quote: false });
      }
    } else if (part.kind === 'price') {
      const amount = part.fields?.amount;
      const currency = knownCurrency(part.fields?.currency);
      if (amount === '' || amount == null || !Number.isFinite(Number(amount)) || Number(amount) < 0 || !currency || currency === 'UNK') return;
      const { updates } = applySaidParts(entry, [{ ...part, fields: { ...part.fields, amount: Number(amount), currency } }]);
      if (updates.priceAmount == null || !quoteFits(entry, updates)) return;
      facts.push({ id: `${partIndex}:quote`, label: `Quoted price: ${updates.priceAmount} ${updates.priceCurrency} / ${quoteUnit(updates)}`, patch: updates, partIndex, quote: true });
    }
  });
  return facts;
}

/** Recheck the live record when Apply is pressed. A newer manual answer wins,
 * including zero, and a quote is applied together or left entirely alone. */
export function applyReviewedTeaFacts(entry: TeaCompassEntry, facts: readonly TeaRecordFact[], selectedIds: readonly string[]): Partial<TeaCompassEntry> {
  const selected = new Set(selectedIds);
  const updates: Partial<TeaCompassEntry> = {};
  for (const fact of facts) {
    if (!selected.has(fact.id)) continue;
    const current = { ...entry, ...updates };
    if (fact.quote) {
      if (quoteFits(current, fact.patch)) Object.assign(updates, fact.patch);
      continue;
    }
    for (const [key, value] of Object.entries(fact.patch)) {
      if (!(key in fieldLabels) || present(current[key as keyof TeaCompassEntry])) continue;
      Object.assign(updates, { [key]: value });
    }
  }
  return updates;
}

export interface TeaRecordReview {
  scope: TeaRecordAssistantScope;
  evidence: TeaRecordEvidence[];
  request: ReturnType<typeof teaRecordExtractionText>;
  parts: SaidPart[];
  facts: TeaRecordFact[];
}

/** One request, no writes. A response for an abandoned record or identity never
 * becomes a preview in the next shop or signed-in user's workspace. */
export async function loadTeaRecordReview(
  entry: TeaCompassEntry,
  notes: readonly Note[],
  scope: TeaRecordAssistantScope,
  currentScope: () => TeaRecordAssistantScope,
  extract: (input: { text: string; tea_name?: string }) => Promise<{ parts: SaidPart[] }>,
  selectedEvidence?: TeaRecordEvidence[],
): Promise<TeaRecordReview | null> {
  if (!scope.accountId || !scope.userId || scope.entryId !== entry.id || !teaRecordScopeMatches(scope, currentScope())) return null;
  const evidence = selectedEvidence ?? collectTeaRecordEvidence(entry, notes, scope.accountId);
  const request = teaRecordExtractionText(evidence, Infinity);
  if (request.text.length > 4000) throw new Error('Choose fewer sources or shorten an excerpt to fit 4,000 characters.');
  if (!request.text) return { scope, evidence, request, parts: [], facts: [] };
  const result = await extract({ text: request.text, tea_name: entry.name || undefined });
  if (!teaRecordScopeMatches(scope, currentScope())) return null;
  const parts = (Array.isArray(result.parts) ? result.parts : []).filter(part =>
    part && ['tea', 'price', 'taste', 'story', 'vendor', 'todo'].includes(part.kind) && typeof part.text === 'string'
  ).slice(0, 12).map(part => ({ ...part, fields: part.fields && typeof part.fields === 'object' ? part.fields : {} }));
  return { scope, evidence, request, parts, facts: suggestTeaRecordFacts(entry, parts) };
}

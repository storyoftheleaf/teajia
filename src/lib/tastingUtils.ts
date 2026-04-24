import type { TastingData } from '../types';
import { resolveTermLabel } from '../data/tastingTaxonomy';

/**
 * Derive a mood string from feeling terms in tasting data.
 * e.g. ['calming', 'grounding'] → "Calming & Grounding"
 */
export function deriveMoodFromFeeling(tasting: TastingData): string {
  const feelings = tasting.feeling || [];
  if (feelings.length === 0) return '';
  const labels = feelings.map(id => resolveTermLabel(id));
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return labels.slice(0, -1).join(', ') + ' & ' + labels[labels.length - 1];
}

/**
 * Derive tastingNotes string array from flavor terms
 */
export function deriveFlavorNotes(tasting: TastingData): string[] {
  const flavorTerms = tasting.flavor || [];
  return flavorTerms.map(id => resolveTermLabel(id));
}

/**
 * Build the payload fields that should auto-sync when saving tasting data.
 * Returns DB-column-named fields ({ mood, tasting_notes }) so the worker's
 * UPDATE allowlist accepts them. Previously emitted camelCase keys which
 * were silently filtered out by the allowlist.
 */
export function buildTastingSyncPayload(tasting: TastingData): { mood?: string; tasting_notes?: string[] } {
  const result: { mood?: string; tasting_notes?: string[] } = {};
  const mood = deriveMoodFromFeeling(tasting);
  if (mood) result.mood = mood;
  const notes = deriveFlavorNotes(tasting);
  if (notes.length > 0) result.tasting_notes = notes;
  return result;
}

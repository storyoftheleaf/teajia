import type { NoteEntry, TastingData } from '../types';

let counter = 0;
function generateId(): string {
  counter += 1;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  return `note-${Date.now()}-${counter}`;
}

/**
 * Normalizes the polymorphic notes array on TastingData into a consistent
 * list of NoteEntry objects. Plain strings from legacy records are wrapped
 * with a generated id so editing and starring have a stable handle.
 */
export function normalizeNotes(tasting: TastingData | undefined | null): NoteEntry[] {
  if (!tasting?.notes?.length) return [];
  return tasting.notes.map((raw): NoteEntry => {
    if (typeof raw === 'string') {
      return { id: generateId(), text: raw };
    }
    return {
      id: raw.id || generateId(),
      text: raw.text ?? '',
      starred: raw.starred,
      section: raw.section,
      capturedAt: raw.capturedAt,
      sourceAuthor: raw.sourceAuthor,
      sourceJournalEntryId: raw.sourceJournalEntryId,
    };
  });
}

/** Replaces the notes array on a tasting object with a normalized version. */
export function withNotes(tasting: TastingData, notes: NoteEntry[]): TastingData {
  return { ...tasting, notes };
}

/** Returns only the starred (published) notes, preserving order. */
export function starredNotes(tasting: TastingData | undefined | null): NoteEntry[] {
  return normalizeNotes(tasting).filter(n => n.starred);
}

/** Create a fresh captured note, optionally tagged with a section. */
export function makeNote(text: string, section?: NoteEntry['section']): NoteEntry {
  return {
    id: generateId(),
    text,
    section,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Returns the plain text content of every note in tasting.notes, losing the
 * structured metadata. Use this when feeding notes into legacy APIs (server
 * fields typed as string[] like tea_reviews.voice_notes) or when rendering
 * a simple bullet list that doesn't need star/section info.
 */
export function notesAsStrings(tasting: TastingData | undefined | null): string[] {
  return normalizeNotes(tasting).map(n => n.text).filter(Boolean);
}

import React from 'react';
import type { NoteEntry, TastingData } from '../../types';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { Button } from '../shared/Button';
import { impressionNotes } from './YourImpression';

/**
 * The shop's own notes on a tea, each with one choice: show it on the tea page
 * as a Curator's note, signed "Tjia, curator", or keep it private (Adrian,
 * 2026-11-24). Only the shop's own words are offered; a note promoted from a
 * customer keeps its own attribution elsewhere and is never offered here.
 * The choice is saved with the tasting, like every other change in the editor.
 */
export function curatorCandidates(value: TastingData): NoteEntry[] {
  return impressionNotes(value).filter((note): note is NoteEntry =>
    typeof note !== 'string' && Boolean(note.text?.trim()) && !note.sourceAuthor && !note.sourceJournalEntryId);
}

export function setCuratorNote(value: TastingData, id: string, shown: boolean): TastingData {
  return {
    ...value,
    notes: impressionNotes(value).map(note => typeof note !== 'string' && note.id === id ? { ...note, starred: shown || undefined } : note),
  };
}

export const CuratorNotesChoice: React.FC<{ value: TastingData; onChange: (next: TastingData) => void }> = ({ value, onChange }) => {
  const notes = curatorCandidates(value);
  if (!notes.length) return null;
  return (
    <section aria-label="Curator’s notes" className="curator-choice mx-4 mt-[var(--space-4)] grid gap-[var(--space-2)]" data-testid="curator-choice">
      <h3 className={`${TYPOGRAPHY_CLASSES.label} m-0 text-tea-gold`}>Curator&rsquo;s notes</h3>
      <p className="m-0 text-ui-13 text-tea-text-sec">Chosen notes show on the tea page, signed Tjia, curator.</p>
      <ul className="m-0 grid list-none gap-[var(--space-2)] p-0">
        {notes.map(note => (
          <li key={note.id} className="curator-choice__row">
            <p className="m-0 min-w-0 break-words text-ui-14 italic text-tea-text">{note.text}</p>
            <Button variant="quiet" size="sm" type="button" aria-pressed={Boolean(note.starred)}
              onClick={() => onChange(setCuratorNote(value, note.id, !note.starred))}>
              {note.starred ? 'On the tea page' : 'Show on the tea page'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};

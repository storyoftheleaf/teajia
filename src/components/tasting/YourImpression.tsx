import React, { useId } from 'react';
import type { NoteEntry, TastingData } from '../../types';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export const IMPRESSION_NOTE_ID = 'personal-impression-draft';

/** One private draft, leaving legacy and curated notes in their original shape. */
export function impressionNoteText(value: TastingData): string {
  const draft = value.notes?.find((note): note is NoteEntry => typeof note !== 'string' && note.id === IMPRESSION_NOTE_ID);
  return draft?.text ?? '';
}

export function updateImpressionNote(value: TastingData, text: string): TastingData {
  const notes = value.notes ?? [];
  const index = notes.findIndex(note => typeof note !== 'string' && note.id === IMPRESSION_NOTE_ID);
  if (index < 0) {
    if (!text) return value;
    return { ...value, notes: [...notes, { id: IMPRESSION_NOTE_ID, text, section: 'general', capturedAt: new Date().toISOString() }] };
  }
  return { ...value, notes: notes.map((note, i) => i === index ? { ...(note as NoteEntry), text } : note) };
}

/** Voice and typed notes write the same draft, without flattening note provenance. */
export function appendImpressionTranscript(value: TastingData, transcript: string): TastingData {
  const addition = transcript.trim();
  if (!addition) return value;
  const current = impressionNoteText(value);
  return updateImpressionNote(value, current ? `${current.trimEnd()}\n\n${addition}` : addition);
}

export interface YourImpressionProps {
  value: TastingData;
  onChange: (value: TastingData) => void;
  verdict: 'love' | 'like' | 'neutral' | 'pass' | null;
  onVerdict: (verdict: YourImpressionProps['verdict']) => void;
  wouldBuy: boolean;
  onWouldBuy: (value: boolean) => void;
  inCollection: boolean;
  onCollection: () => void;
  selections: Array<{ id: string; label: string; words: Array<{ id: string; label: string }> }>;
  onResume: (section: string, word?: string) => void;
  onSaveNotes?: () => void;
  canSaveNotes?: boolean;
  savingNotes?: boolean;
  notesSaveError?: boolean;
  notesSaveHint?: string;
}

export function YourImpression({ value, onChange, verdict, onVerdict, wouldBuy, onWouldBuy, inCollection, onCollection, selections, onResume, onSaveNotes, canSaveNotes = false, savingNotes = false, notesSaveError = false, notesSaveHint }: YourImpressionProps) {
  const notesId = useId();
  const rating = value.quality;
  const historical = (value.notes ?? []).filter(note => typeof note === 'string' || note.id !== IMPRESSION_NOTE_ID);
  const groups = selections.filter(group => group.words.length > 0);
  return <section className="tasting-impression" aria-label="Your impression">
    <div className="tasting-impression-verdicts" role="group" aria-label="Your impression">
      {([['love', 'Love'], ['like', 'Like'], ['neutral', 'Neutral'], ['pass', 'Dislike']] as const).map(([id, label]) =>
        <button type="button" key={id} className="tap-target" aria-pressed={verdict === id} onClick={() => onVerdict(verdict === id ? null : id)}>{label}</button>)}
    </div>
    <div className="tasting-impression-actions">
      <button type="button" className="tap-target" aria-pressed={wouldBuy} onClick={() => onWouldBuy(!wouldBuy)}>Want to purchase this</button>
      <button type="button" className="tap-target" aria-pressed={inCollection} onClick={onCollection}>{inCollection ? 'In my collection' : 'Add to my collection'}</button>
    </div>
    <section className="tasting-impression-rating" aria-label="Rating">
      <div className="tasting-impression-heading"><h3 className={TYPOGRAPHY_CLASSES.label}>Your rating</h3><span className="font-mono text-ui-12">{rating ? `${rating} / 10` : '– / 10'}</span></div>
      <div className="tasting-impression-numbers" role="group" aria-label="Your rating">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <button type="button" key={n} className="tap-target font-sans text-ui-12" aria-label={`Rate ${n} out of 10`} aria-pressed={rating === n} onClick={() => onChange({ ...value, quality: rating === n ? undefined : n })}>{n}</button>)}
      </div>
    </section>
    <div className="tasting-impression-notes">
      <label htmlFor={notesId} className={TYPOGRAPHY_CLASSES.label}>Your notes</label>
      <textarea id={notesId} className={TYPOGRAPHY_CLASSES.bodyLight} rows={4} value={impressionNoteText(value)} onChange={event => onChange(updateImpressionNote(value, event.target.value))} placeholder="Anything you’d like to add…" />
      {onSaveNotes && <div className="tasting-notes-save-row">
        <span className={TYPOGRAPHY_CLASSES.accountMeta} role={notesSaveError ? 'alert' : undefined}>{notesSaveError ? 'Could not save. Please try again.' : notesSaveHint}</span>
        <button type="button" className="tap-target tasting-notes-save" onClick={onSaveNotes} disabled={!canSaveNotes || savingNotes}>{savingNotes ? 'Saving…' : notesSaveError ? 'Retry save notes' : 'Save notes'}</button>
      </div>}
    </div>
    {historical.length > 0 && <details className="tasting-impression-history"><summary className={TYPOGRAPHY_CLASSES.link}>Earlier notes · {historical.length}</summary><div>{historical.map((note, index) => <p className={TYPOGRAPHY_CLASSES.bodyLight} key={typeof note === 'string' ? `legacy-${index}` : note.id}>{typeof note === 'string' ? note : note.text}</p>)}</div></details>}
    {groups.length > 0 && <section className="tasting-impression-recap" aria-label="Your tasting selections">
      <h3 className={TYPOGRAPHY_CLASSES.label}>Your tasting selections</h3>
      {groups.map(group => <div className="tasting-impression-recap-group" key={group.id}>
        <button type="button" className="tasting-impression-group-link tap-target" aria-label={`Resume ${group.label}`} onClick={() => onResume(group.id)}><span>{group.label}</span><span aria-hidden="true">›</span></button>
        <div className="tasting-impression-words">{group.words.map(word => <button type="button" className="tap-target" key={word.id} aria-label={`Edit ${word.label}`} onClick={() => onResume(group.id, word.id)}>{word.label}</button>)}</div>
      </div>)}
    </section>}
  </section>;
}

import React, { useId } from 'react';
import type { NoteEntry, TastingData } from '../../types';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export const IMPRESSION_NOTE_ID = 'personal-impression-draft';

/**
 * The notes as a list. A quick tasting, and every tasting written before notes
 * became a list, stores them as one string ("kept words"); reading that string
 * as a list threw in .filter and took the whole full tasting down. A string is
 * one legacy note, kept as written.
 */
export function impressionNotes(value: TastingData): Array<string | NoteEntry> {
  const notes = value.notes as unknown;
  if (Array.isArray(notes)) return notes as Array<string | NoteEntry>;
  return typeof notes === 'string' && notes.trim() ? [notes] : [];
}

/** One private draft, leaving legacy and curated notes in their original shape. */
export function impressionNoteText(value: TastingData): string {
  const draft = impressionNotes(value).find((note): note is NoteEntry => typeof note !== 'string' && note.id === IMPRESSION_NOTE_ID);
  return draft?.text ?? '';
}

export function updateImpressionNote(value: TastingData, text: string): TastingData {
  const notes = impressionNotes(value);
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

/**
 * One tasting per tea, as many notes as the person likes. The draft being
 * written is the note with IMPRESSION_NOTE_ID. When a tasting is opened on a
 * later day, the earlier draft is sealed under its own id, so it stays as a
 * dated note and today's words start a new one.
 */
export function sealEarlierDraft(value: TastingData, now: Date = new Date()): TastingData {
  const notes = impressionNotes(value);
  const index = notes.findIndex(note => typeof note !== 'string' && note.id === IMPRESSION_NOTE_ID);
  if (index < 0) return value;
  const draft = notes[index] as NoteEntry;
  const written = draft.capturedAt ? new Date(draft.capturedAt) : null;
  if (!written || Number.isNaN(written.getTime()) || written.toDateString() === now.toDateString()) return value;
  const sealed = { ...draft, id: `${IMPRESSION_NOTE_ID}-${draft.capturedAt}` };
  return { ...value, notes: notes.map((note, i) => i === index ? sealed : note) };
}

/** "12 November 2026", or nothing when the note carries no usable date. */
export function noteDateLabel(capturedAt?: string): string {
  if (!capturedAt) return '';
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function TastingRatingRow({ label, rating, onChange }: {
  label: string;
  rating?: number;
  onChange: (rating: number | undefined) => void;
}) {
  return (
    <section className="tasting-impression-rating" aria-label={label}>
      <div className="tasting-impression-heading">
        <h3 className={TYPOGRAPHY_CLASSES.label}>{label}</h3>
        <span className="font-mono text-ui-12">{rating ? `${rating} / 10` : '– / 10'}</span>
      </div>
      <div className="tasting-impression-numbers" role="group" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button type="button" key={n} className="tap-target font-sans text-ui-12"
            aria-label={`Rate ${n} out of 10`} aria-pressed={rating === n}
            onClick={() => onChange(rating === n ? undefined : n)}>{n}</button>
        ))}
      </div>
    </section>
  );
}

export function ImpressionNoteField({ label, value, onChange, rows = 4, children }: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  rows?: number;
  children?: React.ReactNode;
}) {
  const notesId = useId();
  return (
    <div className="tasting-impression-notes">
      <label htmlFor={notesId} className={TYPOGRAPHY_CLASSES.label}>{label}</label>
      <textarea id={notesId} className={TYPOGRAPHY_CLASSES.bodyLight} rows={rows} value={value}
        onChange={event => onChange(event.target.value)} placeholder="Anything you’d like to add…" />
      {children}
    </div>
  );
}

interface ImpressionControlsProps {
  value: TastingData;
  ratingLabel?: string;
  collectionUnavailable?: boolean;
  onChange: (value: TastingData) => void;
  verdict: 'love' | 'like' | 'neutral' | 'pass' | null;
  onVerdict: (verdict: ImpressionControlsProps['verdict']) => void;
  wouldBuy: boolean;
  onWouldBuy: (value: boolean) => void;
  inCollection: boolean;
  onCollection: () => void;
}

export function ImpressionControls({
  value, onChange, verdict, onVerdict, wouldBuy, onWouldBuy, inCollection, onCollection,
  ratingLabel = 'Your rating', collectionUnavailable,
}: ImpressionControlsProps) {
  return <>
    <div className="tasting-impression-verdicts" role="group" aria-label="Your impression">
      {([['love', 'Love'], ['like', 'Like'], ['neutral', 'Neutral'], ['pass', 'Dislike']] as const).map(([id, label]) =>
        <button type="button" key={id} className="tap-target" aria-pressed={verdict === id} onClick={() => onVerdict(verdict === id ? null : id)}>{label}</button>)}
    </div>
    <div className="tasting-impression-actions">
      <button type="button" className="tap-target" aria-pressed={wouldBuy} onClick={() => onWouldBuy(!wouldBuy)}>Want to purchase this</button>
      <button type="button" className="tap-target" aria-pressed={inCollection} onClick={onCollection}
        disabled={collectionUnavailable} title={collectionUnavailable ? 'This tea is not listed in the shop' : undefined}>
        {inCollection ? 'In my collection' : 'Add to my collection'}
      </button>
    </div>
    {ratingLabel === 'Overall' && value.rating != null && !value.quality && (
      <p className={TYPOGRAPHY_CLASSES.accountMeta}>Previous rating {value.rating} / 5</p>
    )}
    <TastingRatingRow label={ratingLabel} rating={value.quality} onChange={quality => onChange({ ...value, quality })} />
  </>;
}

export interface YourImpressionProps extends ImpressionControlsProps {
  sessionSharedNote?: string;
  notesLabel?: string;
  selections: Array<{ id: string; label: string; words: Array<{ id: string; label: string }> }>;
  onResume: (section: string, word?: string) => void;
  onSaveNotes?: () => void;
  canSaveNotes?: boolean;
  savingNotes?: boolean;
  notesSaveError?: boolean;
  notesSaveHint?: string;
  voiceState?: 'idle' | 'recording' | 'transcribing';
  voiceError?: string;
  /** The "Your photographs" row, placed above the notes in the same label and box style. */
  photographRow?: React.ReactNode;
  /** One line under the notes box. */
  notesNotice?: string;
}

export function YourImpression({ value, ratingLabel, collectionUnavailable, sessionSharedNote, notesLabel = 'Your notes', onChange, verdict, onVerdict, wouldBuy, onWouldBuy, inCollection, onCollection, selections, onResume, onSaveNotes, canSaveNotes = false, savingNotes = false, notesSaveError = false, notesSaveHint, voiceState = 'idle', voiceError, photographRow, notesNotice }: YourImpressionProps) {
  const historical = impressionNotes(value).filter(note => typeof note === 'string' || note.id !== IMPRESSION_NOTE_ID);
  const groups = selections.filter(group => group.words.length > 0);
  return <section className="tasting-impression" aria-label="Your impression">
    <ImpressionControls value={value} onChange={onChange} verdict={verdict} onVerdict={onVerdict}
      wouldBuy={wouldBuy} onWouldBuy={onWouldBuy} inCollection={inCollection} onCollection={onCollection}
      ratingLabel={ratingLabel} collectionUnavailable={collectionUnavailable} />
    {sessionSharedNote?.trim() && (
      <section className="tasting-impression-history mb-4" aria-label="Quick tasting note for the host">
        <h3 className={TYPOGRAPHY_CLASSES.label}>Quick tasting note for the host</h3>
        <p className={TYPOGRAPHY_CLASSES.bodyLight}>{sessionSharedNote}</p>
      </section>
    )}
    {photographRow}
    <ImpressionNoteField label={notesLabel} value={impressionNoteText(value)} onChange={text => onChange(updateImpressionNote(value, text))}>
      {notesNotice && <p className={`${TYPOGRAPHY_CLASSES.accountMeta} tasting-impression-notice`}>{notesNotice}</p>}
      {(voiceError || voiceState !== 'idle') && <p className={TYPOGRAPHY_CLASSES.accountMeta} role={voiceError ? 'alert' : 'status'}>{voiceError || (voiceState === 'recording' ? 'Recording… Tap the microphone to finish.' : 'Adding your words…')}</p>}
      {onSaveNotes && <div className="tasting-notes-save-row">
        <span className={TYPOGRAPHY_CLASSES.accountMeta} role={notesSaveError ? 'alert' : undefined}>{notesSaveError ? 'Could not save. Please try again.' : notesSaveHint}</span>
        <button type="button" className="tap-target tasting-notes-save" onClick={onSaveNotes} disabled={!canSaveNotes || savingNotes}>{savingNotes ? 'Saving…' : notesSaveError ? 'Retry save notes' : 'Save notes'}</button>
      </div>}
    </ImpressionNoteField>
    {historical.length > 0 && <section className="tasting-impression-history" aria-label="Earlier notes"><h3 className={TYPOGRAPHY_CLASSES.label}>Earlier notes</h3>{historical.map((note, index) => {
      const date = typeof note === 'string' ? '' : noteDateLabel(note.capturedAt);
      return <div key={typeof note === 'string' ? `legacy-${index}` : note.id}>
        {date && <time className={TYPOGRAPHY_CLASSES.accountMeta} dateTime={(note as NoteEntry).capturedAt}>{date}</time>}
        <p className={TYPOGRAPHY_CLASSES.bodyLight}>{typeof note === 'string' ? note : note.text}</p>
      </div>;
    })}</section>}
    {groups.length > 0 && <section className="tasting-impression-recap" aria-label="Your tasting selections">
      <h3 className={TYPOGRAPHY_CLASSES.label}>Your tasting selections</h3>
      {groups.map(group => <div className="tasting-impression-recap-group" key={group.id}>
        <button type="button" className="tasting-impression-group-link tap-target" aria-label={`Resume ${group.label}`} onClick={() => onResume(group.id)}><span>{group.label}</span><span aria-hidden="true">›</span></button>
        <div className="tasting-impression-words">{group.words.map(word => <button type="button" className="tap-target" key={word.id} aria-label={`Edit ${word.label}`} onClick={() => onResume(group.id, word.id)}>{word.label}</button>)}</div>
      </div>)}
    </section>}
  </section>;
}
